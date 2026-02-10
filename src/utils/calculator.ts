import { CardBenefitManager } from './card-benefits';
import { Transaction } from '../types';

export class TransactionCalculator {
  static getMonthYear(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
  }

  static groupTransactionsByMonth(transactions: Transaction[]) {
    const groups: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      const monthYear = this.getMonthYear(t.date);
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(t);
    });
    return groups;
  }

  static calculateStats(transactions: Transaction[], cardId: string, userElections: string[] | null = null) {
    const cardSpending = CardBenefitManager.calculatePerCategorySpending(transactions, cardId, userElections);
    const card = CardBenefitManager.getCardConfig(cardId);
    const baseMpd = card?.fallbackMPD ?? 0.4;
    
    let totalSpent = 0;
    let expectedMiles = 0;

    // Use DBS points rounding rules for DBS WWMC
    if (cardId === 'DBS_WWMC') {
      transactions.forEach(t => {
        totalSpent += Math.abs(t.amount);
        const eligibility = CardBenefitManager.isTransactionEligible(t, cardId, userElections);
        const totalMpd = eligibility.eligible ? eligibility.mpd : baseMpd;
        const basePoints = Math.floor(Math.abs(t.amount) / 5);
        const totalMultiplier = totalMpd / baseMpd;
        const bonusMultiplier = Math.max(0, totalMultiplier - 1);
        const bonusPoints = Math.floor((Math.abs(t.amount) / 5) * bonusMultiplier);
        const totalPoints = basePoints + bonusPoints;
        expectedMiles += totalPoints * 2;
      });
    } else {
      Object.values(cardSpending).forEach(data => {
        totalSpent += data.spent;
        // Miles are earned on capped amount at higher rate, then fallback if exceeded (though logic here just calculates miles based on eligibility)
        // Standard bank logic: 10X (4mpd) up to $1k, then 1X (0.4mpd)
        const cappedSpent = Math.min(data.spent, data.cap);
        const extraSpent = Math.max(0, data.spent - data.cap);
        
        expectedMiles += cappedSpent * data.mpd;
        // Note: extraSpent miles are handled by 'Others' or fallbackMPD? 
        // Usually if you exceed cap on a 4mpd category, the excess earns base rate (0.4mpd).
        if (data.cap !== Infinity) {
          expectedMiles += extraSpent * baseMpd;
        }
      });
    }

    return {
      totalSpent,
      expectedMiles: Math.round(expectedMiles),
      categoryBreakdown: cardSpending
    };
  }
}
