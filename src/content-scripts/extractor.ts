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

let isScanning = false;
let stopRequested = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
        sendResponse({ status: "ok" });
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
