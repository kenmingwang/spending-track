import { CardBenefitManager } from './card-benefits';
import { Transaction } from '../types';
import { normalizeCategory } from './category-overrides';

export interface RewardOutcome {
  points: number;
  miles: number;
  cashback: number;
  rewardType: 'points' | 'miles' | 'cashback';
  trackedSpend: number;
  trackedFourMpdSpend: number;
}

export class TransactionCalculator {
  static readonly HSBC_TRACKED_CATEGORIES = [
    'Dining',
    'Travel',
    'Transport',
    'Shopping',
    'Fashion',
    'Entertainment',
    'Memberships'
  ] as const;

  private static sortTransactionsForCapProcessing(transactions: Transaction[]) {
    return transactions
      .map((transaction, index) => ({
        transaction,
        index,
        time: Number.isNaN(new Date(transaction.date).getTime()) ? 0 : new Date(transaction.date).getTime(),
        originalIndex: transaction.originalIndex ?? index,
      }))
      .sort((a, b) => a.time - b.time || a.originalIndex - b.originalIndex || a.index - b.index);
  }

  static calculateRewardOutcomes(
    transactions: Transaction[],
    cardId: string,
    userElections: string[] | null = null
  ) {
    const outcomes = new Map<Transaction, RewardOutcome>();
    const card = CardBenefitManager.getCardConfig(cardId);
    const baseMpd = card?.fallbackMPD ?? 0.4;
    const effectiveElections = CardBenefitManager.getEffectiveUserElections(cardId, userElections);
    const orderedTransactions = this.sortTransactionsForCapProcessing(transactions);

    if (cardId === 'DBS_WWMC') {
      let remainingOnlineCap = CardBenefitManager.getCardTotalCap(cardId);

      orderedTransactions.forEach(({ transaction }) => {
        const amount = Math.abs(transaction.amount);
        const eligibility = CardBenefitManager.isTransactionEligible(transaction, cardId, effectiveElections);
        const totalMpd = eligibility.eligible ? eligibility.mpd : baseMpd;
        const basePoints = Math.floor(amount / 5);
        const bonusMultiplier = Math.max(0, (totalMpd / baseMpd) - 1);
        const trackedSpend = eligibility.eligible && eligibility.mpd >= 4
          ? Math.min(amount, remainingOnlineCap)
          : eligibility.eligible && totalMpd > baseMpd
            ? amount
            : 0;
        const trackedFourMpdSpend = eligibility.eligible && eligibility.mpd >= 4 ? trackedSpend : 0;

        if (trackedFourMpdSpend > 0) {
          remainingOnlineCap = Math.max(0, remainingOnlineCap - trackedFourMpdSpend);
        }

        const bonusPoints = Math.floor((trackedSpend / 5) * bonusMultiplier);
        const totalPoints = basePoints + bonusPoints;
        outcomes.set(transaction, {
          points: totalPoints,
          miles: totalPoints * 2,
          cashback: 0,
          rewardType: 'points',
          trackedSpend,
          trackedFourMpdSpend,
        });
      });

      return outcomes;
    }

    if (cardId === 'DBS_LIVE_FRESH') {
      const monthRetailSpend: Record<string, number> = {};
      orderedTransactions.forEach(({ transaction }) => {
        if (this.isNonRetailTransaction(transaction)) return;
        const key = this.getMonthKey(transaction.date);
        if (!key) return;
        monthRetailSpend[key] = (monthRetailSpend[key] || 0) + Math.abs(transaction.amount);
      });

      const monthlyEligibleCashbackUsed: Record<string, number> = {};
      orderedTransactions.forEach(({ transaction }) => {
        const amount = Math.abs(transaction.amount);
        const monthKey = this.getMonthKey(transaction.date);
        const eligibility = CardBenefitManager.isTransactionEligible(transaction, cardId, effectiveElections);
        const qualifiesForBonus = (monthRetailSpend[monthKey] || 0) >= 600;
        const retail = !this.isNonRetailTransaction(transaction);

        if (!retail) {
          outcomes.set(transaction, {
            points: 0,
            miles: 0,
            cashback: 0,
            rewardType: 'cashback',
            trackedSpend: 0,
            trackedFourMpdSpend: 0,
          });
          return;
        }

        let cashback = amount * 0.003;
        let trackedSpend = 0;

        if (eligibility.eligible && qualifiesForBonus) {
          const used = monthlyEligibleCashbackUsed[monthKey] || 0;
          const remainingCap = Math.max(0, 60 - used);
          const fullRateCashback = amount * 0.05;
          const fullRateCashbackApplied = Math.min(fullRateCashback, remainingCap);
          const fullRateSpend = fullRateCashbackApplied / 0.05;
          const baseOnlySpend = Math.max(0, amount - fullRateSpend);
          cashback = fullRateCashbackApplied + (baseOnlySpend * 0.003);
          trackedSpend = fullRateSpend;
          monthlyEligibleCashbackUsed[monthKey] = used + fullRateCashbackApplied;
        }

        outcomes.set(transaction, {
          points: 0,
          miles: 0,
          cashback: Math.floor(cashback * 100) / 100,
          rewardType: 'cashback',
          trackedSpend,
          trackedFourMpdSpend: trackedSpend,
        });
      });

      return outcomes;
    }

    if (cardId === 'UOB_LADYS') {
      const perCategoryCap = 750;
      const aggregateCap = 1500;
      const categorySpent: Record<string, number> = {};
      let aggregateUsed = 0;

      orderedTransactions.forEach(({ transaction }) => {
        const amount = Math.abs(transaction.amount);
        const blockSpend = Math.floor(amount / 5) * 5;
        const eligibility = CardBenefitManager.isTransactionEligible(transaction, cardId, effectiveElections);

        if (!eligibility.eligible || !eligibility.matchedCategory) {
          outcomes.set(transaction, {
            points: blockSpend,
            miles: Math.round(blockSpend * baseMpd),
            cashback: 0,
            rewardType: 'points',
            trackedSpend: 0,
            trackedFourMpdSpend: 0,
          });
          return;
        }

        const categoryName = eligibility.matchedCategory;
        const categoryRemaining = Math.max(0, perCategoryCap - (categorySpent[categoryName] || 0));
        const aggregateRemaining = Math.max(0, aggregateCap - aggregateUsed);
        const trackedSpend = Math.min(amount, categoryRemaining, aggregateRemaining);
        const trackedBlockSpend = Math.floor(trackedSpend / 5) * 5;
        const baseBlockSpend = Math.max(0, blockSpend - trackedBlockSpend);

        if (trackedSpend > 0) {
          categorySpent[categoryName] = (categorySpent[categoryName] || 0) + trackedSpend;
          aggregateUsed += trackedSpend;
        }

        outcomes.set(transaction, {
          points: blockSpend,
          miles: Math.round((trackedBlockSpend * eligibility.mpd) + (baseBlockSpend * baseMpd)),
          cashback: 0,
          rewardType: 'points',
          trackedSpend,
          trackedFourMpdSpend: trackedSpend,
        });
      });

      return outcomes;
    }

    orderedTransactions.forEach(({ transaction }) => {
      const outcome = this.calculateRewardOutcome(transaction, cardId, effectiveElections);
      outcomes.set(transaction, {
        ...outcome,
        rewardType: outcome.rewardType || 'points',
        trackedSpend: 0,
        trackedFourMpdSpend: 0,
      });
    });

    return outcomes;
  }

