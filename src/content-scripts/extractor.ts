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

const UOB_CAPTURE_STORAGE_KEY = '__spendingTrackUobApiResponses';
const UOB_REQUEST_LOG_STORAGE_KEY = '__spendingTrackUobRequestLog';

type UobExtractionResult = {
    transactions: any[];
    scannedRows: number;
    section: string;
};

type CapturedUobResponse = {
    url?: string;
    method?: string;
    status?: number;
    capturedAt?: number;
    body?: string;
};

type UobDebugSnapshot = {
    url: string;
    readyState: string;
    section: { text: string; value: string; options: Array<{ value: string; text: string; selected: boolean }> };
    loading: { count: number; samples: string[] };
    tables: { count: number; dataTableRows: number; anyRows: number; signature: string };
    storage: { capturedRecords: number; sessionKeys: string[]; localKeys: string[] };
    captures: Array<{ url: string; status: number | null; ageSeconds: number | null; chars: number; keys: string[] }>;
    requests: Array<{ url: string; method: string; status: number | null; contentType: string; ageSeconds: number | null; bodyChars: number; bodySample: string }>;
    jsonSources: { count: number; labels: string[] };
    parsed: { capturedTransactions: number; capturedHtmlTransactions: number; visibleTextTransactions: number };
    text: { bodyLength: number; transactionLikeLines: string[] };
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
    if (m) {
        const parsedFallback = new Date(`${m[1]} ${m[2]} ${m[3]}`);
        return Number.isNaN(parsedFallback.getTime()) ? null : parsedFallback;
    }

    const slashDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (slashDate) {
        const year = slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3];
        const parsedSlashDate = new Date(`${year}-${slashDate[2].padStart(2, '0')}-${slashDate[1].padStart(2, '0')}T00:00:00+08:00`);
        return Number.isNaN(parsedSlashDate.getTime()) ? null : parsedSlashDate;
    }

    return null;
};

const normalizeJsonKey = (key: string) => key.replace(/[^a-z0-9]/gi, '').toLowerCase();

const toTextCandidate = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value !== 'object') return null;

    const objectValue = value as Record<string, unknown>;
    const preferred = readLooseField(objectValue, [
        'displayvalue',
        'formattedvalue',
        'description',
        'merchantname',
        'merchant',
        'name',
        'text',
        'value'
    ]);
    return preferred === value ? null : toTextCandidate(preferred);
};

const readLooseField = (obj: Record<string, unknown>, keyHints: string[]): unknown | null => {
    const normalizedHints = keyHints.map(normalizeJsonKey);
    for (const [key, value] of Object.entries(obj)) {
        const normalizedKey = normalizeJsonKey(key);
        if (normalizedHints.some(hint => normalizedKey === hint || normalizedKey.endsWith(hint) || normalizedKey.includes(hint))) {
            return value;
        }
    }
    return null;
};

const parseAmountCandidate = (value: unknown, depth = 0): number | null => {
    if (value === null || value === undefined || depth > 3) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') return parseNumericValue(value);
    if (typeof value !== 'object') return null;

    const objectValue = value as Record<string, unknown>;
    const preferred = readLooseField(objectValue, [
        'amount',
        'transactionamount',
        'txnamount',
        'billingamount',
        'postedamount',
        'localamount',
        'value',
        'displayvalue',
        'formattedvalue'
    ]);
    if (preferred && preferred !== value) {
        const parsed = parseAmountCandidate(preferred, depth + 1);
        if (parsed !== null) return parsed;
    }

    for (const nested of Object.values(objectValue)) {
        if (typeof nested !== 'string' && typeof nested !== 'number') continue;
        const parsed = parseAmountCandidate(nested, depth + 1);
        if (parsed !== null) return parsed;
    }

    return null;
};

