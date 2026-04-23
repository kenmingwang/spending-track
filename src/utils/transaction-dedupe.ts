import { Transaction } from '../types';
import { normalizeMerchant } from './category-overrides';

const normalizeTransactionDateForDedupe = (date: string) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return (date || '').trim();
  }
  return parsed.toISOString().slice(0, 10);
};

const normalizeTransactionCardId = (transaction: Transaction) => {
  if (transaction.cardId) return transaction.cardId;
  if ((transaction.source || '').toUpperCase() === 'UOB') return 'UOB_LADYS';
  if ((transaction.source || '').toUpperCase() === 'HSBC') return 'HSBC_REVOLUTION';
  return 'DBS_WWMC';
};

export const getTransactionDedupeKey = (transaction: Transaction) => [
  normalizeTransactionCardId(transaction),
  normalizeTransactionDateForDedupe(transaction.date),
  normalizeMerchant(transaction.merchant || ''),
  Math.abs(transaction.amount).toFixed(2),
].join('|');

const pickLongerText = (left?: string, right?: string) => {
  const leftValue = (left || '').trim();
  const rightValue = (right || '').trim();
  return rightValue.length > leftValue.length ? rightValue : leftValue;
};

const pickCategory = (left?: string, right?: string) => {
  const leftValue = (left || '').trim();
  const rightValue = (right || '').trim();
  if (!leftValue || /^uncategorized$/i.test(leftValue)) return rightValue || leftValue;
  if (!rightValue || /^uncategorized$/i.test(rightValue)) return leftValue;
  return rightValue.length > leftValue.length ? rightValue : leftValue;
};

const mergeTransactions = (current: Transaction, incoming: Transaction): Transaction => ({
  ...current,
  ...incoming,
  merchant: pickLongerText(current.merchant, incoming.merchant) || 'Unknown Merchant',
  category: pickCategory(current.category, incoming.category) || 'Uncategorized',
  cardId: incoming.cardId || current.cardId,
  source: incoming.source || current.source,
  uobSection: incoming.uobSection || current.uobSection,
  transactionType: incoming.transactionType || current.transactionType,
  paymentType: incoming.paymentType || current.paymentType,
  reimbursable: incoming.reimbursable ?? current.reimbursable,
  hsbcContactlessOptOut: incoming.hsbcContactlessOptOut ?? current.hsbcContactlessOptOut,
  originalIndex: Math.min(
    current.originalIndex ?? Number.MAX_SAFE_INTEGER,
    incoming.originalIndex ?? Number.MAX_SAFE_INTEGER
  ),
});

export const dedupeTransactions = (transactions: Transaction[]) => {
  const deduped = new Map<string, Transaction>();

  transactions.forEach((transaction) => {
    const key = getTransactionDedupeKey(transaction);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, transaction);
      return;
    }
    deduped.set(key, mergeTransactions(existing, transaction));
  });

  return Array.from(deduped.values());
};