  static calculateRewardOutcome(
    transaction: Transaction,
    cardId: string,
    userElections: string[] | null = null
  ) {
    const card = CardBenefitManager.getCardConfig(cardId);
    const baseMpd = card?.fallbackMPD ?? 0.4;
    const eligibility = CardBenefitManager.isTransactionEligible(transaction, cardId, userElections);
    const totalMpd = eligibility.eligible ? eligibility.mpd : baseMpd;
    const amount = Math.abs(transaction.amount);

    if (cardId === 'DBS_WWMC') {
      const basePoints = Math.floor(amount / 5);
      if (totalMpd <= baseMpd) {
        return { points: basePoints, miles: basePoints * 2, cashback: 0, rewardType: 'points' as const };
      }
      const totalMultiplier = totalMpd / baseMpd;
      const bonusMultiplier = Math.max(0, totalMultiplier - 1);
      const bonusPoints = Math.floor((amount / 5) * bonusMultiplier);
      const totalPoints = basePoints + bonusPoints;
      return { points: totalPoints, miles: totalPoints * 2, cashback: 0, rewardType: 'points' as const };
    }

    if (cardId === 'DBS_LIVE_FRESH') {
      const retail = !this.isNonRetailTransaction(transaction);
      const eligible = retail && eligibility.eligible;
      const cashback = retail ? amount * (eligible ? 0.05 : 0.003) : 0;
      return {
        points: 0,
        miles: 0,
        cashback: Math.floor(cashback * 100) / 100,
        rewardType: 'cashback' as const,
      };
    }

    if (cardId === 'UOB_LADYS') {
      const blockSpend = Math.floor(amount / 5) * 5;
      return { points: blockSpend, miles: Math.round(blockSpend * totalMpd), cashback: 0, rewardType: 'points' as const };
    }

    if (cardId === 'HSBC_REVOLUTION') {
      const roundedSpend = Math.floor(amount);
      const rewardRate = Math.round(totalMpd / 0.4);
      const points = roundedSpend * rewardRate;
      return { points, miles: Math.round(roundedSpend * totalMpd), cashback: 0, rewardType: 'points' as const };
    }

    return {
      points: Math.round(amount * totalMpd),
      miles: Math.round(amount * totalMpd),
      cashback: 0,
      rewardType: 'points' as const,
    };
  }

