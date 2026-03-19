# Spending Track

[English](./README.md) | [中文](./README.zh-CN.md)

A Chrome extension for tracking credit card spending, estimating miles/points, and monitoring 4 mpd caps from scanned online banking transactions.

## Features

- Scan transactions from internet banking pages (DBS / UOB workflows supported by current extractor logic).
- Card-level tracking:
  - `DBS Woman's World Card`
  - `UOB Lady's Solitaire Card`
- Estimate points/miles using card-specific rules.
- UOB elected category cap tracking (Dining/Travel) with progress bars.
- Reimbursable transaction mode:
  - Mark individual transactions as reimbursable.
  - Dashboard can exclude reimbursable spend from displayed spend totals.
  - 4 mpd / points calculations still use full transaction amount.
- Merchant-level category override cache (learned from your edits).
- Overall insights:
  - Category share
  - Largest transactions
  - Most frequent merchants
  - Expandable lists
- Weekly reminder via Chrome notification (`alarms` + `notifications`).

## Project Structure

- `src/popup/*`: extension popup UI and scan controls.
- `src/dashboard/*`: dashboard pages and analytics UI.
- `src/content-scripts/extractor.ts`: page extraction logic.
- `src/utils/*`: calculator, card rules, category normalization.
- `src/background.ts`: weekly reminder alarm + notification service worker.
- `manifest.json`: Chrome extension manifest (MV3).

## Prerequisites

- Node.js 18+ recommended.
- npm.
- Google Chrome (for loading unpacked extension).

## Setup

```bash
npm install
```

## Build

```bash
npm run build
```

Build output is generated in:

- `dist/`

## Load in Chrome (Unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `dist`.

## Usage

1. Open DBS or UOB internet banking transaction page.
2. Click the extension popup and run **Start Scanning**.
3. Open dashboard from popup.
4. Review/adjust transaction category if needed.
5. (Optional) mark reimbursable transactions.
6. Use **Exclude Reimbursable** toggle on main dashboard for net spend view.

## Notes and Limitations

- Bank pages can change markup at any time; scanner rules may need updates.
- Some merchants do not provide clean category metadata; keyword/category inference is used.
- Estimated points/miles are for planning and may differ slightly from official statement posting logic.

## Data and Privacy

- Data is stored locally in Chrome extension storage (`chrome.storage.local`).
- No backend/server is used in this project by default.

## Scripts

- `npm run dev`: local dev mode with Vite.
- `npm run build`: type-check + production build.
- `npm run preview`: preview built assets.

