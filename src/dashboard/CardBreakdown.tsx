import React from 'react';
import { Transaction } from '../types';
import { CardConfig } from '../types';
import { CardBenefitManager } from '../utils/card-benefits';
import { getCardBenefitDetail } from '../utils/card-benefit-details';
import { TransactionCalculator } from '../utils/calculator';
import { cn } from '../utils/cn';
import { normalizeCategory } from '../utils/category-overrides';
import { getCardDisplayDescription, getCardDisplayName, Language, t } from '../utils/i18n';

interface Props {
  card: CardConfig;
  transactions: Transaction[];
  userElections?: string[];
  excludeReimbursable?: boolean;
  language?: Language;
  lastUpdatedAt?: string | null;
  onViewDetails: () => void;
}

export const CardBreakdown: React.FC<Props> = ({ card, transactions, userElections, excludeReimbursable = false, language = 'en', lastUpdatedAt = null, onViewDetails }) => {
  const [showBenefitDetail, setShowBenefitDetail] = React.useState(false);
  const cardTransactions = CardBenefitManager.filterTransactionsForCard(transactions, card.id);
  const cardCap = CardBenefitManager.getCardTotalCap(card.id);
  const benefitDetail = React.useMemo(() => getCardBenefitDetail(card.id, language), [card.id, language]);
  const now = new Date();
  const monthlyTransactions = cardTransactions.filter(t => {
    const d = new Date(t.date);
    return !Number.isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const spendingTransactions = excludeReimbursable
    ? monthlyTransactions.filter(t => !t.reimbursable)
    : monthlyTransactions;
  const totalSpent = monthlyTransactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const netMonthlySpent = monthlyTransactions.reduce((acc, t) => acc + (t.reimbursable ? 0 : Math.abs(t.amount)), 0);
  const displayedSpent = spendingTransactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const effectiveElections = CardBenefitManager.getEffectiveUserElections(card.id, userElections);
  const uobEligible = card.id === 'UOB_LADYS'
    ? TransactionCalculator.calculateUobEligibleSpend(monthlyTransactions, effectiveElections)
    : null;
  const hsbcEligible = card.id === 'HSBC_REVOLUTION'
    ? TransactionCalculator.calculateHsbcEligibleSpend(monthlyTransactions)
    : null;
  const fourMpdSpent = card.id === 'UOB_LADYS'
    ? (uobEligible?.aggregateUsed || 0)
    : card.id === 'HSBC_REVOLUTION'
      ? (hsbcEligible?.aggregateUsed || 0)
      : monthlyTransactions.reduce((acc, t) => {
          const eligibility = CardBenefitManager.isTransactionEligible(t, card.id, effectiveElections);
          if (eligibility.eligible && eligibility.mpd >= 4) {
            return acc + Math.abs(t.amount);
          }
          return acc;
        }, 0);
  const fourMpdUsed = Math.min(cardCap, fourMpdSpent);
  const fourMpdBalance = Math.max(0, cardCap - fourMpdUsed);
  
  const categorySpending: Record<string, number> = {};
  spendingTransactions.forEach(t => {
    const cat = normalizeCategory(t.category || 'Uncategorized');
    categorySpending[cat] = (categorySpending[cat] || 0) + Math.abs(t.amount);
  });

  const topCategories = Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const percentSpent = Math.min(100, (fourMpdUsed / cardCap) * 100);
  const uobTrackedCategories = ['Dining', 'Travel'];
  const uobCategoryRows = card.id === 'UOB_LADYS' && uobEligible
    ? uobTrackedCategories.map(cat => {
        const actualUsed = monthlyTransactions.reduce((acc, transaction) => {
          const eligibility = CardBenefitManager.isTransactionEligible(transaction, 'UOB_LADYS', effectiveElections);
          if (eligibility.eligible && eligibility.matchedCategory === cat) {
            return acc + Math.abs(transaction.amount);
          }
          return acc;
        }, 0);
        const bonusUsed = uobEligible.categorySpent?.[cat] || 0;
        const cap = uobEligible.perCategoryCap || 750;
        const remaining = cap - actualUsed;
        const pct = cap > 0 ? Math.min(100, (actualUsed / cap) * 100) : 0;
        return {
          name: cat,
          actualUsed,
          bonusUsed,
          overCap: Math.max(0, actualUsed - cap),
          remaining,
          cap,
          pct,
          exceeded: actualUsed > cap
        };
      })
    : [];
  const hsbcCategoryRows = card.id === 'HSBC_REVOLUTION' && hsbcEligible
    ? Object.entries(hsbcEligible.categorySpent)
        .filter(([, used]) => used > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name, used], index) => ({
          name,
          used,
          cap: hsbcEligible.aggregateCap,
          pct: hsbcEligible.aggregateCap > 0 ? Math.min(100, (used / hsbcEligible.aggregateCap) * 100) : 0,
          colorClass: ['bg-red-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500'][index] || 'bg-slate-500'
        }))
    : [];
  const detailLabels = React.useMemo(() => ({
    button: language === 'zh' ? 'Benefit details' : 'Benefit details',
    sources: language === 'zh' ? 'Official sources' : 'Official sources',
    close: language === 'zh' ? 'Close' : 'Close',
  }), [language]);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="flex items-center gap-4 mb-4">
        <div className="text-3xl bg-gray-50 p-3 rounded-lg">{card.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 leading-tight">{getCardDisplayName(card.id, language, card.name)}</h3>
          <p className="text-xs text-gray-500 font-medium">{getCardDisplayDescription(card.id, language, card.description)}</p>
          {lastUpdatedAt && (
            <p className="text-[11px] text-gray-400 mt-1">
              {t(language, 'last_updated')}: {new Date(lastUpdatedAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-SG')}
            </p>
          )}
        </div>
        {benefitDetail && (
          <button
            type="button"
            onClick={() => setShowBenefitDetail(true)}
            aria-label={detailLabels.button}
            title={detailLabels.button}
            className="shrink-0 w-8 h-8 rounded-full border border-amber-200 bg-amber-50 text-amber-700 font-bold text-sm hover:bg-amber-100 transition-colors"
          >
            !
          </button>
        )}
      </div>

      <div className="space-y-4 flex-grow">
        <div>
          <div className="flex justify-between text-sm mb-2 font-medium">
            <span className="text-gray-500">{t(language, 'total_spending')}</span>
            <span className="text-gray-900 font-bold">${displayedSpent.toFixed(2)}</span>
          </div>
          {excludeReimbursable ? (
            <div className="text-[11px] text-gray-400 mb-2">{t(language, 'gross_used_for_points', { value: totalSpent.toFixed(2) })}</div>
          ) : (
            <div className="text-[11px] text-gray-400 mb-2">{t(language, 'net_excl_reimb', { value: netMonthlySpent.toFixed(2) })}</div>
          )}
          <div className="flex justify-between text-sm mb-2 font-medium">
            <span className="text-gray-500">{t(language, 'mpd_cap_remaining')}</span>
            <span className="text-gray-900 font-bold">${fourMpdBalance.toFixed(2)} / ${cardCap}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                percentSpent > 90 ? "bg-red-500" : percentSpent > 70 ? "bg-orange-500" : "bg-blue-600"
              )}
              style={{ width: `${percentSpent}%` }}
            />
          </div>
          {uobCategoryRows.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {uobCategoryRows.map(row => (
                <div key={row.name} className="rounded bg-gray-50 px-2.5 py-2">
                  <div className={cn("flex justify-between text-[11px]", row.exceeded ? "text-red-600" : "text-gray-600")}>
                    <span>{row.name === 'Dining' ? t(language, 'dining') : t(language, 'travel')}</span>
                    <span className="font-semibold">
                      {row.remaining < 0 ? '-' : ''}${Math.abs(row.remaining).toFixed(2)} {t(language, 'balance_short')}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        row.exceeded ? 'bg-red-500' : row.name === 'Dining' ? 'bg-emerald-500' : 'bg-violet-500'
                      )}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <div className={cn("mt-1 text-[10px]", row.exceeded ? "text-red-600 font-semibold" : "text-gray-500")}>
                    ${row.actualUsed.toFixed(2)} / ${row.cap}
                    {row.overCap > 0 && ` (+$${row.overCap.toFixed(2)} over)`}
                  </div>
                  {row.actualUsed !== row.bonusUsed && (
                    <div className="mt-0.5 text-[10px] text-gray-400">
                      4 mpd tracked: ${row.bonusUsed.toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {hsbcCategoryRows.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {hsbcCategoryRows.map(row => (
                <div key={row.name} className="rounded bg-gray-50 px-2.5 py-2">
                  <div className="flex justify-between text-[11px] text-gray-600">
                    <span>{row.name === 'Dining' ? t(language, 'dining') : row.name === 'Travel' ? t(language, 'travel') : row.name}</span>
                    <span className="font-semibold">${row.used.toFixed(2)} matched</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", row.colorClass)}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500">Shared cap basis: ${row.used.toFixed(2)} / ${row.cap}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-50">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t(language, 'top_categories')}</div>
          <div className="space-y-2">
            {topCategories.map(([cat, amount]) => (
              <div key={cat} className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">{cat}</span>
                <span className="text-gray-900 font-bold">${amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button 
        onClick={onViewDetails}
        className="w-full mt-6 py-2.5 px-4 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-black transition-colors"
      >
        {t(language, 'view_details')}
      </button>
      </div>

      {showBenefitDetail && benefitDetail && (
        <div
          className="fixed inset-0 z-50 bg-gray-950/45 flex items-center justify-center p-4"
          onClick={() => setShowBenefitDetail(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-auto rounded-2xl bg-white shadow-2xl border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-gray-900">{benefitDetail.title}</div>
                <div className="mt-1 text-sm text-gray-600">{benefitDetail.summary}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowBenefitDetail(false)}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                {detailLabels.close}
              </button>
            </div>

            <div className="p-5 space-y-4">
              {benefitDetail.sections.map((section) => (
                <section key={section.title} className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                  <div className="text-sm font-semibold text-gray-900 mb-2">{section.title}</div>
                  <ul className="space-y-1.5">
                    {section.items.map((item) => (
                      <li key={item} className="text-sm text-gray-700 leading-6">
                        {'\u2022'} {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              <section className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <div className="text-sm font-semibold text-blue-900 mb-2">{detailLabels.sources}</div>
                <div className="space-y-1.5">
                  {benefitDetail.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm text-blue-700 hover:text-blue-900 underline underline-offset-2 break-all"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

