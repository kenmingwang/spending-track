const STORAGE_KEY = '__spendingTrackUobApiResponses';
const REQUEST_LOG_KEY = '__spendingTrackUobRequestLog';
const MAX_RECORDS = 24;
const MAX_REQUEST_LOGS = 80;
const MAX_BODY_CHARS = 250_000;

type CapturedUobResponse = {
    url: string;
    method: string;
    status: number;
    capturedAt: number;
    contentType: string;
    body: string;
};

type HookedWindow = typeof window & {
    __spendingTrackUobHookInstalled?: boolean;
    __spendingTrackUobDebug?: () => unknown;
    __spendingTrackUobFindText?: (pattern: string) => Array<{ tag: string; id: string; className: string; text: string }>;
};

const hookedWindow = window as HookedWindow;

const looksLikeJson = (text: string) => {
    const trimmed = text.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith(")]}'");
};

const shouldCapture = (url: string, contentType: string, body: string) => {
    if (!body || body.length < 20) return false;
    if (!/json|text|html|javascript|octet-stream/i.test(contentType) && !looksLikeJson(body)) return false;

    const sample = `${url}\n${body.slice(0, 4000)}`.toLowerCase();
    const hasBankingKeyword = /uob|transaction|txn|statement|posting|merchant|amount|card|account|reward|uni\$/.test(sample);
    const hasTransactionShape = /transaction|txn|posting|postdate|transdate|merchant|description|amount|statement/.test(sample);
    return hasBankingKeyword && hasTransactionShape;
};

const sanitizeUrl = (url: string) => {
    try {
        const parsed = new URL(url, window.location.href);
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return String(url || '').split('?')[0].slice(0, 180);
    }
};

const persistRequestLog = (record: {
    url: string;
    method: string;
    status: number;
    contentType: string;
    capturedAt: number;
    bodyChars: number;
    bodySample: string;
}) => {
    try {
        const existing = sessionStorage.getItem(REQUEST_LOG_KEY);
        const records = existing ? JSON.parse(existing) as unknown[] : [];
        records.push(record);
        sessionStorage.setItem(REQUEST_LOG_KEY, JSON.stringify(records.slice(-MAX_REQUEST_LOGS)));
    } catch (err) {
        console.warn('Spending Track: failed to persist UOB request log', err);
    }
};

