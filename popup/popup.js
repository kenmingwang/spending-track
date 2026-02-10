document.addEventListener('DOMContentLoaded', () => {
    const scanBtn = document.getElementById('scanBtn');
    const stopBtn = document.getElementById('stopBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusDiv = document.getElementById('status');
    const spentSpan = document.getElementById('spentAmount');
    const remainingSpan = document.getElementById('remainingAmount');
    const monthSelect = document.getElementById('monthSelect');
    const breakdownList = document.getElementById('breakdownList');
    const progressContainer = document.getElementById('progressContainer');
    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');

    let currentTabId = null;

    // Initialize: Load data from storage
    loadFromStorage();

    // Event listener for month change
    monthSelect.addEventListener('change', () => {
        loadFromStorage(); // Reloads and re-filters based on selection
    });

    // Progress updates listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "scan_progress") {
            const percent = (request.current / request.total) * 100;
            progressText.textContent = `Scanning: ${request.current}/${request.total}`;
            progressFill.style.width = `${percent}%`;
        }
    });

    scanBtn.addEventListener('click', async () => {
        statusDiv.textContent = 'Starting scan...';
        scanBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        progressContainer.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = 'Scanning: 0/0';

        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTabId = tab.id;
        if (!tab) {
            statusDiv.textContent = 'No active tab.';
            resetUIAfterScan();
            return;
        }

        // Helper to send message handling retry
        function sendMessage() {
            chrome.tabs.sendMessage(tab.id, { action: "scan_transactions" }, async (response) => {
                // Check specifically for connection errors
                if (chrome.runtime.lastError) {
                    const err = chrome.runtime.lastError.message;
                    console.warn("Connection error:", err);

                    // If error implies script is missing/dead, inject and retry
                    if (err.includes("Could not establish connection") || err.includes("Receiving end does not exist")) {
                        statusDiv.textContent = 'Injecting script...';
                        try {
                            await chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                files: ['content-scripts/extractor.js']
                            });
                            statusDiv.textContent = 'Script injected. Retrying scan...';
                            // Retry once
                            setTimeout(() => {
                                chrome.tabs.sendMessage(tab.id, { action: "scan_transactions" }, async (retryParams) => {
                                    // Handle retry response inside
                                    handleResponse(retryParams);
                                });
                            }, 100);
                        } catch (injectErr) {
                            statusDiv.textContent = 'Injection failed: ' + injectErr.message;
                        }
                    } else {
                        statusDiv.textContent = 'Error: ' + err;
                    }
                    return;
                }

                handleResponse(response);
            });
        }

        async function handleResponse(response) {
            resetUIAfterScan();

            if (chrome.runtime.lastError) {
                statusDiv.textContent = 'Retry failed: ' + chrome.runtime.lastError.message;
                return;
            }

            if (response && response.success) {
                const newTransactions = response.transactions || [];
                statusDiv.textContent = `Scanned ${newTransactions.length} items. Saving...`;

                await appendTransactions(newTransactions);
            } else {
                statusDiv.textContent = response ? response.message : 'Scan failed or no response.';
            }
        }

        // Start attempt
        sendMessage();
    });

    const dashboardBtn = document.getElementById('dashboardBtn');

    resetBtn.addEventListener('click', async () => {
        await chrome.storage.local.set({ transactions: [] });
        statusDiv.textContent = 'Storage cleared.';
        monthSelect.innerHTML = ''; // Clear dropdown
        updateUI([]);
    });

    dashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'dashboard/dashboard.html' });
    });

    async function appendTransactions(newTxns) {
        const data = await chrome.storage.local.get(['transactions']);
        let allTxns = data.transactions || [];

        let addedCount = 0;
        newTxns.forEach(newTx => {
            // Deduplication: Check Date + Merchant + Amount
            // We use a simple string key or 'some' check
            const isDuplicate = allTxns.some(existing =>
                existing.date === newTx.date &&
                existing.merchant === newTx.merchant &&
                Math.abs(existing.amount - newTx.amount) < 0.01 // float tolerance
            );

            if (!isDuplicate) {
                allTxns.push(newTx);
                addedCount++;
            }
        });

        statusDiv.textContent = `Added ${addedCount} new items. (${newTxns.length - addedCount} duplicates skipped)`;

        await chrome.storage.local.set({ transactions: allTxns });
        return addedCount;
    }

    stopBtn.addEventListener('click', () => {
        if (currentTabId) {
            chrome.tabs.sendMessage(currentTabId, { action: "cancel_scan" });
            statusDiv.textContent = 'Stopping scan...';
        }
    });

    function resetUIAfterScan() {
        scanBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        progressContainer.classList.add('hidden');
    }

    async function loadFromStorage() {
        const data = await chrome.storage.local.get(['transactions']);
        updateUI(data.transactions || []);
    }

    function updateUI(transactions) {
        // 1. Identify available months from data
        const availableMonths = new Set();
        transactions.forEach(t => {
            try {
                const d = new Date(t.date);
                if (!isNaN(d.getTime())) {
                    const monthKey = `${d.getFullYear()}-${d.getMonth()}`; // "2026-0" for Jan
                    availableMonths.add(monthKey);
                }
            } catch (e) { }
        });

        // 2. Populate Month Selector if empty or needs update
        // (Simple approach: rebuild if size changes or missing current selection)
        // For smoother UX, we only append if missing, but rebuilding is safer for sync.

        const currentSelection = monthSelect.value;
        const sortedMonths = Array.from(availableMonths).sort(); // Sorts strings: "2026-0", "2026-1"

        if (sortedMonths.length === 0) {
            monthSelect.innerHTML = '<option value="">Current</option>';
        } else {
            // Check if options match
            if (monthSelect.children.length !== sortedMonths.length) {
                monthSelect.innerHTML = '';
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                sortedMonths.forEach(m => {
                    const [year, month] = m.split('-');
                    const label = `${monthNames[parseInt(month)]} ${year}`;
                    const option = document.createElement('option');
                    option.value = m;
                    option.textContent = label;
                    monthSelect.appendChild(option);
                });

                // Select latest month by default if nothing selected
                if (!currentSelection) {
                    monthSelect.value = sortedMonths[sortedMonths.length - 1];
                } else {
                    monthSelect.value = currentSelection;
                }
            }
        }

        // 3. Determine filtered month
        let targetMonth, targetYear;
        if (monthSelect.value) {
            [targetYear, targetMonth] = monthSelect.value.split('-').map(Number);
        } else {
            const now = new Date();
            targetMonth = now.getMonth();
            targetYear = now.getFullYear();
        }

        // Filter
        const monthTxns = Calculator.filterByMonth(transactions, targetMonth, targetYear);

        // Calculate Totals using Dynamic Groups
        const groups = Calculator.aggregateByCategory(monthTxns);
        const totalSpent = groups.reduce((sum, g) => sum + g.amount, 0);

        const remaining = Calculator.calculateRemaining('DBS_WWMC', totalSpent);

        // Render Totals
        spentSpan.textContent = `$${totalSpent.toFixed(2)}`;
        remainingSpan.textContent = `$${remaining.toFixed(2)}`;

        // Render Dynamic List
        breakdownList.innerHTML = '';
        groups.forEach(g => {
            const row = document.createElement('div');
            row.className = 'category-row';
            if (g.isOnline) row.classList.add('online-cat');

            const nameSpan = document.createElement('span');
            nameSpan.textContent = g.name;
            if (g.isOnline) {
                const badge = document.createElement('span');
                badge.className = 'badge badge-4mpd';
                badge.textContent = '4mpd';
                nameSpan.appendChild(badge);
            }

            const amountSpan = document.createElement('span');
            amountSpan.textContent = `$${g.amount.toFixed(2)}`;

            row.appendChild(nameSpan);
            row.appendChild(amountSpan);
            breakdownList.appendChild(row);
        });

        statusDiv.textContent = `Stored: ${transactions.length} | Shown: ${monthTxns.length}`;
    }
});
