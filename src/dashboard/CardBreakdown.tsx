import React from 'react';
import { Transaction } from '../types';
import { CardConfig } from '../types';
import { CardBenefitManager } from '../utils/card-benefits';
import { getCardBenefitDetail } from '../utils/card-benefit-details';
import { TransactionCalculator } from '../utils/calculator';
import { cn } from '../utils/cn';
import { normalizeCategory } from '../utils/category-overrides';
import { getCardDisplayDescription, getCardDisplayName, getCategoryDisplayName, Language, t } from '../utils/i18n';

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
  const rewardOutcomes = React.useMemo(
    () => TransactionCalculator.calculateRewardOutcomes(monthlyTransactions, card.id, effectiveElections),
    [monthlyTransactions, card.id, effectiveElections]
  );
  const uobEligible = card.id === 'UOB_LADYS'
    ? TransactionCalculator.calculateUobEligibleSpend(monthlyTransactions, effectiveElections)
    : null;
  const hsbcEligible = card.id === 'HSBC_REVOLUTION'
    ? TransactionCalculator.calculateHsbcEligibleSpend(monthlyTransactions)
    : null;
  const liveFreshCashback = card.id === 'DBS_LIVE_FRESH'
    ? TransactionCalculator.calculateLiveFreshCashback(monthlyTransactions)
    : null;
  const fourMpdSpent = liveFreshCashback
    ? liveFreshCashback.aggregateUsed
    : monthlyTransactions.reduce(
    (acc, transaction) => acc + (rewardOutcomes.get(transaction)?.trackedFourMpdSpend || 0),
    0
  );
  const fourMpdUsed = Math.min(cardCap, fourMpdSpent);
  const fourMpdBalance = Math.max(0, cardCap - fourMpdUsed);
  const dbsTrackedSpend = card.id === 'DBS_WWMC' ? fourMpdUsed : liveFreshCashback ? liveFreshCashback.eligibleSpend : totalSpent;
  
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
        const remaining = cap - bonusUsed;
        const pct = cap > 0 ? Math.min(100, (bonusUsed / cap) * 100) : 0;
        return {
          name: cat,
          actualUsed,
          bonusUsed,
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
          colorClass: ['bg-red', 'bg-info', 'bg-green', 'bg-yellow'][index] || 'bg-secondary'
        }))
    : [];
  const detailLabels = React.useMemo(() => ({
    button: t(language, 'benefit_details'),
    sources: t(language, 'official_sources'),
    close: t(language, 'close'),
  }), [language]);

  return (
    <>
      <div className="card card-benefit h-100">
      <div className="card-body d-flex flex-column">
      <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div
          className="card-benefit-image overflow-hidden border bg-light"
        >
          {card.coverImage ? (
            <img
              src={card.coverImage}
              alt={card.name}
              className={cn(
                "w-100 h-100",
                card.coverFit === 'contain' ? 'object-contain' : 'object-cover'
              )}
              style={{
                transform: `scale(${card.coverScale || 1})`,
                objectPosition: card.coverPosition || 'center',
                background: card.coverBackground || '#f8fafc'
              }}
            />
          ) : (
            <div className="d-flex h-100 w-100 align-items-center justify-content-center bg-light fs-1">{card.icon}</div>
          )}
        </div>
        {benefitDetail && (
          <button
            type="button"
            onClick={() => setShowBenefitDetail(true)}
            aria-label={detailLabels.button}
            title={detailLabels.button}
            className="btn btn-icon btn-outline-secondary flex-shrink-0"
          >
            !
          </button>
        )}
      </div>

      <div className="mb-4">
        <h3 className="h3 mb-2 lh-sm">{getCardDisplayName(card.id, language, card.name)}</h3>
        <p className="text-secondary mb-0 lh-base">{getCardDisplayDescription(card.id, language, card.description)}</p>
        {lastUpdatedAt && (
          <p className="mt-2 mb-0 text-secondary small">
            {t(language, 'last_updated')}: {new Date(lastUpdatedAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-SG')}
          </p>
        )}
      </div>

      <div className="space-y-4 flex-grow-1">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium text-secondary">{t(language, 'total_spending')}</span>
            <span className="h2 mb-0">${displayedSpent.toFixed(2)}</span>
          </div>
          {excludeReimbursable ? (
            <div className="mb-3 small text-secondary">
              {card.rewardType === 'cashback'
                ? language === 'zh'
                  ? `合资格消费 $${dbsTrackedSpend.toFixed(2)} 用于 cashback 估算`
                  : `Eligible $${dbsTrackedSpend.toFixed(2)} used for cashback estimate`
                : t(language, 'gross_used_for_points', { value: dbsTrackedSpend.toFixed(2) })}
            </div>
          ) : (
            <div className="mb-3 small text-secondary">{t(language, 'net_excl_reimb', { value: netMonthlySpent.toFixed(2) })}</div>
          )}
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium text-secondary">{card.rewardType === 'cashback' ? t(language, 'cashback_label') : t(language, 'mpd_cap_remaining')}</span>
            <span className="font-semibold">${fourMpdBalance.toFixed(2)} / ${cardCap}</span>
          </div>
          <div className="progress progress-sm">
            <div 
              className={cn(
                "progress-bar transition-all duration-1000",
                percentSpent > 90 ? "bg-red" : percentSpent > 70 ? "bg-orange" : "bg-primary"
              )}
              style={{ width: `${percentSpent}%` }}
            />
          </div>
          {uobCategoryRows.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {uobCategoryRows.map(row => (
                <div key={row.name} className="rounded border bg-light px-3 py-2">
                  <div className="d-flex justify-content-between small text-secondary">
                    <span>{row.name === 'Dining' ? t(language, 'dining') : t(language, 'travel')}</span>
                    <span className="font-semibold">
                      {row.remaining < 0 ? '-' : ''}${Math.abs(row.remaining).toFixed(2)} {t(language, 'balance_short')}
                    </span>
                  </div>
                  <div className="progress progress-sm mt-2">
                    <div
                      className={cn(
                        "progress-bar transition-all duration-700",
                        row.name === 'Dining' ? 'bg-green' : 'bg-purple'
                      )}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <div className="mt-1 small text-secondary">
                    ${row.bonusUsed.toFixed(2)} / ${row.cap}
                  </div>
                </div>
              ))}
            </div>
          )}
          {hsbcCategoryRows.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {hsbcCategoryRows.map(row => (
                <div key={row.name} className="rounded border bg-light px-3 py-2">
                  <div className="d-flex justify-content-between small text-secondary">
                    <span>{getCategoryDisplayName(row.name, language)}</span>
                    <span className="font-semibold">${row.used.toFixed(2)} {t(language, 'hsbc_matched_amount')}</span>
                  </div>
                  <div className="progress progress-sm mt-2">
                    <div
                      className={cn("progress-bar transition-all duration-700", row.colorClass)}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <div className="mt-1 small text-secondary">
                    {t(language, 'hsbc_shared_cap_basis', { used: row.used.toFixed(2), cap: row.cap })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-top pt-3">
          <div className="mb-3 text-uppercase small fw-semibold text-secondary">{t(language, 'top_categories')}</div>
          <div className="space-y-2">
            {topCategories.map(([cat, amount]) => (
              <div key={cat} className="flex justify-between items-center text-sm">
                <span className="font-medium text-secondary">{getCategoryDisplayName(cat, language)}</span>
                <span className="font-semibold">${amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button 
        onClick={onViewDetails}
        className="btn btn-dark w-100 mt-4"
      >
        {t(language, 'view_details')}
      </button>
      </div>
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

