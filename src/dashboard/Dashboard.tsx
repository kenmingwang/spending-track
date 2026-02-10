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
  const [currentCard, setCurrentCard] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [userElections, setUserElections] = useState<Record<string, string[]>>({});
  const [categoryOverrides, setCategoryOverrides] = useState<CategoryOverrides>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await chrome.storage.local.get(['transactions', 'cardConfigs', 'categoryOverrides']) as { 
      transactions?: Transaction[];
      cardConfigs?: Record<string, string[]>;
      categoryOverrides?: CategoryOverrides;
    };
    const overrides = data.categoryOverrides || {};
    const txns = applyCategoryOverrides(data.transactions || [], overrides);
    setAllTransactions(txns);
    setUserElections(data.cardConfigs || {});
    setCategoryOverrides(overrides);
    
    if (txns.length > 0 && !selectedMonth) {
      const months = Object.keys(TransactionCalculator.groupTransactionsByMonth(txns));
      if (months.length > 0) setSelectedMonth(months[0]);
    }
  };

  const filteredTransactions = useMemo(() => {
    let txns = allTransactions;
    if (selectedMonth) {
      const groups = TransactionCalculator.groupTransactionsByMonth(allTransactions);
      txns = groups[selectedMonth] || [];
    }
    return txns;
  }, [allTransactions, selectedMonth]);

  if (!currentCard) {
    return (
      <div className="container p-6 mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Spending Track</h1>
        </header>
        
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-6 text-gray-700">Your Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CardBenefitManager.getAllCards().map(card => (
              <CardBreakdown 
                key={card.id} 
                card={card} 
                transactions={allTransactions} 
                onViewDetails={() => setCurrentCard(card.id)}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-6 text-gray-700">Overall Category Breakdown</h2>
          <CategoryAggregation transactions={allTransactions} />
        </section>
      </div>
    );
  }

  const cardConfig = CardBenefitManager.getCardConfig(currentCard)!;
  const stats = TransactionCalculator.calculateStats(filteredTransactions, currentCard, userElections[currentCard]);

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
            {Object.keys(TransactionCalculator.groupTransactionsByMonth(allTransactions)).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Total Spent</div>
          <div className="text-2xl font-bold text-gray-900">${stats.totalSpent.toFixed(2)}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Expected Miles</div>
          <div className="text-2xl font-bold text-blue-600">{stats.expectedMiles.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Remaining Cap</div>
          <div className="text-2xl font-bold text-green-600">
            ${Math.max(0, cardConfig.totalCap - stats.totalSpent).toFixed(2)}
          </div>
        </div>
      </div>

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
        />
      </div>
    </div>
  );
};
