import { inferHsbcCategoryFromMerchant, inferHsbcPaymentTypeFromMerchant } from '../utils/merchant-category';

// extractor.ts - Restored robust logic from previous working JS version
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const normalizeText = (text: string) =>
    text.replace(/\s+/g, ' ').trim().replace(/:$/, '').toLowerCase();
const getText = (el: Element | null | undefined) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

const findByExactText = (root: ParentNode, selectors: string, text: string) => {
    const target = normalizeText(text);
    const nodes = Array.from(root.querySelectorAll(selectors));
    return nodes.find(n => normalizeText(getText(n)) === target) || null;
};

const findPanelRoot = (): HTMLElement | null => {
    const heading = findByExactText(document.body, 'p, h1, h2, h3, div, span', 'Transaction details');
    if (!heading) return null;
    return (heading.closest('div[role="dialog"], aside, section, main, [data-testid]') ||
        heading.parentElement) as HTMLElement | null;
};

const waitForPanelRoot = async (timeout = 1000): Promise<HTMLElement | null> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const root = findPanelRoot();
        if (root) return root;
        await sleep(50);
    }
    return findPanelRoot();
};

const findValueForLabel = (root: ParentNode, label: string): string | null => {
    const labelNorm = normalizeText(label);
    const candidates = Array.from(root.querySelectorAll('p, span, div, dt, dd, li, label'));

    for (const el of candidates) {
        if (normalizeText(getText(el)) !== labelNorm) continue;

        // 1) Direct next sibling
        let sib = el.nextElementSibling as HTMLElement | null;
        while (sib) {
            const txt = getText(sib);
            if (txt && normalizeText(txt) !== labelNorm) return txt;
            sib = sib.nextElementSibling as HTMLElement | null;
        }

        // 2) Next text element within the same parent
        const parent = el.parentElement;
        if (parent) {
            const nodes = Array.from(parent.querySelectorAll('p, span, div, dt, dd, li, label'));
            const idx = nodes.indexOf(el as Element);
            for (let i = idx + 1; i < nodes.length; i++) {
                const txt = getText(nodes[i]);
                if (txt && normalizeText(txt) !== labelNorm) return txt;
            }
        }

        // 3) Sibling container in row layout
        const row = el.parentElement?.parentElement;
        if (row) {
            const rowChildren = Array.from(row.children) as HTMLElement[];
            for (const child of rowChildren) {
                if (child.contains(el)) continue;
                const txt = getText(child);
                if (txt && normalizeText(txt) !== labelNorm) return txt;
                const nested = Array.from(child.querySelectorAll('p, span, div, dt, dd, li, label'));
                for (const n of nested) {
                    const nestedTxt = getText(n);
                    if (nestedTxt && normalizeText(nestedTxt) !== labelNorm) return nestedTxt;
                }
            }
        }
    }

    return null;
};

const findValueByLabels = (root: ParentNode, labels: string[]): string | null => {
    for (const label of labels) {
        const val = findValueForLabel(root, label);
        if (val) return val;
    }
    return null;
};

const waitForElement = (selector: string, timeout = 2000): Promise<HTMLElement | null> => {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            const element = document.querySelector(selector) as HTMLElement;
            if (element) {
                clearInterval(checkInterval);
                resolve(element);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                resolve(null);
            }
        }, 100);
    });
};

const parseNumericValue = (value: string): number | null => {
    const cleaned = value.replace(/[,\s]/g, '');
    const match = cleaned.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
};

const isUobPage = (): boolean => {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('uob')) return true;
    const bodyText = (document.body?.innerText || '').toLowerCase();
    return bodyText.includes('uni$') || bodyText.includes('rewards points');
};

const isHsbcPage = (): boolean => {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('hsbc')) return true;
    return Boolean(
        document.querySelector('#rtrvTransactionHistoryUrl') ||
        document.querySelector('main-dashboard') ||
        document.querySelector('#account-summary-name')
    );
};