const parseMaybeJson = (raw: string): unknown | null => {
    const text = raw.trim().replace(/^\)\]\}',?\s*/, '');
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        // Some app shells keep JSON escaped as a string inside storage.
        try {
            const unescaped = JSON.parse(`"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
            return typeof unescaped === 'string' ? JSON.parse(unescaped) : null;
        } catch {
            return null;
        }
    }
};

const readStorageJsonSources = (storage: Storage, label: string): Array<{ label: string; value: unknown }> => {
    const sources: Array<{ label: string; value: unknown }> = [];
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i) || '';
        const raw = storage.getItem(key) || '';
        if (!raw || raw.length < 20) continue;

        if (key === UOB_CAPTURE_STORAGE_KEY) {
            const records = parseMaybeJson(raw) as CapturedUobResponse[] | null;
            if (Array.isArray(records)) {
                records
                    .filter(record => Date.now() - Number(record.capturedAt || 0) < 45 * 60 * 1000)
                    .forEach((record, index) => {
                        const body = typeof record.body === 'string' ? record.body : '';
                        const parsed = parseMaybeJson(body);
                        if (parsed) sources.push({ label: `${label}:${record.url || 'captured'}#${index}`, value: parsed });
                    });
            }
            continue;
        }

        const haystack = `${key}\n${raw.slice(0, 1200)}`.toLowerCase();
        if (!/uob|transaction|txn|statement|posting|merchant|amount|card|account|reward|uni\$/.test(haystack)) continue;
        const parsed = parseMaybeJson(raw);
        if (parsed) sources.push({ label: `${label}:${key}`, value: parsed });
    }
    return sources;
};

const readCapturedUobRecords = (): CapturedUobResponse[] => {
    try {
        const raw = sessionStorage.getItem(UOB_CAPTURE_STORAGE_KEY) || '';
        const records = parseMaybeJson(raw);
        if (!Array.isArray(records)) return [];
        return records
            .filter((record): record is CapturedUobResponse => Boolean(record && typeof record === 'object'))
            .filter(record => Date.now() - Number(record.capturedAt || 0) < 45 * 60 * 1000);
    } catch {
        return [];
    }
};

const readCapturedUobRequestLog = (): any[] => {
    try {
        const records = parseMaybeJson(sessionStorage.getItem(UOB_REQUEST_LOG_STORAGE_KEY) || '');
        return Array.isArray(records) ? records : [];
    } catch {
        return [];
    }
};

const collectUobJsonSources = (): Array<{ label: string; value: unknown }> => {
    const sources: Array<{ label: string; value: unknown }> = [];

    try {
        sources.push(...readStorageJsonSources(sessionStorage, 'sessionStorage'));
    } catch (err) {
        console.warn('Spending Track: unable to read UOB sessionStorage', err);
    }

    try {
        sources.push(...readStorageJsonSources(localStorage, 'localStorage'));
    } catch (err) {
        console.warn('Spending Track: unable to read UOB localStorage', err);
    }

    const scriptNodes = Array.from(document.querySelectorAll('script:not([src]), script[type="application/json"]'));
    scriptNodes.forEach((script, index) => {
        const raw = script.textContent || '';
        if (!raw || raw.length > 500_000) return;
        const haystack = raw.slice(0, 4000).toLowerCase();
        if (!/transaction|txn|statement|posting|merchant|amount|uob|uni\$/.test(haystack)) return;
        const parsed = parseMaybeJson(raw);
        if (parsed) sources.push({ label: `script#${index}`, value: parsed });
    });

    return sources;
};

const summarizeJsonKeys = (value: unknown, maxKeys = 18): string[] => {
    const keys = new Set<string>();
    const visit = (node: unknown, depth: number) => {
        if (keys.size >= maxKeys || depth > 3 || node === null || node === undefined) return;
        if (Array.isArray(node)) {
            node.slice(0, 5).forEach(item => visit(item, depth + 1));
            return;
        }
        if (typeof node !== 'object') return;
        Object.entries(node as Record<string, unknown>).slice(0, 40).forEach(([key, nested]) => {
            if (keys.size < maxKeys) keys.add(key);
            visit(nested, depth + 1);
        });
    };
    visit(value, 0);
    return Array.from(keys);
};

