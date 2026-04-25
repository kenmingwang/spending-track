import React from 'react';
import {
  ArrowLeft,
  Check,
  CreditCard,
  Download,
  ExternalLink,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  WalletCards
} from 'lucide-react';
import { CardBenefitManager } from '../utils/card-benefits';
import { TransactionCalculator } from '../utils/calculator';
import { ParsedStatement, Transaction } from '../types';
import { TransactionTable } from './TransactionTable';
import { CardBreakdown } from './CardBreakdown';
import { CategoryAggregation } from './CategoryAggregation';
import {
  applyCategoryOverrides,
  applyOverrideToSimilar,
  updateOverridesForMerchant,
  type CategoryOverrides
} from '../utils/category-overrides';
import { enrichHsbcTransactionInference } from '../utils/merchant-category';
import { dedupeTransactions, mergeImportedTransactions, TransactionMergeStats } from '../utils/transaction-dedupe';
import { getCardDisplayDescription, getCardDisplayName, getCategoryDisplayName, t } from '../utils/i18n';
import { useLanguage } from '../utils/useLanguage';
import { createBackupPayload, downloadTextFile, parseBackupPayload, transactionsToCsv } from '../utils/backup';
import { OWNED_CARDS_STORAGE_KEY } from '../utils/storage-keys';
import { parseStatementPdfs } from '../utils/statement-parser';

type BackupStatus = {
  tone: 'neutral' | 'success' | 'error';
  message: string;
  importStats?: TransactionMergeStats & { statements: number };
};

const DEV_STORAGE_KEY = 'spending-track-dev-chrome-storage';

const getDevStorageSnapshot = (): Record<string, unknown> => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(DEV_STORAGE_KEY) || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
};

const setDevStorageSnapshot = (data: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(data));
};

const dashboardStorage = {
  async get(keys: string[] | string | null) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return chrome.storage.local.get(keys);
    }

    const snapshot = getDevStorageSnapshot();
    if (keys === null) return snapshot;
    const keyList = Array.isArray(keys) ? keys : [keys];
    return keyList.reduce<Record<string, unknown>>((accumulator, key) => {
      if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
        accumulator[key] = snapshot[key];
      }
      return accumulator;
    }, {});
  },
  async set(nextData: Record<string, unknown>) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set(nextData);
      return;
    }

    setDevStorageSnapshot({ ...getDevStorageSnapshot(), ...nextData });
  },
  async clear() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.clear();
      return;
    }

    setDevStorageSnapshot({});
  },
};

const openExternalUrl = (url: string) => {
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    void chrome.tabs.create({ url });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
};

type CardSetupModalProps = {
  visible: boolean;
  cards: ReturnType<typeof CardBenefitManager.getAllCards>;
  selectedCardIds: string[];
  language: 'en' | 'zh';
  onToggle: (cardId: string) => void;
  onClose: () => void;
  onSave: () => void;
};


