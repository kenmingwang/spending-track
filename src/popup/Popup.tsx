import React, { useState, useEffect } from 'react';
import { useScanner } from './useScanner';
import { CardBenefitManager } from '../utils/card-benefits';
import { TransactionCalculator } from '../utils/calculator';
import { Transaction } from '../types';
import { Play, Square, ExternalLink, RefreshCw } from 'lucide-react';

export const Popup: React.FC = () => {
  const { isScanning, progress, status, startScan, stopScan } = useScanner();
  const [cardStats, setCardStats] = useState<any[]>([]);
  const [uobRewards, setUobRewards] = useState<Array<{ label: string; value: number }>>([]);

  useEffect(() => {
    loadStats();
  }, [isScanning]);

  const loadStats = async () => {
    const data = await chrome.storage.local.get(['transactions', 'uobRewards', 'cardConfigs']) as {
      transactions?: Transaction[];
      uobRewards?: Array<{ label: string; value: number }>;
      cardConfigs?: Record<string, string[]>;
    };
    const txns = data.transactions || [];
    setUobRewards(data.uobRewards || []);
    
    const stats = CardBenefitManager.getAllCards().map(card => {
      const stats = TransactionCalculator.calculateStats(txns, card.id);
      const uobDetail = card.id === 'UOB_LADYS'
        ? TransactionCalculator.calculateUobEligibleSpend(
            CardBenefitManager.filterTransactionsForCard(txns, card.id),
            data.cardConfigs?.[card.id] || null
          )
        : null;
      return {
        ...card,
        spent: stats.totalSpent,
        miles: stats.expectedMiles,
        uobDetail
      };
    });
    setCardStats(stats);
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: 'dashboard/dashboard.html' });
  };

  const openUobBanking = () => {
    chrome.tabs.create({ url: 'https://pib.uob.com.sg/PIBLogin/public/processPreCapture.do' });
  };

  const openDbsBanking = () => {
    chrome.tabs.create({ url: 'https://internet-banking.dbs.com.sg/IB/Welcome' });
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
            {card.id === 'UOB_LADYS' && card.uobDetail && (
              <div className="mt-2 space-y-1">
                {['Dining', 'Travel'].map((cat) => {
                  const used = Number(card.uobDetail.categorySpent?.[cat] || 0);
                  const cap = Number(card.uobDetail.perCategoryCap || 750);
                  const remaining = Math.max(0, cap - used);
                  const pct = Math.min(100, cap > 0 ? (used / cap) * 100 : 0);
                  return (
                    <div key={cat} className="text-[10px] text-gray-500">
                      <div className="flex justify-between">
                        <span>{cat}</span>
                        <span>bal ${remaining.toFixed(0)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1 mt-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${cat === 'Dining' ? 'bg-emerald-500' : 'bg-violet-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-0.5">${used.toFixed(0)} / ${cap}</div>
                    </div>
                  );
                })}
              </div>
            )}
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

      {uobRewards.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-100">
          <div className="text-xs font-bold text-amber-800 mb-2">Latest UOB Rewards</div>
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
          <RefreshCw size={10} /> Reset All Data
        </button>
        <div className="font-medium">Version 1.0.0</div>
      </div>
      <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg p-2.5">
        <div className="text-[10px] font-semibold text-gray-600 mb-2">Weekly Update Reminder</div>
        <div className="flex gap-2 mb-1.5">
          <button
            onClick={openUobBanking}
            className="flex-1 text-[10px] px-2 py-1.5 rounded bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-semibold"
          >
            Open UOB
          </button>
          <button
            onClick={openDbsBanking}
            className="flex-1 text-[10px] px-2 py-1.5 rounded bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-semibold"
          >
            Open DBS
          </button>
        </div>
        <div className="text-[10px] text-gray-500">Login to both banks and run scan once a week to keep caps accurate.</div>
      </div>
    </div>
  );
};
