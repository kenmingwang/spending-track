import { Transaction } from '../types';

export type CategoryOverrides = Record<string, string>;

const CATEGORY_CANONICAL_MAP: Record<string, string> = {
  '线上消费': 'Online Spending',
  '网上消费': 'Online Spending',
  '在线消费': 'Online Spending',
  '账单': 'Bills',
  '帳單': 'Bills',
  '账单支付': 'Bills',
  '會員訂閱': 'Memberships',
  '会员订阅': 'Memberships',
  '会员': 'Memberships',
  '未分类': 'Uncategorized',
  '未分類': 'Uncategorized',
  '餐饮': 'Dining',
  '餐飲': 'Dining',
  '旅行': 'Travel',
  '交通': 'Transport',
  '购物': 'Shopping',
  '購物': 'Shopping',
  '娱乐': 'Entertainment',
  '娛樂': 'Entertainment',
  'FOOD': 'Dining',
  'FOODS': 'Dining',
  'DINING': 'Dining',
  'FOOD DINING': 'Dining',
  'DINING FOOD': 'Dining',
  'UTILITY': 'Bills',
  'UTILITIES': 'Bills',
  'BILL': 'Bills',
  'BILLS': 'Bills',
  'UTILITY BILL': 'Bills',
  'UTILITY BILLS': 'Bills',
  'BILL PAYMENT': 'Bills',
  'BILL PAYMENTS': 'Bills',
  'TRANSPORT': 'Transport',
  'TRANSPORTS': 'Transport',
  'TRANSPORTATION': 'Transport',
  'TRANSIT': 'Transport',
  'PUBLIC TRANSPORT': 'Transport',
  'MEMBERSHIP': 'Memberships',
  'MEMBERSHIPS': 'Memberships',
  'GROCERY': 'Groceries',
  'GROCERIES': 'Groceries',
  'GROCERY SHOPPING': 'Groceries',
  'UNCATEGORISED': 'Uncategorized',
  'UNCATEGORIZED': 'Uncategorized',
};

export const normalizeCategory = (category: string) => {
  const raw = (category || '').trim();
  if (!raw) return 'Uncategorized';
  if (CATEGORY_CANONICAL_MAP[raw]) return CATEGORY_CANONICAL_MAP[raw];
  const normalizedKey = raw.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  return CATEGORY_CANONICAL_MAP[normalizedKey] || raw;
};

export const normalizeMerchant = (merchant: string) =>
  merchant
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\bSINGAPORE\b/g, ' ')
    .replace(/\bSGP\b/g, ' ')
    .replace(/\bSG\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const merchantKey = (merchant: string) => normalizeMerchant(merchant);

export const applyCategoryOverrides = (
  transactions: Transaction[],
  overrides: CategoryOverrides
) => {
  return transactions.map(t => {
    const canonicalCategory = normalizeCategory(t.category || 'Uncategorized');
    const key = merchantKey(t.merchant || '');
    const override = overrides[key];
    const targetCategory = override ? normalizeCategory(override) : canonicalCategory;
    if (targetCategory === t.category) return t;
    return { ...t, category: targetCategory };
  });
};

export const applyOverrideToSimilar = (
  transactions: Transaction[],
  merchant: string,
  category: string
) => {
  const key = merchantKey(merchant);
  const normalizedCategory = normalizeCategory(category);
  if (!key) return transactions;
  return transactions.map(t => {
    if (merchantKey(t.merchant || '') !== key) return t;
    if (normalizeCategory(t.category || '') === normalizedCategory) return { ...t, category: normalizedCategory };
    return { ...t, category: normalizedCategory };
  });
};

export const updateOverridesForMerchant = (
  overrides: CategoryOverrides,
  merchant: string,
  category: string
) => {
  const key = merchantKey(merchant);
  const normalizedCategory = normalizeCategory(category);
  if (!key) return overrides;
  if (normalizeCategory(overrides[key] || '') === normalizedCategory) return overrides;
  return { ...overrides, [key]: normalizedCategory };
};
