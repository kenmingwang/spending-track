import { Language } from './i18n';

export interface BenefitDetailSection {
  title: string;
  items: string[];
}

export interface BenefitDetailLink {
  label: string;
  href: string;
}

export interface BenefitDetail {
  title: string;
  summary: string;
  sections: BenefitDetailSection[];
  links: BenefitDetailLink[];
}

const buildDbsDetail = (_language: Language): BenefitDetail => ({
  title: "DBS Woman's World Card Benefit Details",
  summary:
    "Current public DBS positioning: 4 mpd on eligible online spend, 1.2 mpd on overseas spend, and 0.4 mpd on general local spend.",
  sections: [
    {
      title: 'Official earn rates',
      items: [
        'Eligible online spend earns 10X DBS Points, commonly treated as about 4 miles per S$1.',
        'Eligible overseas spend earns 3X DBS Points, commonly treated as about 1.2 miles per S$1.',
        'Other eligible spend earns 1X DBS Point, commonly treated as about 0.4 miles per S$1.',
        'DBS Points are awarded in S$5 blocks, so small transactions can earn less efficiently than the headline rate.'
      ]
    },
    {
      title: 'Cap and timing',
      items: [
        'The current DBS online bonus cap is S$1,000 per calendar month.',
        'The S$1,000 cap applies to the online 4 mpd bonus layer, not to the base local earn.',
        'The extension treats this cap as a monthly cap reset on the first day of each calendar month.'
      ]
    },
    {
      title: 'What usually qualifies',
      items: [
        'Online retail and in-app payments are the main 4 mpd candidates.',
        'Merchant coding still matters in the bank settlement engine, so edge cases can differ from the extension estimate.',
        'Overseas bonus treatment can depend on how the bank posts the merchant and currency.'
      ]
    },
    {
      title: 'How this extension tracks it',
      items: [
        'Transactions marked as ONLINE or IN-APP are treated as online candidates.',
        'The extension estimates points and miles using DBS S$5 block logic.',
        'The bank uses more exact merchant and settlement data than the extension can normally read from exported transactions.'
      ]
    }
  ],
  links: [
    {
      label: 'DBS official card page',
      href: 'https://www.dbs.com.sg/personal/cards/credit-cards/dbs-woman-mastercard-card'
    }
  ]
});

const buildUobDetail = (_language: Language): BenefitDetail => ({
  title: "UOB Lady's Solitaire Card Benefit Details",
  summary:
    "Current public UOB positioning: 4 mpd on selected preferred reward categories, subject to both an aggregate monthly cap and per-category sub-caps.",
  sections: [
    {
      title: 'Official earn rates',
      items: [
        'Selected preferred categories earn 10X UNI$, commonly treated as about 4 miles per S$1.',
        'That 10X consists of base UNI$ plus bonus UNI$.',
        'Unselected categories fall back to the normal base earn rate for the card.'
      ]
    },
    {
      title: 'Categories and caps',
      items: [
        "Lady's Solitaire lets you choose 2 preferred categories.",
        'The current working cap used by the extension is S$1,500 per calendar month in aggregate.',
        'The working per-category cap is S$750 for each selected category.',
        'Official category families include Beauty and Wellness, Fashion, Dining, Family, Travel, Transport, and Entertainment.'
      ]
    },
    {
      title: 'Enrollment rules',
      items: [
        "Preferred categories require enrollment through UOB's category selection flow.",
        'Category changes do not usually become effective immediately; they typically roll into the next eligible cycle or quarter based on bank rules.',
        'If your chosen categories are different from what the extension is configured for, cap tracking will drift.'
      ]
    },
    {
      title: 'How this extension tracks it',
      items: [
        'The extension is currently strongest on Dining and Travel tracking.',
        'If your actual UOB category elections differ, the home card and detail numbers are still only an estimate.',
        'Miles are estimated from UNI$ using the usual UNI$ to miles conversion convention.'
      ]
    }
  ],
  links: [
    {
      label: 'UOB official card page',
      href: 'https://www.uob.com.sg/personal/cards/rewards/ladys-card/index.page'
    }
  ]
});

const buildHsbcDetail = (_language: Language): BenefitDetail => ({
  title: 'HSBC Revolution Credit Card Benefit Details',
  summary:
    'The key date is 2026-03-31. Until 31 Mar 2026, the Revo Up promo extends 4 mpd treatment to eligible online travel and eligible contactless spend, but contactless is still category-limited.',
  sections: [
    {
      title: 'Official earn structure',
      items: [
        'Eligible bonus spend earns 10X HSBC Reward Points, commonly treated as about 4 miles per S$1.',
        'Non-bonus spend earns the base 1X Reward Point layer.',
        'No minimum spend is required for the card to earn points.'
      ]
    },
    {
      title: 'Promo window and cap',
      items: [
        'From 2025-07-01 through 2026-03-31, the Revo Up promo includes eligible online travel and eligible contactless spend in the bonus pool.',
        'The extension uses a S$1,500 monthly cap during that promo period.',
        'From 2026-04-01 onward, the extension falls back to the standard S$1,000 online bonus cap.'
      ]
    },
    {
      title: 'Important category rule for contactless',
      items: [
        'Yes, contactless 4 mpd is still category-gated during the promo period.',
        'The relevant promo category buckets are Shopping, Dining, Ride hailing and taxis, Memberships, and Travel.',
        'A contactless transaction outside those promo buckets should not be treated as 4 mpd just because it was tapped.'
      ]
    },
    {
      title: 'Posting and exclusions',
      items: [
        'Base points and bonus points do not necessarily post at the same time.',
        'Bonus points can show up later than the base layer based on HSBC posting rules.',
        'Public HSBC exclusions include common non-reward categories such as donations, quasi-cash, crypto-related payments, education, insurance, and some cleaning or maintenance merchants.'
      ]
    },
    {
      title: 'How this extension tracks it',
      items: [
        'The HSBC transaction page currently does not expose stable MCC or payment-type metadata for every row.',
        'Because of that, the progress bar on the home card is currently driven by posted monthly spend as a practical approximation.',
        'Benefit classification still uses inferred category plus payment type, so it is an estimate and not the bank settlement engine.'
      ]
    }
  ],
  links: [
    {
      label: 'HSBC official card page',
      href: 'https://www.hsbc.com.sg/credit-cards/products/revolution/'
    },
    {
      label: 'HSBC 10X reward terms',
      href: 'https://www.hsbc.com.sg/content/dam/hsbc/sg/documents/credit-cards/revolution/offers/10x-reward-points-terms-and-conditions.pdf'
    },
    {
      label: 'HSBC Revolution FAQ',
      href: 'https://www.hsbc.com.sg/content/dam/hsbc/sg/documents/credit-cards/revolution/offers/faq-for-hsbc-revolution-credit-card.pdf'
    }
  ]
});

export const getCardBenefitDetail = (cardId: string, language: Language): BenefitDetail | null => {
  if (cardId === 'DBS_WWMC') {
    return buildDbsDetail(language);
  }

  if (cardId === 'UOB_LADYS') {
    return buildUobDetail(language);
  }

  if (cardId === 'HSBC_REVOLUTION') {
    return buildHsbcDetail(language);
  }

  return null;
};
