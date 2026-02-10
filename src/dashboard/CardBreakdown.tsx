import React from 'react';
import { Transaction } from '../types';
import { CardConfig } from '../types';
import { CardBenefitManager } from '../utils/card-benefits';
import { cn } from '../utils/cn';

interface Props {
  card: CardConfig;
  transactions: Transaction[];
  onViewDetails: () => void;
}

export const CardBreakdown: React.FC<Props> = ({ card, transactions, onViewDetails }) => {
  const cardTransactions = transactions; // For now all, could filter by card
  const totalSpent = cardTransactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  
  const categorySpending: Record<string, number> = {};
  cardTransactions.forEach(t => {
    const cat = t.category || 'Uncategorized';
    categorySpending[cat] = (categorySpending[cat] || 0) + Math.abs(t.amount);
  });

  const topCategories = Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const percentSpent = Math.min(100, (totalSpent / card.totalCap) * 100);

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
            <span className="text-gray-500">Monthly Spending</span>
            <span className="text-gray-900 font-bold">${totalSpent.toFixed(2)} / ${card.totalCap}</span>
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

