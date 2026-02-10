import React from 'react';
import { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
}

export const CategoryAggregation: React.FC<Props> = ({ transactions }) => {
  const categoryTotals = React.useMemo(() => {
    const totals: Record<string, { amount: number; count: number }> = {};
    transactions.forEach(t => {
      const cat = t.category || 'Uncategorized';
      if (!totals[cat]) totals[cat] = { amount: 0, count: 0 };
      totals[cat].amount += Math.abs(t.amount);
      totals[cat].count++;
    });
    return Object.entries(totals).sort((a, b) => b[1].amount - a[1].amount);
  }, [transactions]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {categoryTotals.map(([cat, data]) => (
        <div key={cat} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-blue-600">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 truncate" title={cat}>
            {cat}
          </div>
          <div className="text-lg font-bold text-gray-900">${data.amount.toFixed(2)}</div>
          <div className="text-xs text-gray-500 font-medium">{data.count} txns</div>
        </div>
      ))}
    </div>
  );
};
