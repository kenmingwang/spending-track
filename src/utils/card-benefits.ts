import { CategoryConfig, CardConfig, Transaction } from '../types';
import dbsWomansWorldCard from '../../images/cards/dbs-womans-world-card.png';
import uobLadysSolitaireCard from '../../images/cards/uob-ladys-solitaire-card.png';
import hsbcRevolutionCard from '../../images/cards/hsbc-revolution-card.jpg';

export const CARD_BENEFITS: Record<string, CardConfig> = {
  'DBS_WWMC': {
    id: 'DBS_WWMC',
    name: 'DBS Woman\'s World Card',
    totalCap: 1000,
    icon: 'DBS',
    coverImage: dbsWomansWorldCard,
    requiresElection: false,
    sharedCap: false,
    categories: {
      'Online Spending': {
        cap: 1000,
        mpd: 4,
        autoEligible: true,
        keywords: ['SHOPEE', 'LAZADA', 'AMAZON', 'REDMART', 'TAOBAO', 'GRAB', 'GOJEK', 'TADA', 'FOODPANDA', 'DELIVEROO', 'SIA', 'SCOOT', 'AIRASIA', 'AGODA', 'KLOOK', 'PELAGO', 'NETFLIX', 'SPOTIFY'],
        excludedKeywords: [
          'AMAZE',
          'CARDUP',
          'IPAYMY',
          'AXS',
          'SAM',
          'SGEBIZ',
          'SINGTEL DASH',
          'YOUTRIP',
          'SHOPEEPAY',
          'FAVEPAY'
        ],
        paymentTypes: ['ONLINE', 'IN-APP']
      },
      'Overseas Offline': {
        cap: Infinity,
        mpd: 1.2,
        autoEligible: true,
        keywords: [],
        categoryKeywords: ['FOREIGN CURRENCY', 'OVERSEAS'],
        paymentTypes: ['PHYSICAL', 'CONTACTLESS']
      }
    },
    fallbackMPD: 0.4,
    description: '4 mpd on online spend (S$1k monthly cap), 1.2 mpd on overseas offline FCY spend'
  },
  'UOB_LADYS': {
    id: 'UOB_LADYS',
    name: 'UOB Lady\'s Solitaire Card',
    totalCap: 1500,
    icon: 'UOB',
    coverImage: uobLadysSolitaireCard,
    requiresElection: true,
    maxElectable: 2,
    sharedCap: true,
    categories: {},
    electableCategories: {
      'Dining': {
        cap: 750,
        mpd: 4,
        autoEligible: true,
        keywords: [
          'FOOD PANDA', 'FOODPANDA', 'DELIVEROO', 'GRABFOOD', 'SMP_SUPER SIMPLE', 'MCDONALD',
          'KFC', 'BURGER KING', 'STARBUCKS', 'PAUL', 'BLUE BOTTLE', 'NIKAIKU', 'GOKOKU',
          'RESTAURANT', 'CAFE', 'BAKERY', 'B FOR BAGEL'
        ]
      },
      'Travel': {
        cap: 750,
        mpd: 4,
        autoEligible: true,
        keywords: [
          'AGODA', 'BOOKING', 'TRIP', 'AIRASIA', 'SINGAPORE AIRLINES', 'SIA', 'SCOOT',
          'JETSTAR', 'EXPEDIA', 'HOTELS', 'UBER', 'GRAB', 'GOJEK', 'TADA', 'COMFORTDELGRO', 'CDG'
        ]
      }
    },
    fallbackMPD: 0.4,
    description: '4 mpd on 2 selected categories, S$1,500 monthly aggregate cap and S$750 per selected category cap'
  },
  'HSBC_REVOLUTION': {
    id: 'HSBC_REVOLUTION',
    name: 'HSBC Revolution Credit Card',
    totalCap: 1000,
    icon: 'HSBC',
    coverImage: hsbcRevolutionCard,
    requiresElection: false,
    sharedCap: true,
    categories: {
      'Online Spending': {
        cap: 1000,
        mpd: 4,
        autoEligible: true,
        categoryNames: ['Dining', 'Travel', 'Transport', 'Shopping', 'Fashion', 'Entertainment', 'Memberships'],
        requiredPaymentTypes: ['ONLINE', 'IN-APP']
      },
      'Contactless Promo': {
        cap: 1000,
        mpd: 4,
        autoEligible: true,
        categoryNames: ['Dining', 'Travel', 'Transport', 'Shopping', 'Fashion', 'Entertainment', 'Memberships'],
        requiredPaymentTypes: ['CONTACTLESS']
      }
    },
    fallbackMPD: 0.4,
    description: '4 mpd equivalent on eligible online spend, with online travel/contactless promo to 31 Mar 2026'
  }
};

export class CardBenefitManager {
  static isHsbcContactlessPromoActive(asOf: Date = new Date()): boolean {
    const promoEnd = new Date('2026-04-01T00:00:00+08:00');
    return asOf.getTime() < promoEnd.getTime();
  }

  static getCardTotalCap(cardId: string, asOf: Date = new Date()): number {
    if (cardId === 'HSBC_REVOLUTION') {
      return this.isHsbcContactlessPromoActive(asOf) ? 1500 : 1000;
    }
    return CARD_BENEFITS[cardId]?.totalCap ?? 0;
  }

  static getEffectiveUserElections(cardId: string, userElections: string[] | null = null): string[] | null {
    if (userElections && userElections.length > 0) return userElections;
    if (cardId === 'UOB_LADYS') return ['Dining', 'Travel'];
    return userElections;
  }

