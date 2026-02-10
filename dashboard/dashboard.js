document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const homeView = document.getElementById('homeView');
    const detailView = document.getElementById('detailView');
    const cardsGrid = document.getElementById('cardsGrid');
    const backBtn = document.getElementById('backBtn');
    const cardTitle = document.getElementById('cardTitle');
    const monthSelect = document.getElementById('monthSelect');
    const benefitSummary = document.getElementById('benefitSummary');
    const categoryBudgets = document.getElementById('categoryBudgets');
    const budgetGrid = document.getElementById('budgetGrid');
    const totalSpentEl = document.getElementById('totalSpent');
    const remainingEl = document.getElementById('remaining');
    const expectedMilesEl = document.getElementById('expectedMiles');
    const txnTableBody = document.getElementById('txnTableBody');
    const addTxnBtn = document.getElementById('addTxnBtn');
    const searchInput = document.getElementById('searchInput');
    const exportCsvBtn = document.getElementById('exportCsvBtn');

    // Bulk action elements
    const selectAllCheckbox = document.getElementById('selectAll');
    const bulkActionsBar = document.getElementById('bulkActionsBar');
    const selectedCountSpan = document.getElementById('selectedCount');
    const bulkUpdateCategoryBtn = document.getElementById('bulkUpdateCategoryBtn');
    const bulkUpdateTypeBtn = document.getElementById('bulkUpdateTypeBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');

    // Modal Elements
    const editorModal = document.getElementById('editorModal');
    const electionModal = document.getElementById('electionModal');
    const txnForm = document.getElementById('txnForm');
    const electionForm = document.getElementById('electionForm');
    const modalTitle = document.getElementById('modalTitle');
    const inpDate = document.getElementById('inpDate');
    const inpMerchant = document.getElementById('inpMerchant');
    const inpCategory = document.getElementById('inpCategory');
    const inpAmount = document.getElementById('inpAmount');
    const editIndexInput = document.getElementById('editIndex');

    // State
    let allTransactions = [];
    let currentFilteredTransactions = [];
    let currentCard = null;
    let userElections = {}; // { cardId: [selectedCategories] }
    let sortColumn = null;
    let sortDirection = 'asc';
    let searchTerm = '';
    let selectedIndices = new Set();

    // Initialization
    loadData();

    // Event Listeners
    backBtn.addEventListener('click', () => {
        homeView.classList.remove('hidden');
        detailView.classList.add('hidden');
        currentCard = null;
        selectedIndices.clear(); // Clear selection when leaving detail view
        updateBulkActionsBar();
    });

    monthSelect.addEventListener('change', renderTable);
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderTable();
    });

    addTxnBtn.addEventListener('click', () => openEditorModal());

    // Close modals
    document.querySelectorAll('.close-modal').forEach(el => {
        el.addEventListener('click', (e) => {
            const modal = e.target.dataset.modal;
            if (modal === 'editor') closeEditorModal();
            else if (modal === 'election') closeElectionModal();
        });
    });

    txnForm.addEventListener('submit', handleFormSubmit);
    electionForm.addEventListener('submit', handleElectionSubmit);

    // Table sorting
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.column;
            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortDirection = 'asc';
            }
            renderTable();
        });
    });

    // Bulk action listeners
    selectAllCheckbox.addEventListener('change', handleSelectAllChange);
    deselectAllBtn.addEventListener('click', () => {
        selectedIndices.clear();
        renderTable(); // Re-render to uncheck all
    });
    // bulkUpdateCategoryBtn.addEventListener('click', openBulkCategoryModal);
    // bulkUpdateTypeBtn.addEventListener('click', openBulkTypeModal);

    // Export button
    exportCsvBtn.addEventListener('click', exportToCSV);


    // --- Core Functions ---

    async function loadData() {
        const data = await chrome.storage.local.get(['transactions', 'cardConfigs']);
        allTransactions = data.transactions || [];
        userElections = data.cardConfigs || {};
        renderHomeView();
    }

    function renderHomeView() {
        cardsGrid.innerHTML = '';
        const cards = CardBenefitManager.getAllCards();

        cards.forEach(card => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card-summary';
            cardDiv.dataset.cardId = card.id;

            let benefitText = card.description;
            if (card.requiresElection && userElections[card.id]) {
                const elected = userElections[card.id];
                benefitText = `4 mpd on ${elected.join(' & ')}`;
            }

            // Calculate spending for this card
            const cardTransactions = allTransactions.filter(t => {
                // Simple card matching - could be enhanced
                return true; // For now show all transactions
            });
            const totalSpent = cardTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

            // Calculate category breakdown for this card
            const categoryBreakdown = {};
            cardTransactions.forEach(t => {
                const cat = t.category || 'Uncategorized';
                if (!categoryBreakdown[cat]) {
                    categoryBreakdown[cat] = 0;
                }
                categoryBreakdown[cat] += Math.abs(t.amount);
            });

            // Get top 3 categories
            const topCategories = Object.entries(categoryBreakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            const categoryHTML = topCategories.length > 0 ? `
                <div class="card-category-breakdown">
                    <div class="breakdown-title">Top Categories:</div>
                    ${topCategories.map(([cat, amount]) => `
                        <div class="breakdown-item">
                            <span class="cat-name">${cat}</span>
                            <span class="cat-amount">$${amount.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '';

            cardDiv.innerHTML = `
                <div class="card-icon">${card.icon}</div>
                <h3>${card.name}</h3>
                <p class="card-description">${benefitText}</p>
                <p class="card-cap">Cap: $${card.totalCap.toFixed(2)} | Spent: $${totalSpent.toFixed(2)}</p>
                ${categoryHTML}
                ${card.requiresElection && !userElections[card.id] ?
                    '<button class="config-btn" data-action="configure">⚙️ Configure Categories</button>' :
                    '<button class="view-btn" data-action="view">View Details →</button>'}
            `;

            cardsGrid.appendChild(cardDiv);
        });

        // Event delegation for card actions
        cardsGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const cardDiv = btn.closest('.card-summary');
            const cardId = cardDiv.dataset.cardId;
            const action = btn.dataset.action;

            if (action === 'view') {
                openDetailView(cardId);
            } else if (action === 'configure') {
                openElectionModal(cardId);
            }
        });

        // Render category aggregation
        renderCategoryAggregation();
    }

    function openDetailView(cardId) {
        currentCard = cardId;
        const cardConfig = CardBenefitManager.getCardConfig(cardId);

        homeView.classList.add('hidden');
        detailView.classList.remove('hidden');

        cardTitle.textContent = cardConfig.name;
        benefitSummary.innerHTML = `<p>${cardConfig.description}</p>`;

        updateMonthSelector();
        renderTable();
    }

    function updateMonthSelector() {
        const availableMonths = new Set();
        allTransactions.forEach(t => {
            try {
                const d = new Date(t.date);
                if (!isNaN(d.getTime())) {
                    availableMonths.add(`${d.getFullYear()}-${d.getMonth()}`);
                }
            } catch (e) { }
        });

        const sortedMonths = Array.from(availableMonths).sort();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const currentSelection = monthSelect.value;

        monthSelect.innerHTML = '';
        if (sortedMonths.length === 0) {
            const now = new Date();
            const op = document.createElement('option');
            op.value = `${now.getFullYear()}-${now.getMonth()}`;
            op.textContent = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
            monthSelect.appendChild(op);
        } else {
            sortedMonths.forEach(m => {
                const [year, month] = m.split('-');
                const op = document.createElement('option');
                op.value = m;
                op.textContent = `${monthNames[parseInt(month)]} ${year}`;
                monthSelect.appendChild(op);
            });
        }

        if (currentSelection && availableMonths.has(currentSelection)) {
            monthSelect.value = currentSelection;
        } else if (sortedMonths.length > 0) {
            monthSelect.value = sortedMonths[sortedMonths.length - 1];
        }
    }

    function renderTable() {
        if (!currentCard) return;

        // Get month filter
        let targetMonth, targetYear;
        if (monthSelect.value) {
            [targetYear, targetMonth] = monthSelect.value.split('-').map(Number);
        } else {
            const now = new Date();
            targetMonth = now.getMonth();
            targetYear = now.getFullYear();
        }

        // Filter by month
        currentFilteredTransactions = allTransactions
            .map((t, index) => ({ ...t, originalIndex: index }))
            .filter(t => {
                const d = new Date(t.date);
                if (isNaN(d.getTime())) return false;

                // Month filter
                if (d.getMonth() !== targetMonth || d.getFullYear() !== targetYear) return false;

                // Search filter
                if (searchTerm && !t.merchant.toLowerCase().includes(searchTerm) &&
                    !t.category.toLowerCase().includes(searchTerm)) return false;

                return true;
            });

        // Sort
        if (sortColumn) {
            currentFilteredTransactions.sort((a, b) => {
                let aVal = a[sortColumn];
                let bVal = b[sortColumn];

                if (sortColumn === 'date') {
                    aVal = new Date(aVal).getTime();
                    bVal = new Date(bVal).getTime();
                } else if (sortColumn === 'amount') {
                    aVal = parseFloat(aVal);
                    bVal = parseFloat(bVal);
                }

                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        // Update sort indicators
        document.querySelectorAll('.sort-indicator').forEach(ind => {
            ind.className = 'sort-indicator';
        });
        if (sortColumn) {
            const th = document.querySelector(`[data-column="${sortColumn}"]`);
            if (th) {
                const indicator = th.querySelector('.sort-indicator');
                indicator.classList.add(sortDirection);
            }
        }

        // Render Per-Category Budgets
        const elections = userElections[currentCard] || null;
        const categorySpending = CardBenefitManager.calculatePerCategorySpending(
            currentFilteredTransactions,
            currentCard,
            elections
        );

        budgetGrid.innerHTML = '';
        let totalForCard = 0;
        let totalMiles = 0;

        Object.entries(categorySpending).forEach(([catName, data]) => {
            const card = document.createElement('div');
            card.className = 'budget-card eligible';

            const percentSpent = (data.spent / data.cap) * 100;
            const barClass = percentSpent > 90 ? 'danger' : percentSpent > 70 ? 'warning' : '';

            card.innerHTML = `
                <div class="budget-card-header">
                    <span class="budget-category">${catName}</span>
                    <span class="badge-4mpd">${data.mpd}mpd</span>
                </div>
                <div class="budget-progress">
                    <div class="budget-bar ${barClass}" style="width: ${Math.min(percentSpent, 100)}%"></div>
                </div>
                <div class="budget-amounts">
                    <span class="budget-spent">Spent: $${data.spent.toFixed(2)}</span>
                    <span class="budget-remaining">Left: $${data.remaining.toFixed(2)}</span>
                </div>
            `;
            budgetGrid.appendChild(card);

            totalForCard += data.spent;
            totalMiles += Math.min(data.spent, data.cap) * data.mpd;
        });

        // Render Table Rows
        txnTableBody.innerHTML = '';
        currentFilteredTransactions.forEach((t, displayIndex) => {
            const eligibility = CardBenefitManager.isTransactionEligible(t, currentCard, elections);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="checkbox" class="row-checkbox" data-idx="${t.originalIndex}"></td>
                <td>${formatDate(t.date)}</td>
                <td>${t.merchant}</td>
                <td>${t.category}</td>
                <td>$${Math.abs(t.amount).toFixed(2)}</td>
                <td><span style="font-size:0.85rem;color:#666;">${formatPaymentType(t.paymentType)}</span></td>
                <td>
                    ${eligibility.eligible ?
                    `<span class="badge-4mpd">${eligibility.mpd}mpd</span>` :
                    `<span class="badge-fallback">0.4mpd</span>`}
                </td>
                <td>
                    <button class="edit-btn" data-idx="${t.originalIndex}">Edit</button>
                    <button class="danger-btn" data-idx="${t.originalIndex}">Delete</button>
                </td>
            `;
            txnTableBody.appendChild(row);

            // Make cells editable on double-click
            const editableCells = row.querySelectorAll('td:nth-child(3), td:nth-child(4)'); // Merchant and Category
            editableCells.forEach(cell => {
                cell.addEventListener('dblclick', makeEditable);
            });
        });

        // Update Stats
        const cardConfig = CardBenefitManager.getCardConfig(currentCard);
        totalSpentEl.textContent = `$${totalForCard.toFixed(2)}`;
        remainingEl.textContent = `$${Math.max(0, cardConfig.totalCap - totalForCard).toFixed(2)}`;
        expectedMilesEl.textContent = Math.round(totalMiles).toLocaleString();

        // Attach button listeners
        document.querySelectorAll('.edit-btn').forEach(b => {
            b.addEventListener('click', (e) => openEditorModal(e.target.dataset.idx));
        });
        document.querySelectorAll('.danger-btn').forEach(b => {
            b.addEventListener('click', (e) => deleteTransaction(e.target.dataset.idx));
        });

        // Attach checkbox listeners
        document.querySelectorAll('.row-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', handleRowCheckboxChange);
            // Restore checked state
            const idx = parseInt(checkbox.dataset.idx);
            if (selectedIndices.has(idx)) {
                checkbox.checked = true;
            }
        });

        updateBulkActionsBar();
        updateSummaryRow();
    }

    // --- Election Modal ---

    function openElectionModal(cardId) {
        const cardConfig = CardBenefitManager.getCardConfig(cardId);
        if (!cardConfig || !cardConfig.requiresElection) return;

        currentCard = cardId; // Store for later
        const electionInstructions = document.getElementById('electionInstructions');
        const electionOptions = document.getElementById('electionOptions');

        electionInstructions.textContent = `Choose ${cardConfig.maxElectable} categories to earn ${cardConfig.electableCategories[Object.keys(cardConfig.electableCategories)[0]].mpd} miles per dollar:`;

        electionOptions.innerHTML = '';
        Object.entries(cardConfig.electableCategories).forEach(([catName, catData]) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'election-option';
            optionDiv.innerHTML = `
                <input type="checkbox" name="elected" value="${catName}" id="elect_${catName}">
                <label for="elect_${catName}" class="category-option-label">${catName}</label>
                <span class="category-option-details">$${catData.cap} cap, ${catData.mpd}mpd</span>
            `;
            electionOptions.appendChild(optionDiv);

            // Handle selection styling
            const checkbox = optionDiv.querySelector('input');
            checkbox.addEventListener('change', () => {
                optionDiv.classList.toggle('selected', checkbox.checked);

                // Enforce max selection
                const checked = electionOptions.querySelectorAll('input:checked');
                if (checked.length > cardConfig.maxElectable) {
                    checkbox.checked = false;
                    optionDiv.classList.remove('selected');
                    alert(`You can only select ${cardConfig.maxElectable} categories.`);
                }
            });
        });

        electionModal.classList.remove('hidden');
    }

    function closeElectionModal() {
        electionModal.classList.add('hidden');
    }

    async function handleElectionSubmit(e) {
        e.preventDefault();
        const checked = document.querySelectorAll('#electionOptions input:checked');
        const selected = Array.from(checked).map(cb => cb.value);

        if (!userElections[currentCard]) userElections[currentCard] = [];
        userElections[currentCard] = selected;

        await chrome.storage.local.set({ cardConfigs: userElections });
        closeElectionModal();
        renderHomeView(); // Refresh home to show updated benefits
    }

    // --- Editor Modal ---

    function openEditorModal(index = null) {
        // Populate category dropdown
        populateCategoryDropdown();

        editorModal.classList.remove('hidden');
        if (index !== null) {
            const t = allTransactions[index];
            modalTitle.textContent = "Edit Transaction";
            editIndexInput.value = index;

            const d = new Date(t.date);
            inpDate.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            inpMerchant.value = t.merchant;
            inpCategory.value = t.category;
            inpAmount.value = Math.abs(t.amount);
        } else {
            modalTitle.textContent = "Add Transaction";
            editIndexInput.value = "-1";
            inpDate.valueAsDate = new Date();
            inpMerchant.value = "";
            inpCategory.value = "";
            inpAmount.value = "";
        }
    }

    function closeEditorModal() {
        editorModal.classList.add('hidden');
    }

    function populateCategoryDropdown() {
        inpCategory.innerHTML = '';

        // Start with card-specific categories if available
        if (currentCard) {
            const elections = userElections[currentCard] || null;
            const categories = CardBenefitManager.getCategoriesForCard(currentCard, elections);

            categories.forEach(cat => {
                const op = document.createElement('option');
                op.value = cat.name;
                op.textContent = `${cat.name} ${cat.mpd ? `(${cat.mpd}mpd)` : ''}`;
                inpCategory.appendChild(op);
            });

            // Add separator
            const sep = document.createElement('option');
            sep.disabled = true;
            sep.textContent = '──────────';
            inpCategory.appendChild(sep);
        }

        // Add common categories
        COMMON_CATEGORIES.forEach(cat => {
            const op = document.createElement('option');
            op.value = cat;
            op.textContent = cat;
            inpCategory.appendChild(op);
        });
    }

    async function deleteTransaction(index) {
        if (confirm("Delete this transaction?")) {
            allTransactions.splice(index, 1);
            await saveAndRefresh();
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const idx = parseInt(editIndexInput.value);
        const newTxn = {
            date: new Date(inpDate.value).toDateString(),
            merchant: inpMerchant.value,
            category: inpCategory.value,
            amount: -Math.abs(parseFloat(inpAmount.value)) // Store as negative for expenses
        };

        if (idx === -1) {
            allTransactions.push(newTxn);
        } else {
            allTransactions[idx] = newTxn;
        }

        await saveAndRefresh();
        closeEditorModal();
    }

    async function saveAndRefresh() {
        await chrome.storage.local.set({ transactions: allTransactions });
        updateMonthSelector();
        renderTable();
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatPaymentType(paymentType) {
        if (!paymentType) return 'N/A';
        const pt = paymentType.toUpperCase();
        if (pt.includes('ONLINE') || pt.includes('IN-APP')) {
            return 'Online/In-app';
        } else if (pt.includes('PHYSICAL') || pt.includes('CONTACTLESS')) {
            return 'Offline/Contactless';
        }
        return paymentType;
    }

    function renderCategoryAggregation() {
        const aggContainer = document.getElementById('categoryAggregation');
        if (!aggContainer) return;

        // Aggregate by category
        const categoryTotals = {};
        allTransactions.forEach(t => {
            const cat = t.category || 'Uncategorized';
            if (!categoryTotals[cat]) {
                categoryTotals[cat] = { amount: 0, count: 0 };
            }
            categoryTotals[cat].amount += Math.abs(t.amount);
            categoryTotals[cat].count++;
        });

        // Sort by amount descending
        const sorted = Object.entries(categoryTotals)
            .sort((a, b) => b[1].amount - a[1].amount);

        aggContainer.innerHTML = sorted.map(([cat, data]) => `
            <div class="category-agg-card">
                <div class="category-agg-header">${cat}</div>
                <div class="category-agg-amount">$${data.amount.toFixed(2)}</div>
                <div class="category-agg-count">${data.count} transaction${data.count !== 1 ? 's' : ''}</div>
            </div>
        `).join('');
    }

    // Bulk selection handlers
    selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const idx = parseInt(cb.dataset.idx);
            if (e.target.checked) {
                selectedIndices.add(idx);
            } else {
                selectedIndices.delete(idx);
            }
        });
        updateBulkActionsBar();
    });

    function handleRowCheckboxChange(e) {
        const idx = parseInt(e.target.dataset.idx);
        if (e.target.checked) {
            selectedIndices.add(idx);
        } else {
            selectedIndices.delete(idx);
        }
        updateBulkActionsBar();
    }

    function updateBulkActionsBar() {
        const count = selectedIndices.size;
        selectedCountSpan.textContent = `${count} selected`;

        if (count > 0) {
            bulkActionsBar.classList.remove('hidden');
        } else {
            bulkActionsBar.classList.add('hidden');
        }

        // Update select all checkbox state
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        const allChecked = allCheckboxes.length > 0 && Array.from(allCheckboxes).every(cb => cb.checked);
        selectAllCheckbox.checked = allChecked;
    }

    deselectAllBtn.addEventListener('click', () => {
        selectedIndices.clear();
        document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
        selectAllCheckbox.checked = false;
        updateBulkActionsBar();
    });

    bulkUpdateCategoryBtn.addEventListener('click', () => {
        if (selectedIndices.size === 0) return;

        const newCategory = prompt('Enter new category for selected transactions:');
        if (newCategory) {
            selectedIndices.forEach(idx => {
                allTransactions[idx].category = newCategory;
            });
            saveAndRefresh();
            selectedIndices.clear();
        }
    });

    bulkUpdateTypeBtn.addEventListener('click', () => {
        if (selectedIndices.size === 0) return;

        const options = ['Online/In-app Payment', 'Physical Payment', 'Contactless Payment'];
        const choice = prompt(`Enter new payment type:\n1. ${options[0]}\n2. ${options[1]}\n3. ${options[2]}\n\nEnter 1, 2, or 3:`);

        if (choice && ['1', '2', '3'].includes(choice)) {
            const newType = options[parseInt(choice) - 1];
            selectedIndices.forEach(idx => {
                allTransactions[idx].paymentType = newType;
            });
            saveAndRefresh();
            selectedIndices.clear();
        }
    });

    async function saveAndRefresh() {
        await chrome.storage.local.set({ transactions: allTransactions });
        renderTable();
        updateBulkActionsBar();
    }

    // Inline editing
    function makeEditable(e) {
        const cell = e.target;
        const row = cell.closest('tr');
        const cellIndex = Array.from(row.children).indexOf(cell);
        const rowCheckbox = row.querySelector('.row-checkbox');
        const txnIndex = parseInt(rowCheckbox.dataset.idx);

        const originalValue = cell.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalValue;
        input.style.width = '100%';
        input.style.boxSizing = 'border-box';

        input.addEventListener('blur', () => saveEdit(cell, input, txnIndex, cellIndex));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveEdit(cell, input, txnIndex, cellIndex);
            } else if (e.key === 'Escape') {
                cell.textContent = originalValue;
            }
        });

        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        input.select();
    }

    function saveEdit(cell, input, txnIndex, cellIndex) {
        const newValue = input.value.trim();

        // cellIndex 3 = Merchant (index 2 in innerHTML), cellIndex 4 = Category (index 3)
        if (cellIndex === 3) {
            allTransactions[txnIndex].merchant = newValue;
        } else if (cellIndex === 4) {
            allTransactions[txnIndex].category = newValue;
        }

        chrome.storage.local.set({ transactions: allTransactions });
        renderTable();
    }

    // Update summary row
    function updateSummaryRow() {
        const totalAmount = currentFilteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const totalMiles = currentFilteredTransactions.reduce((sum, t) => {
            const eligibility = CardBenefitManager.isTransactionEligible(t, currentCard, userElections[currentCard]);
            return sum + (Math.abs(t.amount) * (eligibility.eligible ? eligibility.mpd : 0.4));
        }, 0);

        document.getElementById('summaryAmount').textContent = `$${totalAmount.toFixed(2)}`;
        document.getElementById('summaryMiles').textContent = `${Math.round(totalMiles)} miles`;
        document.getElementById('summaryCount').textContent = `${currentFilteredTransactions.length} txns`;
    }

    // Export to CSV
    function exportToCSV() {
        if (currentFilteredTransactions.length === 0) {
            alert('No transactions to export');
            return;
        }

        const headers = ['Date', 'Merchant', 'Category', 'Amount', 'Type', 'Payment Type'];
        const rows = currentFilteredTransactions.map(t => [
            t.date,
            t.merchant,
            t.category,
            Math.abs(t.amount).toFixed(2),
            t.transactionType || '',
            t.paymentType || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${currentCard}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
});
