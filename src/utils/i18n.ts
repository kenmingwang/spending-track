export type Language = 'en' | 'zh';

export const LANGUAGE_STORAGE_KEY = 'language';

const DICT = {
  en: {
    lang_en: 'EN',
    lang_zh: '中文',
    app_name: 'Spending Track',
    open_dashboard: 'Open Dashboard',
    remaining: 'Remaining',
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
    summary_totals: 'Summary Totals',
    net: 'net',
    points_label: 'points',
    miles_label: 'miles',
    card_dbs_name: "DBS Woman's World Card",
    card_dbs_desc: '4 mpd on online spend (S$1k monthly cap), 1.2 mpd on overseas offline FCY spend',
    card_uob_name: "UOB Lady's Solitaire Card",
    card_uob_desc: '4 mpd on 2 selected categories, S$1,500 monthly aggregate cap and S$750 per selected category cap',
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
    lang_zh: '中文',
    app_name: '消费追踪',
    open_dashboard: '打开仪表盘',
    remaining: '剩余额度',
    status: '状态',
    start_scanning: '开始扫描',
    stop_scan: '停止扫描',
    latest_uob_rewards: '最新 UOB 奖励',
    reset_all_data: '清空全部数据',
    weekly_update_reminder: '每周更新提醒',
    open_uob: '打开 UOB',
    open_dbs: '打开 DBS',
    login_scan_weekly: '请每周登录两家网银并扫描一次，确保封顶追踪准确。',
    balance_short: '余额',
    your_cards: '你的卡片',
    overall_insights: '总体洞察',
    month: '月',
    year: '年',
    all: '全部',
    exclude_reimbursable: '排除可报销',
    showing_amount: '当前显示',
    gross_amount: '总额',
    login_scan_once_per_week: '请每周登录并扫描一次。',
    net_spend_excl_reimb: '净消费（不含可报销）',
    expected_miles: '预计里程',
    mpd_cap_remaining: '4 mpd 剩余额度',
    uob_category_cap_detail: 'UOB 分类封顶详情',
    transactions: '交易明细',
    add_transaction: '新增交易',
    export_csv: '导出 CSV',
    total_spending: '消费总额',
    net_excl_reimb: '净额 ${value}（不含可报销）',
    gross_used_for_points: '总额 ${value} 用于积分和 4 mpd 计算',
    top_categories: '主要分类',
    view_details: '查看详情',
    dining: '餐饮',
    travel: '旅行',
    category_share: '分类占比',
    top_largest: '前 5 大消费',
    most_frequent_merchants: '最常消费商户',
    expand: '展开（{count}）',
    show_less: '收起',
    total_spend: '总消费',
    transactions_count: '交易笔数',
    avg_ticket: '客单价',
    details_suffix: '明细',
    close: '关闭',
    no_transactions_in_category: '该分类暂无交易。',
    mom: '环比',
    yoy: '同比',
    na: '无',
    txns: '笔',
    date: '日期',
    merchant: '商户',
    category: '分类',
    amount: '金额',
    reimb_short: '报销',
    yes: '是',
    type: '类型',
    benefit: '权益',
    points: '积分',
    miles: '里程',
    search_transactions: '搜索交易...',
    online_inapp: '线上和应用内',
    offline_contactless: '线下和感应',
    summary_totals: '汇总',
    net: '净额',
    points_label: '积分',
    miles_label: '里程',
    card_dbs_name: 'DBS Woman World 卡',
    card_dbs_desc: '线上消费 4 mpd（每月 S$1k），海外线下外币 1.2 mpd',
    card_uob_name: 'UOB Lady Solitaire 卡',
    card_uob_desc: '所选 2 个类别 4 mpd，总上限 S$1,500，每类上限 S$750',
    scan_ready: '就绪',
    scan_initializing: '正在初始化扫描...',
    scan_cannot_chrome_pages: '无法在 chrome 页面扫描',
    scan_reattaching: '正在重新挂载页面脚本...',
    scan_reconnecting: '页面发生变化，正在重连并重试...',
    scan_retry_error: '切换 UOB 页面时正在刷新，请等待 1 到 2 秒后重试。',
    scan_progress: '扫描中：{current}/{total}',
    scan_uob_section: 'UOB：正在扫描 {label}...',
    scan_stopped: '扫描已停止',
    scan_uob_transactions: 'UOB 交易（{sections}）：{count}',
    scan_uob_rewards: '已抓取 UOB 奖励：{count} 条',
    scan_uob_none: '当前所选区间未找到 UOB 交易',
    scan_found_new: '新增交易 {count} 条',
    scan_stopping: '正在停止...',
    error_prefix: '错误',
    notif_title: '消费追踪每周提醒',
    notif_message: '请登录 UOB 和 DBS 并执行一次扫描，保持封顶追踪准确。',
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
  return fallback;
};

export const getCardDisplayDescription = (cardId: string, language: Language, fallback: string) => {
  if (cardId === 'DBS_WWMC') return t(language, 'card_dbs_desc');
  if (cardId === 'UOB_LADYS') return t(language, 'card_uob_desc');
  return fallback;
};
