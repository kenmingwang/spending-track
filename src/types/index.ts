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
  requiresElection: boolean;
  maxElectable?: number;
  electableCategories?: Record<string, CategoryConfig>;
  categories: Record<string, CategoryConfig>;
  fallbackMPD: number;
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
  transactionType?: string;
  paymentType?: string;
  hsbcContactlessOptOut?: boolean;
  originalIndex?: number;
}
