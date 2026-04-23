import { useState, useEffect, useCallback } from 'react';
import { Transaction } from '../types';
import { CardBenefitManager } from '../utils/card-benefits';
import { Language, t } from '../utils/i18n';
import {
  applyCategoryOverrides,
  updateOverridesForMerchant,
  type CategoryOverrides
} from '../utils/category-overrides';
import { enrichHsbcTransactionInference } from '../utils/merchant-category';
import { dedupeTransactions, getTransactionDedupeKey } from '../utils/transaction-dedupe';

export interface ScanProgress {
  current: number;
  total: number;
}

interface RewardInfo {
  label: string;
  value: number;
  raw?: string;
}

export const useScanner = (language: Language = 'en') => {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [status, setStatus] = useState<string>(t(language, 'scan_ready'));

  useEffect(() => {
    if (!isScanning) {
      setStatus(t(language, 'scan_ready'));
    }
  }, [language, isScanning]);

  useEffect(() => {
    const messageListener = (request: any) => {
      if (request.action === "scan_progress") {
        setProgress({ current: request.current, total: request.total });
        setStatus(t(language, 'scan_progress', { current: request.current, total: request.total }));
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, [language]);

  const startScan = useCallback(async () => {
    setIsScanning(true);
    setStatus(t(language, 'scan_initializing'));
    setProgress({ current: 0, total: 0 });

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found');

      // Check if we can inject
      if (tab.url?.startsWith('chrome://')) {
        setStatus(t(language, 'scan_cannot_chrome_pages'));
        setIsScanning(false);
        return;
      }

      // 1. Try to ping the content script
      const ensureContentScript = async () => {
        let isAlive = false;
        try {
          const pingResp = await chrome.tabs.sendMessage(tab.id!, { action: "ping" });
          if (pingResp?.status === "ok") isAlive = true;
        } catch (e) {
          // Expected when script is missing or page context just reloaded.
        }

        if (isAlive) return;
        setStatus(t(language, 'scan_reattaching'));
        const manifest = chrome.runtime.getManifest();
        const contentScript = manifest.content_scripts?.[0]?.js?.[0];
        if (contentScript) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id! },
            files: [contentScript]
          });
          // Small delay for script to initialize
          await new Promise(r => setTimeout(r, 200));
        } else {
          throw new Error('Content script not found in manifest');
        }
      };

      const waitForTabComplete = async (tabId: number, timeoutMs = 10000) => {
        await new Promise<void>((resolve) => {
          let done = false;
          const cleanup = () => {
            if (done) return;
            done = true;
            chrome.tabs.onUpdated.removeListener(listener);
            clearTimeout(timer);
            resolve();
          };
          const listener = (updatedTabId: number, info: any) => {
            if (updatedTabId === tabId && info.status === 'complete') cleanup();
          };
          const timer = setTimeout(cleanup, timeoutMs);
          chrome.tabs.onUpdated.addListener(listener);
        });
      };

      const shouldRetryForTabLifecycle = (message: string) =>
        /message channel is closed|Could not establish connection|receiving end does not exist|back\/forward cache/i.test(message);

      const sendMessageWithRetry = async (message: any) => {
        await ensureContentScript();
        try {
          return await chrome.tabs.sendMessage(tab.id!, message);
        } catch (firstErr: any) {
          const firstMsg = String(firstErr?.message || firstErr || '');
          if (!shouldRetryForTabLifecycle(firstMsg)) throw firstErr;

          setStatus(t(language, 'scan_reconnecting'));
          await waitForTabComplete(tab.id!);
          await ensureContentScript();

          try {
            return await chrome.tabs.sendMessage(tab.id!, message);
          } catch (secondErr: any) {
            const secondMsg = String(secondErr?.message || secondErr || '');
            if (!shouldRetryForTabLifecycle(secondMsg)) throw secondErr;
            throw new Error(t(language, 'scan_retry_error'));
          }
        }
      };

      const isLikelyUobTab = /uob/i.test(tab.url || '');

      let response: any;
      if (isLikelyUobTab) {
        const currentSectionResp = await sendMessageWithRetry({ action: "uob_get_section" });
        if (currentSectionResp?.error) throw new Error(currentSectionResp.error);
        const currentSectionValue = String(currentSectionResp?.value || '');
        const currentSectionText = String(currentSectionResp?.section || '');

        const sections: string[] = [];
        const mergedTransactions: any[] = [];
        const mergedRewards: RewardInfo[] = [];
        const scanErrors: string[] = [];
        const debugSummaries: string[] = [];

        const scanSection = async (value: string, label: string) => {
          setStatus(t(language, 'scan_uob_section', { label }));
          const switchResp = await sendMessageWithRetry({ action: "uob_set_section", value });
          if (switchResp?.error) throw new Error(switchResp.error);
          const scanResp = await sendMessageWithRetry({ action: "extract_transactions" });
          if (scanResp?.debugSummary) {
            debugSummaries.push(`${label}: ${scanResp.debugSummary}`);
          }
          if (scanResp?.debug) {
            console.info(`Spending Track UOB debug (${label})`, scanResp.debug);
          }
          if (scanResp?.error) {
            scanErrors.push(`${label}: ${scanResp.error}`);
            return;
          }
          if (scanResp?.section) sections.push(scanResp.section);
          mergedTransactions.push(...(scanResp?.transactions || []));
          mergedRewards.push(...(scanResp?.rewards || []));
        };

        // Respect the user's current UOB section selection and do not auto-switch across sections.
        const activeSectionValue = currentSectionValue || '1';
        const activeSectionLabel = currentSectionText || (
          activeSectionValue === '2'
            ? 'Previous Statement'
            : activeSectionValue === '0'
              ? 'New Transactions'
              : 'Latest Statement'
        );
        await scanSection(activeSectionValue, activeSectionLabel);

        try {
          const finalDebugResp = await sendMessageWithRetry({ action: "uob_debug_snapshot" });
          if (finalDebugResp?.summary) {
            debugSummaries.push(`Final: ${finalDebugResp.summary}`);
          }
          if (finalDebugResp?.debug) {
            console.info('Spending Track UOB debug (final)', finalDebugResp.debug);
          }
        } catch (debugErr) {
          console.warn('Spending Track: unable to collect final UOB debug snapshot', debugErr);
        }

        response = {
          source: 'UOB',
          sections,
          transactions: mergedTransactions,
          rewards: mergedRewards,
          errors: scanErrors,
          debugSummaries,
          cancelled: false
        };
      } else {
        response = await sendMessageWithRetry({ action: "extract_transactions" });
      }

      if (response?.error) {
        setStatus(`Error: ${response.error}`);
        return;
      }

      if (response?.transactions) {
        const normalizedCardId = (tx: any) => {
          if (tx?.cardId) return tx.cardId;
          if ((tx?.source || '').toUpperCase() === 'UOB') return 'UOB_LADYS';
          if ((tx?.source || '').toUpperCase() === 'HSBC') return 'HSBC_REVOLUTION';
          return 'DBS_WWMC';
        };

        const dedupedBatchTxns = dedupeTransactions(response.transactions || []);
        console.info('Spending Track: batch scan result', {
          source: response?.source || 'UNKNOWN',
          scannedCount: dedupedBatchTxns.length,
          rawCount: (response.transactions || []).length,
          sections: response?.sections || response?.section || [],
          sample: dedupedBatchTxns.slice(0, 5)
        });

        // Handle deduplication and saving
        const data = await chrome.storage.local.get(['transactions', 'categoryOverrides', 'cardLastUpdated']) as { 
          transactions?: Transaction[];
          categoryOverrides?: CategoryOverrides;
          cardLastUpdated?: Record<string, string>;
        };
        const existingTxns = dedupeTransactions(data.transactions || []);
        const overrides = data.categoryOverrides || {};
        const cardLastUpdated = data.cardLastUpdated || {};
        
        const existingKeys = new Set(existingTxns.map(getTransactionDedupeKey));
        const newTxns = dedupedBatchTxns.filter((nt: any) => 
          !existingKeys.has(getTransactionDedupeKey(nt))
        );
        console.info('Spending Track: dedupe result', {
          existingCount: existingTxns.length,
          scannedCount: dedupedBatchTxns.length,
          newCount: newTxns.length,
          duplicateCount: dedupedBatchTxns.length - newTxns.length
        });

        // 1) Learn cache from existing transaction history (user-edited or previously inferred categories)
        let learnedOverrides: CategoryOverrides = { ...overrides };
        existingTxns.forEach((tx) => {
          const cat = (tx.category || '').trim();
          if (!cat || /^uncategorized$/i.test(cat)) return;
          learnedOverrides = updateOverridesForMerchant(learnedOverrides, tx.merchant, cat);
        });

        // 2) Infer category for newly scanned rows from card rules when category is missing
        const inferredTxns = newTxns.map((tx: any) => {
          const currentCategory = (tx.category || '').trim() || 'Uncategorized';
          const cardId = normalizedCardId(tx);
          let nextTx = cardId === 'HSBC_REVOLUTION'
            ? enrichHsbcTransactionInference(tx as Transaction)
            : { ...tx };

          if (!/^uncategorized$/i.test((nextTx.category || '').trim() || 'Uncategorized')) return nextTx;

          const eligibility = CardBenefitManager.isTransactionEligible(
            { ...nextTx, category: (nextTx.category || currentCategory) } as Transaction,
            cardId,
            null
          );
          if (eligibility.eligible && eligibility.matchedCategory) {
            return { ...nextTx, category: eligibility.matchedCategory };
          }
          return nextTx;
        });

        // 3) Apply learned overrides as hit cache
        const newTxnsWithOverrides = applyCategoryOverrides(inferredTxns, learnedOverrides);

        // 4) Persist newly learned merchant-category pairs to improve future hit rate
        newTxnsWithOverrides.forEach((tx: any) => {
          const cat = (tx.category || '').trim();
          if (!cat || /^uncategorized$/i.test(cat)) return;
          learnedOverrides = updateOverridesForMerchant(learnedOverrides, tx.merchant, cat);
        });

        const touchedCards = new Set<string>();
        dedupedBatchTxns.forEach((tx: any) => touchedCards.add(normalizedCardId(tx)));
        if (touchedCards.size === 0) {
          touchedCards.add(isLikelyUobTab ? 'UOB_LADYS' : 'DBS_WWMC');
        }
        const nowIso = new Date().toISOString();
        touchedCards.forEach(cardId => {
          cardLastUpdated[cardId] = nowIso;
        });

        await chrome.storage.local.set({ 
          transactions: dedupeTransactions([...existingTxns, ...newTxnsWithOverrides]),
          categoryOverrides: learnedOverrides,
          cardLastUpdated
        });

        if (response?.source === 'UOB') {
          const rewards = (response.rewards || []) as RewardInfo[];
          const debugText = Array.isArray(response.debugSummaries) && response.debugSummaries.length > 0
            ? response.debugSummaries.slice(-2).join(' | ')
            : Array.isArray(response.errors) && response.errors.length > 0
              ? response.errors.slice(-2).join(' | ')
              : '';
          if (rewards.length > 0) {
            await chrome.storage.local.set({
              uobRewards: rewards,
              uobRewardsUpdatedAt: new Date().toISOString()
            });
          }

          if (newTxnsWithOverrides.length > 0) {
            const sections = Array.isArray(response.sections)
              ? Array.from(new Set(response.sections.filter(Boolean)))
              : [];
            setStatus(
              response.cancelled
                ? t(language, 'scan_stopped')
                : t(language, 'scan_uob_transactions', {
                    sections: sections.join(' + ') || '-',
                    count: newTxnsWithOverrides.length
                  })
            );
          } else if (dedupedBatchTxns.length > 0) {
            const sections = Array.isArray(response.sections)
              ? Array.from(new Set(response.sections.filter(Boolean)))
              : [];
            setStatus(
              response.cancelled
                ? t(language, 'scan_stopped')
                : t(language, 'scan_uob_duplicates', {
                    sections: sections.join(' + ') || '-',
                    count: dedupedBatchTxns.length,
                    newCount: 0
                  })
            );
          } else if (rewards.length > 0) {
            setStatus(response.cancelled ? t(language, 'scan_stopped') : t(language, 'scan_uob_rewards', { count: rewards.length }));
          } else {
            setStatus(response.cancelled ? t(language, 'scan_stopped') : `${t(language, 'scan_uob_none')}${debugText ? ` | Debug: ${debugText}` : ''}`);
          }
        } else {
          setStatus(response.cancelled ? t(language, 'scan_stopped') : t(language, 'scan_found_new', { count: newTxnsWithOverrides.length }));
        }
      }
    } catch (err: any) {
      console.error(err);
      setStatus(`${t(language, 'error_prefix')}: ${err.message || 'Connection failed'}`);
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  }, [language]);

  const stopScan = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: "cancel_scan" });
      setStatus(t(language, 'scan_stopping'));
    }
  }, [language]);

  return { isScanning, progress, status, startScan, stopScan };
};
