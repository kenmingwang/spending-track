import React from 'react';
import { Transaction } from '../types';
import { CardConfig } from '../types';
import { CardBenefitManager } from '../utils/card-benefits';
import { TransactionCalculator } from '../utils/calculator';
import { cn } from '../utils/cn';
import { normalizeCategory } from '../utils/category-overrides';

interface Props {
  card: CardConfig;
  transactions: Transaction[];
  userElections?: string[];
  excludeReimbursable?: boolean;
  onViewDetails: () => void;
}

export const CardBreakdown: React.FC<Props> = ({ card, transactions, userElections, excludeReimbursable = false, onViewDetails }) => {
  const cardTransactions = CardBenefitManager.filterTransactionsForCard(transactions, card.id);
  const now = new Date();
  const monthlyTransactions = cardTransactions.filter(t => {
    const d = new Date(t.date);
    return !Number.isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const spendingTransactions = excludeReimbursable
    ? monthlyTransactions.filter(t => !t.reimbursable)
    : monthlyTransactions;
  const totalSpent = monthlyTransactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const netMonthlySpent = monthlyTransactions.reduce((acc, t) => acc + (t.reimbursable ? 0 : Math.abs(t.amount)), 0);
  const displayedSpent = spendingTransactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const effectiveElections = CardBenefitManager.getEffectiveUserElections(card.id, userElections);
  const uobEligible = card.id === 'UOB_LADYS'
    ? TransactionCalculator.calculateUobEligibleSpend(monthlyTransactions, effectiveElections)
    : null;
  const fourMpdSpent = card.id === 'UOB_LADYS'
    ? (uobEligible?.aggregateUsed || 0)
    : monthlyTransactions.reduce((acc, t) => {
        const eligibility = CardBenefitManager.isTransactionEligible(t, card.id, effectiveElections);
        if (eligibility.eligible && eligibility.mpd >= 4) {
          return acc + Math.abs(t.amount);
        }
        return acc;
      }, 0);
  const fourMpdUsed = Math.min(card.totalCap, fourMpdSpent);
  const fourMpdBalance = Math.max(0, card.totalCap - fourMpdUsed);
  
  const categorySpending: Record<string, number> = {};
  spendingTransactions.forEach(t => {
    const cat = normalizeCategory(t.category || 'Uncategorized');
    categorySpending[cat] = (categorySpending[cat] || 0) + Math.abs(t.amount);
  });

  const topCategories = Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const percentSpent = Math.min(100, (fourMpdUsed / card.totalCap) * 100);
  const uobTrackedCategories = ['Dining', 'Travel'];
  const uobCategoryRows = card.id === 'UOB_LADYS' && uobEligible
    ? uobTrackedCategories.map(cat => {
        const used = uobEligible.categorySpent?.[cat] || 0;
        const cap = uobEligible.perCategoryCap || 750;
        const remaining = uobEligible.categoryRemaining?.[cat] ?? Math.max(0, cap - used);
        const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
        return { name: cat, used, remaining, cap, pct };
      })
    : [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="flex items-center gap-4 mb-4">
        <div className="text-3xl bg-gray-50 p-3 rounded-lg">{card.icon}</div>
        <div>
          <h3 className="font-bold text-gray-900 leading-tight">{card.name}</h3>
          <p className="text-xs text-gray-500 font-medium">{card.description}</p>
        </div>
      </div>

      <div className="space-y-4 flex-grow">
        <div>
          <div className="flex justify-between text-sm mb-2 font-medium">
            <span className="text-gray-500">Total Spending</span>
            <span className="text-gray-900 font-bold">${displayedSpent.toFixed(2)}</span>
          </div>
          {excludeReimbursable ? (
            <div className="text-[11px] text-gray-400 mb-2">Gross ${totalSpent.toFixed(2)} used for points/4 mpd</div>
          ) : (
            <div className="text-[11px] text-gray-400 mb-2">Net ${netMonthlySpent.toFixed(2)} (excl. reimbursable)</div>
          )}
          <div className="flex justify-between text-sm mb-2 font-medium">
            <span className="text-gray-500">4 mpd Balance</span>
            <span className="text-gray-900 font-bold">${fourMpdBalance.toFixed(2)} / ${card.totalCap}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                percentSpent > 90 ? "bg-red-500" : percentSpent > 70 ? "bg-orange-500" : "bg-blue-600"
              )}
              style={{ width: `${percentSpent}%` }}
            />
          </div>
          {uobCategoryRows.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {uobCategoryRows.map(row => (
                <div key={row.name} className="rounded bg-gray-50 px-2.5 py-2">
                  <div className="flex justify-between text-[11px] text-gray-600">
                    <span>{row.name}</span>
                    <span className="font-semibold">${row.remaining.toFixed(2)} balance</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        row.name === 'Dining' ? 'bg-emerald-500' : 'bg-violet-500'
                      )}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500">${row.used.toFixed(2)} / ${row.cap}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-50">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Top Categories</div>
          <div className="space-y-2">
            {topCategories.map(([cat, amount]) => (
              <div key={cat} className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">{cat}</span>
                <span className="text-gray-900 font-bold">${amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button 
        onClick={onViewDetails}
        className="w-full mt-6 py-2.5 px-4 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-black transition-colors"
      >
        View Details
      </button>
    </div>
  );
};

