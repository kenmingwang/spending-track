export interface CategoryConfig {
  cap: number;
  mpd: number;
  autoEligible?: boolean;
  keywords?: string[];
  excludedKeywords?: string[];
  categoryKeywords?: string[];
  categoryNames?: string[];
  paymentTypes?: string[];
  requiredPaymentTypes?: string[];
}

export interface CardConfig {
  id: string;
  name: string;
  totalCap: number;
  icon: string;
  coverImage?: string;
  coverFit?: 'cover' | 'contain';
  coverScale?: number;
  coverPosition?: string;
  coverBackground?: string;
  requiresElection: boolean;
  maxElectable?: number;
  electableCategories?: Record<string, CategoryConfig>;
  categories: Record<string, CategoryConfig>;
  fallbackMPD: number;
  rewardType?: 'points' | 'miles' | 'cashback';
  description: string;
  sharedCap?: boolean;
}

export interface Transaction {
  date: string;
  merchant: string;
  category: string;
  amount: number;
  reimbursable?: boolean;
  cardId?: string;
  source?: string;
  uobSection?: string;
  statementId?: string;
  statementRef?: string;
  postDate?: string;
  statementCardNumber?: string;
  transactionType?: string;
  paymentType?: string;
  hsbcContactlessOptOut?: boolean;
  originalIndex?: number;
}

export interface StatementCardSummary {
  cardId: string;
  cardName: string;
  cardNumber?: string;
  total?: number;
}

export interface StatementRewardSummary {
  cardId: string;
  rewardType: 'points' | 'uni' | 'cashback';
  label: string;
  earned?: number;
  used?: number;
  adjusted?: number;
  previousBalance?: number;
  currentBalance?: number;
  statementValue?: number;
}

export interface ParsedStatement {
  statementId: string;
  bank: 'DBS' | 'UOB';
  statementDate: string;
  cards: StatementCardSummary[];
  transactions: Transaction[];
  rewardSummary: StatementRewardSummary[];
  sourceFileName: string;
}
