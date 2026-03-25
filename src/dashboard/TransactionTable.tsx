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
import { Language, t } from '../utils/i18n';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  'Uncategorized',
];

const getDateSortValue = (dateStr: string) => {
  const t = new Date(dateStr).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const CategoryCell: React.FC<{
  value: string;
  onCommit?: (val: string) => void;
  options: string[];
}> = ({ value, onCommit, options }) => {
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
        "w-full max-w-[220px] px-2 py-1 rounded text-xs border border-gray-200 bg-gray-50 text-gray-700",
        onCommit ? "focus:ring-2 focus:ring-blue-500 focus:bg-white" : "opacity-70 cursor-not-allowed"
      )}
      disabled={!onCommit}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
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

  const getPoints = (txn: Transaction) => TransactionCalculator.calculateRewardOutcome(txn, cardId, userElections || null);

  const columns = useMemo(() => [
    columnHelper.accessor('date', {
      header: t(language, 'date'),
      sortingFn: (rowA, rowB, columnId) =>
        getDateSortValue(rowA.getValue(columnId) as string) - getDateSortValue(rowB.getValue(columnId) as string),
      sortDescFirst: true,
      cell: info => new Date(info.getValue()).toLocaleDateString(locale, {
        day: '2-digit', month: 'short', year: 'numeric' 
      }),
    }),
    columnHelper.accessor('merchant', {
      header: t(language, 'merchant'),
      cell: info => <span className="font-medium text-gray-900">{info.getValue()}</span>,
    }),
    columnHelper.accessor('category', {
      header: t(language, 'category'),
      cell: info => (
        <CategoryCell
          value={normalizeCategory(info.getValue() || 'Uncategorized')}
          options={categorySuggestions}
          onCommit={onCategoryChange ? (val) => onCategoryChange(info.row.original, val) : undefined}
        />
      ),
    }),
    columnHelper.accessor('amount', {
      header: t(language, 'amount'),
      cell: info => <span className="font-semibold text-gray-900">${Math.abs(info.getValue()).toFixed(2)}</span>,
    }),
    columnHelper.display({
      id: 'reimbursable',
      header: t(language, 'reimb_short'),
      cell: info => {
        const txn = info.row.original;
        return (
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={Boolean(txn.reimbursable)}
              onChange={(e) => onReimbursableChange?.(txn, e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            {t(language, 'yes')}
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
            return <span className="text-blue-600 text-xs font-medium">{t(language, 'online_inapp')}</span>;
          }

          return (
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-medium",
                isPhysical ? "text-gray-500" : "text-orange-600"
              )}>
                {isPhysical ? 'Physical / no tap' : t(language, 'offline_contactless')}
              </span>
              {onHsbcContactlessOptOutChange && (
                <button
                  type="button"
                  onClick={() => onHsbcContactlessOptOutChange(txn, !Boolean(txn.hsbcContactlessOptOut))}
                  className="px-2 py-0.5 rounded border border-gray-200 text-[10px] text-gray-600 hover:bg-gray-50"
                >
                  {txn.hsbcContactlessOptOut ? 'Assume tap' : 'No'}
                </button>
              )}
            </div>
          );
        }

        if (val.includes('ONLINE') || val.includes('IN-APP')) return <span className="text-blue-600 text-xs font-medium">{t(language, 'online_inapp')}</span>;
        if (val.includes('PHYSICAL') || val.includes('CONTACTLESS')) return <span className="text-orange-600 text-xs font-medium">{t(language, 'offline_contactless')}</span>;
        return <span className="text-gray-400 text-xs italic">{t(language, 'na')}</span>;
      },
    }),
    columnHelper.display({
      id: 'benefit',
      header: t(language, 'benefit'),
      cell: props => {
        const txn = props.row.original;
        const eligibility = CardBenefitManager.isTransactionEligible(txn, cardId, userElections);
        return eligibility.eligible ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {eligibility.mpd} mpd
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
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
          <span className={cn("text-xs font-semibold", points.miles > 0 ? "text-blue-700" : "text-gray-400")}>
            {points.miles.toLocaleString()}
          </span>
        );
      }
    }),
  ], [cardId, userElections, onCategoryChange, onReimbursableChange, onHsbcContactlessOptOutChange, baseMpd, categorySuggestions, pointsHeader, language, locale]);

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

  return (
    <div className="w-full">
      <div className="p-4 bg-white">
        <input
          value={globalFilter ?? ''}
          onChange={e => setGlobalFilter(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
          placeholder={t(language, 'search_transactions')}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="bg-gray-50 border-b border-gray-100">
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id} 
                    className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: ' ^',
                      desc: ' v',
                    }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-6 py-4 text-sm text-gray-700">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50/30 font-semibold border-t-2 border-gray-100">
            <tr>
              <td className="px-6 py-4" colSpan={3}>{t(language, 'summary_totals')}</td>
              <td className="px-6 py-4 text-gray-900">
                ${transactions.reduce((acc, t) => acc + Math.abs(t.amount), 0).toFixed(2)}
              </td>
              <td></td>
              <td className="px-6 py-4 text-gray-900">
                ${transactions.reduce((acc, t) => acc + (t.reimbursable ? 0 : Math.abs(t.amount)), 0).toFixed(2)} {t(language, 'net')}
              </td>
              <td className="px-6 py-4 text-blue-600"></td>
              <td className="px-6 py-4 text-blue-700">
                {transactions.reduce((acc, t) => acc + getPoints(t).points, 0).toLocaleString()} {t(language, 'points_label')}
              </td>
              <td className="px-6 py-4 text-blue-700">
                {transactions.reduce((acc, t) => acc + getPoints(t).miles, 0).toLocaleString()} {t(language, 'miles_label')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