const persistCapture = (record: CapturedUobResponse) => {
    try {
        const existing = sessionStorage.getItem(STORAGE_KEY);
        const records = existing ? JSON.parse(existing) as CapturedUobResponse[] : [];
        records.push(record);
        const trimmed = records
            .filter(item => Date.now() - Number(item.capturedAt || 0) < 45 * 60 * 1000)
            .slice(-MAX_RECORDS);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (err) {
        console.warn('Spending Track: failed to persist UOB API capture', err);
    }
};

const captureBody = (url: string, method: string, status: number, contentType: string, body: string) => {
    persistRequestLog({
        url: sanitizeUrl(url),
        method,
        status,
        contentType,
        capturedAt: Date.now(),
        bodyChars: body.length,
        bodySample: body.replace(/\s+/g, ' ').slice(0, 260)
    });

    if (!shouldCapture(url, contentType, body)) return;
    persistCapture({
        url,
        method,
        status,
        capturedAt: Date.now(),
        contentType,
        body: body.slice(0, MAX_BODY_CHARS)
    });
};

const getText = (el: Element | null | undefined) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

const summarizeElement = (el: Element) => ({
    tag: el.tagName.toLowerCase(),
    id: (el as HTMLElement).id || '',
    className: typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : '',
    text: getText(el).slice(0, 220)
});

const readJsonArray = (key: string) => {
    try {
        const parsed = JSON.parse(sessionStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const buildConsoleDebug = () => {
    const selects = Array.from(document.querySelectorAll('select')).map(select => ({
        ...summarizeElement(select),
        name: (select as HTMLSelectElement).name,
        value: (select as HTMLSelectElement).value,
        options: Array.from((select as HTMLSelectElement).options).map(option => ({
            value: option.value,
            text: getText(option),
            selected: option.selected
        })).slice(0, 20)
    }));
    const tables = Array.from(document.querySelectorAll('table')).map(table => ({
        ...summarizeElement(table),
        rows: table.querySelectorAll('tr').length,
        headers: Array.from(table.querySelectorAll('th')).map(getText).slice(0, 20),
        firstRows: Array.from(table.querySelectorAll('tr')).slice(0, 5).map(row => getText(row).slice(0, 300))
    }));
    const rowLike = Array.from(document.querySelectorAll('tr, [role="row"], .row, [class*="row" i], [class*="transaction" i], [class*="statement" i]'))
        .map(summarizeElement)
        .filter(item => item.text.length > 0)
        .slice(0, 40);
    const forms = Array.from(document.querySelectorAll('form')).map(form => ({
        ...summarizeElement(form),
        action: (form as HTMLFormElement).action,
        method: (form as HTMLFormElement).method,
        fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
            tag: field.tagName.toLowerCase(),
            name: (field as HTMLInputElement).name,
            id: (field as HTMLElement).id,
            type: (field as HTMLInputElement).type,
            value: ((field as HTMLInputElement).type || '').toLowerCase() === 'password' ? '' : String((field as HTMLInputElement).value || '').slice(0, 80)
        })).slice(0, 60)
    }));

    return {
        href: window.location.href,
        frame: window.top === window ? 'top' : 'iframe',
        readyState: document.readyState,
        title: document.title,
        bodyChars: document.body?.innerText?.length || 0,
        captures: readJsonArray(STORAGE_KEY).map((item: any) => ({
            url: sanitizeUrl(item.url || ''),
            method: item.method,
            status: item.status,
            contentType: item.contentType,
            ageSeconds: item.capturedAt ? Math.round((Date.now() - item.capturedAt) / 1000) : null,
            bodyChars: typeof item.body === 'string' ? item.body.length : 0,
            bodySample: typeof item.body === 'string' ? item.body.replace(/\s+/g, ' ').slice(0, 260) : ''
        })),
        requests: readJsonArray(REQUEST_LOG_KEY),
        selects,
        forms,
        tables,
        rowLike,
        textHints: (document.body?.innerText || '')
            .split(/\n+/)
            .map(line => line.replace(/\s+/g, ' ').trim())
            .filter(line => /transaction|statement|amount|date|sgd|s\$|uni\$|posted|merchant|new transactions/i.test(line))
            .slice(0, 40)
    };
};

hookedWindow.__spendingTrackUobDebug = buildConsoleDebug;
hookedWindow.__spendingTrackUobFindText = (pattern: string) => {
    const regex = new RegExp(pattern, 'i');
    return Array.from(document.querySelectorAll('body *'))
        .filter(el => regex.test(getText(el)))
        .slice(0, 80)
        .map(summarizeElement);
};

if (!hookedWindow.__spendingTrackUobHookInstalled) {
    hookedWindow.__spendingTrackUobHookInstalled = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
        const response = await originalFetch(...args);
        try {
            const input = args[0];
            const init = args[1];
            const url = typeof input === 'string'
                ? input
                : input instanceof URL
                    ? input.href
                    : input.url;
            const method = init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET') || 'GET';
            const contentType = response.headers.get('content-type') || '';
            void response.clone().text().then((body) => {
                captureBody(url, method, response.status, contentType, body);
            }).catch(() => undefined);
        } catch {
            // Never let the observer affect the banking app.
        }
        return response;
    };

    const originalOpen: any = XMLHttpRequest.prototype.open;
    const originalSend: any = XMLHttpRequest.prototype.send;

    (XMLHttpRequest.prototype.open as any) = function open(this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
        (this as XMLHttpRequest & { __spendingTrackUobRequest?: unknown }).__spendingTrackUobRequest = {
            method: method || 'GET',
            url: String(url || '')
        };
        return originalOpen.call(this, method, url, ...rest);
    };

    (XMLHttpRequest.prototype.send as any) = function send(this: XMLHttpRequest, ...args: unknown[]) {
        this.addEventListener('loadend', function onLoadEnd(this: XMLHttpRequest) {
            try {
                const meta = (this as any).__spendingTrackUobRequest || {};
                const contentType = this.getResponseHeader('content-type') || '';
                if (typeof this.responseText !== 'string') return;
                captureBody(String(meta.url || this.responseURL || ''), String(meta.method || 'GET'), this.status, contentType, this.responseText);
            } catch {
                // Observer only.
            }
        });
        return originalSend.apply(this, args);
    };
}

export {};
