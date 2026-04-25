import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
} from '@tanstack/react-table';
import { Transaction } from '../types';
import { CardBenefitManager } from '../utils/card-benefits';
import { TransactionCalculator } from '../utils/calculator';
import { normalizeCategory } from '../utils/category-overrides';
import { getCardDisplayName, getCategoryDisplayName, getMerchantDisplayName, Language, t } from '../utils/i18n';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FileText, Search } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  transactions: Transaction[];
  cardId: string;
  userElections?: string[];
  onCategoryChange?: (txn: Transaction, newCategory: string) => void;
  onReimbursableChange?: (txn: Transaction, reimbursable: boolean) => void;
  onHsbcContactlessOptOutChange?: (txn: Transaction, optOut: boolean) => void;
  language?: Language;
}

const columnHelper = createColumnHelper<Transaction>();
const COMMON_CATEGORY_OPTIONS = [
  'Beauty & Wellness',
  'Dining',
  'Family',
  'Fashion',
  'Travel',
  'Transport',
  'Shopping',
  'Groceries',
  'Entertainment',
  'Memberships',
  'Bills',
  'Online Spending',
  'Online / PayWave',
  'Uncategorized',
];

const getDateSortValue = (dateStr: string) => {
  const t = new Date(dateStr).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const formatDateCell = (dateStr: string, locale: string) => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).replace(/,/g, '');
};

const CategoryCell: React.FC<{
  value: string;
  onCommit?: (val: string) => void;
  options: string[];
  language: Language;
}> = ({ value, onCommit, options, language }) => {
  const [draft, setDraft] = React.useState(value || 'Uncategorized');

  React.useEffect(() => {
    setDraft(value || 'Uncategorized');
  }, [value]);

  return (
    <select
      value={draft}
      onChange={e => {
        const next = e.target.value || 'Uncategorized';
        setDraft(next);
        if (onCommit && next !== (value || 'Uncategorized')) {
          onCommit(next);
        }
      }}
      className={cn(
        "form-select form-select-sm table-category-select",
        onCommit ? "" : "opacity-70 cursor-not-allowed"
      )}
      disabled={!onCommit}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{getCategoryDisplayName(opt, language)}</option>
      ))}
    </select>
  );
};

