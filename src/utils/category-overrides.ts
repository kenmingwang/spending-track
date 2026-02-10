import { Transaction } from '../types';

export type CategoryOverrides = Record<string, string>;

export const normalizeMerchant = (merchant: string) =>
  merchant
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const merchantKey = (merchant: string) => normalizeMerchant(merchant);

export const applyCategoryOverrides = (
  transactions: Transaction[],
  overrides: CategoryOverrides
) => {
  if (!overrides || Object.keys(overrides).length === 0) return transactions;
  return transactions.map(t => {
    const key = merchantKey(t.merchant || '');
    const override = overrides[key];
    if (!override || override === t.category) return t;
    return { ...t, category: override };
  });
};

export const applyOverrideToSimilar = (
  transactions: Transaction[],
  merchant: string,
  category: string
) => {
  const key = merchantKey(merchant);
  if (!key) return transactions;
  return transactions.map(t => {
    if (merchantKey(t.merchant || '') !== key) return t;
    if (t.category === category) return t;
    return { ...t, category };
  });
};

export const updateOverridesForMerchant = (
  overrides: CategoryOverrides,
  merchant: string,
  category: string
) => {
  const key = merchantKey(merchant);
  if (!key) return overrides;
  if (overrides[key] === category) return overrides;
  return { ...overrides, [key]: category };
};