const sanitizeDebugUrl = (value: string | undefined) => {
    if (!value) return '';
    try {
        const parsed = new URL(value, window.location.href);
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return value.split('?')[0].slice(0, 120);
    }
};

const buildUobTransactionFromObject = (
    obj: Record<string, unknown>,
    section: string,
    originalIndex: number
): any | null => {
    const dateRaw = readLooseField(obj, [
        'transactiondate',
        'transdate',
        'txndate',
        'postingdate',
        'posteddate',
        'postdate',
        'effectivedate',
        'valuedate',
        'date'
    ]);
    const descRaw = readLooseField(obj, [
        'merchantname',
        'originalmerchantname',
        'merchant',
        'transactiondescription',
        'txndescription',
        'description',
        'narrative',
        'details',
        'payee',
        'billername'
    ]);
    const amountRaw = readLooseField(obj, [
        'transactionamount',
        'txnamount',
        'debitamount',
        'billingamount',
        'postedamount',
        'amount',
        'localamount'
    ]);

    const dateText = toTextCandidate(dateRaw);
    const descText = toTextCandidate(descRaw);
    const amount = parseAmountCandidate(amountRaw);

    if (!dateText || !descText || amount === null || amount === 0) return null;

    const parsedDate = parseUobDate(dateText);
    if (!parsedDate) return null;

    const merchant = descText
        .replace(/Ref No:\s*.+$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!merchant || /previous balance|available balance|outstanding balance|minimum payment/i.test(merchant)) return null;

    const indicatorText = [
        readLooseField(obj, ['creditdebitindicator', 'debitcreditindicator', 'drcrindicator', 'indicator', 'type', 'transactiontype']),
        amountRaw
    ]
        .map(toTextCandidate)
        .filter(Boolean)
        .join(' ');
    const creditLike = /\b(CR|CREDIT)\b/i.test(indicatorText) || /refund|reversal|payment received/i.test(merchant);
    const debitLike = /\b(DR|DEBIT|PURCHASE|SALE)\b/i.test(indicatorText);
    if (creditLike && !debitLike) return null;

    const objectSection = toTextCandidate(readLooseField(obj, [
        'statementtype',
        'statementname',
        'statementperiod',
        'accountname',
        'cardname',
        'section'
    ]));

    return {
        date: parsedDate.toISOString(),
        merchant: merchant || 'Unknown Merchant',
        amount: -Math.abs(amount),
        category: 'Uncategorized',
        cardId: 'UOB_LADYS',
        source: 'UOB',
        uobSection: objectSection || section || 'UOB App Data',
        paymentType: '',
        transactionType: 'PURCHASE',
        originalIndex
    };
};