const buildDashboardCopy = (language: 'en' | 'zh') => (
  language === 'zh'
    ? {
        subtitle: '\u9ad8\u7aef\u4fe1\u7528\u5361\u7ba1\u7406\u4e0e\u6d88\u8d39\u6d1e\u5bdf',
        manageCards: '\u7ba1\u7406\u5361\u7247',
        setupTitle: '\u5148\u6dfb\u52a0\u4f60\u6301\u6709\u7684\u4fe1\u7528\u5361',
        setupBody: '\u5148\u52fe\u9009\u4f60\u5b9e\u9645\u6301\u6709\u7684\u5361\u7247\u3002\u9996\u9875\u3001\u6d1e\u5bdf\u548c\u63d0\u9192\u90fd\u4f1a\u56f4\u7ed5\u8fd9\u4e9b\u5361\u7247\u5c55\u5f00\u3002',
        continue: '\u5f00\u59cb\u4f7f\u7528',
        selected: '\u5df2\u9009',
        portfolioTitle: '\u672c\u6708\u7ec4\u5408\u603b\u89c8',
        portfolioBody: '\u628a\u5c01\u9876\u8fdb\u5ea6\u3001\u91cc\u7a0b\u9884\u4f30\u3001\u5206\u7c7b\u7ed3\u6784\u548c\u5546\u6237\u53d8\u5316\u653e\u5728\u4e00\u4e2a\u89c6\u56fe\u91cc\u3002',
        activeCards: '\u5728\u7ba1\u5361\u7247',
        trackedSpend: '\u5df2\u8ffd\u8e2a\u6d88\u8d39',
        headroom: '\u5269\u4f59\u5c01\u9876\u7a7a\u95f4',
        expectedMiles: '\u9884\u4f30\u5956\u52b1',
        databaseTitle: '\u672c\u5730\u6570\u636e\u5907\u4efd\u4e0e\u6062\u590d',
        databaseBody: '\u5bfc\u51fa\u5b8c\u6574\u7684\u672c\u5730\u6570\u636e\u5feb\u7167\uff0c\u6216\u4ece\u5907\u4efd\u6587\u4ef6\u6062\u590d\u4ea4\u6613\u3001\u5206\u7c7b\u3001\u5361\u7247\u8bbe\u7f6e\u548c\u504f\u597d\u3002',
        exportBackup: '\u5bfc\u51fa\u5907\u4efd',
        importBackup: '\u5bfc\u5165\u5907\u4efd',
        backupReady: '\u672c\u5730\u6570\u636e\u5df2\u5c31\u7eea',
        backupExported: '\u5907\u4efd\u5df2\u5bfc\u51fa',
        backupImported: '\u5907\u4efd\u5df2\u5bfc\u5165\u5e76\u5237\u65b0',
        importConfirm: '\u5bfc\u5165\u4f1a\u66ff\u6362\u5f53\u524d\u672c\u5730\u6570\u636e\uff0c\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f',
        noCardsTitle: '\u5148\u9009\u62e9\u8981\u7ba1\u7406\u7684\u5361\u7247',
        noCardsBody: '\u9009\u597d\u5361\u4e4b\u540e\uff0c\u9996\u9875\u624d\u4f1a\u6309\u4f60\u7684\u771f\u5b9e\u7ec4\u5408\u663e\u793a\u5c01\u9876\u3001\u91cc\u7a0b\u548c\u63d0\u9192\u3002',
        insightsTitle: '\u6d88\u8d39\u6d1e\u5bdf',
        insightsBody: '\u4ece\u6d88\u8d39\u8282\u594f\u3001\u5e38\u7528\u5546\u6237\u3001\u5206\u7c7b\u7ed3\u6784\u548c\u5f02\u5e38\u652f\u51fa\u770b\u6e05\u672c\u6708\u8d70\u52bf\u3002',
        monthlyView: '\u6708\u5ea6\u89c6\u56fe',
        cardTools: '\u94f6\u884c\u5feb\u6377\u5165\u53e3',
        currentSelection: '\u8fd9\u91cc\u53ea\u663e\u793a\u4f60\u5df2\u6dfb\u52a0\u7684\u5361\u7247\u3002',
        exportCsv: '\u5bfc\u51fa CSV',
        currentCardBody: '\u67e5\u770b\u5c01\u9876\u8fdb\u5ea6\u3001\u5206\u7c7b\u5206\u5e03\u3001\u4ea4\u6613\u660e\u7ec6\u548c\u5173\u952e\u5546\u6237\u8868\u73b0\u3002',
        openBanks: '\u5efa\u8bae\u6bcf\u5468\u767b\u5f55\u4e00\u6b21\u94f6\u884c\u5e76\u626b\u63cf\uff0c\u5c01\u9876\u8ffd\u8e2a\u4f1a\u66f4\u51c6\u786e\u3002',
        setupHint: '\u4e4b\u540e\u4e5f\u80fd\u968f\u65f6\u8c03\u6574\u3002',
      }
    : {
        subtitle: 'Premium credit-card control and spend intelligence',
        manageCards: 'Manage Cards',
        setupTitle: 'Start with the cards you actually own',
        setupBody: 'Pick the cards in your wallet first. The home view, insights, and reminders will stay focused on those cards.',
        continue: 'Continue',
        selected: 'Selected',
        portfolioTitle: 'Portfolio Overview',
        portfolioBody: 'See card caps, expected miles, category mix, and merchant behavior in one place.',
        activeCards: 'Active Cards',
        trackedSpend: 'Tracked Spend',
        headroom: 'Cap Headroom',
        expectedMiles: 'Expected Rewards',
        databaseTitle: 'Database Backup & Restore',
        databaseBody: 'Export a full local database snapshot, or restore transactions, categories, card setup, and preferences from backup.',
        exportBackup: 'Export Backup',
        importBackup: 'Import Backup',
        backupReady: 'Database ready',
        backupExported: 'Backup exported',
        backupImported: 'Backup imported and reloaded',
        importConfirm: 'Importing will replace your current local data. Continue?',
        noCardsTitle: 'Pick the cards you want to manage',
        noCardsBody: 'Once you choose your cards, the dashboard will tailor caps, reminders, and insights to your real setup.',
        insightsTitle: 'Insight Studio',
        insightsBody: 'Explore spend cadence, recurring merchants, category structure, concentration, and notable outliers in one view.',
        monthlyView: 'Monthly view',
        cardTools: 'Bank links',
        currentSelection: 'Only your selected cards are shown here.',
        exportCsv: 'Export CSV',
        currentCardBody: 'Track cap usage, category pacing, transactions, and high-value merchants.',
        openBanks: 'Log in and scan weekly to keep your cap tracking accurate.',
        setupHint: 'You can change this any time.',
      }
);