export const TransactionTable: React.FC<Props> = ({ transactions, cardId, userElections, onCategoryChange, onReimbursableChange, onHsbcContactlessOptOutChange, language = 'en' }) => {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'date', desc: true }]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const locale = language === 'zh' ? 'zh-CN' : 'en-SG';

  const cardConfig = CardBenefitManager.getCardConfig(cardId);
  const baseMpd = cardConfig?.fallbackMPD ?? 0.4;
  const pointsHeader = cardId === 'UOB_LADYS'
    ? `UOB ${t(language, 'points')}`
    : cardId === 'DBS_LIVE_FRESH'
      ? t(language, 'cashback_label')
      : cardId === 'DBS_WWMC'
      ? `DBS ${t(language, 'points')}`
      : cardId === 'HSBC_REVOLUTION'
        ? `HSBC ${t(language, 'points')}`
        : t(language, 'points');

  const categorySuggestions = useMemo(() => {
    const set = new Set<string>();
    COMMON_CATEGORY_OPTIONS.forEach(c => set.add(c));
    transactions.forEach(t => {
      if (t.category) set.add(normalizeCategory(t.category));
    });
    Object.keys(cardConfig?.categories || {}).forEach(c => set.add(normalizeCategory(c)));
    set.add('Uncategorized');
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [transactions, cardConfig]);

  const rewardOutcomes = useMemo(
    () => TransactionCalculator.calculateRewardOutcomes(transactions, cardId, userElections || null),
    [transactions, cardId, userElections]
  );

  const getPoints = (txn: Transaction) =>
    rewardOutcomes.get(txn) ?? TransactionCalculator.calculateRewardOutcome(txn, cardId, userElections || null);

  const columns = useMemo(() => [
    columnHelper.accessor('date', {
      header: t(language, 'date'),
      sortingFn: (rowA, rowB, columnId) =>
        getDateSortValue(rowA.getValue(columnId) as string) - getDateSortValue(rowB.getValue(columnId) as string),
      sortDescFirst: true,
      cell: info => <span className="table-date-nowrap">{formatDateCell(info.getValue(), locale)}</span>,
    }),
    columnHelper.accessor('merchant', {
      header: t(language, 'merchant'),
      cell: info => <span className="table-merchant-name fw-semibold text-reset" title={getMerchantDisplayName(info.getValue(), language)}>{getMerchantDisplayName(info.getValue(), language)}</span>,
    }),
    columnHelper.display({
      id: 'source',
      header: language === 'zh' ? '来源' : 'Source',
      cell: info => {
        const txn = info.row.original;
        const normalizedCardId = CardBenefitManager.normalizeTransactionCardId(txn);
        const cardName = getCardDisplayName(normalizedCardId, language, normalizedCardId);

        if (!txn.statementId) {
          return (
            <div className="table-source-cell small text-muted" title={cardName}>
              <span className="table-source-icon table-source-icon-local">L</span>
              <span className="table-source-card">{cardName}</span>
            </div>
          );
        }

        return (
          <div className="table-source-cell small" title={cardName}>
            <span className="badge bg-blue-lt table-source-badge" aria-label={language === 'zh' ? '账单导入' : 'Statement import'}>
              <FileText size={12} />
            </span>
            <span className="table-source-card text-muted">{cardName}</span>
          </div>
        );
      },
    }),
    columnHelper.accessor('category', {
      header: t(language, 'category'),
      cell: info => (
        <CategoryCell
          value={normalizeCategory(info.getValue() || 'Uncategorized')}
          options={categorySuggestions}
          language={language}
          onCommit={onCategoryChange ? (val) => onCategoryChange(info.row.original, val) : undefined}
        />
      ),
    }),
    columnHelper.accessor('amount', {
      header: t(language, 'amount'),
      cell: info => <span className="fw-semibold text-reset">${Math.abs(info.getValue()).toFixed(2)}</span>,
    }),
    columnHelper.display({
      id: 'reimbursable',
      header: t(language, 'reimb_short'),
      cell: info => {
        const txn = info.row.original;
        return (
          <label className="form-check m-0">
            <input
              type="checkbox"
              checked={Boolean(txn.reimbursable)}
              onChange={(e) => onReimbursableChange?.(txn, e.target.checked)}
              className="form-check-input"
            />
            <span className="form-check-label text-muted">{t(language, 'yes')}</span>
          </label>
        );
      }
    }),
    columnHelper.accessor('paymentType', {
      header: t(language, 'type'),
      cell: info => {
        const txn = info.row.original;
        const val = info.getValue()?.toUpperCase() || '';

        if (cardId === 'HSBC_REVOLUTION') {
          const isOnline = val.includes('ONLINE') || val.includes('IN-APP');
          const isPhysical = val.includes('PHYSICAL');
          const isContactless = val.includes('CONTACTLESS');

          if (isOnline) {
            return <span className="badge bg-blue-lt">{t(language, 'online_inapp')}</span>;
          }

          return (
            <div className="flex items-center gap-2">
              <span className={cn(
                "badge",
                isPhysical ? "bg-secondary-lt" : "bg-orange-lt"
              )}>
                {isPhysical ? t(language, 'payment_physical_no_tap') : t(language, 'offline_contactless')}
              </span>
              {onHsbcContactlessOptOutChange && (
                <button
                  type="button"
                  onClick={() => onHsbcContactlessOptOutChange(txn, !Boolean(txn.hsbcContactlessOptOut))}
                  className="btn btn-outline-secondary btn-sm table-action-btn"
                >
                  {txn.hsbcContactlessOptOut ? t(language, 'payment_assume_tap') : t(language, 'payment_no_tap')}
                </button>
              )}
            </div>
          );
        }

        if (val.includes('ONLINE') || val.includes('IN-APP')) return <span className="badge bg-blue-lt">{t(language, 'online_inapp')}</span>;
        if (val.includes('PHYSICAL') || val.includes('CONTACTLESS')) return <span className="badge bg-orange-lt">{t(language, 'offline_contactless')}</span>;
        return <span className="text-muted small">{t(language, 'na')}</span>;
      },
    }),
    columnHelper.display({
      id: 'benefit',
      header: t(language, 'benefit'),
      cell: props => {
        const txn = props.row.original;
        const eligibility = CardBenefitManager.isTransactionEligible(txn, cardId, userElections);
        const outcome = rewardOutcomes.get(txn);
        const trackedFourMpdSpend = outcome?.trackedFourMpdSpend || 0;
        const amount = Math.abs(txn.amount);

        if (cardId === 'DBS_LIVE_FRESH') {
          return (
            <span className={cn("badge", eligibility.eligible ? "bg-green-lt" : "bg-secondary-lt")}>
              {eligibility.eligible ? '5%' : '0.3%'}
            </span>
          );
        }

        if (eligibility.eligible && eligibility.mpd >= 4 && trackedFourMpdSpend > 0 && trackedFourMpdSpend < amount) {
          return (
            <span className="badge bg-yellow-lt">
              {t(language, 'partial_4mpd')}
            </span>
          );
        }

        return eligibility.eligible ? (
          <span className={cn(
            "badge",
            eligibility.mpd >= 4 && trackedFourMpdSpend <= 0
              ? "bg-secondary-lt"
              : "bg-green-lt"
          )}>
            {eligibility.mpd >= 4 && trackedFourMpdSpend <= 0 ? `${baseMpd} mpd` : `${eligibility.mpd} mpd`}
          </span>
        ) : (
          <span className="badge bg-secondary-lt">
            {baseMpd} mpd
          </span>
        );
      }
    }),
    columnHelper.display({
      id: 'dbs_points',
      header: pointsHeader,
      cell: props => {
        const points = getPoints(props.row.original);
        if (cardId === 'DBS_LIVE_FRESH') {
          return (
            <span className={cn("text-xs font-semibold", points.cashback > 0 ? "text-green" : "text-muted")}>
              ${points.cashback.toFixed(2)}
            </span>
          );
        }
        return (
          <span className={cn("text-xs font-semibold", points.points > 0 ? "text-blue-700" : "text-gray-400")}>
            {points.points.toLocaleString()}
          </span>
        );
      }
    }),
    columnHelper.display({
      id: 'miles',
      header: t(language, 'miles'),
      cell: props => {
        const points = getPoints(props.row.original);
        return (
          <span className={cn("text-xs font-semibold", points.miles > 0 ? "text-blue" : "text-muted")}>
            {points.miles.toLocaleString()}
          </span>
        );
      }
    }),
  ], [cardId, userElections, onCategoryChange, onReimbursableChange, onHsbcContactlessOptOutChange, baseMpd, categorySuggestions, pointsHeader, language, locale, rewardOutcomes]);

  const table = useReactTable({
    data: transactions,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const grossTotal = transactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const netTotal = transactions.reduce((acc, t) => acc + (t.reimbursable ? 0 : Math.abs(t.amount)), 0);
  const pointsTotal = transactions.reduce((acc, t) => acc + getPoints(t).points, 0);
  const milesTotal = transactions.reduce((acc, t) => acc + getPoints(t).miles, 0);
  const cashbackTotal = transactions.reduce((acc, t) => acc + getPoints(t).cashback, 0);

  return (
    <div className="card table-card">
      <div className="card-header">
        <div className="card-title">{t(language, 'transactions')}</div>
        <div className="card-actions">
          <div className="input-icon">
            <span className="input-icon-addon">
              <Search size={18} />
            </span>
            <input
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              className="form-control"
              placeholder={t(language, 'search_transactions')}
            />
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-vcenter table-hover card-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={header.column.getCanSort() ? 'cursor-pointer' : ''}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="d-inline-flex align-items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted && (
                          <span className="text-blue">{sorted === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>
                <span className="fw-semibold">{t(language, 'summary_totals')}</span>
                <span className="ms-2 text-muted">{transactions.length.toLocaleString()} {t(language, 'txns')}</span>
              </td>
              <td className="fw-bold text-reset">${grossTotal.toFixed(2)}</td>
              <td></td>
              <td className="fw-bold text-reset">${netTotal.toFixed(2)} <span className="text-muted fw-normal">{t(language, 'net')}</span></td>
              <td></td>
              <td className="fw-bold text-blue">{cardId === 'DBS_LIVE_FRESH' ? `$${cashbackTotal.toFixed(2)}` : pointsTotal.toLocaleString()} <span className="text-muted fw-normal">{cardId === 'DBS_LIVE_FRESH' ? t(language, 'cashback_label') : t(language, 'points_label')}</span></td>
              <td className="fw-bold text-blue">{milesTotal.toLocaleString()} <span className="text-muted fw-normal">{t(language, 'miles_label')}</span></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
