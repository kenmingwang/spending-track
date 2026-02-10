// Logic for spending calculations and categorization

const CARD_CAPS = {
    'DBS_WWMC': 2000.00
};

// Transport keywords
const TRANSPORT_KEYWORDS = ['GRAB', 'GOJEK', 'TADA', 'RYDE', 'COMFORTDELGRO', 'CDG', 'BUS', 'TRAIN', 'MRT', 'TRANSIT', 'ANYWHEEL', 'BLUESG'];

// Online keywords (simplified for WWMC, normally this involves MCC checks)
// For now, we assume most things are "Online" unless explicitly "Offline" or blocked categories.
// Actually, user just wants categorization: Transport vs Dining vs Other.
// We will try to guess based on Merchant name or Category from DBS.

class Calculator {
    static getCap(cardType) {
        return CARD_CAPS[cardType] || 0;
    }

    static calculateRemaining(cardType, spent) {
        const cap = this.getCap(cardType);
        return Math.max(0, cap - spent);
    }

    // Filter transactions for a specific month (0-indexed month, full year)
    static filterByMonth(transactions, month, year) {
        return transactions.filter(t => {
            const dateStr = t.date; // e.g., "Mon, 12 Jan 2026"
            try {
                // Parse date manually or use Date.parse
                // "Mon, 12 Jan 2026" is parseable by cleaner regex or Date constructor usually
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return false; // Invalid date

                return d.getMonth() === month && d.getFullYear() === year;
            } catch (e) {
                console.error("Date parse error", dateStr, e);
                return false;
            }
        });
    }

    static aggregateByCategory(transactions) {
        let groups = {};

        transactions.forEach(t => {
            const cat = t.category; // e.g. "Transportation", "Dining"
            const merch = t.merchant.toUpperCase();
            const catUpper = cat.toUpperCase();

            // Initialize group if not exists
            if (!groups[cat]) {
                groups[cat] = {
                    name: cat,
                    amount: 0,
                    isOnline: false
                };
            }

            // Add amount
            groups[cat].amount += t.amount;

            // Determine if likely Online/4mpd
            // This is a heuristic.
            // Transport (Grab/Gojek/Tada) is usually online.
            // Online food delivery (Deliveroo/Foodpanda) is online.
            // E-commerce (Shopee/Lazada/Amazon) is online.

            // Check specific keywords for this *transaction* to tag the *category* as containing online stuff.
            // Or better: tag the category as "4mpd eligible" if matches known categories.

            const isTransport = TRANSPORT_KEYWORDS.some(k => merch.includes(k) || catUpper.includes('TRANSPORT'));
            // Add more known online patterns
            const isDelivery = merch.includes('DELIVEROO') || merch.includes('FOODPANDA') || merch.includes('GRABFOOD');
            const isOnlineRetail = merch.includes('AMAZON') || merch.includes('SHOPEE') || merch.includes('LAZADA') || merch.includes('Taobao') || merch.includes('Qoo10');
            const isSubscription = merch.includes('NETFLIX') || merch.includes('SPOTIFY') || merch.includes('YOUTUBE') || merch.includes('GOOGLE');

            if (isTransport || isDelivery || isOnlineRetail || isSubscription) {
                groups[cat].isOnline = true;
            }
        });

        // Convert to array and sort by amount desc
        return Object.values(groups).sort((a, b) => b.amount - a.amount);
    }
}