  static isNonRetailTransaction(transaction: Transaction) {
    const merchant = (transaction.merchant || '').toUpperCase();
    const type = (transaction.transactionType || '').toUpperCase();
    return transaction.amount <= 0
      || type.includes('PAYMENT')
      || type.includes('REWARD')
      || /(BILL PAYMENT|PAYMT|DEDUCTED UNI\$|CARD FEE WAIVER|BASE REWARDS|ADD UNI\$)/.test(merchant);
  }

  static calculateLiveFreshCashback(transactions: Transaction[]) {
    const outcomes = this.calculateRewardOutcomes(transactions, 'DBS_LIVE_FRESH');
    let eligibleSpend = 0;
    let cashback = 0;
    let retailSpend = 0;

    transactions.forEach((transaction) => {
      if (!this.isNonRetailTransaction(transaction)) {
        retailSpend += Math.abs(transaction.amount);
      }
      const outcome = outcomes.get(transaction);
      if (!outcome) return;
      eligibleSpend += outcome.trackedSpend;
      cashback += outcome.cashback;
    });

    return {
      retailSpend,
      eligibleSpend,
      aggregateCap: 60,
      aggregateUsed: Math.min(60, cashback),
      aggregateRemaining: Math.max(0, 60 - Math.min(60, cashback)),
      cashback: Math.floor(cashback * 100) / 100,
    };
  }

  static calculateHsbcEligibleSpend(transactions: Transaction[]) {
    const trackedCategories = [...this.HSBC_TRACKED_CATEGORIES];
    const latestTransactionDate = transactions.reduce<Date | null>((latest, transaction) => {
      const parsed = new Date(transaction.date);
      if (Number.isNaN(parsed.getTime())) return latest;
      if (!latest || parsed.getTime() > latest.getTime()) return parsed;
      return latest;
    }, null);
    const aggregateCap = CardBenefitManager.getCardTotalCap('HSBC_REVOLUTION', latestTransactionDate || new Date());
    const categorySpent = Object.fromEntries(
      trackedCategories.map((category) => [category, 0])
    ) as Record<string, number>;

    let aggregateUsed = 0;
    let eligibleSpend = 0;
    let expectedMiles = 0;

    transactions.forEach((transaction) => {
      const amount = Math.abs(transaction.amount);
      const canonicalCategory = normalizeCategory(transaction.category || 'Uncategorized');
      const matchedCategory = trackedCategories.includes(canonicalCategory as typeof trackedCategories[number])
        ? canonicalCategory
        : null;
      const eligibility = CardBenefitManager.isTransactionEligible(transaction, 'HSBC_REVOLUTION', null);
      const aggregateRemaining = Math.max(0, aggregateCap - aggregateUsed);
      const bonusEligibleAmount = eligibility.eligible && matchedCategory
        ? Math.min(amount, aggregateRemaining)
        : 0;
      const baseAmount = Math.max(0, amount - bonusEligibleAmount);

      if (matchedCategory && bonusEligibleAmount > 0) {
        categorySpent[matchedCategory] += bonusEligibleAmount;
        aggregateUsed += bonusEligibleAmount;
        eligibleSpend += bonusEligibleAmount;
      }

      expectedMiles += (bonusEligibleAmount * 4) + (baseAmount * 0.4);
    });

    return {
      eligibleSpend,
      aggregateUsed,
      aggregateRemaining: Math.max(0, aggregateCap - aggregateUsed),
      aggregateCap,
      categorySpent,
      expectedMiles: Math.round(expectedMiles),
    };
  }

