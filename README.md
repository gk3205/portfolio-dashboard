# Portfolio Dashboard

A mobile-friendly React dashboard that reads live data from your Google Sheets and displays:

- Total portfolio value, unrealised gain, today's best/worst performers
- Portfolio growth vs S&P500 and STI (indexed chart)
- Asset allocation by class
- XIRR by owner
- Sortable holdings detail table
- Monthly return % vs S&P500

## Setup (5 minutes)

### 1. Get a Google Sheets API key

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project (or select existing)
3. Go to **APIs & Services → Library** → search "Google Sheets API" → Enable
4. Go to **APIs & Services → Credentials** → Create Credentials → API Key
5. Copy the key

> **Recommended**: Click the key → Add restrictions → API restrictions → Google Sheets API.
> This prevents misuse if the key is ever seen.

### 2. Make your Google Sheet public (read-only)

1. Open your Google Sheet
2. Click **Share** → Change to "Anyone with the link" → Viewer
   - The API key approach requires the sheet to be publicly readable
   - Alternatively use OAuth2 (more complex setup)

### 3. Configure the app

Open `src/config.js` and fill in:

```js
export const SHEET_ID = 'your-sheet-id-from-url'
export const API_KEY = 'your-api-key'
```

Also update `RANGES` to match your exact tab names and column layout.

### 4. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

### 5. Deploy to Vercel

**Option A — Vercel CLI (easiest):**
```bash
npm install -g vercel
vercel
```
Follow the prompts. Done.

**Option B — GitHub + Vercel dashboard:**
1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Select your repo → Deploy
4. Done — you get a URL like `https://portfolio-dashboard-xyz.vercel.app`

**Add to your iPhone/iPad home screen:**
1. Open the URL in Safari
2. Tap the Share icon
3. Tap "Add to Home Screen"
4. Name it "Portfolio" → Add

It will open fullscreen like a native app.

## Google Sheets column layout expected

### Investment Holdings tab
| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| Ticker | Owner | Asset Class | Units | Avg Cost | Current Price | Cost Value (SGD) | Current Value (SGD) | Gain/Loss (SGD) | Gain % | Day Change % |

### Cash Holdings tab
| A | B | C |
|---|---|---|
| Account Name | Owner | Balance (SGD) |

### Portfolio Snapshot tab
| A | B | C | D |
|---|---|---|---|
| Date | Portfolio (indexed to 100) | S&P500 (indexed) | STI (indexed) |

### XIRR Summary (Dashboard tab or any named range)
| A | B | C |
|---|---|---|
| Owner | XIRR (decimal, e.g. 0.124) | Total Value (SGD) |

### Monthly Returns (in Portfolio Snapshot tab or separate columns)
| A | B | C |
|---|---|---|
| Month (e.g. "Oct 24") | Portfolio Return % | S&P500 Return % |

## Troubleshooting

**"Could not load data" error:**
- Check that your Sheet is set to "Anyone with the link can view"
- Double-check SHEET_ID (the long string in the URL)
- Make sure the API key is correct and Google Sheets API is enabled
- Check that tab names in `config.js` match your sheet exactly (case-sensitive)

**Values look wrong (e.g. XIRR shows 0.12 instead of 12%):**
- The app auto-detects decimal vs percentage format for XIRR, Gain %, and Day Change %
- If it's still wrong, multiply your values by 100 in the sheet before pulling them in

**Holdings table shows blank:**
- Ensure column layout matches what's in config.js
- Check that row 1 is the header row (it's skipped automatically)
