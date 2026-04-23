export type Language = 'en' | 'zh';

export const LANGUAGE_STORAGE_KEY = 'language';

const DICT = {
  en: {
    lang_en: 'EN',
    lang_zh: '\u4e2d\u6587',
    app_name: 'Spending Track',
    open_dashboard: 'Open Dashboard',
    remaining: 'Remaining',
    last_updated: 'Last Updated',
    status: 'Status',
    start_scanning: 'Start Scanning',
    stop_scan: 'Stop Scan',
    latest_uob_rewards: 'Latest UOB Rewards',
    reset_all_data: 'Reset All Data',
    weekly_update_reminder: 'Weekly Update Reminder',
    open_uob: 'Open UOB',
    open_dbs: 'Open DBS',
    login_scan_weekly: 'Login to both banks and run scan once a week to keep caps accurate.',
    balance_short: 'bal',
    your_cards: 'Your Cards',
    overall_insights: 'Overall Insights',
    month: 'Month',
    year: 'Year',
    all: 'All',
    exclude_reimbursable: 'Exclude Reimbursable',
    showing_amount: 'Showing',
    gross_amount: 'gross',
    login_scan_once_per_week: 'Login and scan once per week.',
    net_spend_excl_reimb: 'Net Spend (Excl. Reimb.)',
    expected_miles: 'Expected Miles',
    mpd_cap_remaining: '4 mpd Cap Remaining',
    uob_category_cap_detail: 'UOB Category Cap Detail',
    transactions: 'Transactions',
    add_transaction: 'Add Transaction',
    export_csv: 'Export CSV',
    total_spending: 'Total Spending',
    net_excl_reimb: 'Net ${value} (excl. reimbursable)',
    gross_used_for_points: 'Gross ${value} used for points/4 mpd',
    top_categories: 'Top Categories',
    view_details: 'View Details',
    dining: 'Dining',
    travel: 'Travel',
    category_share: 'Category Share',
    top_largest: 'Top 5 Largest Transactions',
    most_frequent_merchants: 'Most Frequent Merchants',
    expand: 'Expand ({count})',
    show_less: 'Show Less',
    total_spend: 'Total Spend',
    transactions_count: 'Transactions',
    avg_ticket: 'Avg Ticket',
    details_suffix: 'Details',
    close: 'Close',
    no_transactions_in_category: 'No transactions in this category.',
    mom: 'MoM',
    yoy: 'YoY',
    na: 'n/a',
    txns: 'txns',
    date: 'Date',
    merchant: 'Merchant',
    category: 'Category',
    amount: 'Amount',
    reimb_short: 'Reimb.',
    yes: 'Yes',
    type: 'Type',
    benefit: 'Benefit',
    points: 'Points',
    miles: 'Miles',
    search_transactions: 'Search transactions...',
    online_inapp: 'Online/In-app',
    offline_contactless: 'Offline/Contactless',
    partial_4mpd: 'Partial 4 mpd',
    summary_totals: 'Summary Totals',
    net: 'net',
    points_label: 'points',
    miles_label: 'miles',
    card_dbs_name: "DBS Woman's World Card",
    card_dbs_desc: '4 mpd on online spend (S$1k monthly cap), 1.2 mpd on overseas offline FCY spend',
    card_uob_name: "UOB Lady's Solitaire Card",
    card_uob_desc: '4 mpd on 2 selected categories, S$1,500 monthly aggregate cap and S$750 per selected category cap',
    card_hsbc_name: 'HSBC Revolution Credit Card',
    card_hsbc_desc: '4 mpd equivalent on eligible online spend, with online travel/contactless promo till 31 Mar 2026',
    scan_ready: 'Ready',
    scan_initializing: 'Initializing scan...',
    scan_cannot_chrome_pages: 'Cannot scan on chrome:// pages',
    scan_reattaching: 'Re-attaching to page...',
    scan_reconnecting: 'Page changed, reconnecting and retrying...',
    scan_retry_error: 'Page was reloading while switching UOB sections. Please wait 1-2 seconds and scan again.',
    scan_progress: 'Scanning: {current}/{total}',
    scan_uob_section: 'UOB: scanning {label}...',
    scan_stopped: 'Scan stopped',
    scan_uob_transactions: 'UOB transactions ({sections}): {count}',
    scan_uob_duplicates: 'UOB transactions ({sections}): {count} scanned, {newCount} new',
    scan_uob_rewards: 'UOB rewards captured: {count} items',
    scan_uob_none: 'No UOB transactions found in selected section',
    scan_found_new: 'Found {count} new transactions',
    scan_stopping: 'Stopping...',
    error_prefix: 'Error',
    notif_title: 'Spending Track Weekly Reminder',
    notif_message: 'Login to UOB/DBS and run a scan to keep your cap tracking accurate.',
  },
  zh: {
    lang_en: 'EN',
    lang_zh: '\u4e2d\u6587',
    app_name: '\u6d88\u8d39\u8ffd\u8e2a',
    open_dashboard: '\u6253\u5f00\u4eea\u8868\u76d8',
    remaining: '\u5269\u4f59\u989d\u5ea6',
    last_updated: '\u6700\u540e\u66f4\u65b0',
    status: '\u72b6\u6001',
    start_scanning: '\u5f00\u59cb\u626b\u63cf',
    stop_scan: '\u505c\u6b62\u626b\u63cf',
    latest_uob_rewards: '\u6700\u65b0 UOB \u5956\u52b1',
    reset_all_data: '\u6e05\u7a7a\u5168\u90e8\u6570\u636e',
    weekly_update_reminder: '\u6bcf\u5468\u66f4\u65b0\u63d0\u9192',
    open_uob: '\u6253\u5f00 UOB',
    open_dbs: '\u6253\u5f00 DBS',
    login_scan_weekly: '\u8bf7\u6bcf\u5468\u767b\u5f55\u4e24\u5bb6\u7f51\u94f6\u5e76\u626b\u63cf\u4e00\u6b21\uff0c\u786e\u4fdd\u5c01\u9876\u8ffd\u8e2a\u51c6\u786e\u3002',
    balance_short: '\u4f59\u989d',
    your_cards: '\u4f60\u7684\u5361\u7247',
    overall_insights: '\u603b\u4f53\u6d1e\u5bdf',
    month: '\u6708',
    year: '\u5e74',
    all: '\u5168\u90e8',
    exclude_reimbursable: '\u6392\u9664\u53ef\u62a5\u9500',
    showing_amount: '\u5f53\u524d\u663e\u793a',
    gross_amount: '\u603b\u989d',
    login_scan_once_per_week: '\u8bf7\u6bcf\u5468\u767b\u5f55\u5e76\u626b\u63cf\u4e00\u6b21\u3002',
    net_spend_excl_reimb: '\u51c0\u6d88\u8d39\uff08\u4e0d\u542b\u53ef\u62a5\u9500\uff09',
    expected_miles: '\u9884\u8ba1\u91cc\u7a0b',
    mpd_cap_remaining: '4 mpd \u5269\u4f59\u989d\u5ea6',
    uob_category_cap_detail: 'UOB \u5206\u7c7b\u5c01\u9876\u8be6\u60c5',
    transactions: '\u4ea4\u6613\u660e\u7ec6',
    add_transaction: '\u65b0\u589e\u4ea4\u6613',
    export_csv: '\u5bfc\u51fa CSV',
    total_spending: '\u6d88\u8d39\u603b\u989d',
    net_excl_reimb: '\u51c0\u989d ${value}\uff08\u4e0d\u542b\u53ef\u62a5\u9500\uff09',
    gross_used_for_points: '\u603b\u989d ${value} \u7528\u4e8e\u79ef\u5206\u548c 4 mpd \u8ba1\u7b97',
    top_categories: '\u4e3b\u8981\u5206\u7c7b',
    view_details: '\u67e5\u770b\u8be6\u60c5',
    dining: '\u9910\u996e',
    travel: '\u65c5\u884c',
    category_share: '\u5206\u7c7b\u5360\u6bd4',
    top_largest: '\u524d 5 \u5927\u6d88\u8d39',
    most_frequent_merchants: '\u6700\u5e38\u6d88\u8d39\u5546\u6237',
    expand: '\u5c55\u5f00\uff08{count}\uff09',
    show_less: '\u6536\u8d77',
    total_spend: '\u603b\u6d88\u8d39',
    transactions_count: '\u4ea4\u6613\u7b14\u6570',
    avg_ticket: '\u5ba2\u5355\u4ef7',
    details_suffix: '\u660e\u7ec6',
    close: '\u5173\u95ed',
    no_transactions_in_category: '\u8be5\u5206\u7c7b\u6682\u65e0\u4ea4\u6613\u3002',
    mom: '\u73af\u6bd4',
    yoy: '\u540c\u6bd4',
    na: '\u65e0',
    txns: '\u7b14',
    date: '\u65e5\u671f',
    merchant: '\u5546\u6237',
    category: '\u5206\u7c7b',
    amount: '\u91d1\u989d',
    reimb_short: '\u62a5\u9500',
    yes: '\u662f',
    type: '\u7c7b\u578b',
    benefit: '\u6743\u76ca',
    points: '\u79ef\u5206',
    miles: '\u91cc\u7a0b',
    search_transactions: '\u641c\u7d22\u4ea4\u6613...',
    online_inapp: '\u7ebf\u4e0a/\u5e94\u7528\u5185',
    offline_contactless: '\u7ebf\u4e0b/\u611f\u5e94',
    partial_4mpd: '\u90e8\u5206 4 mpd',
    summary_totals: '\u6c47\u603b',
    net: '\u51c0\u989d',
    points_label: '\u79ef\u5206',
    miles_label: '\u91cc\u7a0b',
    card_dbs_name: 'DBS Woman World \u5361',
    card_dbs_desc: '\u7ebf\u4e0a\u6d88\u8d39 4 mpd\uff08\u6bcf\u6708 S$1k\uff09\uff0c\u6d77\u5916\u7ebf\u4e0b\u5916\u5e01 1.2 mpd',
    card_uob_name: 'UOB Lady Solitaire \u5361',
    card_uob_desc: '\u6240\u9009 2 \u4e2a\u7c7b\u522b 4 mpd\uff0c\u603b\u4e0a\u9650 S$1,500\uff0c\u6bcf\u7c7b\u4e0a\u9650 S$750',
    card_hsbc_name: 'HSBC Revolution \u5361',
    card_hsbc_desc: '\u5408\u8d44\u683c\u7ebf\u4e0a\u6d88\u8d39 4 mpd\uff0c\u7ebf\u4e0a\u65c5\u884c/\u611f\u5e94\u4fc3\u9500\u81f3 2026-03-31',
    scan_ready: '\u5c31\u7eea',
    scan_initializing: '\u6b63\u5728\u521d\u59cb\u5316\u626b\u63cf...',
    scan_cannot_chrome_pages: '\u65e0\u6cd5\u5728 chrome:// \u9875\u9762\u626b\u63cf',
    scan_reattaching: '\u6b63\u5728\u91cd\u65b0\u6302\u8f7d\u9875\u9762\u811a\u672c...',
    scan_reconnecting: '\u9875\u9762\u53d1\u751f\u53d8\u5316\uff0c\u6b63\u5728\u91cd\u8fde\u5e76\u91cd\u8bd5...',
    scan_retry_error: '\u5207\u6362 UOB \u9875\u9762\u65f6\u6b63\u5728\u5237\u65b0\uff0c\u8bf7\u7b49\u5f85 1 \u5230 2 \u79d2\u540e\u91cd\u8bd5\u3002',
    scan_progress: '\u626b\u63cf\u4e2d\uff1a{current}/{total}',
    scan_uob_section: 'UOB\uff1a\u6b63\u5728\u626b\u63cf {label}...',
    scan_stopped: '\u626b\u63cf\u5df2\u505c\u6b62',
    scan_uob_transactions: 'UOB \u4ea4\u6613\uff08{sections}\uff09\uff1a{count}',
    scan_uob_duplicates: 'UOB \u4ea4\u6613\uff08{sections}\uff09\uff1a\u5df2\u626b\u63cf {count} \u6761\uff0c\u65b0\u589e {newCount} \u6761',
    scan_uob_rewards: '\u5df2\u6293\u53d6 UOB \u5956\u52b1\uff1a{count} \u6761',
    scan_uob_none: '\u5f53\u524d\u6240\u9009\u533a\u95f4\u672a\u627e\u5230 UOB \u4ea4\u6613',
    scan_found_new: '\u65b0\u589e\u4ea4\u6613 {count} \u6761',
    scan_stopping: '\u6b63\u5728\u505c\u6b62...',
    error_prefix: '\u9519\u8bef',
    notif_title: '\u6d88\u8d39\u8ffd\u8e2a\u6bcf\u5468\u63d0\u9192',
    notif_message: '\u8bf7\u767b\u5f55 UOB \u548c DBS \u5e76\u6267\u884c\u4e00\u6b21\u626b\u63cf\uff0c\u4fdd\u6301\u5c01\u9876\u8ffd\u8e2a\u51c6\u786e\u3002',
  }
} as const;

