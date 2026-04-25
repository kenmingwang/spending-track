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

export const getTransactionFallbackDedupeKey = (transaction: Transaction) => [
  normalizeTransactionCardId(transaction),
  normalizeTransactionDateForDedupe(transaction.date),
  normalizeMerchant(transaction.merchant || ''),
  Math.abs(transaction.amount).toFixed(2),
].join('|');

export const getTransactionDedupeKey = (transaction: Transaction) => [
  normalizeTransactionCardId(transaction),
  transaction.statementRef
    ? `ref:${transaction.statementRef}`
    : transaction.statementId && transaction.originalIndex !== undefined
      ? `stmt:${transaction.statementId}:${transaction.originalIndex}`
      : '',
  getTransactionFallbackDedupeKey(transaction),
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
  statementId: incoming.statementId || current.statementId,
  statementRef: incoming.statementRef || current.statementRef,
  postDate: incoming.postDate || current.postDate,
  statementCardNumber: incoming.statementCardNumber || current.statementCardNumber,
  transactionType: incoming.transactionType || current.transactionType,
  paymentType: incoming.paymentType || current.paymentType,
  reimbursable: incoming.reimbursable ?? current.reimbursable,
  hsbcContactlessOptOut: incoming.hsbcContactlessOptOut ?? current.hsbcContactlessOptOut,
  originalIndex: Math.min(
    current.originalIndex ?? Number.MAX_SAFE_INTEGER,
    incoming.originalIndex ?? Number.MAX_SAFE_INTEGER
  ),
});

export type TransactionMergeStats = {
  parsed: number;
  added: number;
  updated: number;
  unchanged: number;
};

const hasStatementMetadataGain = (current: Transaction, incoming: Transaction) => (
  (!current.statementId && Boolean(incoming.statementId)) ||
  (!current.statementRef && Boolean(incoming.statementRef)) ||
  (!current.postDate && Boolean(incoming.postDate)) ||
  (!current.statementCardNumber && Boolean(incoming.statementCardNumber)) ||
  (!current.source && Boolean(incoming.source))
);

const canMergeByFallback = (current: Transaction, incoming: Transaction) => {
  if (current.statementId && incoming.statementId) {
    return current.statementId === incoming.statementId && current.originalIndex === incoming.originalIndex;
  }
  return true;
};

export const mergeImportedTransactions = (
  currentTransactions: Transaction[],
  importedTransactions: Transaction[]
) => {
  const merged = [...currentTransactions];
  const strictIndex = new Map<string, number>();
  const fallbackIndex = new Map<string, number>();
  const stats: TransactionMergeStats = {
    parsed: importedTransactions.length,
    added: 0,
    updated: 0,
    unchanged: 0,
  };

  merged.forEach((transaction, index) => {
    strictIndex.set(getTransactionDedupeKey(transaction), index);
    fallbackIndex.set(getTransactionFallbackDedupeKey(transaction), index);
  });

  importedTransactions.forEach((incoming) => {
    const strictKey = getTransactionDedupeKey(incoming);
    const fallbackKey = getTransactionFallbackDedupeKey(incoming);
    const strictMatchIndex = strictIndex.get(strictKey);
    const fallbackMatchIndex = fallbackIndex.get(fallbackKey);
    const fallbackMatch = fallbackMatchIndex === undefined ? null : merged[fallbackMatchIndex];
    const shouldUseFallback = strictMatchIndex === undefined
      && fallbackMatch
      && canMergeByFallback(fallbackMatch, incoming);
    const existingIndex = strictMatchIndex ?? (shouldUseFallback ? fallbackMatchIndex : undefined);

    if (existingIndex === undefined) {
      const nextIndex = merged.length;
      merged.push(incoming);
      strictIndex.set(strictKey, nextIndex);
      fallbackIndex.set(fallbackKey, nextIndex);
      stats.added += 1;
      return;
    }

    const current = merged[existingIndex];
    merged[existingIndex] = mergeTransactions(current, incoming);
    if (hasStatementMetadataGain(current, incoming)) {
      stats.updated += 1;
    } else {
      stats.unchanged += 1;
    }
    strictIndex.set(getTransactionDedupeKey(merged[existingIndex]), existingIndex);
    fallbackIndex.set(getTransactionFallbackDedupeKey(merged[existingIndex]), existingIndex);
  });

  return {
    transactions: dedupeTransactions(merged),
    stats,
  };
};

export const dedupeTransactions = (transactions: Transaction[]) => {
  const deduped: Transaction[] = [];
  const strictIndex = new Map<string, number>();
  const fallbackIndex = new Map<string, number>();

  transactions.forEach((transaction) => {
    const strictKey = getTransactionDedupeKey(transaction);
    const fallbackKey = getTransactionFallbackDedupeKey(transaction);
    const strictMatchIndex = strictIndex.get(strictKey);
    const fallbackMatchIndex = fallbackIndex.get(fallbackKey);
    const fallbackMatch = fallbackMatchIndex === undefined ? null : deduped[fallbackMatchIndex];
    const shouldUseFallback = strictMatchIndex === undefined
      && fallbackMatch
      && canMergeByFallback(fallbackMatch, transaction);
    const existingIndex = strictMatchIndex ?? (shouldUseFallback ? fallbackMatchIndex : undefined);

    if (existingIndex === undefined) {
      const nextIndex = deduped.length;
      deduped.push(transaction);
      strictIndex.set(strictKey, nextIndex);
      fallbackIndex.set(fallbackKey, nextIndex);
      return;
    }

    deduped[existingIndex] = mergeTransactions(deduped[existingIndex], transaction);
    strictIndex.set(getTransactionDedupeKey(deduped[existingIndex]), existingIndex);
    fallbackIndex.set(getTransactionFallbackDedupeKey(deduped[existingIndex]), existingIndex);
  });

  return deduped;
};