  static normalizeTransactionCardId(transaction: Transaction): string {
    if (transaction.cardId) return transaction.cardId;
    if ((transaction.source || '').toUpperCase() === 'UOB') return 'UOB_LADYS';
    if ((transaction.source || '').toUpperCase() === 'HSBC') return 'HSBC_REVOLUTION';
    return 'DBS_WWMC';
  }

  static filterTransactionsForCard(transactions: Transaction[], cardId: string): Transaction[] {
    return transactions.filter(t => this.normalizeTransactionCardId(t) === cardId);
  }

  static getCardConfig(cardId: string): CardConfig | undefined {
    return CARD_BENEFITS[cardId];
  }

  static getAllCards(): CardConfig[] {
    return Object.values(CARD_BENEFITS);
  }

  static isTransactionEligible(
    transaction: Transaction,
    cardId: string,
    userElections: string[] | null = null
  ) {
    const card = this.getCardConfig(cardId);
    if (!card) return { eligible: false, mpd: 0.4, matchedCategory: null };
    const effectiveElections = this.getEffectiveUserElections(cardId, userElections);

    const merchant = (transaction.merchant || '').toUpperCase();
    const category = (transaction.category || '').toUpperCase();
    const paymentType = (transaction.paymentType || '').toUpperCase();
    const transactionDate = new Date(transaction.date);
    const hsbcPromoActiveForTransaction = !Number.isNaN(transactionDate.getTime())
      ? this.isHsbcContactlessPromoActive(transactionDate)
      : this.isHsbcContactlessPromoActive();

    const categoriesToCheck = { ...card.categories };

    if (card.requiresElection && effectiveElections && card.electableCategories) {
      effectiveElections.forEach(catName => {
        if (card.electableCategories?.[catName]) {
          categoriesToCheck[catName] = card.electableCategories[catName];
        }
      });
    }

    for (const [catName, catConfig] of Object.entries(categoriesToCheck)) {
      if (cardId === 'HSBC_REVOLUTION' && catName === 'Contactless Promo' && !hsbcPromoActiveForTransaction) {
        continue;
      }

      let isMatch = false;
      const categoryNames = (catConfig.categoryNames || []).map(name => name.toUpperCase());
      const requiredPaymentTypes = (catConfig.requiredPaymentTypes || []).map(type => type.toUpperCase());

      if (category === catName.toUpperCase()) {
        isMatch = true;
      }

      if (!isMatch && categoryNames.length > 0) {
        isMatch = categoryNames.includes(category);
      }

      if (!isMatch && catConfig.keywords && catConfig.keywords.length > 0) {
        isMatch = catConfig.keywords.some(kw => merchant.includes(kw.toUpperCase()));
      }

      if (!isMatch && catConfig.categoryKeywords) {
        isMatch = catConfig.categoryKeywords.some(kw => category.includes(kw.toUpperCase()));
      }

      if (!isMatch && catConfig.paymentTypes && paymentType) {
        isMatch = catConfig.paymentTypes.some(pt => paymentType.includes(pt.toUpperCase()));
      }

      if (isMatch && requiredPaymentTypes.length > 0) {
        isMatch = requiredPaymentTypes.some(pt => paymentType.includes(pt));
      }

      if (isMatch && catConfig.excludedKeywords && catConfig.excludedKeywords.length > 0) {
        const isExcluded = catConfig.excludedKeywords.some(kw => merchant.includes(kw.toUpperCase()));
        if (isExcluded) isMatch = false;
      }

      if (isMatch) {
        return { eligible: true, mpd: catConfig.mpd, matchedCategory: catName };
      }
    }

    return { eligible: false, mpd: card.fallbackMPD, matchedCategory: null };
  }

  static calculatePerCategorySpending(
    transactions: Transaction[],
    cardId: string,
    userElections: string[] | null = null
  ) {
    const card = this.getCardConfig(cardId);
    if (!card) return {};
    const scopedTransactions = this.filterTransactionsForCard(transactions, cardId);
    const effectiveElections = this.getEffectiveUserElections(cardId, userElections);

    const spending: Record<string, { spent: number; cap: number; remaining: number; mpd: number }> = {};

    const relevantCategories = { ...card.categories };
    if (card.requiresElection && effectiveElections && card.electableCategories) {
      effectiveElections.forEach(catName => {
        if (card.electableCategories?.[catName]) {
          relevantCategories[catName] = card.electableCategories[catName];
        }
      });
    }

    Object.entries(relevantCategories).forEach(([name, config]) => {
      const effectiveCap = cardId === 'HSBC_REVOLUTION'
        ? this.getCardTotalCap(cardId)
        : config.cap;
      spending[name] = { spent: 0, cap: effectiveCap, remaining: effectiveCap, mpd: config.mpd };
    });

    spending['Others'] = { spent: 0, cap: Infinity, remaining: Infinity, mpd: card.fallbackMPD };

    scopedTransactions.forEach(t => {
      const amount = Math.abs(t.amount);
      const eligibility = this.isTransactionEligible(t, cardId, effectiveElections);

      if (eligibility.eligible && eligibility.matchedCategory) {
        spending[eligibility.matchedCategory].spent += amount;
      } else {
        spending['Others'].spent += amount;
      }
    });

    Object.keys(spending).forEach(name => {
      if (card.sharedCap) {
        // Shared caps are handled differently in UI/summary usually
      }
      spending[name].remaining = Math.max(0, spending[name].cap - spending[name].spent);
    });

    return spending;
  }
}
