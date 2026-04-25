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

const buildDbsDetail = (language: Language): BenefitDetail => {
  if (language === 'zh') {
    return {
      title: 'DBS Woman\'s World 卡权益说明',
      summary: '这张卡的核心是线上消费 4 mpd、海外消费约 1.2 mpd，其余本地消费按基础里程计算。',
      sections: [
        {
          title: '主要返里程结构',
          items: [
            '合资格线上消费通常按 10X DBS Points 计算，常见换算约为每 S$1 得 4 miles。',
            '合资格海外消费通常按 3X DBS Points 计算，约为每 S$1 得 1.2 miles。',
            '其他一般消费通常按基础 1X DBS Point 计算，约为每 S$1 得 0.4 miles。'
          ]
        },
        {
          title: '上限与周期',
          items: [
            '扩展当前按每自然月 S$1,000 的线上加速消费上限来追踪。',
            '这个上限针对 4 mpd 奖励层，不是针对全部本地消费。',
            '系统会在每个月第一天重置本月封顶进度。'
          ]
        },
        {
          title: '扩展如何估算',
          items: [
            '被标记为 ONLINE 或 IN-APP 的交易会优先视为线上候选。',
            '积分与里程会按 DBS 的 S$5 记分块逻辑做近似估算。',
            '银行最终入账会参考更细的商户编码与清算数据，因此这里仍是估算值。'
          ]
        }
      ],
      links: [
        {
          label: 'DBS 官方卡页',
          href: 'https://www.dbs.com.sg/personal/cards/credit-cards/dbs-woman-mastercard-card'
        }
      ]
    };
  }

  return {
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
  };
};

const buildUobDetail = (language: Language): BenefitDetail => {
  if (language === 'zh') {
    return {
      title: 'UOB Lady\'s Solitaire 卡权益说明',
      summary: '这张卡的核心是自选类别 4 mpd，但同时受总上限和单类别上限约束。',
      sections: [
        {
          title: '主要返里程结构',
          items: [
            '已选择的奖励类别通常按 10X UNI$ 计算，常见换算约为每 S$1 得 4 miles。',
            '未选择的类别则回到卡片基础返利。',
            '10X UNI$ 一般由基础 UNI$ 加上额外奖励 UNI$ 组成。'
          ]
        },
        {
          title: '类别与上限',
          items: [
            'Lady\'s Solitaire 一般可选 2 个偏好类别。',
            '扩展当前按每月总上限 S$1,500 来追踪。',
            '每个已选类别当前按 S$750 的子上限来估算。'
          ]
        },
        {
          title: '扩展如何估算',
          items: [
            '目前扩展对 Dining 和 Travel 的追踪最完整。',
            '如果你在银行里实际选择的类别和扩展配置不同，首页与详情页都会出现偏差。',
            '里程会按常见的 UNI$ 换算规则做近似估算。'
          ]
        }
      ],
      links: [
        {
          label: 'UOB 官方卡页',
          href: 'https://www.uob.com.sg/personal/cards/rewards/ladys-card/index.page'
        }
      ]
    };
  }

  return {
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
  };
};

const buildHsbcDetail = (language: Language): BenefitDetail => {
  if (language === 'zh') {
    return {
      title: 'HSBC Revolution 卡权益说明',
      summary: '这张卡近期最关键的是 2026-03-31 这个日期。在此之前，线上旅行和合资格感应交易仍可能享有 4 mpd，但感应依旧受类别限制。',
      sections: [
        {
          title: '主要返里程结构',
          items: [
            '合资格奖励消费通常按 10X HSBC Reward Points 计算，常见换算约为每 S$1 得 4 miles。',
            '非奖励消费按基础层积分计算。',
            '这张卡本身没有最低消费门槛才开始给积分。'
          ]
        },
        {
          title: '促销窗口与上限',
          items: [
            '扩展当前在促销期内按每月 S$1,500 的共享上限追踪。',
            '从 2026-04-01 起，扩展会回到标准的每月 S$1,000 线上奖励上限。',
            '是否最终算入 4 mpd，仍取决于商户类别和付款方式。'
          ]
        },
        {
          title: '扩展如何估算',
          items: [
            'HSBC 页面通常拿不到稳定的 MCC 或付款方式元数据，所以首页进度条是按月度已入账消费做近似。',
            '权益分类会结合推断出的类别和付款方式来估算。',
            '因此这里更像实用跟踪，不是银行清算系统的最终结果。'
          ]
        }
      ],
      links: [
        {
          label: 'HSBC 官方卡页',
          href: 'https://www.hsbc.com.sg/credit-cards/products/revolution/'
        },
        {
          label: 'HSBC 10X 奖励条款',
          href: 'https://www.hsbc.com.sg/content/dam/hsbc/sg/documents/credit-cards/revolution/offers/10x-reward-points-terms-and-conditions.pdf'
        },
        {
          label: 'HSBC Revolution FAQ',
          href: 'https://www.hsbc.com.sg/content/dam/hsbc/sg/documents/credit-cards/revolution/offers/faq-for-hsbc-revolution-credit-card.pdf'
        }
      ]
    };
  }

  return {
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
  };
};

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
