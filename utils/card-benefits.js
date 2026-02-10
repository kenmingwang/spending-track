// Card Benefit Configuration
// Defines benefit structures, caps, and MPD (Miles Per Dollar) for different credit cards

const CARD_BENEFITS = {
    'DBS_WWMC': {
        name: 'DBS Woman\'s World Card',
        totalCap: 1000,
        icon: '💳',
        requiresElection: false,
        sharedCap: false, // Individual caps per category
        categories: {
            'Online Spending': {
                cap: 1000,
                mpd: 4,
                autoEligible: true,
                keywords: ['SHOPEE', 'LAZADA', 'AMAZON', 'REDMART', 'TAOBAO', 'GRAB', 'GOJEK', 'SIA', 'SCOOT', 'AIRASIA', 'AGODA', 'KLOOK', 'PELAGO', 'NETFLIX', 'SPOTIFY'],
                paymentTypes: ['ONLINE', 'IN-APP']
            },
            'Overseas Offline': {
                cap: 1000,
                mpd: 1.2,
                autoEligible: true,
                keywords: [],
                categoryKeywords: ['FOREIGN CURRENCY', 'OVERSEAS'],
                paymentTypes: ['PHYSICAL', 'CONTACTLESS']
            }
        },
        fallbackMPD: 0.4,
        description: '4 mpd on Online Spending ($1k cap), 1.2 mpd on Overseas Offline ($1k cap)'
    },
    'UOB_WS': {
        name: 'UOB Women Solitaire',
        totalCap: 1000,
        icon: '💎',
        requiresElection: true,
        electableCategories: {
            'Dining': {
                cap: 500,
                mpd: 4,
                keywords: ['RESTAURANT', 'CAFE', 'FOOD', 'DINING', 'MCDONALD', 'KFC', 'STARBUCKS']
            },
            'Travel': {
                cap: 500,
                mpd: 4,
                keywords: ['AGODA', 'BOOKING', 'AIRBNB', 'EXPEDIA', 'KLOOK', 'GRAB', 'TAXI']
            },
            'Wellness': {
                cap: 500,
                mpd: 4,
                keywords: ['GYM', 'FITNESS', 'SPA', 'YOGA', 'WELLNESS', 'GUARDIAN', 'WATSONS']
            },
            'Fashion': {
                cap: 500,
                mpd: 4,
                keywords: ['UNIQLO', 'ZARA', 'H&M', 'ZALORA', 'SEPHORA', 'FASHION']
            }
        },
        maxElectable: 2,
        fallbackMPD: 0.4,
        description: 'Choose 2 from 4 categories - 4 mpd up to $500 each'
    }
};

// Category suggestions for dropdown (general)
const COMMON_CATEGORIES = [
    'Transportation',
    'Dining',
    'Online Shopping',
    'Travel',
    'Entertainment',
    'Groceries',
    'Fashion',
    'Wellness',
    'Food Delivery',
    'Bills & Utilities',
    'Other'
];

class CardBenefitManager {
    static getCardConfig(cardId) {
        return CARD_BENEFITS[cardId] || null;
    }

    static getAllCards() {
        return Object.keys(CARD_BENEFITS).map(id => ({
            id,
            ...CARD_BENEFITS[id]
        }));
    }

    static getCategoriesForCard(cardId, userElections = null) {
        const card = CARD_BENEFITS[cardId];
        if (!card) return [];

        if (card.requiresElection && userElections) {
            // For electable cards, only return user's selected categories
            const result = [];
            userElections.forEach(catName => {
                if (card.electableCategories[catName]) {
                    result.push({
                        name: catName,
                        ...card.electableCategories[catName],
                        isElected: true
                    });
                }
            });
            return result;
        } else if (card.requiresElection) {
            // Not yet elected, return all as options
            return Object.keys(card.electableCategories).map(name => ({
                name,
                ...card.electableCategories[name],
                isElected: false
            }));
        } else {
            // Auto-eligible categories
            return Object.keys(card.categories).map(name => ({
                name,
                ...card.categories[name]
            }));
        }
    }

    static isTransactionEligible(transaction, cardId, userElections = null) {
        const card = CARD_BENEFITS[cardId];
        if (!card) return { eligible: false, mpd: 0, matchedCategory: null };

        const merchant = transaction.merchant.toUpperCase();
        const category = (transaction.category || '').toUpperCase();
        const paymentType = (transaction.paymentType || '').toUpperCase();

        // Check categories
        let categoriesToCheck = card.categories || {};

        if (card.requiresElection && userElections) {
            // Only check elected categories
            categoriesToCheck = {};
            userElections.forEach(catName => {
                if (card.electableCategories[catName]) {
                    categoriesToCheck[catName] = card.electableCategories[catName];
                }
            });
        } else if (card.requiresElection) {
            categoriesToCheck = card.electableCategories;
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

            // 3. Check category keywords (e.g., "FOREIGN CURRENCY", "OVERSEAS")
            if (!isMatch && catConfig.categoryKeywords) {
                isMatch = catConfig.categoryKeywords.some(kw => category.includes(kw.toUpperCase()));
            }

            // 4. Check payment type (e.g., "ONLINE", "IN-APP", "PHYSICAL")
            if (!isMatch && catConfig.paymentTypes && paymentType) {
                isMatch = catConfig.paymentTypes.some(pt => paymentType.includes(pt.toUpperCase()));
            }

            if (isMatch) {
                return { eligible: true, mpd: catConfig.mpd, matchedCategory: catName };
            }
        }

        return { eligible: false, mpd: card.fallbackMPD, matchedCategory: null };
    }

    static calculatePerCategorySpending(transactions, cardId, userElections = null) {
        const card = this.getCardConfig(cardId);
        const categories = this.getCategoriesForCard(cardId, userElections);
        const spending = {};

        // Initialize
        categories.forEach(cat => {
            spending[cat.name] = {
                spent: 0,
                cap: card.sharedCap ? card.totalCap : (cat.cap || card.totalCap),
                mpd: cat.mpd,
                remaining: 0
            };
        });

        // Aggregate
        transactions.forEach(txn => {
            const eligibility = this.isTransactionEligible(txn, cardId, userElections);
            if (eligibility.eligible && eligibility.matchedCategory) {
                const catName = eligibility.matchedCategory;
                if (spending[catName]) {
                    spending[catName].spent += Math.abs(txn.amount);
                }
            }
        });

        // Calculate remaining (shared cap logic)
        if (card.sharedCap) {
            // All categories share the total cap
            const totalSpent = Object.values(spending).reduce((sum, cat) => sum + cat.spent, 0);
            const sharedRemaining = Math.max(0, card.totalCap - totalSpent);

            Object.keys(spending).forEach(catName => {
                spending[catName].remaining = sharedRemaining;
            });
        } else {
            // Individual caps
            Object.keys(spending).forEach(catName => {
                spending[catName].remaining = Math.max(0, spending[catName].cap - spending[catName].spent);
            });
        }

        return spending;
    }
}