  static calculateUobEligibleSpend(
    transactions: Transaction[],
    userElections: string[] | null = null
  ) {
    const effectiveElections = CardBenefitManager.getEffectiveUserElections('UOB_LADYS', userElections) || [];
    const perCategoryCap = 750;
    const aggregateCap = 1500;
    const categorySpent: Record<string, number> = {};
    const categoryRemaining: Record<string, number> = {};

    effectiveElections.forEach(cat => {
      categorySpent[cat] = 0;
      categoryRemaining[cat] = perCategoryCap;
    });

    let aggregateUsed = 0;
    let eligibleSpend = 0;
    let expectedMiles = 0;

    const orderedTransactions = this.sortTransactionsForCapProcessing(transactions);

    orderedTransactions.forEach(({ transaction: t }) => {
      const amount = Math.abs(t.amount);
      const blockSpend = Math.floor(amount / 5) * 5;
      const eligibility = CardBenefitManager.isTransactionEligible(t, 'UOB_LADYS', effectiveElections);

      if (!eligibility.eligible || !eligibility.matchedCategory) {
        expectedMiles += blockSpend * 0.4;
        return;
      }

      const cat = eligibility.matchedCategory;
      const categoryRemaining = Math.max(0, perCategoryCap - (categorySpent[cat] || 0));
      const aggregateRemaining = Math.max(0, aggregateCap - aggregateUsed);
      const bonusEligibleAmount = Math.min(amount, categoryRemaining, aggregateRemaining);

      if (bonusEligibleAmount > 0) {
        categorySpent[cat] = (categorySpent[cat] || 0) + bonusEligibleAmount;
        aggregateUsed += bonusEligibleAmount;
        eligibleSpend += bonusEligibleAmount;
      }

      const bonusEligibleBlockSpend = Math.floor(bonusEligibleAmount / 5) * 5;
      const baseBlockSpend = Math.max(0, blockSpend - bonusEligibleBlockSpend);
      expectedMiles += (bonusEligibleBlockSpend * 4) + (baseBlockSpend * 0.4);
    });

    return {
      eligibleSpend,
      aggregateUsed,
      aggregateRemaining: Math.max(0, aggregateCap - aggregateUsed),
      perCategoryCap,
      aggregateCap,
      categorySpent,
      categoryRemaining: Object.fromEntries(
        Object.entries(categorySpent).map(([cat, spent]) => [cat, Math.max(0, perCategoryCap - spent)])
      ),
      expectedMiles: Math.round(expectedMiles),
    };
  }

  static getMonthKey(dateStr: string) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  static formatMonthKey(monthKey: string, locale: string = 'en-US') {
    const m = monthKey.match(/^(\d{4})-(\d{2})$/);
    if (!m) return monthKey;
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) return monthKey;
    return `${new Date(year, monthIndex, 1).toLocaleString(locale, { month: 'long' })} ${year}`;
  }

  static groupTransactionsByMonth(transactions: Transaction[]) {
    const groups: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      const monthKey = this.getMonthKey(t.date);
      if (!monthKey) return;
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(t);
    });
    return groups;
  }

  static calculateStats(transactions: Transaction[], cardId: string, userElections: string[] | null = null) {
    const scopedTransactions = CardBenefitManager.filterTransactionsForCard(transactions, cardId);
    const effectiveElections = CardBenefitManager.getEffectiveUserElections(cardId, userElections);
    const cardSpending = CardBenefitManager.calculatePerCategorySpending(scopedTransactions, cardId, effectiveElections);
    const card = CardBenefitManager.getCardConfig(cardId);
    const baseMpd = card?.fallbackMPD ?? 0.4;
    
    let totalSpent = 0;
    let expectedMiles = 0;

    // Use DBS points rounding rules for DBS WWMC
    if (cardId === 'DBS_WWMC') {
      const rewardOutcomes = this.calculateRewardOutcomes(scopedTransactions, cardId, effectiveElections);
      scopedTransactions.forEach(t => {
        const outcome = rewardOutcomes.get(t);
        if (!outcome) return;
        totalSpent += outcome.trackedFourMpdSpend;
        expectedMiles += outcome.miles;
      });
    } else if (cardId === 'DBS_LIVE_FRESH') {
      const liveFresh = this.calculateLiveFreshCashback(scopedTransactions);
      totalSpent = liveFresh.eligibleSpend;
      expectedMiles = Math.round(liveFresh.cashback * 100);
    } else if (cardId === 'UOB_LADYS') {
      const uob = this.calculateUobEligibleSpend(scopedTransactions, effectiveElections);
      totalSpent = uob.eligibleSpend;
      expectedMiles = uob.expectedMiles;
    } else if (cardId === 'HSBC_REVOLUTION') {
      const hsbc = this.calculateHsbcEligibleSpend(scopedTransactions);
      totalSpent = hsbc.eligibleSpend;
      expectedMiles = hsbc.expectedMiles;
    } else {
      Object.values(cardSpending).forEach(data => {
        totalSpent += data.spent;
        // Miles are earned on capped amount at higher rate, then fallback if exceeded (though logic here just calculates miles based on eligibility)
        // Standard bank logic: 10X (4mpd) up to $1k, then 1X (0.4mpd)
        const cappedSpent = Math.min(data.spent, data.cap);
        const extraSpent = Math.max(0, data.spent - data.cap);
        
        expectedMiles += cappedSpent * data.mpd;
        // Note: extraSpent miles are handled by 'Others' or fallbackMPD? 
        // Usually if you exceed cap on a 4mpd category, the excess earns base rate (0.4mpd).
        if (data.cap !== Infinity) {
          expectedMiles += extraSpent * baseMpd;
        }
      });
    }

    return {
      totalSpent,
      expectedMiles: Math.round(expectedMiles),
      categoryBreakdown: cardSpending
    };
  }
}
