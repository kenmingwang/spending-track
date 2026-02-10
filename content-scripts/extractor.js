console.log("Spending Track: Content script loaded");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scan_transactions") {
        console.log("Spending Track: Scanning for transactions...");
        // Use async extraction
        extractTransactionsAsync().then(results => {
            sendResponse({
                success: true,
                count: results.count,
                totalSpent: results.totalSpent,
                transactions: results.transactions,
                cancelled: results.cancelled || false
            });
        }).catch(error => {
            console.error("Spending Track: Extraction failed", error);
            sendResponse({ success: false, message: error.message });
        });
        return true; // Keep message channel open for async response
    }
    return true;
});

// Helper to wait for element to appear
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) {
                clearInterval(checkInterval);
                resolve(element);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                reject(new Error(`Timeout waiting for ${selector}`));
            }
        }, 100);
    });
}

// Helper to wait
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractTransactionsAsync() {
    console.log("Spending Track: Starting enhanced extraction with side panel data...");
    let transactions = [];
    let totalSpent = 0;
    let shouldCancel = false;

    // Listen for cancel signal
    const cancelHandler = (request) => {
        if (request.action === "cancel_scan") {
            shouldCancel = true;
        }
    };
    chrome.runtime.onMessage.addListener(cancelHandler);

    // Stable selector for transaction rows
    const distinctRows = document.querySelectorAll('div[data-testid^="card_row_"]');
    console.log(`Spending Track: Found ${distinctRows.length} card rows.`);

    for (let idx = 0; idx < distinctRows.length; idx++) {
        // Check for cancel
        if (shouldCancel) {
            console.log("Spending Track: Scan cancelled by user");
            chrome.runtime.onMessage.removeListener(cancelHandler);
            return {
                count: transactions.length,
                totalSpent: totalSpent,
                transactions: transactions,
                cancelled: true
            };
        }

        // Send progress update
        chrome.runtime.sendMessage({
            action: "scan_progress",
            current: idx + 1,
            total: distinctRows.length
        });

        const row = distinctRows[idx];
        try {
            // 1. Extract Date from DOM (pre-click)
            let currentDate = "Unknown Date";
            let dateContainer = row.parentElement;
            const dateRegex = /[A-Za-z]{3},\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/;

            for (let i = 0; i < 4; i++) {
                if (!dateContainer) break;
                let sibling = dateContainer.previousElementSibling;

                for (let j = 0; j < 3 && sibling; j++) {
                    const text = sibling.innerText;
                    if (text && dateRegex.test(text)) {
                        const match = text.match(dateRegex);
                        if (match) {
                            currentDate = match[0];
                            break;
                        }
                    }
                    sibling = sibling.previousElementSibling;
                }

                if (currentDate !== "Unknown Date") break;
                dateContainer = dateContainer.parentElement;
            }

            // 2. Extract basic merchant and amount (pre-click)
            const textColumn = row.querySelector('div:nth-child(2)');
            let merchantPreview = "Unknown Merchant";
            if (textColumn) {
                const lines = textColumn.querySelectorAll('p');
                if (lines.length > 0) merchantPreview = lines[0].innerText;
            }

            const amountEl = row.querySelector('[data-testid="CurrencyPairAmount__value"]');
            let amount = 0;
            if (amountEl) {
                const amountText = amountEl.innerText.replace(/,/g, '');
                amount = parseFloat(amountText);
            }

            // Skip bill payments (positive amounts)
            if (amount > 0) {
                console.log(`Spending Track: Skipping bill payment/refund: ${merchantPreview} ($${amount})`);
                continue;
            }

            // 3. Click the row to open side panel
            console.log(`Spending Track: Clicking row ${idx + 1}/${distinctRows.length}: ${merchantPreview}`);
            row.click();

            //Wait for side panel to appear (maximum optimization)
            await sleep(100); // Reduced from 250ms

            // 4. Extract detailed data from side panel
            let merchant = merchantPreview;
            let category = "Uncategorized";
            let transactionType = "PURCHASE";
            let paymentType = null;

            try {
                // Wait for transaction details panel
                const detailsPanel = await waitForElement('p.sc-iiNlPs.sc-jmvEJJ.hUcOVF.fdiZvL.sc-fSfPiM.ddulGh', 2000);

                if (detailsPanel && detailsPanel.innerText === "Transaction details") {
                    // Extract merchant name (better version)
                    const merchantEl = document.querySelector('p.sc-iiNlPs.sc-jmvEJJ.hUcOVF.fdiZvL.sc-FqlkE.bxVaTq');
                    if (merchantEl) merchant = merchantEl.innerText;

                    // Extract category
                    // Look for the section with label "Category"
                    const allLabels = document.querySelectorAll('p.sc-iiNlPs.sc-iQJIiq.iMtaqM.hqYnFw');
                    for (let label of allLabels) {
                        if (label.innerText === "Category") {
                            // Next sibling or nearby element should have the category
                            const categoryEl = label.parentElement.querySelector('p.sc-iiNlPs.sc-eqMpiH.ljbzTM.gNnMLi.sc-falggM.KceJi');
                            if (categoryEl) {
                                // Remove icon text if present
                                category = categoryEl.innerText.trim();
                            }
                        } else if (label.innerText === "Transaction type") {
                            const typeEl = label.parentElement.querySelector('p.sc-iiNlPs.sc-eqMpiH.ljbzTM.gNnMLi.sc-falggM.KceJi');
                            if (typeEl) transactionType = typeEl.innerText;
                        } else if (label.innerText === "Payment type") {
                            const payTypeEl = label.parentElement.querySelector('p.sc-iiNlPs.sc-eqMpiH.ljbzTM.gNnMLi.sc-falggM.KceJi');
                            if (payTypeEl) paymentType = payTypeEl.innerText;
                        }
                    }
                }
            } catch (err) {
                console.warn(`Spending Track: Could not extract side panel data for ${merchantPreview}, using fallback`, err);
            }

            // 5. Close the side panel
            const closeButton = document.querySelector('button[type="button"][aria-label="close"]');
            if (closeButton) {
                closeButton.click();
                await sleep(100); // Reduced from 150ms
            }

            // Skip payment-related transactions
            const merchantUpper = merchant.toUpperCase();
            const categoryUpper = category.toUpperCase();
            if (merchantUpper.includes('BILL PAYMENT') ||
                categoryUpper.includes('CREDIT CARD PAYMENT') ||
                categoryUpper.includes('CARD PAYMENT')) {
                console.log(`Spending Track: Skipping payment transaction: ${merchant}`);
                continue;
            }

            if (amount < 0) {
                totalSpent += Math.abs(amount);
            }

            // Store enhanced transaction
            transactions.push({
                date: currentDate,
                merchant: merchant,
                amount: amount,
                category: category,
                transactionType: transactionType,
                paymentType: paymentType
            });

        } catch (err) {
            console.error(`Spending Track: Error parsing row ${idx}`, err);
            // Try to close any open panel
            const closeButton = document.querySelector('button[type="button"][aria-label="close"]');
            if (closeButton) closeButton.click();
        }
    }

    console.log(`Spending Track: Extracted ${transactions.length} transactions. Total Spent: ${totalSpent.toFixed(2)}`);
    chrome.runtime.onMessage.removeListener(cancelHandler);

    return {
        count: transactions.length,
        totalSpent: totalSpent,
        transactions: transactions,
        cancelled: false
    };
}
