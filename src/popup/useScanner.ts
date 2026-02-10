import { useState, useEffect, useCallback } from 'react';
import { Transaction } from '../types';
import { applyCategoryOverrides, type CategoryOverrides } from '../utils/category-overrides';

export interface ScanProgress {
  current: number;
  total: number;
}

export const useScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [status, setStatus] = useState<string>('Ready');

  useEffect(() => {
    const messageListener = (request: any) => {
      if (request.action === "scan_progress") {
        setProgress({ current: request.current, total: request.total });
        setStatus(`Scanning: ${request.current}/${request.total}`);
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  const startScan = useCallback(async () => {
    setIsScanning(true);
    setStatus('Initializing scan...');
    setProgress({ current: 0, total: 0 });

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found');

      // Check if we can inject
      if (tab.url?.startsWith('chrome://')) {
        setStatus('Cannot scan on chrome:// pages');
        setIsScanning(false);
        return;
      }

      // 1. Try to ping the content script
      let isAlive = false;
      try {
        const pingResp = await chrome.tabs.sendMessage(tab.id, { action: "ping" });
        if (pingResp?.status === "ok") isAlive = true;
      } catch (e) {
        // Expected error if script is missing: "Could not establish connection..."
      }

      // 2. Re-inject if not alive
      if (!isAlive) {
        setStatus('Re-attaching to page...');
        const manifest = chrome.runtime.getManifest();
        const contentScript = manifest.content_scripts?.[0]?.js?.[0];
        if (contentScript) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [contentScript]
          });
          // Small delay for script to initialize
          await new Promise(r => setTimeout(r, 200));
        } else {
          throw new Error('Content script not found in manifest');
        }
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: "extract_transactions" });
      
      if (response?.error) {
        setStatus(`Error: ${response.error}`);
        return;
      }

      if (response?.transactions) {
        // Handle deduplication and saving
        const data = await chrome.storage.local.get(['transactions', 'categoryOverrides']) as { 
          transactions?: Transaction[];
          categoryOverrides?: CategoryOverrides;
        };
        const existingTxns = data.transactions || [];
        const overrides = data.categoryOverrides || {};
        
        // Simple deduplication logic
        const newTxns = response.transactions.filter((nt: any) => 
          !existingTxns.some((et: any) => 
            et.date === nt.date && 
            et.merchant === nt.merchant && 
            Math.abs(et.amount) === Math.abs(nt.amount)
          )
        );

        const newTxnsWithOverrides = applyCategoryOverrides(newTxns, overrides);

        await chrome.storage.local.set({ 
          transactions: [...existingTxns, ...newTxnsWithOverrides] 
        });
        
        setStatus(response.cancelled ? 'Scan stopped' : `Found ${newTxnsWithOverrides.length} new transactions`);
      }
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message || 'Connection failed'}`);
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  }, []);

  const stopScan = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: "cancel_scan" });
      setStatus('Stopping...');
    }
  }, []);

  return { isScanning, progress, status, startScan, stopScan };
};
