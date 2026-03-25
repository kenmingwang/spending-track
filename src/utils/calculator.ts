import { CardBenefitManager } from './card-benefits';
import { Transaction } from '../types';
import { normalizeCategory } from './category-overrides';

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
        return { points: basePoints, miles: basePoints * 2 };
      }
      const totalMultiplier = totalMpd / baseMpd;
      const bonusMultiplier = Math.max(0, totalMultiplier - 1);
      const bonusPoints = Math.floor((amount / 5) * bonusMultiplier);
      const totalPoints = basePoints + bonusPoints;
      return { points: totalPoints, miles: totalPoints * 2 };
    }

    if (cardId === 'UOB_LADYS') {
      const blockSpend = Math.floor(amount / 5) * 5;
      return { points: blockSpend, miles: Math.round(blockSpend * totalMpd) };
    }

    if (cardId === 'HSBC_REVOLUTION') {
      const roundedSpend = Math.floor(amount);
      const rewardRate = Math.round(totalMpd / 0.4);
      const points = roundedSpend * rewardRate;
      return { points, miles: Math.round(roundedSpend * totalMpd) };
    }

    return {
      points: Math.round(amount * totalMpd),
      miles: Math.round(amount * totalMpd),
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

    transactions.forEach(t => {
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

  static formatMonthKey(monthKey: string) {
    const m = monthKey.match(/^(\d{4})-(\d{2})$/);
    if (!m) return monthKey;
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) return monthKey;
    return `${new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'long' })} ${year}`;
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
      scopedTransactions.forEach(t => {
        totalSpent += Math.abs(t.amount);
        const eligibility = CardBenefitManager.isTransactionEligible(t, cardId, userElections);
        const totalMpd = eligibility.eligible ? eligibility.mpd : baseMpd;
        const basePoints = Math.floor(Math.abs(t.amount) / 5);
        const totalMultiplier = totalMpd / baseMpd;
        const bonusMultiplier = Math.max(0, totalMultiplier - 1);
        const bonusPoints = Math.floor((Math.abs(t.amount) / 5) * bonusMultiplier);
        const totalPoints = basePoints + bonusPoints;
        expectedMiles += totalPoints * 2;
      });
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
