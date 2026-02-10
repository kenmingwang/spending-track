import { CategoryConfig, CardConfig, Transaction } from '../types';

export const CARD_BENEFITS: Record<string, CardConfig> = {
  'DBS_WWMC': {
    id: 'DBS_WWMC',
    name: 'DBS Woman\'s World Card',
    totalCap: 1000,
    icon: '💳',
    requiresElection: false,
    sharedCap: false, // Individual caps per category as per latest update
    categories: {
      'Online Spending': {
        cap: 1000,
        mpd: 4,
        autoEligible: true,
        keywords: ['SHOPEE', 'LAZADA', 'AMAZON', 'REDMART', 'TAOBAO', 'GRAB', 'GOJEK', 'TADA', 'FOODPANDA', 'DELIVEROO', 'SIA', 'SCOOT', 'AIRASIA', 'AGODA', 'KLOOK', 'PELAGO', 'NETFLIX', 'SPOTIFY'],
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
    description: '4 mpd on Online Spending ($1k cap), 1.2 mpd on Overseas Offline (no cap)'
  }
};

export class CardBenefitManager {
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

    const merchant = (transaction.merchant || '').toUpperCase();
    const category = (transaction.category || '').toUpperCase();
    const paymentType = (transaction.paymentType || '').toUpperCase();

    // Check fixed categories
    const categoriesToCheck = { ...card.categories };
    
    // Add user elected categories if applicable
    if (card.requiresElection && userElections && card.electableCategories) {
      userElections.forEach(catName => {
        if (card.electableCategories?.[catName]) {
          categoriesToCheck[catName] = card.electableCategories[catName];
        }
      });
    }

    for (const [catName, catConfig] of Object.entries(categoriesToCheck)) {
      let isMatch = false;

      // 1. Check if transaction category matches benefit category name
      if (category === catName.toUpperCase()) {
        isMatch = true;
      }

      // 2. Check merchant keywords
      if (!isMatch && catConfig.keywords && catConfig.keywords.length > 0) {
        isMatch = catConfig.keywords.some(kw => merchant.includes(kw.toUpperCase()));
      }

      // 3. Check category keywords
      if (!isMatch && catConfig.categoryKeywords) {
        isMatch = catConfig.categoryKeywords.some(kw => category.includes(kw.toUpperCase()));
      }

      // 4. Check payment type
      if (!isMatch && catConfig.paymentTypes && paymentType) {
        isMatch = catConfig.paymentTypes.some(pt => paymentType.includes(pt.toUpperCase()));
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

    const spending: Record<string, { spent: number; cap: number; remaining: number; mpd: number }> = {};
    
    // Initialize categories
    const relevantCategories = { ...card.categories };
    if (card.requiresElection && userElections && card.electableCategories) {
      userElections.forEach(catName => {
        if (card.electableCategories?.[catName]) {
          relevantCategories[catName] = card.electableCategories[catName];
        }
      });
    }

    Object.entries(relevantCategories).forEach(([name, config]) => {
      spending[name] = { spent: 0, cap: config.cap, remaining: config.cap, mpd: config.mpd };
    });

    // Add fallback category
    spending['Others'] = { spent: 0, cap: Infinity, remaining: Infinity, mpd: card.fallbackMPD };

    transactions.forEach(t => {
      const amount = Math.abs(t.amount);
      const eligibility = this.isTransactionEligible(t, cardId, userElections);
      
      if (eligibility.eligible && eligibility.matchedCategory) {
        spending[eligibility.matchedCategory].spent += amount;
      } else {
        spending['Others'].spent += amount;
      }
    });

    // Update remaining and respect caps
    Object.keys(spending).forEach(name => {
      if (card.sharedCap) {
        // Shared caps are handled differently in UI/summary usually
        // but for per-category specifically if sharedCap=true, we might show total cap
      }
      spending[name].remaining = Math.max(0, spending[name].cap - spending[name].spent);
    });

    return spending;
  }
}