const extractUobTransactionsFromJsonValue = (
    value: unknown,
    sourceLabel: string,
    section: string,
    transactions: any[],
    seen: Set<string>,
    depth = 0
) => {
    if (stopRequested || depth > 12 || value === null || value === undefined) return;

    if (typeof value === 'string') {
        if (value.length > 20 && value.length < 500_000 && /^[\s{\[]/.test(value)) {
            const parsed = parseMaybeJson(value);
            if (parsed) extractUobTransactionsFromJsonValue(parsed, sourceLabel, section, transactions, seen, depth + 1);
        }
        return;
    }

    if (Array.isArray(value)) {
        value.forEach(item => extractUobTransactionsFromJsonValue(item, sourceLabel, section, transactions, seen, depth + 1));
        return;
    }

    if (typeof value !== 'object') return;

    const obj = value as Record<string, unknown>;
    const tx = buildUobTransactionFromObject(obj, section || sourceLabel, transactions.length);
    if (tx) {
        const key = `${tx.date.slice(0, 10)}|${tx.merchant.toLowerCase()}|${Math.abs(tx.amount).toFixed(2)}`;
        if (!seen.has(key)) {
            seen.add(key);
            transactions.push(tx);
        }
    }

    Object.values(obj).forEach(nested => {
        extractUobTransactionsFromJsonValue(nested, sourceLabel, section, transactions, seen, depth + 1);
    });
};

const extractUobTransactionsFromCapturedData = (): UobExtractionResult => {
    const section = getUobSelectedSectionText() || 'UOB App Data';
    const sources = collectUobJsonSources();
    const transactions: any[] = [];
    const seen = new Set<string>();

    sources.forEach(source => {
        extractUobTransactionsFromJsonValue(source.value, source.label, section, transactions, seen);
    });

    return { transactions, scannedRows: sources.length, section };
};

const extractUobTransactionsFromLines = (text: string, section: string): UobExtractionResult => {
    const lines = text
        .split(/\n+/)
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(line => line.length > 0 && line.length < 240);
    const datePattern = String.raw`(?:\d{1,2}\s+[A-Za-z]{3}\s+\d{4}|\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4})|\d{4}-\d{2}-\d{2})`;
    const amountPattern = String.raw`(?:S\$|SGD|\$)?\s*-?\d[\d,]*(?:\.\d{2})?\s*(?:CR|DR)?`;
    const rowRegex = new RegExp(`^(${datePattern})(?:\\s+(${datePattern}))?\\s+(.+?)\\s+(${amountPattern})$`, 'i');
    const transactions: any[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
        if (stopRequested) break;

        const windows = [
            lines[i],
            lines.slice(i, i + 2).join(' '),
            lines.slice(i, i + 3).join(' '),
            lines.slice(i, i + 4).join(' ')
        ];

        for (const candidate of windows) {
            const match = candidate.match(rowRegex);
            if (!match) continue;

            const transDate = match[2] || match[1];
            const merchant = (match[3] || '').replace(/\s+/g, ' ').trim();
            const amountText = match[4] || '';
            if (!merchant || /post date|trans date|description|amount|previous balance/i.test(merchant)) continue;
            if (/\bCR\b/i.test(amountText)) continue;

            const parsedDate = parseUobDate(transDate);
            const amount = parseNumericValue(amountText);
            if (!parsedDate || amount === null || amount <= 0) continue;

            const key = `${parsedDate.toISOString().slice(0, 10)}|${merchant.toLowerCase()}|${Math.abs(amount).toFixed(2)}`;
            if (seen.has(key)) continue;
            seen.add(key);

            transactions.push({
                date: parsedDate.toISOString(),
                merchant,
                amount: -Math.abs(amount),
                category: 'Uncategorized',
                cardId: 'UOB_LADYS',
                source: 'UOB',
                uobSection: section,
                paymentType: '',
                transactionType: 'PURCHASE',
                originalIndex: i
            });
            break;
        }
    }

    return { transactions, scannedRows: lines.length, section };
};

const extractUobTransactionsFromCapturedHtml = (): UobExtractionResult => {
    const section = getUobSelectedSectionText() || 'UOB Captured HTML';
    const records = readCapturedUobRecords();
    const transactions: any[] = [];
    const seen = new Set<string>();
    let scannedRows = 0;

    records.forEach((record) => {
        const body = typeof record.body === 'string' ? record.body : '';
        if (!/<(?:table|tr|td|div|span|body)\b/i.test(body)) return;
        if (!/transaction|txn|statement|post|date|amount|sgd|s\$|merchant/i.test(body)) return;

        const doc = new DOMParser().parseFromString(body, 'text/html');
        const rows = Array.from(doc.querySelectorAll('tr'));
        scannedRows += rows.length;

        rows.forEach((row, index) => {
            const cols = Array.from(row.querySelectorAll('td, th')).map(getText).filter(Boolean);
            if (cols.length < 3) return;

            const joined = cols.join(' ');
            const parsed = extractUobTransactionsFromLines(joined, section).transactions[0];
            if (!parsed) return;

            const key = `${parsed.date.slice(0, 10)}|${parsed.merchant.toLowerCase()}|${Math.abs(parsed.amount).toFixed(2)}`;
            if (seen.has(key)) return;
            seen.add(key);
            transactions.push({ ...parsed, originalIndex: index });
        });

        const textParsed = extractUobTransactionsFromLines(doc.body?.innerText || doc.body?.textContent || '', section);
        textParsed.transactions.forEach((tx) => {
            const key = `${tx.date.slice(0, 10)}|${tx.merchant.toLowerCase()}|${Math.abs(tx.amount).toFixed(2)}`;
            if (seen.has(key)) return;
            seen.add(key);
            transactions.push(tx);
        });
        scannedRows += textParsed.scannedRows;
    });

    return { transactions, scannedRows, section };
};

const extractUobTransactionsFromVisibleText = (): UobExtractionResult => {
    return extractUobTransactionsFromLines(document.body?.innerText || '', getUobSelectedSectionText() || 'UOB Visible Text');
};

const isVisibleElement = (el: Element) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || '1') > 0;
};

