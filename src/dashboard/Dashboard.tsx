import React, { useState, useEffect, useMemo } from 'react';
import { CardBenefitManager } from '../utils/card-benefits';
import { TransactionCalculator } from '../utils/calculator';
import { Transaction } from '../types';
import { TransactionTable } from './TransactionTable';
import { CardBreakdown } from './CardBreakdown';
import { CategoryAggregation } from './CategoryAggregation';
import { ArrowLeft, Plus, Download } from 'lucide-react';
import { 
  applyCategoryOverrides, 
  applyOverrideToSimilar, 
  updateOverridesForMerchant, 
  type CategoryOverrides 
} from '../utils/category-overrides';

export const Dashboard: React.FC = () => {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [excludeReimbursable, setExcludeReimbursable] = useState<boolean>(true);
  const [currentCard, setCurrentCard] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [insightRange, setInsightRange] = useState<'month' | 'year' | 'all'>('month');
  const [insightMonth, setInsightMonth] = useState<string>('');
  const [insightYear, setInsightYear] = useState<string>('');
  const [userElections, setUserElections] = useState<Record<string, string[]>>({});
  const [categoryOverrides, setCategoryOverrides] = useState<CategoryOverrides>({});

  useEffect(() => {
    loadData();
  }, []);

  const openUobBanking = () => {
    chrome.tabs.create({ url: 'https://pib.uob.com.sg/PIBLogin/public/processPreCapture.do' });
  };

  const openDbsBanking = () => {
    chrome.tabs.create({ url: 'https://internet-banking.dbs.com.sg/IB/Welcome' });
  };

  const loadData = async () => {
    const data = await chrome.storage.local.get(['transactions', 'cardConfigs', 'categoryOverrides']) as { 
      transactions?: Transaction[];
      cardConfigs?: Record<string, string[]>;
      categoryOverrides?: CategoryOverrides;
    };
    const overrides = data.categoryOverrides || {};
    const txns = applyCategoryOverrides(data.transactions || [], overrides);
    const mergedCardConfigs = {
      UOB_LADYS: ['Dining', 'Travel'],
      ...(data.cardConfigs || {})
    };
    setAllTransactions(txns);
    setUserElections(mergedCardConfigs);
    setCategoryOverrides(overrides);
    
    if (txns.length > 0 && !selectedMonth) {
      const months = Object.keys(TransactionCalculator.groupTransactionsByMonth(txns));
      const sortedMonths = months.sort((a, b) => b.localeCompare(a));
      if (sortedMonths.length > 0) setSelectedMonth(sortedMonths[0]);
      if (sortedMonths.length > 0 && !insightMonth) setInsightMonth(sortedMonths[0]);
      const years = Array.from(
        new Set(
          txns
            .map(t => new Date(t.date))
            .filter(d => !Number.isNaN(d.getTime()))
            .map(d => String(d.getFullYear()))
        )
      ).sort((a, b) => Number(b) - Number(a));
      if (years.length > 0 && !insightYear) setInsightYear(years[0]);
    }
  };

  const insightMonths = useMemo(() => {
    const months = Object.keys(TransactionCalculator.groupTransactionsByMonth(allTransactions));
    return months.sort((a, b) => b.localeCompare(a));
  }, [allTransactions]);

  const insightYears = useMemo(() => {
    const years = Array.from(
      new Set(
        allTransactions
          .map(t => new Date(t.date))
          .filter(d => !Number.isNaN(d.getTime()))
          .map(d => String(d.getFullYear()))
      )
    );
    return years.sort((a, b) => Number(b) - Number(a));
  }, [allTransactions]);

  const displayTransactions = useMemo(
    () => excludeReimbursable ? allTransactions.filter(t => !t.reimbursable) : allTransactions,
    [allTransactions, excludeReimbursable]
  );

  const grossTotalSpend = useMemo(
    () => allTransactions.reduce((acc, t) => acc + Math.abs(t.amount), 0),
    [allTransactions]
  );
  const netTotalSpend = useMemo(
    () => allTransactions.reduce((acc, t) => acc + (t.reimbursable ? 0 : Math.abs(t.amount)), 0),
    [allTransactions]
  );

  const overallInsightTransactions = useMemo(() => {
    if (insightRange === 'all') return displayTransactions;
    if (insightRange === 'month') {
      const groups = TransactionCalculator.groupTransactionsByMonth(displayTransactions);
      return groups[insightMonth] || [];
    }
    return displayTransactions.filter(t => {
      const d = new Date(t.date);
      return !Number.isNaN(d.getTime()) && String(d.getFullYear()) === insightYear;
    });
  }, [displayTransactions, insightRange, insightMonth, insightYear]);

  const filteredTransactions = useMemo(() => {
    let txns = allTransactions;
    if (currentCard) {
      txns = txns.filter(t => (t.cardId || 'DBS_WWMC') === currentCard);
    }
    if (selectedMonth) {
      const groups = TransactionCalculator.groupTransactionsByMonth(txns);
      txns = groups[selectedMonth] || [];
    }
    return txns;
  }, [allTransactions, selectedMonth, currentCard]);

  if (!currentCard) {
    return (
      <div className="container p-6 mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Spending Track</h1>
        </header>
        
        <section className="mb-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <h2 className="text-xl font-semibold text-gray-700">Your Cards</h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={excludeReimbursable}
                  onChange={(e) => setExcludeReimbursable(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Exclude Reimbursable
              </label>
              <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                Showing <span className="font-semibold">${excludeReimbursable ? netTotalSpend.toFixed(2) : grossTotalSpend.toFixed(2)}</span>
                {excludeReimbursable && <span className="text-gray-400"> (gross ${grossTotalSpend.toFixed(2)})</span>}
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <div className="text-[11px] text-blue-800 font-semibold mb-1">Weekly Update Reminder</div>
                <div className="flex items-center gap-2">
                <button
                  onClick={openUobBanking}
                  className="text-xs px-2.5 py-1 rounded bg-white border border-blue-200 text-blue-700 hover:bg-blue-100"
                >
                  Open UOB
                </button>
                <button
                  onClick={openDbsBanking}
                  className="text-xs px-2.5 py-1 rounded bg-white border border-blue-200 text-blue-700 hover:bg-blue-100"
                >
                  Open DBS
                </button>
                <span className="text-[11px] text-blue-700">Login and scan once per week.</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CardBenefitManager.getAllCards().map(card => (
              <CardBreakdown 
                key={card.id} 
                card={card} 
                transactions={allTransactions} 
                userElections={userElections[card.id]}
                excludeReimbursable={excludeReimbursable}
                onViewDetails={() => setCurrentCard(card.id)}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <h2 className="text-xl font-semibold text-gray-700">Overall Insights</h2>
            <div className="flex items-center gap-2">
              <select
                value={insightRange}
                onChange={(e) => setInsightRange(e.target.value as 'month' | 'year' | 'all')}
                className="border rounded-md px-3 py-2 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="month">Month</option>
                <option value="year">Year</option>
                <option value="all">All</option>
              </select>
              {insightRange === 'month' && (
                <select
                  value={insightMonth}
                  onChange={(e) => setInsightMonth(e.target.value)}
                  className="border rounded-md px-3 py-2 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  {insightMonths.map(m => (
                    <option key={m} value={m}>{TransactionCalculator.formatMonthKey(m)}</option>
                  ))}
                </select>
              )}
              {insightRange === 'year' && (
                <select
                  value={insightYear}
                  onChange={(e) => setInsightYear(e.target.value)}
                  className="border rounded-md px-3 py-2 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  {insightYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <CategoryAggregation
            transactions={overallInsightTransactions}
            allTransactions={displayTransactions}
            compareMode={insightRange === 'month' ? 'mom' : insightRange === 'year' ? 'yoy' : null}
            currentMonthKey={insightMonth}
            currentYear={insightYear}
          />
        </section>
      </div>
    );
  }

  const cardConfig = CardBenefitManager.getCardConfig(currentCard)!;
  const stats = TransactionCalculator.calculateStats(filteredTransactions, currentCard, userElections[currentCard]);
  const netSpent = filteredTransactions.reduce((acc, t) => acc + (t.reimbursable ? 0 : Math.abs(t.amount)), 0);
  const uobDetail = currentCard === 'UOB_LADYS'
    ? TransactionCalculator.calculateUobEligibleSpend(filteredTransactions, userElections[currentCard] || null)
    : null;

  const handleCategoryChange = async (txn: Transaction, newCategory: string) => {
    const normalized = newCategory.trim() || 'Uncategorized';
    const updatedOverrides = updateOverridesForMerchant(categoryOverrides, txn.merchant, normalized);
    const updatedTransactions = applyOverrideToSimilar(allTransactions, txn.merchant, normalized);
    setAllTransactions(updatedTransactions);
    setCategoryOverrides(updatedOverrides);
    await chrome.storage.local.set({ 
      transactions: updatedTransactions, 
      categoryOverrides: updatedOverrides 
    });
  };

  const handleReimbursableChange = async (txn: Transaction, reimbursable: boolean) => {
    const updatedTransactions = allTransactions.map(t => t === txn ? { ...t, reimbursable } : t);
    setAllTransactions(updatedTransactions);
    await chrome.storage.local.set({ transactions: updatedTransactions });
  };

  return (
    <div className="container p-6 mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCurrentCard(null)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-gray-800">{cardConfig.name}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border rounded-md px-3 py-2 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {Object.keys(TransactionCalculator.groupTransactionsByMonth(allTransactions))
              .sort((a, b) => b.localeCompare(a))
              .map(m => (
              <option key={m} value={m}>{TransactionCalculator.formatMonthKey(m)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Net Spend (Excl. Reimb.)</div>
          <div className="text-2xl font-bold text-gray-900">${netSpent.toFixed(2)}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Expected Miles</div>
          <div className="text-2xl font-bold text-blue-600">{stats.expectedMiles.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">4 mpd Cap Remaining</div>
          <div className="text-2xl font-bold text-green-600">
            ${Math.max(0, cardConfig.totalCap - stats.totalSpent).toFixed(2)}
          </div>
        </div>
      </div>
      {uobDetail && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="text-sm font-semibold text-gray-700 mb-2">UOB Category Cap Detail</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {Object.keys(uobDetail.categorySpent).map(cat => {
              const used = uobDetail.categorySpent[cat] || 0;
              const rem = uobDetail.categoryRemaining?.[cat] || 0;
              return (
                <div key={cat} className="flex justify-between bg-gray-50 rounded px-3 py-2">
                  <span className="text-gray-600">{cat}</span>
                  <span className="font-semibold text-gray-900">${used.toFixed(2)} / ${uobDetail.perCategoryCap} (bal ${rem.toFixed(2)})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="font-semibold text-gray-700">Transactions</h2>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              <Plus size={18} /> Add Transaction
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-600">
              <Download size={18} /> Export CSV
            </button>
          </div>
        </div>
        <TransactionTable 
          transactions={filteredTransactions} 
          cardId={currentCard}
          userElections={userElections[currentCard]}
          onCategoryChange={handleCategoryChange}
          onReimbursableChange={handleReimbursableChange}
        />
      </div>
    </div>
  );
};
