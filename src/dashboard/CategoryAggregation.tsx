import React from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Gauge,
  Layers3,
  Receipt,
  Repeat2,
  Sparkles,
  Store,
  TrendingUp,
  X
} from 'lucide-react';
import { Transaction } from '../types';
import { normalizeCategory, normalizeMerchant } from '../utils/category-overrides';
import { getCardDisplayName, getCategoryDisplayName, Language, t } from '../utils/i18n';
import { CardBenefitManager } from '../utils/card-benefits';

interface Props {
  transactions: Transaction[];
  allTransactions?: Transaction[];
  compareMode?: 'mom' | 'yoy' | null;
  currentMonthKey?: string;
  currentYear?: string;
  language?: Language;
}

type NormalizedTransaction = Transaction & {
  amountAbs: number;
  categoryName: string;
  merchantName: string;
  parsedDate: Date;
};

type InsightSelection =
  | { type: 'category'; key: string }
  | { type: 'day'; key: string }
  | { type: 'month'; key: string }
  | null;

type CategorySlice = {
  key: string;
  name: string;
  amount: number;
  count: number;
  share: number;
  color: string;
};

const OTHER_CATEGORY_KEY = '__OTHER__';
const CATEGORY_COLORS = ['#2563eb', '#0d9488', '#f59e0b', '#e11d48', '#7c3aed', '#475569'];
const BAR_COLORS = ['#2563eb', '#0d9488', '#f59e0b', '#e11d48', '#7c3aed', '#0891b2'];

const buildInsightCopy = (language: Language) => (
  language === 'zh'
    ? {
        spendVelocity: '\u6708\u672b\u9884\u6d4b',
        activeDays: '\u6d3b\u8dc3\u6d88\u8d39\u65e5',
        spendCreep: '\u6d88\u8d39\u722c\u5347',
        merchantFocus: '\u5546\u6237\u96c6\u4e2d\u5ea6',
        categoryMatrix: '\u5206\u7c7b\u77e9\u9635',
        cashFlowTrend: '\u6708\u5ea6\u8d8b\u52bf',
        trendMovers: '\u53d8\u5316\u6700\u5927\u7684\u5206\u7c7b',
        biggestIncrease: '\u589e\u52a0\u6700\u591a',
        biggestDrop: '\u4e0b\u964d\u6700\u591a',
        recurringPayments: '\u7ecf\u5e38\u6027\u652f\u51fa',
        largeOutliers: '\u5927\u989d\u5f02\u5e38',
        spendingPulse: '\u6d88\u8d39\u8d70\u52bf',
        projectedMonthEnd: '\u6708\u672b\u9884\u6d4b',
        topMerchant: '\u6700\u9ad8\u652f\u51fa\u5546\u6237',
        topDay: '\u6700\u9ad8\u652f\u51fa\u65e5',
        avgVisits: '\u5e73\u5747\u56de\u8bbf',
        noRecurringCandidates: '\u6682\u65f6\u8fd8\u6ca1\u6709\u7a33\u5b9a\u7684\u7ecf\u5e38\u6027\u652f\u51fa\u3002',
        noOutliers: '\u8fd9\u4e00\u65f6\u6bb5\u6ca1\u6709\u660e\u663e\u7684\u5927\u989d\u5f02\u5e38\u3002',
        categoryDetails: '\u5206\u7c7b\u660e\u7ec6',
        avgSpend: '\u7b14\u5747\u6d88\u8d39',
        comparison: '\u5bf9\u6bd4',
        pulseWindow: '30d \u6d3b\u8dc3\u6d88\u8d39\u65e5',
        recurringMonths: '\u8986\u76d6\u6708\u4efd',
        lastSixMonths: '\u6700\u8fd1 6 \u4e2a\u6708',
        periodChange: '\u8f83\u4e0a\u671f',
        steadyPace: '\u5e73\u7a33',
        noTrendMovers: '\u6682\u65e0\u53ef\u5bf9\u6bd4\u7684\u5206\u7c7b\u53d8\u5316\u3002',
        noCategoryTransactions: '\u8fd9\u4e2a\u5206\u7c7b\u4e0b\u8fd8\u6ca1\u6709\u4ea4\u6613\u3002',
        categoryMix: '\u5206\u7c7b\u7ed3\u6784',
        merchantSignals: '\u5546\u6237\u89c2\u5bdf',
        unknownMerchant: '\u672a\u77e5\u5546\u6237',
        allCategories: '\u5168\u90e8\u5206\u7c7b',
        categoryLeader: '\u4e3b\u8981\u5206\u7c7b',
        avgActiveDay: '\u6d3b\u8dc3\u65e5\u5747',
        recurringShare: '\u56fa\u5b9a\u652f\u51fa\u5360\u6bd4',
      }
    : {
        spendVelocity: 'Month-end Forecast',
        activeDays: 'Active Days',
        spendCreep: 'Spend Creep',
        merchantFocus: 'Merchant Focus',
        categoryMatrix: 'Category Matrix',
        cashFlowTrend: 'Cash Flow Trend',
        trendMovers: 'Biggest Category Moves',
        biggestIncrease: 'Biggest Increase',
        biggestDrop: 'Biggest Drop',
        recurringPayments: 'Recurring Payments',
        largeOutliers: 'Large Outliers',
        spendingPulse: 'Spending Pulse',
        projectedMonthEnd: 'Projected Month End',
        topMerchant: 'Top Merchant',
        topDay: 'Top Day',
        avgVisits: 'Avg. Visits',
        noRecurringCandidates: 'No stable recurring patterns yet.',
        noOutliers: 'No obvious large outliers in this period.',
        categoryDetails: 'Category Detail',
        avgSpend: 'Avg Spend',
        comparison: 'Comparison',
        pulseWindow: '30-day active spend',
        recurringMonths: 'Months',
        lastSixMonths: 'Last 6 months',
        periodChange: 'vs previous',
        steadyPace: 'Steady',
        noTrendMovers: 'No comparable category movement yet.',
        noCategoryTransactions: 'No transactions inside this category.',
        categoryMix: 'Category Mix',
        merchantSignals: 'Merchant Signals',
        unknownMerchant: 'Unknown Merchant',
        allCategories: 'All Categories',
        categoryLeader: 'Category Leader',
        avgActiveDay: 'Avg Active Day',
        recurringShare: 'Recurring Share',
      }
);