const getUobLoadingSamples = () => {
    const selectors = [
        '[aria-busy="true"]',
        '[role="progressbar"]',
        '[class*="load" i]',
        '[class*="spinner" i]',
        '[class*="progress" i]',
        '[class*="busy" i]',
        '[id*="load" i]',
        '[id*="spinner" i]'
    ].join(',');
    const nodes = Array.from(document.querySelectorAll(selectors))
        .filter(isVisibleElement)
        .slice(0, 8);
    return nodes.map((node) => {
        const el = node as HTMLElement;
        const label = [
            el.tagName.toLowerCase(),
            el.id ? `#${el.id}` : '',
            typeof el.className === 'string' && el.className ? `.${el.className.replace(/\s+/g, '.')}` : '',
            getText(el).slice(0, 60)
        ].filter(Boolean).join(' ');
        return label.slice(0, 160);
    });
};

const getStorageKeys = (storage: Storage) => {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key) keys.push(key);
    }
    return keys.slice(0, 24);
};

const getUobDebugSnapshot = (): UobDebugSnapshot => {
    const select = document.querySelector('#frequency-account-summary') as HTMLSelectElement | null;
    const options = select
        ? Array.from(select.options).map(option => ({
            value: option.value,
            text: getText(option),
            selected: option.selected
        }))
        : [];
    const tableRows = Array.from(document.querySelectorAll('table.data-table.infinite-scroll tbody tr.text-md'));
    const anyRows = Array.from(document.querySelectorAll('tr, [role="row"]'));
    const loadingSamples = getUobLoadingSamples();
    const capturedRecords = readCapturedUobRecords();
    const requestLog = readCapturedUobRequestLog();
    const jsonSources = collectUobJsonSources();
    const capturedTransactions = extractUobTransactionsFromCapturedData();
    const capturedHtmlTransactions = extractUobTransactionsFromCapturedHtml();
    const visibleTextTransactions = extractUobTransactionsFromVisibleText();
    const bodyText = document.body?.innerText || '';
    const transactionLikeLines = bodyText
        .split(/\n+/)
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(line => /transaction|statement|amount|date|sgd|s\$|uni\$|posted|pending|merchant|new transactions/i.test(line))
        .slice(0, 16)
        .map(line => line.slice(0, 180));

    return {
        url: sanitizeDebugUrl(window.location.href),
        readyState: document.readyState,
        section: {
            text: getUobSelectedSectionText(),
            value: getUobSelectedSectionValue(),
            options
        },
        loading: {
            count: loadingSamples.length,
            samples: loadingSamples
        },
        tables: {
            count: document.querySelectorAll('table').length,
            dataTableRows: tableRows.length,
            anyRows: anyRows.length,
            signature: getUobTableSignature().slice(0, 300)
        },
        storage: {
            capturedRecords: capturedRecords.length,
            sessionKeys: getStorageKeys(sessionStorage),
            localKeys: getStorageKeys(localStorage)
        },
        captures: capturedRecords.slice(-8).map(record => {
            const parsed = typeof record.body === 'string' ? parseMaybeJson(record.body) : null;
            return {
                url: sanitizeDebugUrl(record.url),
                status: typeof record.status === 'number' ? record.status : null,
                ageSeconds: typeof record.capturedAt === 'number' ? Math.round((Date.now() - record.capturedAt) / 1000) : null,
                chars: typeof record.body === 'string' ? record.body.length : 0,
                keys: summarizeJsonKeys(parsed)
            };
        }),
        requests: requestLog.slice(-12).map(record => ({
            url: sanitizeDebugUrl(record?.url),
            method: String(record?.method || ''),
            status: typeof record?.status === 'number' ? record.status : null,
            contentType: String(record?.contentType || '').slice(0, 80),
            ageSeconds: typeof record?.capturedAt === 'number' ? Math.round((Date.now() - record.capturedAt) / 1000) : null,
            bodyChars: Number(record?.bodyChars || 0),
            bodySample: String(record?.bodySample || '').slice(0, 180)
        })),
        jsonSources: {
            count: jsonSources.length,
            labels: jsonSources.map(source => source.label.slice(0, 160)).slice(0, 12)
        },
        parsed: {
            capturedTransactions: capturedTransactions.transactions.length,
            capturedHtmlTransactions: capturedHtmlTransactions.transactions.length,
            visibleTextTransactions: visibleTextTransactions.transactions.length
        },
        text: {
            bodyLength: bodyText.length,
            transactionLikeLines
        }
    };
};

