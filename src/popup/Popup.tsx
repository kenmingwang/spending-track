import React, { useEffect, useState } from 'react';
import { CreditCard, ExternalLink, Play, RefreshCw, Square } from 'lucide-react';
import { Transaction } from '../types';
import { CardBenefitManager } from '../utils/card-benefits';
import { TransactionCalculator } from '../utils/calculator';
import { getCardDisplayName, getCategoryDisplayName } from '../utils/i18n';
import { enrichHsbcTransactionInference } from '../utils/merchant-category';
import { useLanguage } from '../utils/useLanguage';
import { OWNED_CARDS_STORAGE_KEY } from '../utils/storage-keys';
import { useScanner } from './useScanner';

type PopupCardStat = {
  id: string;
  icon: string;
  coverImage?: string;
  coverFit?: 'cover' | 'contain';
  coverScale?: number;
  coverPosition?: string;
  coverBackground?: string;
  totalCap: number;
  displayName: string;
  spent: number;
  miles: number;
  cashback: number;
  uobDetail: ReturnType<typeof TransactionCalculator.calculateUobEligibleSpend> | null;
  hsbcDetail: ReturnType<typeof TransactionCalculator.calculateHsbcEligibleSpend> | null;
  lastUpdatedAt: string | null;
};

export const Popup: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { isScanning, progress, status, startScan, stopScan } = useScanner(language);
  const [cardStats, setCardStats] = useState<PopupCardStat[]>([]);
  const [uobRewards, setUobRewards] = useState<Array<{ label: string; value: number }>>([]);
  const [hasOwnedCards, setHasOwnedCards] = useState(true);

  useEffect(() => {
    void loadStats();
  }, [isScanning, language]);

  const loadStats = async () => {
    const data = await chrome.storage.local.get([
      'transactions',
      'uobRewards',
      'cardConfigs',
      'cardLastUpdated',
      OWNED_CARDS_STORAGE_KEY
    ]) as {
      transactions?: Transaction[];
      uobRewards?: Array<{ label: string; value: number }>;
      cardConfigs?: Record<string, string[]>;
      cardLastUpdated?: Record<string, string>;
      ownedCards?: string[];
    };

    const rawTransactions = data.transactions || [];
    const transactions = rawTransactions.map(enrichHsbcTransactionInference);
    const lastUpdated = data.cardLastUpdated || {};
    const now = new Date();
    const hasBackfilledTransactions = transactions.some((txn, index) => (
      txn.category !== rawTransactions[index]?.category ||
      txn.paymentType !== rawTransactions[index]?.paymentType
    ));

    setUobRewards(data.uobRewards || []);

    const ownedCards = Array.isArray(data.ownedCards)
      ? data.ownedCards.filter((cardId) => CardBenefitManager.getAllCards().some((card) => card.id === cardId))
      : [];
    const visibleCards = ownedCards.length > 0
      ? CardBenefitManager.getAllCards().filter((card) => ownedCards.includes(card.id))
      : rawTransactions.length > 0
        ? CardBenefitManager.getAllCards()
        : [];
    setHasOwnedCards(visibleCards.length > 0);

    const stats = visibleCards.map((card) => {
      const monthlyTransactions = CardBenefitManager
        .filterTransactionsForCard(transactions, card.id)
        .filter((txn) => {
          const date = new Date(txn.date);
          return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
        });

      const calculated = TransactionCalculator.calculateStats(monthlyTransactions, card.id);
      const liveFresh = card.id === 'DBS_LIVE_FRESH'
        ? TransactionCalculator.calculateLiveFreshCashback(monthlyTransactions)
        : null;
      const uobDetail = card.id === 'UOB_LADYS'
        ? TransactionCalculator.calculateUobEligibleSpend(monthlyTransactions, data.cardConfigs?.[card.id] || null)
        : null;
      const hsbcDetail = card.id === 'HSBC_REVOLUTION'
        ? TransactionCalculator.calculateHsbcEligibleSpend(monthlyTransactions)
        : null;

      return {
        id: card.id,
        icon: card.icon,
        coverImage: card.coverImage,
        coverFit: card.coverFit,
        coverScale: card.coverScale,
        coverPosition: card.coverPosition,
        coverBackground: card.coverBackground,
        totalCap: CardBenefitManager.getCardTotalCap(card.id),
        displayName: getCardDisplayName(card.id, language, card.name),
        spent: calculated.totalSpent,
        miles: calculated.expectedMiles,
        cashback: liveFresh?.cashback || 0,
        uobDetail,
        hsbcDetail,
        lastUpdatedAt: lastUpdated[card.id] || null,
      };
    });

    setCardStats(stats);

    if (hasBackfilledTransactions) {
      await chrome.storage.local.set({ transactions });
    }
  };

  const openDashboard = () => chrome.tabs.create({ url: 'dashboard/dashboard.html' });
  const openUobBanking = () => chrome.tabs.create({ url: 'https://pib.uob.com.sg/PIBLogin/Public/processPreCapture.do?keyId=lpc' });
  const openDbsBanking = () => chrome.tabs.create({ url: 'https://internet-banking.dbs.com.sg/IB/Welcome' });

  const resetData = async () => {
    const message = language === 'zh'
      ? '\u786e\u8ba4\u6e05\u7a7a\u6240\u6709\u6570\u636e\u5417\uff1f'
      : 'Are you sure you want to clear all data?';
    if (!confirm(message)) return;
    await chrome.storage.local.clear();
    await loadStats();
  };

  const locale = language === 'zh' ? 'zh-CN' : 'en-SG';

  return (
    <div className="w-[350px] bg-white text-gray-900 font-sans p-4 shadow-xl">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CreditCard size={20} className="text-blue-600" />
          {t('app_name')}
        </h1>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
            className="px-2 py-1 text-[10px] border border-gray-200 rounded-md hover:bg-gray-100"
            title={t('switch_language')}
          >
            {language === 'en' ? t('lang_zh') : t('lang_en')}
          </button>
          <button
            onClick={openDashboard}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500 hover:text-blue-600"
            title={t('open_dashboard')}
          >
            <ExternalLink size={18} />
          </button>
        </div>
      </header>

      <div className="space-y-3 mb-6">
        {!hasOwnedCards && (
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-sm font-bold text-slate-900 mb-1">
              {t('setup_cards_first_title')}
            </div>
            <div className="text-xs text-slate-500 mb-3">
              {t('setup_cards_first_body')}
            </div>
            <button
              onClick={openDashboard}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <ExternalLink size={14} />
              {t('open_dashboard')}
            </button>
          </div>
        )}

        {cardStats.map((card) => (
          <div key={card.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="shrink-0 w-[60px] h-[38px] rounded-md overflow-hidden border border-gray-200 bg-white">
                {card.coverImage ? (
                  <img
                    src={card.coverImage}
                    alt={card.displayName}
                    className={`w-full h-full ${card.coverFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                    style={{
                      transform: `scale(${card.coverScale || 1})`,
                      objectPosition: card.coverPosition || 'center',
                      background: card.coverBackground || '#f8fafc'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">{card.icon}</div>
                )}
              </div>
              <div className="flex-grow">
                <div className="text-sm font-bold truncate">{card.displayName}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                  {t('remaining')}: ${Math.max(0, card.totalCap - card.spent).toFixed(2)}
                </div>
                {card.lastUpdatedAt && (
                  <div className="text-[10px] text-gray-400">
                    {t('last_updated')}: {new Date(card.lastUpdatedAt).toLocaleDateString(locale)}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-blue-600">
                  {card.id === 'DBS_LIVE_FRESH' ? `$${card.cashback.toFixed(2)} ${t('cashback_label')}` : `${card.miles} ${t('miles_label')}`}
                </div>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-1">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (card.spent / card.totalCap) * 100)}%` }}
              />
            </div>

            {card.id === 'UOB_LADYS' && card.uobDetail && (
              <div className="mt-2 space-y-1">
                {[t('dining'), t('travel')].map((label, index) => {
                  const sourceKey = index === 0 ? 'Dining' : 'Travel';
                  const used = Number(card.uobDetail?.categorySpent?.[sourceKey] || 0);
                  const cap = Number(card.uobDetail?.perCategoryCap || 750);
                  const remaining = Math.max(0, cap - used);
                  const pct = Math.min(100, cap > 0 ? (used / cap) * 100 : 0);

                  return (
                    <div key={sourceKey} className="text-[10px] text-gray-500">
                      <div className="flex justify-between">
                        <span>{label}</span>
                        <span>{t('balance_short')} ${remaining.toFixed(0)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1 mt-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${sourceKey === 'Dining' ? 'bg-emerald-500' : 'bg-violet-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-0.5">${used.toFixed(0)} / ${cap}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {card.id === 'HSBC_REVOLUTION' && card.hsbcDetail && (
              <div className="mt-2 space-y-1">
                {Object.entries(card.hsbcDetail.categorySpent)
                  .filter(([, used]) => used > 0)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([category, used]) => {
                    const pct = Math.min(100, card.hsbcDetail!.aggregateCap > 0 ? (used / card.hsbcDetail!.aggregateCap) * 100 : 0);

                    return (
                      <div key={category} className="text-[10px] text-gray-500">
                        <div className="flex justify-between">
                          <span>{getCategoryDisplayName(category, language)}</span>
                          <span>${used.toFixed(0)} {t('hsbc_matched_amount')}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-0.5">
                          <div
                            className="h-full rounded-full transition-all duration-500 bg-red-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-100">
        <div className="text-xs font-bold text-blue-800 mb-1">{t('status')}</div>
        <div className="text-sm text-blue-900 font-medium mb-3">{status}</div>

        {isScanning && progress && (
          <div className="mb-4">
            <div className="w-full bg-blue-100 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isScanning ? (
            <button
              onClick={startScan}
              className="flex-grow flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Play size={16} fill="white" /> {t('start_scanning')}
            </button>
          ) : (
            <button
              onClick={stopScan}
              className="flex-grow flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors"
            >
              <Square size={16} fill="white" /> {t('stop_scan')}
            </button>
          )}
        </div>
      </div>

      {uobRewards.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-100">
          <div className="text-xs font-bold text-amber-800 mb-2">{t('latest_uob_rewards')}</div>
          <div className="space-y-1.5">
            {uobRewards.slice(0, 3).map((item, idx) => (
              <div key={`${item.label}-${idx}`} className="flex justify-between gap-2 text-xs">
                <span className="text-amber-900 truncate">{item.label}</span>
                <span className="text-amber-700 font-bold">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center text-[10px] text-gray-400">
        <button
          onClick={resetData}
          className="flex items-center gap-1 hover:text-red-500 transition-colors font-medium"
        >
          <RefreshCw size={10} /> {t('reset_all_data')}
        </button>
        <div className="font-medium">Version 1.0.0</div>
      </div>

      <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg p-2.5">
        <div className="text-[10px] font-semibold text-gray-600 mb-2">{t('weekly_update_reminder')}</div>
        <div className="flex gap-2 mb-1.5">
          <button
            onClick={openUobBanking}
            className="flex-1 text-[10px] px-2 py-1.5 rounded bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-semibold"
          >
            {t('open_uob')}
          </button>
          <button
            onClick={openDbsBanking}
            className="flex-1 text-[10px] px-2 py-1.5 rounded bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-semibold"
          >
            {t('open_dbs')}
          </button>
        </div>
        <div className="text-[10px] text-gray-500">{t('login_scan_weekly')}</div>
      </div>
    </div>
  );
};
