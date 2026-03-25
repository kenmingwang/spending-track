import { Transaction } from '../types';

const normalizeMerchantForInference = (merchant: string) =>
  (merchant || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const HSBC_CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  {
    category: 'Memberships',
    keywords: [
      'CURSOR',
      'OPENAI',
      'CHATGPT',
      'NETFLIX',
      'SPOTIFY',
      'YOUTUBE',
      'DISNEY',
      'AMAZON PRIME',
      'PATREON',
      'GOOGLE ONE'
    ]
  },
  {
    category: 'Travel',
    keywords: [
      'AGODA',
      'BOOKING',
      'TRIP COM',
      'TRIPCOM',
      'EXPEDIA',
      'AIRBNB',
      'KLOOK',
      'PELAGO',
      'SIA',
      'SINGAPORE AIRLINES',
      'SCOOT',
      'AIRASIA',
      'JETSTAR',
      'HOTEL',
      'HOTELS'
    ]
  },
  {
    category: 'Transport',
    keywords: [
      'GRAB',
      'GOJEK',
      'TADA',
      'RYDE',
      'COMFORT',
      'COMFORTDELGRO',
      'CDG',
      'TRANSCAB',
      'TAXI'
    ]
  },
  {
    category: 'Fashion',
    keywords: [
      'ZALORA',
      'UNIQLO',
      'LOVE BONITO',
      'POMELO',
      'SHEIN',
      ' ADIDAS ',
      ' NIKE ',
      ' H M ',
      'CHARLES KEITH',
      'COTTON ON',
      'LULULEMON',
      'PUMA'
    ]
  },
  {
    category: 'Entertainment',
    keywords: [
      'GOLDEN VILLAGE',
      'CATHAY',
      'SHAW',
      'STEAM',
      'PLAYSTATION',
      'NINTENDO',
      'APPLE TV',
      'SPOTIFY',
      'NETFLIX'
    ]
  },
  {
    category: 'Dining',
    keywords: [
      'KOUFU',
      'SUBWAY',
      'STARBUCKS',
      'MCDONALD',
      'BURGER KING',
      'CHAGEE',
      'WOOBBEE',
      'WU PAO CHUN',
      'PAO CHUN',
      'SPICY NOODLE',
      'JINCHENG',
      'NESPRESSO',
      'SUPER SIMPLE',
      'RESTAURANT',
      'CAFE',
      'COFFEE',
      'BAKERY',
      'TOAST',
      'KOPI',
      'TEA'
    ]
  },
  {
    category: 'Shopping',
    keywords: [
      'AMAZON',
      'SHOPEE',
      'LAZADA',
      'TAOBAO',
      'TEMU',
      'REDMART',
      'IKEA'
    ]
  }
];

const HSBC_ONLINE_KEYWORDS = [
  '.COM',
  ' WWW ',
  'CURSOR',
  'OPENAI',
  'CHATGPT',
  'NETFLIX',
  'SPOTIFY',
  'YOUTUBE',
  'DISNEY',
  'AGODA',
  'BOOKING',
  'TRIP COM',
  'TRIPCOM',
  'EXPEDIA',
  'AIRBNB',
  'KLOOK',
  'PELAGO',
  'AMAZON',
  'SHOPEE',
  'LAZADA',
  'TAOBAO',
  'TEMU',
  'ZALORA',
  'SHEIN'
];

export const inferHsbcCategoryFromMerchant = (merchant: string): string => {
  const normalizedMerchant = ` ${normalizeMerchantForInference(merchant)} `;
  if (!normalizedMerchant.trim()) return 'Uncategorized';

  for (const rule of HSBC_CATEGORY_KEYWORDS) {
    if (rule.keywords.some((keyword) => normalizedMerchant.includes(` ${keyword} `) || normalizedMerchant.includes(keyword))) {
      return rule.category;
    }
  }

  return 'Uncategorized';
};

export const inferHsbcPaymentTypeFromMerchant = (merchant: string): string => {
  const normalizedMerchant = ` ${normalizeMerchantForInference(merchant)} `;
  if (!normalizedMerchant.trim()) return '';

  if (HSBC_ONLINE_KEYWORDS.some((keyword) => normalizedMerchant.includes(` ${keyword} `) || normalizedMerchant.includes(keyword))) {
    return 'ONLINE';
  }

  return '';
};

export const enrichHsbcTransactionInference = (transaction: Transaction): Transaction => {
  if ((transaction.source || '').toUpperCase() !== 'HSBC' && transaction.cardId !== 'HSBC_REVOLUTION') {
    return transaction;
  }

  const nextCategory = (transaction.category || '').trim();
  const nextPaymentType = (transaction.paymentType || '').trim();
  const isOptedOut = Boolean(transaction.hsbcContactlessOptOut);

  const inferredCategory = !nextCategory || /^uncategorized$/i.test(nextCategory)
    ? inferHsbcCategoryFromMerchant(transaction.merchant || '')
    : nextCategory;
  const inferredOnlinePaymentType = inferHsbcPaymentTypeFromMerchant(transaction.merchant || '');
  const inferredPaymentType = nextPaymentType || inferredOnlinePaymentType || (isOptedOut ? 'PHYSICAL' : 'CONTACTLESS');

  if (
    inferredCategory === nextCategory &&
    inferredPaymentType === nextPaymentType
  ) {
    return transaction;
  }

  return {
    ...transaction,
    category: inferredCategory || 'Uncategorized',
    paymentType: inferredPaymentType,
  };
};
