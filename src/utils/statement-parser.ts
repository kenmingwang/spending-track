import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { ParsedStatement, StatementRewardSummary, Transaction } from '../types';
import { normalizeCategory } from './category-overrides';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type TextToken = {
  text: string;
  x: number;
  y: number;
  page: number;
};

type TextLine = {
  text: string;
  tokens: TextToken[];
  y: number;
  page: number;
};

const MONTHS: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

const BANK_SKIP_RE = /^(PREVIOUS BALANCE|SUB-?TOTAL|SUB TOTAL|TOTAL:?|GRAND TOTAL|TOTAL BALANCE|NEW TRANSACTIONS|CARD NUMBER|DATE\b|DESCRIPTION\b|REF NO:?$)/i;
const NON_SPEND_RE = /(BILL PAYMENT|PAYMT THRU|PAYMENT|DEDUCTED UNI\$|CARD FEE WAIVER|ADD UNI\$|BASE REWARDS|PREVIOUS BALANCE|MEMBERSHIP FEE REV)/i;
const DBS_WWMC_CARD_NUMBER = '5420 8911 0151 2310';
const DBS_LIVE_FRESH_CARD_NUMBER = '4119 1101 0474 8634';
const UOB_LADYS_CARD_NUMBER = '5522-5320-3064-0635';

const parseAmount = (raw: string | undefined) => {
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, ' ').trim();
  const match = normalized.match(/^(\d{1,3}(?:,\d{3})*|\d+)\.\d{2}(?:\s+CR)?$/i);
  if (!match) return null;
  const isCredit = /\bCR\b/i.test(normalized);
  const value = Number(normalized.replace(/\s+CR/i, '').replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  return isCredit ? -value : value;
};

const parseNumber = (raw: string | undefined) => {
  if (!raw) return undefined;
  const value = Number(raw.replace(/,/g, ''));
  return Number.isFinite(value) ? value : undefined;
};