const formatShortDate = (date: Date, language: Language) =>
  date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-SG', { month: 'short', day: 'numeric' });

const formatDayKey = (date: Date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const formatMonthLabel = (monthKey: string, language: Language) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-SG', {
    month: 'short',
  });
};

const getPiePoint = (startAngle: number, endAngle: number, radius: number) => {
  const angle = ((startAngle + endAngle) / 2 - 90) * (Math.PI / 180);
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius,
  };
};

const getPieAngle = (startAngle: number, endAngle: number) => ((startAngle + endAngle) / 2 - 90) * (Math.PI / 180);

const getDonutPoint = (angle: number, radius: number) => {
  const radians = (angle - 90) * (Math.PI / 180);
  return {
    x: 50 + Math.cos(radians) * radius,
    y: 50 + Math.sin(radians) * radius,
  };
};

const getDonutSlicePath = (startAngle: number, endAngle: number, outerRadius: number, innerRadius: number) => {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const outerStart = getDonutPoint(startAngle, outerRadius);
  const outerEnd = getDonutPoint(endAngle, outerRadius);
  const innerEnd = getDonutPoint(endAngle, innerRadius);
  const innerStart = getDonutPoint(startAngle, innerRadius);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
};

const formatSelectionTitle = (
  selection: InsightSelection,
  categorySlices: CategorySlice[],
  language: Language,
  copy: ReturnType<typeof buildInsightCopy>
) => {
  if (!selection) return '';
  if (selection.type === 'category') {
    const slice = categorySlices.find((item) => item.key === selection.key);
    if (slice?.key === OTHER_CATEGORY_KEY) return language === 'zh' ? '其他分类' : 'Other Categories';
    return getCategoryDisplayName(slice?.name || selection.key, language);
  }
  if (selection.type === 'day') {
    return `${copy.topDay}: ${formatShortDate(new Date(`${selection.key}T00:00:00`), language)}`;
  }
  return `${copy.cashFlowTrend}: ${formatMonthLabel(selection.key, language)}`;
};