export type TranslationKey = keyof typeof DICT.en;

const interpolate = (template: string, vars?: Record<string, string | number>) => {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
};

export const t = (language: Language, key: TranslationKey, vars?: Record<string, string | number>) => {
  const table = DICT[language] || DICT.en;
  const value = table[key] || DICT.en[key] || key;
  return interpolate(value, vars);
};

export const normalizeLanguage = (value?: string | null): Language => {
  return value === 'zh' ? 'zh' : 'en';
};

export const getStoredLanguage = async (): Promise<Language> => {
  const data = await chrome.storage.local.get([LANGUAGE_STORAGE_KEY]) as { language?: string };
  return normalizeLanguage(data.language);
};

export const setStoredLanguage = async (language: Language) => {
  await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: language });
};

export const getCardDisplayName = (cardId: string, language: Language, fallback: string) => {
  if (cardId === 'DBS_WWMC') return t(language, 'card_dbs_name');
  if (cardId === 'UOB_LADYS') return t(language, 'card_uob_name');
  if (cardId === 'HSBC_REVOLUTION') return t(language, 'card_hsbc_name');
  return fallback;
};

export const getCardDisplayDescription = (cardId: string, language: Language, fallback: string) => {
  if (cardId === 'DBS_WWMC') return t(language, 'card_dbs_desc');
  if (cardId === 'UOB_LADYS') return t(language, 'card_uob_desc');
  if (cardId === 'HSBC_REVOLUTION') return t(language, 'card_hsbc_desc');
  return fallback;
};