const formatUobDebugSummary = (debug: UobDebugSnapshot) => [
    `section=${debug.section.value || '-'}:${debug.section.text || '-'}`,
    `loading=${debug.loading.count}`,
    `tables=${debug.tables.count}/${debug.tables.dataTableRows}`,
    `rows=${debug.tables.anyRows}`,
    `captures=${debug.storage.capturedRecords}`,
    `requests=${debug.requests.length}`,
    `jsonSources=${debug.jsonSources.count}`,
    `parsed=${debug.parsed.capturedTransactions}/${debug.parsed.capturedHtmlTransactions}/${debug.parsed.visibleTextTransactions}`,
    `urls=${debug.requests.map(item => item.url.split('/').pop()).filter(Boolean).slice(-5).join('|') || '-'}`,
    `keys=${debug.captures.flatMap(item => item.keys).slice(0, 10).join('|') || '-'}`
].join('; ');

const getUobSelectedSectionText = (): string => {
    return getText(document.querySelector('#frequency-account-summary option:checked')) ||
        getText(document.querySelector('#frequency-account-summary')) ||
        getText(document.querySelector('[aria-current="page"], [aria-selected="true"], .active')) ||
        document.title ||
        'UOB';
};

const getUobSelectedSectionValue = (): string => {
    const select = document.querySelector('#frequency-account-summary') as HTMLSelectElement | null;
    return select?.value || '';
};

const getUobTableSignature = (): string => {
    const rows = Array.from(document.querySelectorAll('table.data-table.infinite-scroll tbody tr.text-md')).slice(0, 5);
    return rows.map(r => getText(r)).join('||');
};

const getUobRuntimeSignature = (): string => {
    const records = readCapturedUobRecords();
    const lastRecord = records[records.length - 1];
    return [
        getUobTableSignature(),
        records.length,
        lastRecord?.capturedAt || '',
        document.querySelectorAll('tr, [role="row"]').length,
        (document.body?.innerText || '').length
    ].join('|');
};