const parseHsbcDate = (value: string): Date | null => {
    const text = value.replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const parsed = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00+08:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getHsbcSelectedAccountName = (): string => {
    return getText(document.querySelector('#account-summary-name')) ||
        getText(document.querySelector('#account-container-1 .account-title')) ||
        getText(document.querySelector('.account-summary-title-detail .account-title'));
};

const getHsbcSelectedSectionText = (): string => {
    return getText(document.querySelector('.cc-tab-group .cc-tab-selected')) ||
        getText(document.querySelector('.cc-tabs-dropdown .select-target')) ||
        'Transactions';
};

const extractHsbcTransactions = async () => {
    const accountName = getHsbcSelectedAccountName();
    if (!/REVOLUTION/i.test(accountName)) {
        return {
            transactions: [],
            scannedRows: 0,
            section: getHsbcSelectedSectionText(),
            error: `Selected HSBC account is "${accountName || 'Unknown'}", not Revolution Visa.`
        };
    }

    const rows = Array.from(document.querySelectorAll('table.desktop-table tr.description-table-row'));
    const transactions: any[] = [];
    const sectionText = getHsbcSelectedSectionText();

    for (let i = 0; i < rows.length; i++) {
        if (stopRequested) break;

        chrome.runtime.sendMessage({
            action: "scan_progress",
            current: i + 1,
            total: rows.length
        });

        const row = rows[i] as HTMLElement;
        const dateText = getText(row.querySelector('date-display div, .table-row-column1'));
        const merchantText = getText(row.querySelector('.table-row-column2 span, .table-row-column2 p, #transaction-description-preview-0'));
        const amountOutText = getText(row.querySelector('.table-row-column4 p, .table-row-column4'));
        const amountInText = getText(row.querySelector('.table-row-column3 p, .table-row-column3'));

        const parsedDate = parseHsbcDate(dateText);
        if (!parsedDate || !merchantText) continue;

        const amountOut = parseNumericValue(amountOutText);
        const amountIn = parseNumericValue(amountInText);

        if (amountIn !== null && amountIn > 0 && (amountOut === null || amountOut <= 0)) {
            continue;
        }
        if (amountOut === null || amountOut <= 0) continue;

        const merchant = merchantText.replace(/\s+/g, ' ').trim();

        transactions.push({
            date: parsedDate.toISOString(),
            merchant: merchant || 'Unknown Merchant',
            amount: -Math.abs(amountOut),
            category: inferHsbcCategoryFromMerchant(merchant),
            cardId: 'HSBC_REVOLUTION',
            source: 'HSBC',
            uobSection: sectionText,
            paymentType: inferHsbcPaymentTypeFromMerchant(merchant),
            transactionType: 'PURCHASE',
            originalIndex: i
        });
    }

    return {
        transactions,
        scannedRows: rows.length,
        section: sectionText
    };
};

const extractUobRewards = () => {
    const extractFromKnownUobRewardBlock = (): Array<{ label: string; value: number; raw: string }> => {
        const results: Array<{ label: string; value: number; raw: string }> = [];
        const rewardTable = Array.from(document.querySelectorAll('div.tables, div.table-list'))
            .find((block) => /AGGREGATED\s+UNI\$\s+FOR\s+ALL\s+CARDS/i.test(getText(block)));
        if (!rewardTable) return results;

        const rows = Array.from(rewardTable.querySelectorAll('div.rows > div[class*="col-"]'));
        for (const row of rows) {
            const labelEl = row.querySelector('label span, label');
            const valueEl = row.querySelector('.text-lg');
            const label = getText(labelEl);
            const rawValue = getText(valueEl);
            if (!label || !rawValue) continue;

            if (/date/i.test(label)) {
                // Date fields are useful context but are not numeric points balances.
                continue;
            }

            const numeric = parseNumericValue(rawValue);
            if (numeric === null) continue;
            results.push({ label, value: numeric, raw: rawValue });
        }

        return results;
    };

    const knownBlockResults = extractFromKnownUobRewardBlock();
    if (knownBlockResults.length > 0) {
        return knownBlockResults;
    }

    const keywordRegex = /(uni\$|rewards? points?|points? balance|available points?|total points?|smart\$)/i;
    const numberRegex = /-?\d[\d,]*(?:\.\d+)?/g;
    const candidates = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, span, div, td, th, li, strong, b'));
    const results: Array<{ label: string; value: number; raw: string }> = [];
    const seen = new Set<string>();

    for (const el of candidates) {
        const rawText = getText(el);
        if (!rawText || rawText.length > 120 || !keywordRegex.test(rawText)) continue;

        const directMatches = rawText.match(numberRegex) || [];
        let pickedValue: number | null = null;

        if (directMatches.length > 0) {
            const parsedValues = directMatches
                .map(parseNumericValue)
                .filter((v): v is number => v !== null);
            if (parsedValues.length > 0) {
                pickedValue = Math.max(...parsedValues);
            }
        }

        if (pickedValue === null) {
            const siblingTexts = [
                getText(el.nextElementSibling),
                getText(el.parentElement?.nextElementSibling)
            ].filter(Boolean);

            for (const text of siblingTexts) {
                const siblingMatches = text.match(numberRegex) || [];
                const siblingValue = siblingMatches
                    .map(parseNumericValue)
                    .find((v): v is number => v !== null);
                if (siblingValue !== undefined) {
                    pickedValue = siblingValue;
                    break;
                }
            }
        }

        if (pickedValue === null) continue;

        const normalizedLabel = rawText.replace(/\s+/g, ' ').trim();
        const dedupeKey = `${normalizedLabel}::${pickedValue}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        results.push({
            label: normalizedLabel,
            value: pickedValue,
            raw: rawText
        });
    }

    results.sort((a, b) => b.value - a.value);
    return results.slice(0, 12);
};

const parseUobDate = (value: string): Date | null => {
    const text = value.replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const m = text.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
    if (!m) return null;
    const parsedFallback = new Date(`${m[1]} ${m[2]} ${m[3]}`);
    return Number.isNaN(parsedFallback.getTime()) ? null : parsedFallback;
};

const getUobSelectedSectionText = (): string => {
    return getText(document.querySelector('#frequency-account-summary option:checked')) ||
        getText(document.querySelector('#frequency-account-summary'));
};

const getUobSelectedSectionValue = (): string => {
    const select = document.querySelector('#frequency-account-summary') as HTMLSelectElement | null;
    return select?.value || '';
};

const getUobTableSignature = (): string => {
    const rows = Array.from(document.querySelectorAll('table.data-table.infinite-scroll tbody tr.text-md')).slice(0, 5);
    return rows.map(r => getText(r)).join('||');
};

const waitForUobTableChange = async (oldSignature: string, timeout = 4000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const nextSig = getUobTableSignature();
        if (nextSig && nextSig !== oldSignature) return;
        await sleep(120);
    }
};

const switchUobSection = async (value: string) => {
    const select = document.querySelector('#frequency-account-summary') as HTMLSelectElement | null;
    if (!select) return;
    if (select.value === value) return;
    const beforeSig = getUobTableSignature();
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForUobTableChange(beforeSig);
};

const extractUobTransactions = async () => {
    const tableBody = document.querySelector('table.data-table.infinite-scroll tbody');
    if (!tableBody) return { transactions: [], scannedRows: 0, section: '' };

    const sectionText = getUobSelectedSectionText();

    const rows = Array.from(tableBody.querySelectorAll('tr.text-md'));
    const transactions: any[] = [];

    for (let i = 0; i < rows.length; i++) {
        if (stopRequested) break;

        chrome.runtime.sendMessage({
            action: "scan_progress",
            current: i + 1,
            total: rows.length
        });

        const row = rows[i] as HTMLElement;
        const cols = row.querySelectorAll('td');
        if (cols.length < 4) continue;

        const postDateText = getText(cols[0]);
        const transDateText = getText(cols[1]);
        const descText = getText(cols[2]);
        const amountText = getText(cols[3]);

        if (!descText || /previous balance/i.test(descText)) continue;

        const parsedDate = parseUobDate(transDateText) || parseUobDate(postDateText);
        if (!parsedDate) continue;

        const amount = parseNumericValue(amountText);
        if (amount === null) continue;
        if (amount <= 0) continue;
        if (/\bCR\b/i.test(amountText)) continue;

        const merchant = descText
            .replace(/Ref No:\s*.+$/i, '')
            .replace(/\s+/g, ' ')
            .trim();

        transactions.push({
            date: parsedDate.toISOString(),
            merchant: merchant || 'Unknown Merchant',
            amount: -Math.abs(amount),
            category: 'Uncategorized',
            cardId: 'UOB_LADYS',
            source: 'UOB',
            uobSection: sectionText,
            paymentType: '',
            transactionType: 'PURCHASE',
            originalIndex: i
        });
    }

    return { transactions, scannedRows: rows.length, section: sectionText };
};

let isScanning = false;
let stopRequested = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
        sendResponse({ status: "ok" });
        return;
    }
    if (request.action === "uob_set_section") {
        if (!isUobPage()) {
            sendResponse({ error: "Not on UOB page" });
            return;
        }
        const value = String(request.value ?? '');
        switchUobSection(value)
            .then(() => {
                sendResponse({
                    ok: true,
                    section: getUobSelectedSectionText()
                });
            })
            .catch((err: any) => {
                sendResponse({ error: err?.message || 'Failed to switch UOB section' });
            });
        return true;
    }
    if (request.action === "uob_get_section") {
        if (!isUobPage()) {
            sendResponse({ error: "Not on UOB page" });
            return;
        }
        sendResponse({
            ok: true,
            section: getUobSelectedSectionText(),
            value: getUobSelectedSectionValue()
        });
        return;
    }
    if (request.action === "extract_transactions") {
        if (isScanning) return;
        runExtraction(sendResponse);
        return true; // Keep channel open for async response
    }
    if (request.action === "cancel_scan") {
        stopRequested = true;
    }
});

async function runExtraction(sendResponse: (response: any) => void) {
    isScanning = true;
    stopRequested = false;

    try {
        console.log("Spending Track: Starting extraction...");

        if (isUobPage()) {
            const { transactions, section } = await extractUobTransactions();
            if (transactions.length > 0 || stopRequested) {
                sendResponse({
                    source: 'UOB',
                    transactions,
                    section,
                    cancelled: stopRequested
                });
                return;
            }

            // Fallback only when no transaction rows are parsable on the current UOB page.
            const rewards = extractUobRewards();
            sendResponse({
                source: 'UOB',
                transactions: [],
                rewards,
                section,
                cancelled: false,
                error: rewards.length === 0
                    ? 'No UOB transactions found on this page. Open Statement Details with transaction rows and try again.'
                    : undefined
            });
            return;
        }

        if (isHsbcPage()) {
            const { transactions, section, error } = await extractHsbcTransactions();
            sendResponse({
                source: 'HSBC',
                transactions,
                section,
                cancelled: stopRequested,
                error: error || (transactions.length === 0 ? 'No HSBC transactions found on this page. Open the Revolution card transaction table and try again.' : undefined)
            });
            return;
        }
        
        // 1. Use the proven row selector from the JS version
        const transactionRows = document.querySelectorAll('div[data-testid^="card_row_"]');
        
        if (transactionRows.length === 0) {
            console.log("Spending Track: card_row_ selector failed. Current URL:", window.location.href);
            sendResponse({ error: "No transactions found. Ensure you are on the Transaction History page." });
            return;
        }

        console.log(`Spending Track: Found ${transactionRows.length} potential transaction rows.`);

        const distinctRows = Array.from(transactionRows);
        const results: any[] = [];
        const total = distinctRows.length;

        for (let i = 0; i < total; i++) {
            if (stopRequested) break;

            const row = distinctRows[i] as HTMLElement;
            
            // Send progress update
            chrome.runtime.sendMessage({ 
                action: "scan_progress", 
                current: i + 1, 
                total: total 
            });

            // --- PROVEN LOGIC FROM JS VERSION ---
            
            // A. Extract Date from DOM by crawling upwards to find date header
            let currentDate = "Unknown Date";
            let dateContainer: HTMLElement | null = row.parentElement;
            const dateRegex = /[A-Za-z]{3},\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/;

            for (let depth = 0; depth < 4; depth++) {
                if (!dateContainer) break;
                let sibling = dateContainer.previousElementSibling as HTMLElement;

                for (let j = 0; j < 3 && sibling; j++) {
                    const text = sibling.innerText;
                    if (text && dateRegex.test(text)) {
                        const match = text.match(dateRegex);
                        if (match) {
                            currentDate = match[0];
                            break;
                        }
                    }
                    sibling = sibling.previousElementSibling as HTMLElement;
                }

                if (currentDate !== "Unknown Date") break;
                dateContainer = dateContainer.parentElement;
            }

            // B. Extract basic merchant and amount preview
            const textColumn = row.querySelector('div:nth-child(2)');
            let merchantPreview = "Unknown Merchant";
            if (textColumn) {
                const lines = textColumn.querySelectorAll('p');
                if (lines.length > 0) merchantPreview = (lines[0] as HTMLElement).innerText;
            }

            const amountEl = row.querySelector('[data-testid="CurrencyPairAmount__value"]') as HTMLElement;
            let amount = 0;
            if (amountEl) {
                const amountText = amountEl.innerText.replace(/,/g, '');
                amount = parseFloat(amountText);
            }

            // Skip bill payments (positive amounts in most bank views)
            if (amount > 0) {
                console.log(`Spending Track: Skipping bill payment/refund: ${merchantPreview} ($${amount})`);
                continue;
            }

            // C. Click to open side panel
            console.log(`Spending Track: Clicking row ${i + 1}/${total}: ${merchantPreview}`);
            row.click();
            await sleep(50);

            // D. Extract from side panel using optimized JS-version selectors
            let merchant = merchantPreview;
            let category = "Uncategorized";
            let paymentType = "";
            let transactionType = "PURCHASE";
            let panelRoot: HTMLElement | null = null;

            try {
                // Wait for side panel and use text-driven extraction (more resilient)
                panelRoot = await waitForPanelRoot(1000);
                const detailsTitle = findByExactText(panelRoot || document.body, 'p, h1, h2, h3, div, span', 'Transaction details');
                if (detailsTitle) {
                    // Try legacy selector first (fast if still valid)
                    const merchantEl = document.querySelector('p.sc-iiNlPs.sc-jmvEJJ.hUcOVF.fdiZvL.sc-FqlkE.bxVaTq') as HTMLElement | null;
                    if (merchantEl) merchant = getText(merchantEl) || merchant;

                    const root = panelRoot || document.body;
                    category = findValueByLabels(root, ['Category']) || category;
                    paymentType = findValueByLabels(root, ['Payment type', 'Payment Type']) || paymentType;
                    transactionType = findValueByLabels(root, ['Transaction type', 'Transaction Type']) || transactionType;

                    // Prefer original merchant name if available and more specific
                    const originalMerchant = findValueByLabels(root, ['Original merchant name', 'Original Merchant Name']);
                    if (originalMerchant && originalMerchant.length > merchant.length) {
                        merchant = originalMerchant;
                    }
                }
            } catch (err) {
                console.warn(`Spending Track: Side panel extraction failed for ${merchantPreview}`, err);
            }

            // E. Close panel at the end for speed; keep it open during scan

            results.push({
                merchant,
                amount,
                date: currentDate,
                category,
                cardId: 'DBS_WWMC',
                source: 'DBS',
                paymentType,
                transactionType,
                originalIndex: i
            });
        }

        // Close panel if still open
        const closeButton = document.querySelector('button[aria-label="close"], button[type="button"][aria-label="close"]') as HTMLElement | null;
        if (closeButton) closeButton.click();

        sendResponse({ transactions: results, cancelled: stopRequested });
    } catch (err: any) {
        console.error("Spending Track: Fatal error during extraction", err);
        sendResponse({ error: err.message });
    } finally {
        isScanning = false;
        stopRequested = false;
    }
}
