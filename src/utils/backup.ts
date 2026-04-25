import { Transaction } from '../types';

export const APP_BACKUP_VERSION = '2026.04.24';

export type AppBackupPayload = {
  version: string;
  exportedAt: string;
  data: Record<string, unknown>;
};

export const createBackupPayload = (data: Record<string, unknown>): AppBackupPayload => ({
  version: APP_BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  data,
});

export const parseBackupPayload = (raw: string): Record<string, unknown> => {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid backup file');
  }

  if ('data' in parsed && parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
    return parsed.data as Record<string, unknown>;
  }

  return parsed as Record<string, unknown>;
};

export const downloadTextFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const escapeCsvValue = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const transactionsToCsv = (transactions: Transaction[]) => {
  const headers = [
    'date',
    'merchant',
    'category',
    'amount',
    'reimbursable',
    'cardId',
    'source',
    'statementId',
    'statementRef',
    'postDate',
    'statementCardNumber',
    'uobSection',
    'transactionType',
    'paymentType'
  ];

  const rows = transactions.map((transaction) => [
    transaction.date,
    transaction.merchant,
    transaction.category,
    transaction.amount,
    transaction.reimbursable ? 'true' : 'false',
    transaction.cardId || '',
    transaction.source || '',
    transaction.statementId || '',
    transaction.statementRef || '',
    transaction.postDate || '',
    transaction.statementCardNumber || '',
    transaction.uobSection || '',
    transaction.transactionType || '',
    transaction.paymentType || ''
  ]);

  return [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCsvValue).join(','))
  ].join('\n');
};