export const CategoryAggregation: React.FC<Props> = ({
  transactions,
  allTransactions = [],
  compareMode = null,
  currentMonthKey,
  currentYear,
  language = 'en',
}) => {
  const [selection, setSelection] = React.useState<InsightSelection>(null);
  const [selectedCategoryKey, setSelectedCategoryKey] = React.useState<string | null>(null);
  const copy = React.useMemo(() => buildInsightCopy(language), [language]);

  const toggleSelection = React.useCallback((nextSelection: Exclude<InsightSelection, null>) => {
    setSelection((current) => (
      current?.type === nextSelection.type && current.key === nextSelection.key
        ? null
        : nextSelection
    ));
  }, []);

  const selectCategory = React.useCallback((categoryKey: string) => {
    setSelectedCategoryKey((current) => {
      const next = current === categoryKey ? null : categoryKey;
      setSelection(next ? { type: 'category', key: next } : null);
      return next;
    });
  }, []);

  const normalizedTransactions = React.useMemo<NormalizedTransaction[]>(() => (
    transactions
      .map((transaction) => {
        const parsedDate = new Date(transaction.date);
        return {
          ...transaction,
          amountAbs: Math.abs(transaction.amount),
          categoryName: normalizeCategory(transaction.category || 'Uncategorized'),
          merchantName: transaction.merchant || copy.unknownMerchant,
          parsedDate,
        };
      })
      .filter((transaction) => !Number.isNaN(transaction.parsedDate.getTime()))
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
  ), [copy.unknownMerchant, transactions]);

  const previousPeriodCategoryTotals = React.useMemo(() => {
    if (!compareMode || allTransactions.length === 0) return {} as Record<string, number>;

    const periodTransactions = (() => {
      if (compareMode === 'mom' && currentMonthKey) {
        const match = currentMonthKey.match(/^(\d{4})-(\d{2})$/);
        if (!match) return [] as Transaction[];
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const previous = new Date(year, month - 1, 1);
        const previousKey = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
        return allTransactions.filter((transaction) => {
          const parsedDate = new Date(transaction.date);
          if (Number.isNaN(parsedDate.getTime())) return false;
          const key = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
          return key === previousKey;
        });
      }

      if (compareMode === 'yoy' && currentYear) {
        const previousYear = String(Number(currentYear) - 1);
        return allTransactions.filter((transaction) => {
          const parsedDate = new Date(transaction.date);
          return !Number.isNaN(parsedDate.getTime()) && String(parsedDate.getFullYear()) === previousYear;
        });
      }

      return [] as Transaction[];
    })();

    return periodTransactions.reduce<Record<string, number>>((accumulator, transaction) => {
      const category = normalizeCategory(transaction.category || 'Uncategorized');
      accumulator[category] = (accumulator[category] || 0) + Math.abs(transaction.amount);
      return accumulator;
    }, {});
  }, [allTransactions, compareMode, currentMonthKey, currentYear]);

  const stats = React.useMemo(() => {
    const totalSpent = normalizedTransactions.reduce((sum, transaction) => sum + transaction.amountAbs, 0);
    const txCount = normalizedTransactions.length;
    const avgSpend = txCount > 0 ? totalSpent / txCount : 0;

    const activeDaysMap = new Map<string, number>();
    const categoryTotals = new Map<string, { amount: number; count: number }>();
    const merchantTotals = new Map<string, { label: string; amount: number; count: number; months: Set<string>; averageAmount: number }>();

    normalizedTransactions.forEach((transaction) => {
      const dayKey = formatDayKey(transaction.parsedDate);
      activeDaysMap.set(dayKey, (activeDaysMap.get(dayKey) || 0) + transaction.amountAbs);

      const categoryCurrent = categoryTotals.get(transaction.categoryName) || { amount: 0, count: 0 };
      categoryCurrent.amount += transaction.amountAbs;
      categoryCurrent.count += 1;
      categoryTotals.set(transaction.categoryName, categoryCurrent);

      const merchantKey = normalizeMerchant(transaction.merchantName);
      const monthKey = `${transaction.parsedDate.getFullYear()}-${String(transaction.parsedDate.getMonth() + 1).padStart(2, '0')}`;
      const merchantCurrent = merchantTotals.get(merchantKey) || {
        label: transaction.merchantName,
        amount: 0,
        count: 0,
        months: new Set<string>(),
        averageAmount: 0
      };
      merchantCurrent.amount += transaction.amountAbs;
      merchantCurrent.count += 1;
      merchantCurrent.months.add(monthKey);
      merchantCurrent.averageAmount = merchantCurrent.amount / merchantCurrent.count;
      merchantTotals.set(merchantKey, merchantCurrent);
    });

    const categoryMatrix = Array.from(categoryTotals.entries())
      .map(([name, data]) => {
        const previousAmount = previousPeriodCategoryTotals[name] || 0;
        const delta = data.amount - previousAmount;
        const deltaPct = previousAmount > 0 ? (delta / previousAmount) * 100 : null;
        return {
          name,
          amount: data.amount,
          count: data.count,
          avgTicket: data.count > 0 ? data.amount / data.count : 0,
          share: totalSpent > 0 ? (data.amount / totalSpent) * 100 : 0,
          deltaPct,
          delta,
          previousAmount,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const previousTotal = Object.values(previousPeriodCategoryTotals).reduce((sum, amount) => sum + amount, 0);
    const periodDelta = totalSpent - previousTotal;
    const periodDeltaPct = previousTotal > 0 ? (periodDelta / previousTotal) * 100 : null;
    const risingCategories = categoryMatrix
      .filter((category) => category.previousAmount > 0 && category.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 4);
    const fallingCategories = categoryMatrix
      .filter((category) => category.previousAmount > 0 && category.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 4);
    const topIncrease = risingCategories[0] || null;
    const topDrop = fallingCategories[0] || null;

    const merchantRanking = Array.from(merchantTotals.entries())
      .map(([key, value]) => ({
        key,
        ...value,
      }))
      .sort((a, b) => b.amount - a.amount || b.count - a.count);

    const recurringCandidates = merchantRanking
      .filter((merchant) => merchant.months.size >= 2 || merchant.count >= 3)
      .slice(0, 6);

    const topMerchant = merchantRanking[0] || null;
    const merchantConcentration = topMerchant && totalSpent > 0 ? (topMerchant.amount / totalSpent) * 100 : 0;

    const dailySeries = (() => {
      if (currentMonthKey) {
        const match = currentMonthKey.match(/^(\d{4})-(\d{2})$/);
        if (match) {
          const year = Number(match[1]);
          const monthIndex = Number(match[2]) - 1;
          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
          return Array.from({ length: Math.min(daysInMonth, 30) }, (_, index) => {
            const parsedDate = new Date(year, monthIndex, index + 1);
            const day = formatDayKey(parsedDate);
            return {
              day,
              amount: activeDaysMap.get(day) || 0,
              parsedDate,
            };
          });
        }
      }

      const activeDayKeys = Array.from(activeDaysMap.keys()).sort();
      const latestActiveDay = activeDayKeys[activeDayKeys.length - 1];
      const endDate = latestActiveDay ? new Date(`${latestActiveDay}T00:00:00`) : new Date();
      return Array.from({ length: 30 }, (_, index) => {
        const parsedDate = new Date(endDate);
        parsedDate.setDate(endDate.getDate() - (29 - index));
        const day = formatDayKey(parsedDate);
        return {
          day,
          amount: activeDaysMap.get(day) || 0,
          parsedDate,
        };
      });
    })();

    const activeDays = activeDaysMap.size;

    const topDay = Array.from(activeDaysMap.entries())
      .map(([day, amount]) => ({ day, amount, parsedDate: new Date(`${day}T00:00:00`) }))
      .sort((a, b) => b.amount - a.amount)[0] || null;

    const outliers = normalizedTransactions
      .slice()
      .sort((a, b) => b.amountAbs - a.amountAbs)
      .filter((transaction) => {
        const merchant = merchantTotals.get(normalizeMerchant(transaction.merchantName));
        if (!merchant) return transaction.amountAbs > avgSpend * 1.6;
        return transaction.amountAbs > merchant.averageAmount * 1.75 || transaction.amountAbs > avgSpend * 1.75;
      })
      .slice(0, 6);

    const projection = (() => {
      if (!currentMonthKey) return null;
      const match = currentMonthKey.match(/^(\d{4})-(\d{2})$/);
      if (!match) return null;
      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      const now = new Date();
      if (now.getFullYear() !== year || now.getMonth() !== monthIndex) return null;
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      if (dayOfMonth <= 0) return null;
      return (totalSpent / dayOfMonth) * daysInMonth;
    })();

    const monthlyTrendSource = allTransactions.length > 0 ? allTransactions : normalizedTransactions;
    const monthlyTrendMap = new Map<string, number>();
    monthlyTrendSource.forEach((transaction) => {
      const parsedDate = new Date(transaction.date);
      if (Number.isNaN(parsedDate.getTime())) return;
      const monthKey = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
      monthlyTrendMap.set(monthKey, (monthlyTrendMap.get(monthKey) || 0) + Math.abs(transaction.amount));
    });
    const monthlyTrend = Array.from(monthlyTrendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, amount]) => ({ month, amount }));

    return {
      totalSpent,
      txCount,
      avgSpend,
      activeDays,
      categoryMatrix,
      risingCategories,
      fallingCategories,
      topIncrease,
      topDrop,
      periodDelta,
      periodDeltaPct,
      merchantRanking,
      recurringCandidates,
      topMerchant,
      merchantConcentration,
      dailySeries,
      monthlyTrend,
      topDay,
      outliers,
      projection,
    };
  }, [allTransactions, currentMonthKey, normalizedTransactions, previousPeriodCategoryTotals]);

  const categorySlices = React.useMemo<CategorySlice[]>(() => {
    if (stats.categoryMatrix.length === 0 || stats.totalSpent <= 0) return [];
    const primaryCategories = stats.categoryMatrix.slice(0, 5);
    const otherCategories = stats.categoryMatrix.slice(5);
    const primarySlices = primaryCategories.map((category, index) => ({
      key: category.name,
      name: category.name,
      amount: category.amount,
      count: category.count,
      share: category.share,
      color: CATEGORY_COLORS[index],
    }));

    if (otherCategories.length === 0) return primarySlices;

    const otherAmount = otherCategories.reduce((sum, category) => sum + category.amount, 0);
    const otherCount = otherCategories.reduce((sum, category) => sum + category.count, 0);
    return [
      ...primarySlices,
      {
        key: OTHER_CATEGORY_KEY,
        name: language === 'zh' ? '其他' : 'Other',
        amount: otherAmount,
        count: otherCount,
        share: (otherAmount / stats.totalSpent) * 100,
        color: CATEGORY_COLORS[5],
      },
    ];
  }, [language, stats.categoryMatrix, stats.totalSpent]);

  const primaryCategoryKeys = React.useMemo(
    () => new Set(categorySlices.filter((slice) => slice.key !== OTHER_CATEGORY_KEY).map((slice) => slice.key)),
    [categorySlices]
  );

  const selectedCategoryTitle = React.useMemo(() => {
    if (!selectedCategoryKey) return copy.allCategories;
    const slice = categorySlices.find((item) => item.key === selectedCategoryKey);
    if (selectedCategoryKey === OTHER_CATEGORY_KEY) return language === 'zh' ? '其他' : 'Other';
    return getCategoryDisplayName(slice?.name || selectedCategoryKey, language);
  }, [categorySlices, copy.allCategories, language, selectedCategoryKey]);

  const matchesTrendCategory = React.useCallback((categoryName: string) => {
    if (!selectedCategoryKey) return true;
    if (selectedCategoryKey === OTHER_CATEGORY_KEY) return !primaryCategoryKeys.has(categoryName);
    return categoryName === selectedCategoryKey;
  }, [primaryCategoryKeys, selectedCategoryKey]);

  const monthlyTrend = React.useMemo(() => {
    const sourceTransactions = (allTransactions.length > 0 ? allTransactions : normalizedTransactions)
      .map((transaction) => {
        const parsedDate = new Date(transaction.date);
        return {
          amountAbs: Math.abs(transaction.amount),
          categoryName: normalizeCategory(transaction.category || 'Uncategorized'),
          parsedDate,
        };
      })
      .filter((transaction) => !Number.isNaN(transaction.parsedDate.getTime()));

    const monthKeys = Array.from(new Set(sourceTransactions.map((transaction) => (
      `${transaction.parsedDate.getFullYear()}-${String(transaction.parsedDate.getMonth() + 1).padStart(2, '0')}`
    ))))
      .sort((a, b) => a.localeCompare(b))
      .slice(-6);

    const monthlyTrendMap = new Map(monthKeys.map((month) => [month, 0]));
    sourceTransactions.forEach((transaction) => {
      const monthKey = `${transaction.parsedDate.getFullYear()}-${String(transaction.parsedDate.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyTrendMap.has(monthKey) || !matchesTrendCategory(transaction.categoryName)) return;
      monthlyTrendMap.set(monthKey, (monthlyTrendMap.get(monthKey) || 0) + transaction.amountAbs);
    });

    return monthKeys.map((month) => ({
      month,
      amount: monthlyTrendMap.get(month) || 0,
    }));
  }, [allTransactions, matchesTrendCategory, normalizedTransactions]);

  const selectedDetailTransactions = React.useMemo(() => {
    if (!selection) return [];
    const detailTransactions: NormalizedTransaction[] = selection.type === 'month' && allTransactions.length > 0
      ? allTransactions
        .map((transaction) => {
          const parsedDate = new Date(transaction.date);
          return {
            ...transaction,
            amountAbs: Math.abs(transaction.amount),
            categoryName: normalizeCategory(transaction.category || 'Uncategorized'),
            merchantName: transaction.merchant || copy.unknownMerchant,
            parsedDate,
          };
        })
        .filter((transaction) => !Number.isNaN(transaction.parsedDate.getTime()))
      : normalizedTransactions;

    return detailTransactions
      .filter((transaction) => {
        if (selection.type === 'category') {
          return selection.key === OTHER_CATEGORY_KEY
            ? !primaryCategoryKeys.has(transaction.categoryName)
            : transaction.categoryName === selection.key;
        }
        if (selection.type === 'day') {
          return formatDayKey(transaction.parsedDate) === selection.key;
        }
        const monthKey = `${transaction.parsedDate.getFullYear()}-${String(transaction.parsedDate.getMonth() + 1).padStart(2, '0')}`;
        return monthKey === selection.key && matchesTrendCategory(transaction.categoryName);
      })
      .sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
  }, [allTransactions, copy.unknownMerchant, matchesTrendCategory, normalizedTransactions, primaryCategoryKeys, selection]);

  const selectedDetailTotal = selectedDetailTransactions.reduce((sum, transaction) => sum + transaction.amountAbs, 0);
  const selectedTitle = selection?.type === 'month' && selectedCategoryKey
    ? `${selectedCategoryTitle}: ${formatMonthLabel(selection.key, language)}`
    : formatSelectionTitle(selection, categorySlices, language, copy);

  const maxDailySpend = Math.max(...stats.dailySeries.map((item) => item.amount), 1);
  const maxTrendSpend = Math.max(...monthlyTrend.map((item) => item.amount), 1);
  const maxCategoryDelta = Math.max(
    ...[...stats.risingCategories, ...stats.fallingCategories].map((category) => Math.abs(category.delta)),
    1
  );
  const topCategory = stats.categoryMatrix[0] || null;
  const avgActiveDaySpend = stats.activeDays > 0 ? stats.totalSpent / stats.activeDays : 0;
  const recurringTotal = stats.recurringCandidates.reduce((sum, merchant) => sum + merchant.amount, 0);
  const recurringShare = stats.totalSpent > 0 ? (recurringTotal / stats.totalSpent) * 100 : 0;
  const compareLabel = compareMode === 'mom' ? t(language, 'mom') : compareMode === 'yoy' ? t(language, 'yoy') : copy.comparison;
  const trendPreviousAmount = monthlyTrend[monthlyTrend.length - 2]?.amount ?? 0;
  const trendCurrentAmount = monthlyTrend[monthlyTrend.length - 1]?.amount ?? 0;
  const trendDeltaPct = trendPreviousAmount > 0 ? ((trendCurrentAmount - trendPreviousAmount) / trendPreviousAmount) * 100 : null;
  const trendIsUp = trendCurrentAmount >= trendPreviousAmount;
  const categoryMatrixByName = React.useMemo(
    () => new Map(stats.categoryMatrix.map((category) => [category.name, category])),
    [stats.categoryMatrix]
  );

  React.useEffect(() => {
    if (!selection) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelection(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection]);

  return (
    <div className="tabler-insights">
      <section className="row row-cards">
        {[
          { label: t(language, 'total_spend'), value: `$${stats.totalSpent.toFixed(2)}`, icon: <Receipt size={18} />, color: 'primary' },
          { label: copy.spendVelocity, value: stats.projection ? `$${stats.projection.toFixed(2)}` : `${stats.txCount.toLocaleString()} ${t(language, 'txns')}`, icon: <TrendingUp size={18} />, color: 'azure' },
          { label: copy.activeDays, value: stats.activeDays.toLocaleString(), icon: <CalendarRange size={18} />, color: 'green' },
          { label: copy.spendCreep, value: stats.topIncrease ? `+$${stats.topIncrease.delta.toFixed(0)}` : copy.steadyPace, icon: <Gauge size={18} />, color: 'orange' },
          { label: copy.merchantFocus, value: `${stats.merchantConcentration.toFixed(1)}%`, icon: <Store size={18} />, color: 'pink' },
        ].map((item, index) => (
          <div key={item.label} className="col-sm-6 col-lg" style={{ animationDelay: `${index * 55}ms` }}>
            <div className="card insight-card">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <span className={`avatar avatar-sm bg-${item.color}-lt text-${item.color} me-3`}>
                    {item.icon}
                  </span>
                  <div className="subheader mb-0">{item.label}</div>
                </div>
                <div className="h2 mt-3 mb-0">{item.value}</div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="insight-pulse-grid mt-4">
        <div className="insight-pulse-main">
          <div className="card h-100">
            <div className="card-header">
              <div>
                <div className="card-title d-flex align-items-center gap-2">
                  <Activity size={16} className="text-blue" />
                {copy.spendingPulse}
                </div>
                <div className="card-subtitle">{copy.pulseWindow}</div>
              </div>
              {stats.projection && (
                <div className="card-actions">
                  <div className="badge bg-blue-lt">
                    {copy.projectedMonthEnd}: ${stats.projection.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            <div className="card-body">
              {stats.dailySeries.length > 0 ? (
                <div className="dashboard-bars dashboard-bars-daily">
                  {stats.dailySeries.map((item, index) => (
                    <button
                      key={item.day}
                      type="button"
                      onClick={() => toggleSelection({ type: 'day', key: item.day })}
                      className={`dashboard-bar-item dashboard-bar-button ${selection?.type === 'day' && selection.key === item.day ? 'is-active' : ''}`}
                      title={`$${item.amount.toFixed(2)}`}
                    >
                      <div className="dashboard-bar-track">
                        <div
                          className="insight-bar dashboard-chart-bar"
                          style={{
                            height: item.amount > 0 ? `${Math.max(7, (item.amount / maxDailySpend) * 100)}%` : '0%',
                            animationDelay: `${index * 45}ms`,
                            background: `linear-gradient(180deg, ${BAR_COLORS[index % BAR_COLORS.length]}cc 0%, ${BAR_COLORS[index % BAR_COLORS.length]} 100%)`,
                          }}
                        />
                      </div>
                      <div className="dashboard-bar-label">{formatShortDate(item.parsedDate, language)}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty py-4">
                  <p className="empty-title">{copy.noCategoryTransactions}</p>
                </div>
              )}

              <div className="row g-3 mt-2">
                <div className="col-md-4">
                  <div className="datagrid">
                    <div className="datagrid-item">
                      <div className="datagrid-title d-flex align-items-center gap-1"><Sparkles size={14} />{copy.topDay}</div>
                      <div className="datagrid-content">{stats.topDay ? `$${stats.topDay.amount.toFixed(2)}` : '$0.00'}</div>
                      <div className="text-muted small">{stats.topDay ? formatShortDate(stats.topDay.parsedDate, language) : '-'}</div>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="datagrid">
                    <div className="datagrid-item">
                      <div className="datagrid-title d-flex align-items-center gap-1"><Store size={14} />{copy.topMerchant}</div>
                      <div className="datagrid-content text-truncate">{stats.topMerchant?.label || '-'}</div>
                      <div className="text-muted small">{stats.topMerchant ? `$${stats.topMerchant.amount.toFixed(2)}` : '$0.00'}</div>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="datagrid">
                    <div className="datagrid-item">
                      <div className="datagrid-title d-flex align-items-center gap-1"><Repeat2 size={14} />{copy.avgVisits}</div>
                      <div className="datagrid-content">{stats.merchantRanking.length > 0 ? (stats.txCount / stats.merchantRanking.length).toFixed(1) : '0.0'}</div>
                      <div className="text-muted small">{t(language, 'txns')}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="insight-signal-grid mt-3">
                <div className="insight-signal-item">
                  <div className="subheader">{copy.categoryLeader}</div>
                  <div className="fw-semibold mt-1">
                    {topCategory ? getCategoryDisplayName(topCategory.name, language) : '-'}
                  </div>
                  <div className="text-muted small">
                    {topCategory ? `${topCategory.share.toFixed(1)}% / $${topCategory.amount.toFixed(2)}` : '$0.00'}
                  </div>
                </div>
                <div className="insight-signal-item">
                  <div className="subheader">{copy.avgActiveDay}</div>
                  <div className="fw-semibold mt-1">${avgActiveDaySpend.toFixed(2)}</div>
                  <div className="text-muted small">
                    {stats.activeDays.toLocaleString()} {copy.activeDays}
                  </div>
                </div>
                <div className="insight-signal-item">
                  <div className="subheader">{copy.recurringShare}</div>
                  <div className="fw-semibold mt-1">{recurringShare.toFixed(1)}%</div>
                  <div className="text-muted small">${recurringTotal.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="insight-pulse-side">
          <div className="card">
            <div className="card-header">
              <div className="card-title d-flex align-items-center gap-2">
                <Store size={16} className="text-blue" />
                {copy.merchantSignals}
              </div>
            </div>
            <div className="list-group list-group-flush">
              {stats.merchantRanking.slice(0, 5).map((merchant, index) => (
                <div key={merchant.key} className="list-group-item insight-row">
                  <div className="row align-items-center">
                    <div className="col text-truncate">
                      <div className="fw-semibold text-truncate">{index + 1}. {merchant.label}</div>
                      <div className="text-muted small">{merchant.count} {t(language, 'txns')}</div>
                    </div>
                    <div className="col-auto text-end">
                      <div className="fw-semibold">${merchant.amount.toFixed(2)}</div>
                      <div className="text-muted small">{((merchant.amount / Math.max(stats.totalSpent, 1)) * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card flex-fill">
            <div className="card-header">
              <div className="card-title d-flex align-items-center gap-2">
                <Repeat2 size={16} className="text-green" />
                {copy.recurringPayments}
              </div>
            </div>
            <div className="list-group list-group-flush">
              {stats.recurringCandidates.length > 0 ? stats.recurringCandidates.map((merchant) => (
                <div key={merchant.key} className="list-group-item insight-row">
                  <div className="row align-items-center">
                    <div className="col text-truncate">
                      <div className="fw-semibold text-truncate">{merchant.label}</div>
                      <div className="text-muted small">
                        {copy.recurringMonths}: {merchant.months.size} / {merchant.count} {t(language, 'txns')}
                      </div>
                    </div>
                    <div className="col-auto fw-semibold">${merchant.averageAmount.toFixed(2)}</div>
                  </div>
                </div>
              )) : (
                <div className="empty py-4">
                  {copy.noRecurringCandidates}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="row row-cards mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title d-flex align-items-center gap-2">
                  <Layers3 size={16} className="text-purple" />
                  {copy.categoryMix}
                </div>
                <div className="card-subtitle">
                  {t(language, 'amount')} / {copy.avgSpend} / {compareLabel}
                </div>
              </div>
            </div>

            <div className="card-body">
              <div className="category-mix-layout">
                {categorySlices.length > 0 ? (
                  <>
                    <div className="category-donut" aria-label={copy.categoryMix}>
                      <svg className="category-donut-svg" viewBox="0 0 100 100">
                        {(() => {
                          let startAngle = 0;
                          return categorySlices.map((slice) => {
                            const selected = selectedCategoryKey === slice.key;
                            const sliceAngle = (slice.share / 100) * 360;
                            const endAngle = startAngle + sliceAngle;
                            const path = getDonutSlicePath(startAngle, endAngle, selected ? 45 : 43, selected ? 21 : 23);
                            const insideLabelPoint = getPiePoint(startAngle, endAngle, 34);
                            const lineStart = getPiePoint(startAngle, endAngle, 45);
                            const lineEnd = getPiePoint(startAngle, endAngle, 54);
                            const outsideLabelPoint = getPiePoint(startAngle, endAngle, 61);
                            const labelAngle = getPieAngle(startAngle, endAngle);
                            const showInsideLabel = slice.share >= 12;
                            const outsideAnchor = Math.cos(labelAngle) >= 0 ? 'start' : 'end';
                            startAngle = endAngle;

                            return (
                              <React.Fragment key={slice.key}>
                                <path
                                  className={`category-donut-slice ${selected ? 'is-active' : ''}`}
                                  d={path}
                                  fill={slice.color}
                                  onClick={() => selectCategory(slice.key)}
                                />
                                {showInsideLabel ? (
                                  <text
                                    x={insideLabelPoint.x}
                                    y={insideLabelPoint.y}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="category-donut-label"
                                  >
                                    <tspan x={insideLabelPoint.x} dy="-0.2em">{getCategoryDisplayName(slice.name, language)}</tspan>
                                    <tspan x={insideLabelPoint.x} dy="1.15em">{slice.share.toFixed(0)}%</tspan>
                                  </text>
                                ) : (
                                  <>
                                    <line
                                      x1={lineStart.x}
                                      y1={lineStart.y}
                                      x2={lineEnd.x}
                                      y2={lineEnd.y}
                                      className="category-donut-callout-line"
                                    />
                                    <text
                                      x={outsideLabelPoint.x}
                                      y={outsideLabelPoint.y}
                                      textAnchor={outsideAnchor}
                                      dominantBaseline="middle"
                                      className="category-donut-callout"
                                    >
                                      <tspan x={outsideLabelPoint.x} dy="-0.2em">{getCategoryDisplayName(slice.name, language)}</tspan>
                                      <tspan x={outsideLabelPoint.x} dy="1.15em">{slice.share.toFixed(0)}%</tspan>
                                    </text>
                                  </>
                                )}
                              </React.Fragment>
                            );
                          });
                        })()}
                        <circle cx="50" cy="50" r="19" className="category-donut-core" />
                        <text x="50" y="46" textAnchor="middle" className="category-donut-total-label">
                          {t(language, 'total_spend')}
                        </text>
                        <text x="50" y="56" textAnchor="middle" className="category-donut-total-value">
                          ${stats.totalSpent.toFixed(0)}
                        </text>
                      </svg>
                      {(() => {
                        let startAngle = 0;
                        return categorySlices.map((slice) => {
                          const sliceAngle = (slice.share / 100) * 360;
                          const endAngle = startAngle + sliceAngle;
                          const labelPoint = getPiePoint(startAngle, endAngle, 34);
                          startAngle = endAngle;

                          return (
                            <button
                              key={`${slice.key}-hit`}
                              type="button"
                              aria-label={`${getCategoryDisplayName(slice.name, language)} ${slice.share.toFixed(0)}%`}
                              onClick={() => selectCategory(slice.key)}
                              className="category-donut-hit"
                              style={{
                                left: `${labelPoint.x}%`,
                                top: `${labelPoint.y}%`,
                              }}
                            />
                          );
                        });
                      })()}
                    </div>

                    <div className="category-mix-grid">
                      {categorySlices.map((slice) => {
                        const matrixCategory = categoryMatrixByName.get(slice.key);
                        const avgTicket = matrixCategory ? matrixCategory.avgTicket : slice.count > 0 ? slice.amount / slice.count : 0;
                        const deltaPct = matrixCategory?.deltaPct ?? null;
                        const deltaClass = deltaPct === null ? 'text-secondary' : deltaPct >= 0 ? 'text-red' : 'text-green';
                        const deltaLabel = deltaPct === null ? t(language, 'na') : `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`;
                        const selected = selectedCategoryKey === slice.key;

                        return (
                          <button
                            key={slice.key}
                            type="button"
                            onClick={() => selectCategory(slice.key)}
                            className={`category-mix-tile ${selected ? 'is-active' : ''}`}
                          >
                            <div className="d-flex align-items-center justify-content-between gap-2">
                              <div className="d-flex align-items-center gap-2 min-w-0">
                                <span className="legend-dot" style={{ backgroundColor: slice.color }} />
                                <span className="fw-semibold text-truncate">{getCategoryDisplayName(slice.name, language)}</span>
                              </div>
                              <span className="fw-semibold">${slice.amount.toFixed(2)}</span>
                            </div>
                            <div className="category-mix-meta">
                              <span>{slice.count} {t(language, 'txns')}</span>
                              <span>{slice.share.toFixed(1)}%</span>
                            </div>
                            <div className="category-mix-stats">
                              <div>
                                <div className="category-bar-stat-label">{copy.avgSpend}</div>
                                <div>${avgTicket.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="category-bar-stat-label">{compareLabel}</div>
                                <div className={`fw-semibold ${deltaClass}`}>{deltaLabel}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="empty py-4">{copy.noCategoryTransactions}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="row row-cards mt-4">
        <div className="col-xl-5">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title d-flex align-items-center gap-2">
                  <Activity size={16} className="text-blue" />
                  {copy.cashFlowTrend}
                </div>
                <div className="card-subtitle">{copy.lastSixMonths}</div>
              </div>
              <div className="card-actions">
                <span className={`badge ${trendDeltaPct === null ? 'bg-secondary-lt' : trendIsUp ? 'bg-red-lt' : 'bg-green-lt'}`}>
                  {selectedCategoryTitle}: {trendDeltaPct === null ? t(language, 'na') : `${trendIsUp ? '+' : ''}${trendDeltaPct.toFixed(1)}%`}
                </span>
              </div>
            </div>

            <div className="card-body">
              {monthlyTrend.length > 0 ? (
                <div className="dashboard-bars dashboard-bars-monthly">
                  {monthlyTrend.map((item, index) => (
                    <button
                      key={item.month}
                      type="button"
                      onClick={() => toggleSelection({ type: 'month', key: item.month })}
                      className={`dashboard-bar-item dashboard-bar-button ${selection?.type === 'month' && selection.key === item.month ? 'is-active' : ''}`}
                      title={`$${item.amount.toFixed(2)}`}
                    >
                      <div className="dashboard-bar-track">
                        <div
                          className="insight-bar insight-meter dashboard-chart-bar"
                          style={{
                            height: `${Math.max(10, (item.amount / maxTrendSpend) * 100)}%`,
                            animationDelay: `${index * 70}ms`,
                            background: `linear-gradient(180deg, ${BAR_COLORS[index % BAR_COLORS.length]}cc 0%, ${BAR_COLORS[index % BAR_COLORS.length]} 100%)`,
                          }}
                        />
                      </div>
                      <div className="dashboard-bar-label">{formatMonthLabel(item.month, language)}</div>
                      <div className="dashboard-bar-value">${item.amount.toFixed(0)}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty py-4">
                  <p className="empty-title">{copy.noTrendMovers}</p>
                </div>
              )}

              <div className="subheader mt-4 mb-2">{copy.trendMovers}</div>
              <div className="list-group list-group-flush">
                {[stats.topIncrease, stats.topDrop].filter(Boolean).map((category) => {
                  const direction = category!.delta >= 0 ? 'up' : 'down';
                  return (
                    <button
                      key={`${category!.name}-${direction}`}
                      type="button"
                      onClick={() => selectCategory(category!.name)}
                      className={`list-group-item list-group-item-action insight-row px-0 ${selectedCategoryKey === category!.name ? 'active-soft' : ''}`}
                    >
                      <div className="row align-items-center">
                        <div className="col text-truncate">
                          <div className="text-muted small d-flex align-items-center gap-1">
                            {direction === 'up' ? <ArrowUpRight size={14} className="text-red" /> : <ArrowDownRight size={14} className="text-green" />}
                            {direction === 'up' ? copy.biggestIncrease : copy.biggestDrop}
                          </div>
                          <div className="fw-semibold text-truncate">{getCategoryDisplayName(category!.name, language)}</div>
                          <div className="progress progress-sm mt-2">
                            <div
                              className={`progress-bar bg-${direction === 'up' ? 'red' : 'green'}`}
                              style={{ width: `${Math.max(8, (Math.abs(category!.delta) / maxCategoryDelta) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className={`col-auto fw-semibold text-${direction === 'up' ? 'red' : 'green'}`}>
                          {category!.delta >= 0 ? '+' : '-'}${Math.abs(category!.delta).toFixed(2)}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {!stats.topIncrease && !stats.topDrop && (
                  <div className="empty py-4">{copy.noTrendMovers}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-7">
          <div className="card">
            <div className="card-header">
              <div className="card-title d-flex align-items-center gap-2">
                <TrendingUp size={16} className="text-red" />
                {copy.largeOutliers}
              </div>
            </div>
            <div className="list-group list-group-flush">
              {stats.outliers.length > 0 ? stats.outliers.map((transaction, index) => (
                <div key={`${transaction.merchantName}-${transaction.date}-${index}`} className="list-group-item">
                  <div className="row align-items-center">
                    <div className="col text-truncate">
                      <div className="fw-semibold text-truncate">{transaction.merchantName}</div>
                      <div className="text-muted small">
                        {formatShortDate(transaction.parsedDate, language)} / {getCategoryDisplayName(transaction.categoryName, language)}
                      </div>
                    </div>
                    <div className="col-auto fw-semibold">${transaction.amountAbs.toFixed(2)}</div>
                  </div>
                </div>
              )) : (
                <div className="empty py-4">{copy.noOutliers}</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {selection && (
        <div className="category-detail-layer">
          <button
            type="button"
            aria-label={t(language, 'close')}
            onClick={() => setSelection(null)}
            className="category-detail-backdrop"
          />
          <div className="modal modal-blur show category-detail-modal" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <div className="modal-title d-flex align-items-center gap-2">
                      <Sparkles size={16} className="text-blue" />
                      {selectedTitle} {copy.categoryDetails}
                    </div>
                    <div className="text-muted small">
                      {selectedDetailTransactions.length} {t(language, 'txns')} / ${selectedDetailTotal.toFixed(2)}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={t(language, 'close')}
                    onClick={() => setSelection(null)}
                    className="btn-close"
                  />
                </div>
                <div className="modal-body p-0">
                  <div className="table-responsive">
                    <table className="table table-vcenter card-table mb-0">
                      <tbody>
                        {selectedDetailTransactions.length > 0 ? selectedDetailTransactions.slice(0, 60).map((transaction, index) => (
                          <tr key={`${transaction.merchantName}-${transaction.date}-${index}`}>
                            <td>
                              <div className="fw-semibold">{transaction.merchantName}</div>
                              <div className="text-muted small">
                                {transaction.parsedDate.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-SG')} / {getCategoryDisplayName(transaction.categoryName, language)} / {getCardDisplayName(CardBenefitManager.normalizeTransactionCardId(transaction), language, CardBenefitManager.normalizeTransactionCardId(transaction))}
                              </div>
                            </td>
                            <td className="text-end fw-semibold">${transaction.amountAbs.toFixed(2)}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td className="text-muted">{copy.noCategoryTransactions}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => setSelection(null)} className="btn btn-outline-secondary">
                    <X size={16} />
                    {t(language, 'close')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