const parseStatementDate = (text: string) => {
  const match = text.match(/Statement Date\s+(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i)
    || text.match(/STATEMENT DATE[\s\S]{0,80}?(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!match) return new Date().toISOString().slice(0, 10);
  const day = Number(match[1]);
  const month = MONTHS[match[2].toUpperCase()] ?? 0;
  const year = Number(match[3]);
  return new Date(year, month, day).toISOString().slice(0, 10);
};

const parseDatedValue = (day: string, monthText: string, statementDate: string) => {
  const statement = new Date(statementDate);
  const month = MONTHS[monthText.toUpperCase()] ?? statement.getMonth();
  let year = statement.getFullYear();
  if (month > statement.getMonth()) year -= 1;
  return new Date(year, month, Number(day)).toISOString().slice(0, 10);
};

const normalizeLineText = (tokens: TextToken[]) => tokens
  .sort((a, b) => a.x - b.x)
  .map((token) => token.text.trim())
  .filter(Boolean)
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim();

const groupTokensIntoLines = (tokens: TextToken[]) => {
  const sorted = [...tokens].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: TextLine[] = [];

  sorted.forEach((token) => {
    if (!token.text.trim()) return;
    const current = lines[lines.length - 1];
    if (current && current.page === token.page && Math.abs(current.y - token.y) <= 3) {
      current.tokens.push(token);
      current.y = (current.y + token.y) / 2;
      current.text = normalizeLineText(current.tokens);
      return;
    }

    lines.push({
      text: token.text.trim(),
      tokens: [token],
      y: token.y,
      page: token.page,
    });
  });

  return lines;
};

const extractPdfLines = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const tokens: TextToken[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    content.items.forEach((item) => {
      if (!('str' in item) || !item.str.trim()) return;
      tokens.push({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        page: pageNumber,
      });
    });
  }

  const lines = groupTokensIntoLines(tokens);
  return {
    text: lines.map((line) => line.text).join('\n'),
    lines,
  };
};

const statementId = (bank: string, date: string, fileName: string) =>
  `${bank}-${date}-${fileName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40)}`;

const inferCategoryAndPayment = (merchantRaw: string, cardId: string) => {
  const merchant = merchantRaw.toUpperCase();
  let category = 'Uncategorized';
  let paymentType = '';

  if (/(BUS\/MRT|TRANSIT|COMFORT|TADA|GRAB\*|GOJEK|CDG)/.test(merchant)) {
    category = 'Transport';
  } else if (/(FOOD PANDA|FOODPANDA|DELIVEROO|RESTAURANT|SICHUAN|NICK-|BREADTALK|LUCKIN|COFFEE|BAKERY|PAUL|KAFFE|TOAST|DUMPLING|NIKAIKU|GOKOKU|SUPERSIMPLE|SUPER SIMPLE)/.test(merchant)) {
    category = 'Dining';
  } else if (/(CLASSPASS|FITNESS|NETFLIX|SPOTIFY|DISNEY|YOUTUBE)/.test(merchant)) {
    category = 'Memberships';
  } else if (/(SP DIGITAL|SINGTEL|UTIL|BILL)/.test(merchant)) {
    category = 'Bills';
  } else if (/(UNIQLO|FAIRPRICE|TANGLIN MARKET|SCARLETT|MARKET PLACE|SHOPEE|LAZADA|AMAZON)/.test(merchant)) {
    category = 'Shopping';
  } else if (/(AIRWAYS|AIRLINES|SCOOT|AGODA|BOOKING|KLOOK|TRIP|HOTEL|TADA)/.test(merchant)) {
    category = 'Travel';
  }

  if (/(WWW\.|FP\*|FOOD PANDA|FOODPANDA|DELIVEROO|CLASSPASS|SP DIGITAL|KRISPAY|TADA|GRAB\*)/.test(merchant)) {
    paymentType = 'ONLINE';
  } else if (/(BUS\/MRT|PAYWAVE|APPLE PAY|SAMSUNG PAY|GOOGLE PAY)/.test(merchant)) {
    paymentType = 'CONTACTLESS';
  } else if (cardId === 'DBS_LIVE_FRESH') {
    paymentType = 'CONTACTLESS';
  }

  return { category: normalizeCategory(category), paymentType };
};

const buildStatementTransaction = (
  input: {
    date: string;
    postDate?: string;
    merchant: string;
    amount: number;
    cardId: string;
    bank: 'DBS' | 'UOB';
    statementId: string;
    statementRef?: string;
    statementCardNumber?: string;
    originalIndex: number;
  }
): Transaction | null => {
  const merchant = input.merchant.replace(/\s+/g, ' ').trim();
  if (!merchant || BANK_SKIP_RE.test(merchant) || NON_SPEND_RE.test(merchant)) return null;
  if (input.amount === 0) return null;

  const inferred = inferCategoryAndPayment(merchant, input.cardId);
  return {
    date: input.date,
    postDate: input.postDate,
    merchant,
    amount: input.amount,
    category: inferred.category,
    paymentType: inferred.paymentType,
    cardId: input.cardId,
    source: input.bank,
    statementId: input.statementId,
    statementRef: input.statementRef,
    statementCardNumber: input.statementCardNumber,
    transactionType: input.amount < 0 ? 'REFUND' : 'PURCHASE',
    originalIndex: input.originalIndex,
  };
};

const parseDbsStatement = (lines: TextLine[], text: string, fileName: string): ParsedStatement => {
  const statementDate = parseStatementDate(text);
  const id = statementId('DBS', statementDate, fileName);
  const transactions: Transaction[] = [];
  const cards = [
    { cardId: 'DBS_LIVE_FRESH', cardName: 'DBS Live Fresh Card', cardNumber: DBS_LIVE_FRESH_CARD_NUMBER },
    { cardId: 'DBS_WWMC', cardName: "DBS Woman's World Card", cardNumber: DBS_WWMC_CARD_NUMBER },
  ];
  let currentCardId = '';
  let currentCardNumber = '';
  let pendingRef = '';

  lines.forEach((line) => {
    if (/LIVE FRESH DBS VISA/i.test(line.text)) {
      currentCardId = 'DBS_LIVE_FRESH';
      currentCardNumber = DBS_LIVE_FRESH_CARD_NUMBER;
      return;
    }
    if (/DBS WOMAN'?S WORLD/i.test(line.text)) {
      currentCardId = 'DBS_WWMC';
      currentCardNumber = DBS_WWMC_CARD_NUMBER;
      return;
    }
    if (!currentCardId) return;

    const refMatch = line.text.match(/^REF NO:\s*(\S+)/i);
    if (refMatch) {
      pendingRef = refMatch[1];
      return;
    }

    const dateToken = line.tokens.find((token) => token.x >= 45 && token.x < 85 && /^\d{2}\s+[A-Z]{3}$/i.test(token.text.trim()));
    const amountToken = [...line.tokens].reverse().find((token) => token.x > 500 && /^(\d{1,3}(?:,\d{3})*|\d+)\.\d{2}(?:\s+CR)?$/i.test(token.text.trim()));
    if (!dateToken || !amountToken) return;

    const hasCreditMarker = line.tokens.some((token) => token.x > amountToken.x && /\bCR\b/i.test(token.text));
    const amount = parseAmount(`${amountToken.text}${hasCreditMarker ? ' CR' : ''}`);
    if (amount === null) return;
    const [day, month] = dateToken.text.trim().split(/\s+/);
    const merchant = line.tokens
      .filter((token) => token.x >= 90 && token.x < 500)
      .map((token) => token.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const transaction = buildStatementTransaction({
      date: parseDatedValue(day, month, statementDate),
      merchant,
      amount,
      cardId: currentCardId,
      bank: 'DBS',
      statementId: id,
      statementRef: pendingRef || undefined,
      statementCardNumber: currentCardNumber,
      originalIndex: transactions.length,
    });
    pendingRef = '';
    if (transaction) transactions.push(transaction);
  });

  const rewardSummary: StatementRewardSummary[] = [];
  const pointsLine = lines.find((line) => line.tokens.some((token) => token.text.trim() === DBS_WWMC_CARD_NUMBER));
  if (pointsLine) {
    const earnedToken = pointsLine.tokens.find((token) => token.x > 240 && token.x < 310 && /\d/.test(token.text));
    const currentToken = pointsLine.tokens.find((token) => token.x > 410 && token.x < 470 && /\d/.test(token.text));
    rewardSummary.push({
      cardId: 'DBS_WWMC',
      rewardType: 'points',
      label: 'DBS Points',
      earned: parseNumber(earnedToken?.text),
      currentBalance: parseNumber(currentToken?.text),
    });
  }

  return {
    statementId: id,
    bank: 'DBS',
    statementDate,
    cards,
    transactions,
    rewardSummary,
    sourceFileName: fileName,
  };
};

const parseUobStatement = (lines: TextLine[], text: string, fileName: string): ParsedStatement => {
  const statementDate = parseStatementDate(text);
  const id = statementId('UOB', statementDate, fileName);
  const transactions: Transaction[] = [];

  lines.forEach((line, index) => {
    const postToken = line.tokens.find((token) => token.x >= 55 && token.x < 95 && /^\d{2}\s+[A-Z]{3}$/i.test(token.text.trim()));
    const transToken = line.tokens.find((token) => token.x >= 95 && token.x < 140 && /^\d{2}\s+[A-Z]{3}$/i.test(token.text.trim()));
    const amountToken = [...line.tokens].reverse().find((token) => token.x > 500 && /^(\d{1,3}(?:,\d{3})*|\d+)\.\d{2}(?:\s+CR)?$/i.test(token.text.trim()));
    if (!postToken || !transToken || !amountToken) return;

    const amount = parseAmount(amountToken.text);
    if (amount === null) return;
    const merchant = line.tokens
      .filter((token) => token.x >= 145 && token.x < 500)
      .map((token) => token.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const nextLine = lines[index + 1];
    const refMatch = nextLine?.text.match(/Ref No\.\s*:\s*(\S+)/i);
    const [postDay, postMonth] = postToken.text.trim().split(/\s+/);
    const [transDay, transMonth] = transToken.text.trim().split(/\s+/);
    const transaction = buildStatementTransaction({
      date: parseDatedValue(transDay, transMonth, statementDate),
      postDate: parseDatedValue(postDay, postMonth, statementDate),
      merchant,
      amount,
      cardId: 'UOB_LADYS',
      bank: 'UOB',
      statementId: id,
      statementRef: refMatch?.[1],
      statementCardNumber: UOB_LADYS_CARD_NUMBER,
      originalIndex: transactions.length,
    });
    if (transaction) transactions.push(transaction);
  });

  const rewardSummary: StatementRewardSummary[] = [];
  const uniLine = lines.find((line) => line.text.startsWith('UNI$') && line.tokens.length >= 7);
  if (uniLine) {
    const numericTokens = uniLine.tokens
      .filter((token) => /^-?$|^-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?$|^-?\d+(?:\.\d{2})?$/.test(token.text.trim()))
      .map((token) => token.text.trim())
      .filter((value) => value !== '-');
    rewardSummary.push({
      cardId: 'UOB_LADYS',
      rewardType: 'uni',
      label: 'UNI$',
      previousBalance: parseNumber(numericTokens[0]),
      earned: parseNumber(numericTokens[1]),
      used: parseNumber(numericTokens[2]),
      adjusted: parseNumber(numericTokens[3]),
      currentBalance: parseNumber(numericTokens[4]),
    });
  }

  return {
    statementId: id,
    bank: 'UOB',
    statementDate,
    cards: [{ cardId: 'UOB_LADYS', cardName: "UOB Lady's Solitaire Card", cardNumber: UOB_LADYS_CARD_NUMBER }],
    transactions,
    rewardSummary,
    sourceFileName: fileName,
  };
};

export const parseStatementPdf = async (file: File): Promise<ParsedStatement> => {
  const { text, lines } = await extractPdfLines(file);
  if (/United Overseas Bank|LADY'?S SOLITAIRE CARD|UNI\$/i.test(text)) {
    return parseUobStatement(lines, text, file.name);
  }
  if (/DBS WOMAN|LIVE FRESH DBS|DBS POINTS SUMMARY/i.test(text)) {
    return parseDbsStatement(lines, text, file.name);
  }
  throw new Error(`Unsupported statement PDF: ${file.name}`);
};

export const parseStatementPdfs = async (files: File[]) => Promise.all(files.map(parseStatementPdf));