const waitForUobPageSettle = async (oldSignature: string, timeout = 12000) => {
    const start = Date.now();
    let lastSignature = '';
    let stableSince = Date.now();

    while (Date.now() - start < timeout) {
        const nextSignature = getUobRuntimeSignature();
        const loadingSamples = getUobLoadingSamples();

        if (nextSignature !== lastSignature) {
            lastSignature = nextSignature;
            stableSince = Date.now();
        }

        const waitedLongEnough = Date.now() - start > 800;
        const stableEnough = Date.now() - stableSince > 500;
        const changed = nextSignature !== oldSignature;
        const hasRows = document.querySelectorAll('table.data-table.infinite-scroll tbody tr.text-md, tr, [role="row"]').length > 0;
        const hasCapture = readCapturedUobRecords().length > 0;

        if (waitedLongEnough && stableEnough && loadingSamples.length === 0 && (changed || hasRows || hasCapture)) {
            return;
        }

        await sleep(200);
    }
};

const switchUobSection = async (value: string) => {
    const select = document.querySelector('#frequency-account-summary') as HTMLSelectElement | null;
    if (!select) return;
    const beforeSig = getUobRuntimeSignature();
    if (select.value === value) {
        await waitForUobPageSettle(beforeSig, 5000);
        return;
    }
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForUobPageSettle(beforeSig);
};

const extractUobTransactions = async () => {
    if (getUobLoadingSamples().length > 0) {
        await waitForUobPageSettle(getUobRuntimeSignature(), 8000);
    }

    const tableBody = document.querySelector('table.data-table.infinite-scroll tbody');
    if (!tableBody) {
        const captured = extractUobTransactionsFromCapturedData();
        if (captured.transactions.length > 0 || stopRequested) return captured;

        const capturedHtml = extractUobTransactionsFromCapturedHtml();
        if (capturedHtml.transactions.length > 0 || stopRequested) return capturedHtml;

        const visibleText = extractUobTransactionsFromVisibleText();
        if (visibleText.transactions.length > 0 || stopRequested) return visibleText;

        return { transactions: [], scannedRows: 0, section: getUobSelectedSectionText() };
    }

    const sectionText = getUobSelectedSectionText();

    const rows = Array.from(tableBody.querySelectorAll('tr.text-md'));
    const transactions: any[] = [];
    console.info('Spending Track: UOB table detected', {
        section: sectionText,
        rowCount: rows.length,
        tableSample: rows.slice(0, 3).map(row => getText(row).slice(0, 220))
    });

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

    console.info('Spending Track: UOB extraction pass finished', {
        section: sectionText,
        parsedCount: transactions.length,
        sample: transactions.slice(0, 5)
    });

    if (transactions.length > 0 || stopRequested) {
        return { transactions, scannedRows: rows.length, section: sectionText };
    }

    const captured = extractUobTransactionsFromCapturedData();
    if (captured.transactions.length > 0 || stopRequested) return captured;

    const capturedHtml = extractUobTransactionsFromCapturedHtml();
    if (capturedHtml.transactions.length > 0 || stopRequested) return capturedHtml;

    const visibleText = extractUobTransactionsFromVisibleText();
    if (visibleText.transactions.length > 0 || stopRequested) return visibleText;

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
    if (request.action === "uob_debug_snapshot") {
        if (!isUobPage()) {
            sendResponse({ error: "Not on UOB page" });
            return;
        }
        const debug = getUobDebugSnapshot();
        console.info("Spending Track: UOB debug snapshot", debug);
        sendResponse({
            ok: true,
            summary: formatUobDebugSummary(debug),
            debug
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
                console.info('Spending Track: UOB scan returning transactions', {
                    section,
                    count: transactions.length,
                    sample: transactions.slice(0, 5)
                });
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
            const debug = getUobDebugSnapshot();
            const debugSummary = formatUobDebugSummary(debug);
            console.info("Spending Track: UOB scan returned no transactions", debug);
            sendResponse({
                source: 'UOB',
                transactions: [],
                rewards,
                section,
                debug,
                debugSummary,
                cancelled: false,
                error: rewards.length === 0
                    ? `No UOB transactions found. Debug: ${debugSummary}`
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
