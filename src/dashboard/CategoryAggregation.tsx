import React from 'react';
import { Transaction } from '../types';
import { normalizeCategory, normalizeMerchant } from '../utils/category-overrides';
import { Language, t } from '../utils/i18n';

interface Props {
  transactions: Transaction[];
  allTransactions?: Transaction[];
  compareMode?: 'mom' | 'yoy' | null;
  currentMonthKey?: string;
  currentYear?: string;
  language?: Language;
}

export const CategoryAggregation: React.FC<Props> = ({
  transactions,
  allTransactions = [],
  compareMode = null,
  currentMonthKey,
  currentYear,
  language = 'en',
}) => {
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [largestExpanded, setLargestExpanded] = React.useState(false);
  const [frequentExpanded, setFrequentExpanded] = React.useState(false);

  const localizeCategory = React.useCallback((category: string) => {
    const cat = normalizeCategory(category || 'Uncategorized');
    if (cat === 'Dining') return t(language, 'dining');
    if (cat === 'Travel') return t(language, 'travel');
    return cat;
  }, [language]);

  const getCategoryEmoji = React.useCallback((category: string) => {
    const cat = (category || '').toUpperCase();
    if (cat.includes('DINING') || cat.includes('FOOD')) return '🍽️';
    if (cat.includes('TRAVEL')) return '✈️';
    if (cat.includes('TRANSPORT')) return '🚌';
    if (cat.includes('GROCER')) return '🛒';
    if (cat.includes('SHOPPING') || cat.includes('FASHION')) return '🛍️';
    if (cat.includes('BILL') || cat.includes('UTILIT')) return '🧾';
    if (cat.includes('ENTERTAINMENT')) return '🎬';
    if (cat.includes('HEALTH') || cat.includes('FITNESS')) return '💪';
    if (cat.includes('BEAUTY')) return '💄';
    if (cat.includes('ONLINE')) return '💻';
    if (cat.includes('UNCATEG')) return '📦';
    return '💳';
  }, []);

  const colorPalette = React.useMemo(() => ([
    { border: 'border-l-blue-600', chip: 'bg-blue-100 text-blue-700' },
    { border: 'border-l-emerald-600', chip: 'bg-emerald-100 text-emerald-700' },
    { border: 'border-l-amber-500', chip: 'bg-amber-100 text-amber-700' },
    { border: 'border-l-rose-500', chip: 'bg-rose-100 text-rose-700' },
    { border: 'border-l-violet-600', chip: 'bg-violet-100 text-violet-700' },
    { border: 'border-l-cyan-600', chip: 'bg-cyan-100 text-cyan-700' },
  ]), []);

  const stats = React.useMemo(() => {
    const normalized = transactions.map(t => ({
      ...t,
      amountAbs: Math.abs(t.amount),
      category: normalizeCategory(t.category || 'Uncategorized'),
      merchant: t.merchant || 'Unknown Merchant',
    }));

    const totals: Record<string, { amount: number; count: number }> = {};
    normalized.forEach(t => {
      const cat = t.category;
      if (!totals[cat]) totals[cat] = { amount: 0, count: 0 };
      totals[cat].amount += t.amountAbs;
      totals[cat].count++;
    });

    const totalSpent = normalized.reduce((acc, t) => acc + t.amountAbs, 0);
    const avgSpend = normalized.length > 0 ? totalSpent / normalized.length : 0;

    const categoryTotals = Object.entries(totals).sort((a, b) => b[1].amount - a[1].amount);
    const pieCategories = categoryTotals.slice(0, 6);
    const pieGradient = (() => {
      if (pieCategories.length === 0 || totalSpent <= 0) return 'conic-gradient(#e5e7eb 0 100%)';
      const colors = ['#2563eb', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
      let start = 0;
      const segments = pieCategories.map(([_, data], idx) => {
        const pct = (data.amount / totalSpent) * 100;
        const end = start + pct;
        const seg = `${colors[idx % colors.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
        start = end;
        return seg;
      });
      return `conic-gradient(${segments.join(', ')})`;
    })();

    const largestTransactions = normalized
      .slice()
      .sort((a, b) => b.amountAbs - a.amountAbs)
      .slice(0, 50);

    const merchantTotals: Record<string, { label: string; count: number; amount: number }> = {};
    normalized.forEach(t => {
      const merchantKey = normalizeMerchant(t.merchant);
      if (!merchantTotals[merchantKey]) {
        merchantTotals[merchantKey] = { label: t.merchant, count: 0, amount: 0 };
      }
      merchantTotals[merchantKey].count += 1;
      merchantTotals[merchantKey].amount += t.amountAbs;
    });
    const topFrequent = Object.entries(merchantTotals)
      .sort((a, b) => b[1].count - a[1].count || b[1].amount - a[1].amount)
      .slice(0, 100);

    return {
      normalized,
      totalSpent,
      txCount: normalized.length,
      avgSpend,
      categoryTotals,
      pieCategories,
      pieGradient,
      largestTransactions,
      topFrequent,
    };
  }, [transactions]);

  const displayedLargest = React.useMemo(
    () => largestExpanded ? stats.largestTransactions : stats.largestTransactions.slice(0, 5),
    [stats.largestTransactions, largestExpanded]
  );

  const displayedFrequent = React.useMemo(
    () => frequentExpanded ? stats.topFrequent : stats.topFrequent.slice(0, 5),
    [stats.topFrequent, frequentExpanded]
  );

  const previousPeriodCategoryTotals = React.useMemo(() => {
    if (!compareMode || allTransactions.length === 0) return {} as Record<string, number>;

    const periodTxns: Transaction[] = (() => {
      if (compareMode === 'mom' && currentMonthKey) {
        const m = currentMonthKey.match(/^(\d{4})-(\d{2})$/);
        if (!m) return [];
        const year = Number(m[1]);
        const month = Number(m[2]) - 1;
        const prevDate = new Date(year, month - 1, 1);
        const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        return allTransactions.filter(t => {
          const d = new Date(t.date);
          if (Number.isNaN(d.getTime())) return false;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return key === prevKey;
        });
      }

      if (compareMode === 'yoy' && currentYear) {
        const prevYear = String(Number(currentYear) - 1);
        return allTransactions.filter(t => {
          const d = new Date(t.date);
          return !Number.isNaN(d.getTime()) && String(d.getFullYear()) === prevYear;
        });
      }

      return [];
    })();

    const totals: Record<string, number> = {};
    periodTxns.forEach(t => {
      const cat = normalizeCategory(t.category || 'Uncategorized');
      totals[cat] = (totals[cat] || 0) + Math.abs(t.amount);
    });
    return totals;
  }, [allTransactions, compareMode, currentMonthKey, currentYear]);

  const selectedCategoryTransactions = React.useMemo(() => {
    if (!selectedCategory) return [];
    return stats.normalized
      .filter(t => normalizeCategory(t.category || 'Uncategorized') === selectedCategory)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [stats.normalized, selectedCategory]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t(language, 'total_spend')}</div>
          <div className="text-2xl font-bold text-gray-900">${stats.totalSpent.toFixed(2)}</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t(language, 'transactions_count')}</div>
          <div className="text-2xl font-bold text-gray-900">{stats.txCount.toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t(language, 'avg_ticket')}</div>
          <div className="text-2xl font-bold text-gray-900">${stats.avgSpend.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
          <div className="text-sm font-semibold text-gray-700 mb-4">{t(language, 'category_share')}</div>
          <div className="flex items-center gap-5">
            <div
              className="w-40 h-40 rounded-full border border-gray-100 shrink-0"
              style={{ background: stats.pieGradient }}
            />
            <div className="space-y-2 text-xs w-full">
              {stats.pieCategories.map(([cat, data], idx) => {
                const colors = ['#2563eb', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
                const pct = stats.totalSpent > 0 ? (data.amount / stats.totalSpent) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-gray-700 truncate">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                      <span className="truncate">{getCategoryEmoji(cat)} {localizeCategory(cat)}</span>
                    </span>
                    <span className="text-gray-500 font-medium">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
          <div className="text-sm font-semibold text-gray-700 mb-3">{t(language, 'top_largest')}</div>
          <div className={`space-y-2 ${largestExpanded ? 'max-h-64 overflow-auto pr-1' : ''}`}>
            {displayedLargest.map((txn, idx) => (
              <div key={`${txn.merchant}-${txn.date}-${idx}`} className="flex justify-between gap-3 text-sm">
                <span className="text-gray-700 truncate">{idx + 1}. {txn.merchant}</span>
                <span className="font-bold text-gray-900">${txn.amountAbs.toFixed(2)}</span>
              </div>
            ))}
          </div>
          {stats.largestTransactions.length > 5 && (
            <button
              onClick={() => setLargestExpanded(v => !v)}
              className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              {largestExpanded ? t(language, 'show_less') : t(language, 'expand', { count: stats.largestTransactions.length })}
            </button>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
          <div className="text-sm font-semibold text-gray-700 mb-3">{t(language, 'most_frequent_merchants')}</div>
          <div className={`space-y-2 ${frequentExpanded ? 'max-h-64 overflow-auto pr-1' : ''}`}>
            {displayedFrequent.map(([merchantKey, data], idx) => (
              <div key={`${merchantKey}-${idx}`} className="flex justify-between gap-3 text-sm">
                <span className="text-gray-700 truncate">{idx + 1}. {data.label}</span>
                <span className="font-medium text-gray-600">{data.count}x</span>
              </div>
            ))}
          </div>
          {stats.topFrequent.length > 5 && (
            <button
              onClick={() => setFrequentExpanded(v => !v)}
              className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              {frequentExpanded ? t(language, 'show_less') : t(language, 'expand', { count: stats.topFrequent.length })}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {stats.categoryTotals.map(([cat, data], idx) => {
          const color = colorPalette[idx % colorPalette.length];
          const active = selectedCategory === cat;
          const previousAmount = previousPeriodCategoryTotals[cat] || 0;
          const delta = data.amount - previousAmount;
          const deltaPct = previousAmount > 0 ? (delta / previousAmount) * 100 : null;
          const compareText = compareMode === 'mom' ? t(language, 'mom') : compareMode === 'yoy' ? t(language, 'yoy') : '';
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(active ? null : cat)}
              className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 border-l-4 ${color.border} text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${active ? 'ring-2 ring-blue-300' : ''}`}
            >
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 truncate" title={cat}>
                {getCategoryEmoji(cat)} {localizeCategory(cat)}
              </div>
              <div className="text-lg font-bold text-gray-900">${data.amount.toFixed(2)}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">{data.count} {t(language, 'txns')}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${color.chip}`}>
                  {stats.totalSpent > 0 ? ((data.amount / stats.totalSpent) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
              {compareMode && (
                <div className="mt-2 text-[11px] font-medium">
                  {deltaPct === null ? (
                    <span className="text-gray-400">{compareText}: {t(language, 'na')}</span>
                  ) : (
                    <span className={delta >= 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {compareText}: {delta >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedCategory && (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-700">
              {getCategoryEmoji(selectedCategory)} {localizeCategory(selectedCategory)} {t(language, 'details_suffix')}
            </div>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              {t(language, 'close')}
            </button>
          </div>
          <div className="max-h-72 overflow-auto divide-y divide-gray-100">
            {selectedCategoryTransactions.slice(0, 60).map((txn, idx) => (
              <div key={`${txn.merchant}-${txn.date}-${idx}`} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-gray-800 truncate">{txn.merchant}</div>
                  <div className="text-xs text-gray-500">{new Date(txn.date).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-SG')}</div>
                </div>
                <div className="font-bold text-gray-900 shrink-0">${txn.amountAbs.toFixed(2)}</div>
              </div>
            ))}
            {selectedCategoryTransactions.length === 0 && (
              <div className="py-4 text-sm text-gray-500">{t(language, 'no_transactions_in_category')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
