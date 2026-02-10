import React, { useState, useEffect } from 'react';
import { useScanner } from './useScanner';
import { CardBenefitManager } from '../utils/card-benefits';
import { TransactionCalculator } from '../utils/calculator';
import { Transaction } from '../types';
import { Play, Square, ExternalLink, RefreshCw } from 'lucide-react';

export const Popup: React.FC = () => {
  const { isScanning, progress, status, startScan, stopScan } = useScanner();
  const [cardStats, setCardStats] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, [isScanning]);

  const loadStats = async () => {
    const data = await chrome.storage.local.get('transactions') as { transactions?: Transaction[] };
    const txns = data.transactions || [];
    
    const stats = CardBenefitManager.getAllCards().map(card => {
      const stats = TransactionCalculator.calculateStats(txns, card.id);
      return {
        ...card,
        spent: stats.totalSpent,
        miles: stats.expectedMiles
      };
    });
    setCardStats(stats);
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: 'dashboard/dashboard.html' });
  };

  const resetData = async () => {
    if (confirm('Are you sure you want to clear all data?')) {
      await chrome.storage.local.clear();
      loadStats();
    }
  };

  return (
    <div className="w-[350px] bg-white text-gray-900 font-sans p-4 shadow-xl">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-blue-600">💸</span> Spending Track
        </h1>
        <button 
          onClick={openDashboard}
          className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500 hover:text-blue-600"
          title="Open Dashboard"
        >
          <ExternalLink size={18} />
        </button>
      </header>

      <div className="space-y-3 mb-6">
        {cardStats.map(card => (
          <div key={card.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">{card.icon}</span>
              <div className="flex-grow">
                <div className="text-sm font-bold truncate">{card.name}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                  Remaining: ${Math.max(0, card.totalCap - card.spent).toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-blue-600">{card.miles} miles</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (card.spent / card.totalCap) * 100)}%` }} 
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-100">
        <div className="text-xs font-bold text-blue-800 mb-1">Status</div>
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
              <Play size={16} fill="white" /> Start Scanning
            </button>
          ) : (
            <button 
              onClick={stopScan}
              className="flex-grow flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors"
            >
              <Square size={16} fill="white" /> Stop Scan
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center text-[10px] text-gray-400">
        <button 
          onClick={resetData}
          className="flex items-center gap-1 hover:text-red-500 transition-colors font-medium"
        >
          <RefreshCw size={10} /> Reset All Data
        </button>
        <div className="font-medium">Version 1.0.0</div>
      </div>
    </div>
  );
};