const CardSetupModal: React.FC<CardSetupModalProps> = ({
  visible,
  cards,
  selectedCardIds,
  language,
  onToggle,
  onClose,
  onSave,
}) => {
  if (!visible) return null;

  const copy = buildDashboardCopy(language);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-[28px] border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-950 px-6 py-6 text-white">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{copy.manageCards}</div>
          <div className="mt-2 text-3xl font-semibold">{copy.setupTitle}</div>
          <div className="mt-2 max-w-3xl text-sm text-slate-300">{copy.setupBody}</div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {cards.map((card) => {
              const selected = selectedCardIds.includes(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onToggle(card.id)}
                  className={`rounded-[26px] border p-5 text-left transition-all ${selected ? 'border-blue-400 bg-blue-50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-[124px] h-[78px] rounded-2xl overflow-hidden border border-slate-200 bg-white">
                      {card.coverImage ? (
                        <img
                          src={card.coverImage}
                          alt={card.name}
                          className={`w-full h-full ${card.coverFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                          style={{
                            transform: `scale(${card.coverScale || 1})`,
                            objectPosition: card.coverPosition || 'center',
                            background: card.coverBackground || '#f8fafc'
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">{card.icon}</div>
                      )}
                    </div>

                    <div className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${selected ? 'border-blue-400 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-400'}`}>
                      {selected ? <Check size={18} /> : <Plus size={18} />}
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="text-lg font-semibold text-slate-950">{getCardDisplayName(card.id, language, card.name)}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">
                      {getCardDisplayDescription(card.id, language, card.description)}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-xs font-medium">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{selected ? copy.selected : copy.manageCards}</span>
                    <span className="text-slate-500">{copy.setupHint}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex items-center justify-between gap-4">
          <div className="text-sm text-slate-500">{selectedCardIds.length} / {cards.length} {copy.selected.toLowerCase()}</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {t(language, 'close')}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={selectedCardIds.length === 0}
              className="px-5 py-2.5 rounded-xl bg-slate-950 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copy.continue}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const copy = React.useMemo(() => buildDashboardCopy(language), [language]);
  const backupInputRef = React.useRef<HTMLInputElement | null>(null);

  const [allTransactions, setAllTransactions] = React.useState<Transaction[]>([]);
  const [excludeReimbursable, setExcludeReimbursable] = React.useState<boolean>(true);
  const [currentCard, setCurrentCard] = React.useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = React.useState<string>('');
  const [insightRange, setInsightRange] = React.useState<'month' | 'year' | 'all'>('month');
  const [insightMonth, setInsightMonth] = React.useState<string>('');
  const [insightYear, setInsightYear] = React.useState<string>('');
  const [userElections, setUserElections] = React.useState<Record<string, string[]>>({});
  const [categoryOverrides, setCategoryOverrides] = React.useState<CategoryOverrides>({});
  const [cardLastUpdated, setCardLastUpdated] = React.useState<Record<string, string>>({});
  const [ownedCards, setOwnedCards] = React.useState<string[]>([]);
  const [draftOwnedCards, setDraftOwnedCards] = React.useState<string[]>([]);
  const [showCardSetup, setShowCardSetup] = React.useState(false);
  const [backupStatus, setBackupStatus] = React.useState<BackupStatus>({
    tone: 'neutral',
    message: copy.backupReady
  });

  const availableCards = React.useMemo(() => CardBenefitManager.getAllCards(), []);

  const loadData = React.useCallback(async () => {
    const data = await dashboardStorage.get([
      'transactions',
      'cardConfigs',
      'categoryOverrides',
      'cardLastUpdated',
      'statements',
      OWNED_CARDS_STORAGE_KEY
    ]) as {
      transactions?: Transaction[];
      cardConfigs?: Record<string, string[]>;
      categoryOverrides?: CategoryOverrides;
      cardLastUpdated?: Record<string, string>;
      statements?: ParsedStatement[];
      ownedCards?: string[];
    };

    const overrides = data.categoryOverrides || {};
    const rawTransactions = dedupeTransactions(data.transactions || []);
    const enrichedTransactions = rawTransactions.map(enrichHsbcTransactionInference);
    const nextTransactions = applyCategoryOverrides(enrichedTransactions, overrides);
    const hasBackfilledTransactions = enrichedTransactions.some((transaction, index) => (
      transaction.category !== rawTransactions[index]?.category ||
      transaction.paymentType !== rawTransactions[index]?.paymentType
    ));

    const mergedCardConfigs = {
      UOB_LADYS: ['Dining', 'Travel'],
      ...(data.cardConfigs || {})
    };

    const storedOwnedCards = Array.isArray(data.ownedCards)
      ? data.ownedCards.filter((cardId) => availableCards.some((card) => card.id === cardId))
      : [];
    const effectiveOwnedCards = storedOwnedCards.length > 0
      ? storedOwnedCards
      : rawTransactions.length > 0
        ? availableCards.map((card) => card.id)
        : [];

    setAllTransactions(nextTransactions);
    setUserElections(mergedCardConfigs);
    setCategoryOverrides(overrides);
    setCardLastUpdated(data.cardLastUpdated || {});
    setOwnedCards(effectiveOwnedCards);
    setDraftOwnedCards(effectiveOwnedCards);
    setShowCardSetup(storedOwnedCards.length === 0 && rawTransactions.length === 0);

    if (currentCard && effectiveOwnedCards.length > 0 && !effectiveOwnedCards.includes(currentCard)) {
      setCurrentCard(null);
    }

    if (hasBackfilledTransactions || rawTransactions.length !== (data.transactions || []).length) {
      await dashboardStorage.set({ transactions: nextTransactions });
    }

    if (storedOwnedCards.length === 0 && rawTransactions.length > 0) {
      await dashboardStorage.set({ [OWNED_CARDS_STORAGE_KEY]: effectiveOwnedCards });
    }
  }, [availableCards, currentCard]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    setBackupStatus((current) => current.tone === 'neutral' ? { tone: 'neutral', message: copy.backupReady } : current);
  }, [copy.backupReady]);

  const visibleCards = React.useMemo(() => {
    if (ownedCards.length === 0) return [];
    return availableCards.filter((card) => ownedCards.includes(card.id));
  }, [availableCards, ownedCards]);

  const visibleCardIds = React.useMemo(() => new Set(visibleCards.map((card) => card.id)), [visibleCards]);

  const portfolioTransactions = React.useMemo(() => (
    allTransactions.filter((transaction) => visibleCardIds.has(CardBenefitManager.normalizeTransactionCardId(transaction)))
  ), [allTransactions, visibleCardIds]);

  const monthOptions = React.useMemo(() => (
    Object.keys(TransactionCalculator.groupTransactionsByMonth(portfolioTransactions)).sort((a, b) => b.localeCompare(a))
  ), [portfolioTransactions]);

  const yearOptions = React.useMemo(() => (
    Array.from(
      new Set(
        portfolioTransactions
          .map((transaction) => new Date(transaction.date))
          .filter((date) => !Number.isNaN(date.getTime()))
          .map((date) => String(date.getFullYear()))
      )
    ).sort((a, b) => Number(b) - Number(a))
  ), [portfolioTransactions]);

  React.useEffect(() => {
    if (monthOptions.length === 0) {
      setSelectedMonth('');
      setInsightMonth('');
      return;
    }
    if (!selectedMonth || !monthOptions.includes(selectedMonth)) {
      setSelectedMonth(monthOptions[0]);
    }
    if (!insightMonth || !monthOptions.includes(insightMonth)) {
      setInsightMonth(monthOptions[0]);
    }
  }, [insightMonth, monthOptions, selectedMonth]);

  React.useEffect(() => {
    if (yearOptions.length === 0) {
      setInsightYear('');
      return;
    }
    if (!insightYear || !yearOptions.includes(insightYear)) {
      setInsightYear(yearOptions[0]);
    }
  }, [insightYear, yearOptions]);

  const displayTransactions = React.useMemo(
    () => excludeReimbursable ? portfolioTransactions.filter((transaction) => !transaction.reimbursable) : portfolioTransactions,
    [excludeReimbursable, portfolioTransactions]
  );

  const currentMonthPortfolioTransactions = React.useMemo(() => {
    const now = new Date();
    return portfolioTransactions.filter((transaction) => {
      const date = new Date(transaction.date);
      return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
  }, [portfolioTransactions]);

  const homeTrackedSpend = React.useMemo(() => (
    visibleCards.reduce((sum, card) => {
      const monthlyTransactions = CardBenefitManager.filterTransactionsForCard(currentMonthPortfolioTransactions, card.id);
      const stats = TransactionCalculator.calculateStats(monthlyTransactions, card.id, userElections[card.id] || null);
      return sum + stats.totalSpent;
    }, 0)
  ), [currentMonthPortfolioTransactions, userElections, visibleCards]);

  const homeExpectedReward = React.useMemo(() => {
    const totals = visibleCards.reduce((accumulator, card) => {
      const monthlyTransactions = CardBenefitManager.filterTransactionsForCard(currentMonthPortfolioTransactions, card.id);
      if (card.rewardType === 'cashback') {
        accumulator.cashback += TransactionCalculator.calculateLiveFreshCashback(monthlyTransactions).cashback;
      } else {
        const stats = TransactionCalculator.calculateStats(monthlyTransactions, card.id, userElections[card.id] || null);
        accumulator.miles += stats.expectedMiles;
      }
      return accumulator;
    }, { miles: 0, cashback: 0 });
    if (totals.cashback > 0 && totals.miles > 0) return `${totals.miles.toLocaleString()} / $${totals.cashback.toFixed(2)}`;
    if (totals.cashback > 0) return `$${totals.cashback.toFixed(2)}`;
    return totals.miles.toLocaleString();
  }, [currentMonthPortfolioTransactions, userElections, visibleCards]);

  const homeCapHeadroom = React.useMemo(() => (
    visibleCards.reduce((sum, card) => {
      const monthlyTransactions = CardBenefitManager.filterTransactionsForCard(currentMonthPortfolioTransactions, card.id);
      if (card.rewardType === 'cashback') {
        return sum + TransactionCalculator.calculateLiveFreshCashback(monthlyTransactions).aggregateRemaining;
      }
      const stats = TransactionCalculator.calculateStats(monthlyTransactions, card.id, userElections[card.id] || null);
      return sum + Math.max(0, CardBenefitManager.getCardTotalCap(card.id) - stats.totalSpent);
    }, 0)
  ), [currentMonthPortfolioTransactions, userElections, visibleCards]);

  const filteredTransactions = React.useMemo(() => {
    let transactions = portfolioTransactions;
    if (currentCard) {
      transactions = transactions.filter((transaction) => CardBenefitManager.normalizeTransactionCardId(transaction) === currentCard);
    }
    if (selectedMonth) {
      const groups = TransactionCalculator.groupTransactionsByMonth(transactions);
      transactions = groups[selectedMonth] || [];
    }
    return transactions;
  }, [currentCard, portfolioTransactions, selectedMonth]);

  const overallInsightTransactions = React.useMemo(() => {
    if (insightRange === 'all') return displayTransactions;
    if (insightRange === 'month') {
      const groups = TransactionCalculator.groupTransactionsByMonth(displayTransactions);
      return groups[insightMonth] || [];
    }
    return displayTransactions.filter((transaction) => {
      const date = new Date(transaction.date);
      return !Number.isNaN(date.getTime()) && String(date.getFullYear()) === insightYear;
    });
  }, [displayTransactions, insightMonth, insightRange, insightYear]);

  const handleCategoryChange = async (transaction: Transaction, newCategory: string) => {
    const normalized = newCategory.trim() || 'Uncategorized';
    const updatedOverrides = updateOverridesForMerchant(categoryOverrides, transaction.merchant, normalized);
    const updatedTransactions = applyOverrideToSimilar(allTransactions, transaction.merchant, normalized);
    setAllTransactions(updatedTransactions);
    setCategoryOverrides(updatedOverrides);
    await dashboardStorage.set({
      transactions: updatedTransactions,
      categoryOverrides: updatedOverrides
    });
  };

  const handleReimbursableChange = async (transaction: Transaction, reimbursable: boolean) => {
    const updatedTransactions = allTransactions.map((item) => item === transaction ? { ...item, reimbursable } : item);
    setAllTransactions(updatedTransactions);
    await dashboardStorage.set({ transactions: updatedTransactions });
  };

  const handleHsbcContactlessOptOutChange = async (transaction: Transaction, optOut: boolean) => {
    const updatedTransactions = allTransactions.map((item) => (
      item !== transaction
        ? item
        : {
            ...item,
            hsbcContactlessOptOut: optOut,
            paymentType: '',
          }
    ));
    const refreshedTransactions = updatedTransactions.map(enrichHsbcTransactionInference);
    setAllTransactions(refreshedTransactions);
    await dashboardStorage.set({ transactions: refreshedTransactions });
  };

  const openUobBanking = () => openExternalUrl('https://pib.uob.com.sg/PIBLogin/Public/processPreCapture.do?keyId=lpc');
  const openDbsBanking = () => openExternalUrl('https://internet-banking.dbs.com.sg/IB/Welcome');

  const toggleDraftOwnedCard = (cardId: string) => {
    setDraftOwnedCards((current) => (
      current.includes(cardId)
        ? current.filter((item) => item !== cardId)
        : [...current, cardId]
    ));
  };

  const saveOwnedCards = async () => {
    if (draftOwnedCards.length === 0) return;
    const nextOwnedCards = availableCards
      .map((card) => card.id)
      .filter((cardId) => draftOwnedCards.includes(cardId));
    await dashboardStorage.set({ [OWNED_CARDS_STORAGE_KEY]: nextOwnedCards });
    setOwnedCards(nextOwnedCards);
    setShowCardSetup(false);
    if (currentCard && !nextOwnedCards.includes(currentCard)) {
      setCurrentCard(null);
    }
  };

  const openCardSetup = () => {
    setDraftOwnedCards(ownedCards);
    setShowCardSetup(true);
  };

  const handleExportBackup = async () => {
    const allData = await dashboardStorage.get(null);
    const payload = createBackupPayload(allData as Record<string, unknown>);
    const filename = `spending-track-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json');
    setBackupStatus({ tone: 'success', message: copy.backupExported });
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    try {
      const jsonFiles = files.filter((file) => /\.json$/i.test(file.name) || file.type === 'application/json');
      const pdfFiles = files.filter((file) => /\.pdf$/i.test(file.name) || file.type === 'application/pdf');

      if (jsonFiles.length > 0) {
        const raw = await jsonFiles[0].text();
        const nextData = parseBackupPayload(raw);
        const confirmed = window.confirm(copy.importConfirm);
        if (!confirmed) {
          event.target.value = '';
          return;
        }

        await dashboardStorage.clear();
        await dashboardStorage.set(nextData);
      }

      if (pdfFiles.length > 0) {
        const parsedStatements = await parseStatementPdfs(pdfFiles);
        const currentData = await dashboardStorage.get([
          'transactions',
          'statements',
          OWNED_CARDS_STORAGE_KEY,
          'cardLastUpdated'
        ]) as {
          transactions?: Transaction[];
          statements?: ParsedStatement[];
          ownedCards?: string[];
          cardLastUpdated?: Record<string, string>;
        };
        const importTransactions = parsedStatements.flatMap((statement) => statement.transactions);
        const mergeResult = mergeImportedTransactions(currentData.transactions || [], importTransactions);
        const mergedTransactions = mergeResult.transactions;
        const statementMap = new Map<string, ParsedStatement>();
        [...(currentData.statements || []), ...parsedStatements].forEach((statement) => {
          statementMap.set(statement.statementId, statement);
        });
        const nextStatements = Array.from(statementMap.values()).sort((a, b) => b.statementDate.localeCompare(a.statementDate));
        const importedCardIds = Array.from(new Set(parsedStatements.flatMap((statement) => statement.cards.map((card) => card.cardId))));
        const currentOwned = Array.isArray(currentData.ownedCards) ? currentData.ownedCards : [];
        const nextOwnedCards = Array.from(new Set([...currentOwned, ...importedCardIds]))
          .filter((cardId) => availableCards.some((card) => card.id === cardId));
        const nextLastUpdated = {
          ...(currentData.cardLastUpdated || {}),
          ...Object.fromEntries(importedCardIds.map((cardId) => [cardId, new Date().toISOString()])),
        };

        await dashboardStorage.set({
          transactions: mergedTransactions,
          statements: nextStatements,
          [OWNED_CARDS_STORAGE_KEY]: nextOwnedCards,
          cardLastUpdated: nextLastUpdated,
        });
        setBackupStatus({
          tone: 'success',
          importStats: {
            statements: parsedStatements.length,
            ...mergeResult.stats,
          },
          message: language === 'zh'
            ? `已导入 ${parsedStatements.length} 份账单，解析 ${mergeResult.stats.parsed} 条交易`
            : `Imported ${parsedStatements.length} statement(s), parsed ${mergeResult.stats.parsed} transactions`,
        });
      } else if (jsonFiles.length > 0) {
        setBackupStatus({ tone: 'success', message: copy.backupImported });
      }

      setCurrentCard(null);
      await loadData();
    } catch (error: any) {
      setBackupStatus({ tone: 'error', message: error?.message || t(language, 'failed_import_backup') });
    } finally {
      event.target.value = '';
    }
  };

  const handleExportCurrentCsv = () => {
    if (!currentCard) return;
    const filename = `${currentCard.toLowerCase()}-${selectedMonth || 'all'}-transactions.csv`;
    downloadTextFile(filename, transactionsToCsv(filteredTransactions), 'text/csv;charset=utf-8');
  };

  const backupToneClass = backupStatus.tone === 'success'
    ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100'
    : backupStatus.tone === 'error'
      ? 'border-rose-300/40 bg-rose-400/10 text-rose-100'
      : 'border-white/10 bg-white/10 text-white/70';

  const locale = language === 'zh' ? 'zh-CN' : 'en-SG';

  return (
    <div className="tabler-dashboard min-h-screen bg-[#f6f8fb] text-[#182433]">
      <input
        ref={backupInputRef}
        type="file"
        accept=".json,.pdf,application/json,application/pdf"
        multiple
        className="hidden"
        onChange={handleImportBackup}
      />

      <CardSetupModal
        visible={showCardSetup}
        cards={availableCards}
        selectedCardIds={draftOwnedCards}
        language={language}
        onToggle={toggleDraftOwnedCard}
        onClose={() => setShowCardSetup(false)}
        onSave={saveOwnedCards}
      />

      <header className="navbar navbar-expand-md d-print-none bg-white border-bottom sticky-top">
        <div className="container-xl flex-wrap gap-2 py-2">
          <div className="navbar-brand dashboard-brand d-flex align-items-center gap-3 m-0">
            <span className="avatar avatar-md bg-dark text-white rounded-circle">
                <WalletCards size={20} />
            </span>
            <span className="min-w-0">
              <span className="d-block fw-bold fs-2 lh-1">{t(language, 'app_name')}</span>
              <span className="dashboard-subtitle d-block text-muted small mt-1">{copy.subtitle}</span>
            </span>
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
              className="btn btn-outline-secondary btn-sm dashboard-language-btn"
            >
              {language === 'en' ? t(language, 'lang_zh') : t(language, 'lang_en')}
            </button>
          </div>

          <div className="dashboard-header-actions d-flex flex-wrap gap-2 ms-md-auto">
            {!currentCard && (
              <div className="dashboard-insight-controls dashboard-header-period-controls">
                <select
                  value={insightRange}
                  onChange={(event) => setInsightRange(event.target.value as 'month' | 'year' | 'all')}
                  className="form-select"
                  aria-label={copy.monthlyView}
                >
                  <option value="month">{t(language, 'month')}</option>
                  <option value="year">{t(language, 'year')}</option>
                  <option value="all">{t(language, 'all')}</option>
                </select>
                {insightRange === 'month' && monthOptions.length > 0 && (
                  <select
                    value={insightMonth}
                    onChange={(event) => setInsightMonth(event.target.value)}
                    className="form-select"
                    aria-label={t(language, 'month')}
                  >
                    {monthOptions.map((month) => (
                      <option key={month} value={month}>
                        {TransactionCalculator.formatMonthKey(month, locale)}
                      </option>
                    ))}
                  </select>
                )}
                {insightRange === 'year' && yearOptions.length > 0 && (
                  <select
                    value={insightYear}
                    onChange={(event) => setInsightYear(event.target.value)}
                    className="form-select"
                    aria-label={t(language, 'year')}
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={openCardSetup}
              className="btn btn-outline-secondary"
              title={copy.manageCards}
            >
              <Settings2 size={16} />
              <span className="dashboard-action-label">{copy.manageCards}</span>
            </button>
            <button
              type="button"
              onClick={handleExportBackup}
              className="btn btn-outline-secondary"
              title={copy.exportBackup}
            >
              <Download size={16} />
              <span className="dashboard-action-label">{copy.exportBackup}</span>
            </button>
            <button
              type="button"
              onClick={() => backupInputRef.current?.click()}
              className="btn btn-primary"
              title={copy.importBackup}
            >
              <Upload size={16} />
              <span className="dashboard-action-label">{copy.importBackup}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="page-wrapper">
        <div className="container-xl py-4">
        {currentCard ? (
          <>
            {(() => {
              const cardConfig = CardBenefitManager.getCardConfig(currentCard)!;
              const currentCardCap = CardBenefitManager.getCardTotalCap(currentCard);
              const stats = TransactionCalculator.calculateStats(filteredTransactions, currentCard, userElections[currentCard]);
              const netSpent = filteredTransactions.reduce((sum, transaction) => sum + (transaction.reimbursable ? 0 : Math.abs(transaction.amount)), 0);
              const uobDetail = currentCard === 'UOB_LADYS'
                ? TransactionCalculator.calculateUobEligibleSpend(filteredTransactions, userElections[currentCard] || null)
                : null;
              const hsbcDetail = currentCard === 'HSBC_REVOLUTION'
                ? TransactionCalculator.calculateHsbcEligibleSpend(filteredTransactions)
                : null;
              const liveFreshDetail = currentCard === 'DBS_LIVE_FRESH'
                ? TransactionCalculator.calculateLiveFreshCashback(filteredTransactions)
                : null;
              const rewardLabel = cardConfig.rewardType === 'cashback' ? t(language, 'cashback_label') : copy.expectedMiles;
              const rewardValue = cardConfig.rewardType === 'cashback'
                ? `$${(liveFreshDetail?.cashback || 0).toFixed(2)}`
                : stats.expectedMiles.toLocaleString();

              return (
                <>
                  <section className="card mb-4">
                    <div className="card-body">
                    <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-4">
                      <div className="d-flex align-items-center gap-3 gap-md-4">
                        <button
                          type="button"
                          onClick={() => setCurrentCard(null)}
                          className="btn btn-icon btn-outline-secondary flex-shrink-0"
                          aria-label="Back"
                        >
                          <ArrowLeft size={22} />
                        </button>
                        {cardConfig.coverImage && (
                          <div className="card-detail-image flex-shrink-0 overflow-hidden border bg-light">
                            <img
                              src={cardConfig.coverImage}
                              alt={cardConfig.name}
                              className={`w-100 h-100 ${cardConfig.coverFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                              style={{
                                transform: `scale(${cardConfig.coverScale || 1})`,
                                objectPosition: cardConfig.coverPosition || 'center',
                                background: cardConfig.coverBackground || '#f8fafc'
                              }}
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-uppercase small fw-semibold text-secondary">{copy.monthlyView}</div>
                          <h1 className="h1 mb-2 mt-1">{getCardDisplayName(currentCard, language, cardConfig.name)}</h1>
                          <p className="text-secondary mb-0">{copy.currentCardBody}</p>
                        </div>
                      </div>

                      <div className="btn-list flex-shrink-0">
                        {monthOptions.length > 0 && (
                          <select
                            value={selectedMonth}
                            onChange={(event) => setSelectedMonth(event.target.value)}
                            className="form-select w-auto"
                          >
                            {monthOptions.map((month) => (
                              <option key={month} value={month}>
                                {TransactionCalculator.formatMonthKey(month, locale)}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          onClick={handleExportCurrentCsv}
                          className="btn btn-primary"
                        >
                          <Download size={16} />
                          {copy.exportCsv}
                        </button>
                      </div>
                    </div>
                    </div>
                  </section>

                  <section className="row row-cards mb-4">
                    <div className="col-sm-6 col-lg-4">
                    <div className="card">
                      <div className="card-body">
                      <div className="text-uppercase small fw-semibold text-secondary">{t(language, 'net_spend_excl_reimb')}</div>
                      <div className="h1 mt-3 mb-0">${netSpent.toFixed(2)}</div>
                      </div>
                    </div>
                    </div>
                    <div className="col-sm-6 col-lg-4">
                    <div className="card">
                      <div className="card-body">
                      <div className="text-uppercase small fw-semibold text-secondary">{rewardLabel}</div>
                      <div className="h1 mt-3 mb-0 text-primary">{rewardValue}</div>
                      </div>
                    </div>
                    </div>
                    <div className="col-sm-6 col-lg-4">
                    <div className="card">
                      <div className="card-body">
                      <div className="text-uppercase small fw-semibold text-secondary">{cardConfig.rewardType === 'cashback' ? t(language, 'cashback_label') : t(language, 'mpd_cap_remaining')}</div>
                      <div className="h1 mt-3 mb-0">${Math.max(0, currentCardCap - stats.totalSpent).toFixed(2)}</div>
                      </div>
                    </div>
                    </div>
                  </section>

                  {uobDetail && (
                    <section className="card mb-4">
                      <div className="card-header">
                        <h3 className="card-title">{t(language, 'uob_category_cap_detail')}</h3>
                      </div>
                      <div className="card-body">
                      <div className="row row-cards">
                        {Object.keys(uobDetail.categorySpent).map((category) => {
                          const bonusUsed = uobDetail.categorySpent[category] || 0;
                          const remaining = uobDetail.perCategoryCap - bonusUsed;
                          const pct = Math.min(100, (bonusUsed / Math.max(1, uobDetail.perCategoryCap)) * 100);
                          return (
                            <div key={category} className="col-md-6">
                            <div className="border rounded bg-light p-3">
                              <div className="d-flex align-items-center justify-content-between gap-3">
                                <div className="fw-semibold">
                                  {getCategoryDisplayName(category, language)}
                                </div>
                                <div className="fw-semibold">
                                  ${bonusUsed.toFixed(2)} / ${uobDetail.perCategoryCap}
                                </div>
                              </div>
                              <div className="progress progress-sm mt-3">
                                <div
                                  className={`progress-bar ${category === 'Dining' ? 'bg-green' : 'bg-purple'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="mt-2 small text-secondary">
                                {t(language, 'balance_short')} {remaining < 0 ? '-' : ''}${Math.abs(remaining).toFixed(2)}
                              </div>
                            </div>
                            </div>
                          );
                        })}
                      </div>
                      </div>
                    </section>
                  )}

                  {hsbcDetail && (
                    <section className="card mb-4">
                      <div className="card-header">
                        <h3 className="card-title">{t(language, 'hsbc_matched_categories')}</h3>
                      </div>
                      <div className="card-body">
                      <div className="row row-cards">
                        {Object.entries(hsbcDetail.categorySpent)
                          .filter(([, used]) => used > 0)
                          .sort((a, b) => b[1] - a[1])
                          .map(([category, used]) => (
                            <div key={category} className="col-md-6">
                            <div className="border rounded bg-light p-3">
                              <div className="d-flex align-items-center justify-content-between gap-3">
                                <div className="fw-semibold">
                                  {getCategoryDisplayName(category, language)}
                                </div>
                                <div className="fw-semibold">${used.toFixed(2)}</div>
                              </div>
                              <div className="progress progress-sm mt-3">
                                <div
                                  className="progress-bar bg-red"
                                  style={{ width: `${Math.min(100, (used / Math.max(1, hsbcDetail.aggregateCap)) * 100)}%` }}
                                />
                              </div>
                            </div>
                            </div>
                          ))}
                      </div>
                      </div>
                    </section>
                  )}

                  <TransactionTable
                    transactions={filteredTransactions}
                    cardId={currentCard}
                    userElections={userElections[currentCard]}
                    onCategoryChange={handleCategoryChange}
                    onReimbursableChange={handleReimbursableChange}
                    onHsbcContactlessOptOutChange={handleHsbcContactlessOptOutChange}
                    language={language}
                  />
                </>
              );
            })()}
          </>
        ) : (
          <>
            <section className="row row-cards align-items-stretch dashboard-overview-row">
              <div className="col-xl-8 d-flex">
                <div className="card h-100 w-100">
                  <div className="card-body">
                    <div className="subheader d-flex align-items-center gap-2">
                      <Sparkles size={14} />
                      {copy.portfolioTitle}
                    </div>
                    <h1 className="h1 mt-2 mb-2">{copy.portfolioTitle}</h1>
                    <p className="text-muted mb-4">{copy.portfolioBody}</p>

                    <div className="row g-3">
                      {[
                        [copy.activeCards, visibleCards.length.toLocaleString()],
                        [copy.trackedSpend, `$${homeTrackedSpend.toFixed(2)}`],
                        [copy.expectedMiles, homeExpectedReward],
                        [copy.headroom, `$${homeCapHeadroom.toFixed(2)}`],
                      ].map(([label, value]) => (
                        <div className="col-6 col-lg-3" key={label}>
                          <div className="card bg-light border-0">
                            <div className="card-body p-3">
                              <div className="subheader">{label}</div>
                              <div className="h2 mb-0 mt-2">{value}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-xl-4 d-flex">
                <div className="dashboard-overview-side d-flex flex-column gap-3 w-100">
                <div className="card dashboard-backup-card">
                  <div className="card-body">
                    <div className="d-flex align-items-center gap-2 fw-semibold">
                      <ShieldCheck size={16} className="text-green" />
                      <span>{copy.databaseTitle}</span>
                    </div>
                    <div className="text-muted mt-2">{backupStatus.message}</div>
                    {backupStatus.importStats && (
                      <div className="statement-import-stats mt-3">
                        <div>
                          <span className="text-muted">{language === 'zh' ? '新增明细' : 'New rows'}</span>
                          <strong>{backupStatus.importStats.added.toLocaleString()}</strong>
                        </div>
                        <div>
                          <span className="text-muted">{language === 'zh' ? '补齐明细' : 'Updated rows'}</span>
                          <strong>{backupStatus.importStats.updated.toLocaleString()}</strong>
                        </div>
                        <div>
                          <span className="text-muted">{language === 'zh' ? '已存在' : 'Already present'}</span>
                          <strong>{backupStatus.importStats.unchanged.toLocaleString()}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card flex-fill">
                  <div className="card-body">
                    <div className="fw-semibold">{copy.cardTools}</div>
                    <div className="btn-list mt-3">
                      <button onClick={openUobBanking} className="btn btn-outline-secondary">
                        <ExternalLink size={15} />
                        {t(language, 'open_uob')}
                      </button>
                      <button onClick={openDbsBanking} className="btn btn-outline-secondary">
                        <ExternalLink size={15} />
                        {t(language, 'open_dbs')}
                      </button>
                    </div>
                    <div className="text-muted mt-3">{copy.openBanks}</div>
                  </div>
                </div>
                </div>
              </div>
            </section>

            <section className="mt-4">
              <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3 mb-3">
                <div>
                  <div className="h2 mb-1">{t(language, 'your_cards')}</div>
                  <div className="text-muted">{copy.currentSelection}</div>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                  <div className="card px-3 py-2">
                    <label className="form-check form-switch m-0">
                      <input
                        type="checkbox"
                        checked={excludeReimbursable}
                        onChange={(event) => setExcludeReimbursable(event.target.checked)}
                        className="form-check-input"
                      />
                      <span className="form-check-label">{t(language, 'exclude_reimbursable')}</span>
                    </label>
                  </div>
                  <div className="badge bg-secondary-lt fs-4 py-2 px-3">
                    {t(language, 'showing_amount')} <span className="fw-bold">${(excludeReimbursable ? displayTransactions : portfolioTransactions).reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0).toFixed(2)}</span>
                    {excludeReimbursable && <span className="text-muted ms-1">({t(language, 'gross_amount')} ${(portfolioTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)).toFixed(2)})</span>}
                  </div>
                </div>
              </div>

              {visibleCards.length > 0 ? (
                <div className="row row-cards">
                  {visibleCards.map((card) => (
                    <div className="col-md-6 col-xl-4" key={card.id}>
                      <CardBreakdown
                        card={card}
                        transactions={allTransactions}
                        userElections={userElections[card.id]}
                        excludeReimbursable={excludeReimbursable}
                        language={language}
                        lastUpdatedAt={cardLastUpdated[card.id]}
                        onViewDetails={() => setCurrentCard(card.id)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card">
                  <div className="empty">
                    <div className="empty-img">
                      <span className="avatar avatar-lg rounded-circle">
                        <CreditCard size={24} />
                      </span>
                    </div>
                    <p className="empty-title">{copy.noCardsTitle}</p>
                    <p className="empty-subtitle text-muted">{copy.noCardsBody}</p>
                  <button
                    type="button"
                    onClick={openCardSetup}
                      className="btn btn-primary"
                  >
                    <Plus size={16} />
                    {copy.manageCards}
                  </button>
                  </div>
                </div>
              )}
            </section>

            <section className="mt-4">
              <div className="d-flex flex-column flex-xl-row align-items-xl-end justify-content-between gap-3 mb-3">
                <div>
                  <div className="h2 mb-1">{copy.insightsTitle}</div>
                  <div className="text-muted">{copy.insightsBody}</div>
                </div>
              </div>

              <CategoryAggregation
                transactions={overallInsightTransactions}
                allTransactions={displayTransactions}
                compareMode={insightRange === 'month' ? 'mom' : insightRange === 'year' ? 'yoy' : null}
                currentMonthKey={insightMonth}
                currentYear={insightYear}
                language={language}
              />
            </section>
          </>
        )}
        </div>
      </main>
    </div>
  );
};

