// ============================================================
// STEP 1: Paste your Google Sheet ID (from the URL bar)
// ============================================================
export const SHEET_ID = '1CA163l7NJy38iDqivzAcFsisT0-Vo-3S6VuiPnYphN4'

// ============================================================
// STEP 2: Paste your Google Sheets API Key
// ============================================================
export const API_KEY = import.meta.env.VITE_API_KEY || 'AIzaSyDzP1jwpX_94Lo0ZhOW41iL7_9EZObx4Ic'

// ============================================================
// Ranges — open-ended column notation, auto-picks up new rows
// ============================================================
export const RANGES = {
  // Cols: Ticker|Account ID|Owner|Asset Class|CCY|Total Shares|
  //       Cost Basis (SGD)|Current Price|Live FX Rate|Curr Value (Native)|
  //       Curr Value (SGD)|Unrealised Gain (SGD)|Gain %|Weight %|Day Change %
  INVESTMENTS: 'Inv_Holdings!A:O',

  // Cols: Cash Label|Account ID|Owner|CCY|Balance|Balance (SGD)
  CASH: 'Cash Holding!A:F',

  // NEW 6-column schema (auto-populated by Apps Script + GOOGLEFINANCE):
  // Date | Bryan Value (SGD) | Joint Value (SGD) | Nathan Value (SGD) | Natalie Value (SGD) | SP500 Close
  SNAPSHOT: 'Portfolio Snapshot!A:F',

  // Cols: SN|Date|Account ID|Owner|Ticker|Asset Class|Type|
  //       Shares|Inv Price|Currency|Inv Amount|Inv Amount (SGD)|Notes
  INV_TX: 'Inv_Tx!A:M',
}

// Owner names — must match values in your sheet Owner columns exactly
export const OWNERS = ['All Owners', 'Bryan', 'Joint', 'Nathan', 'Natalie']

// Asset class colours
export const ASSET_CLASS_COLORS = {
  ETF: '#10b981', Equity: '#3b82f6', Fund: '#f59e0b',
  REIT: '#ef4444', Bond: '#94a3b8', Cash: '#8b5cf6',
  Commodity: '#ec4899', Other: '#d1d5db',
}

// ── Column indices — Inv_Holdings (0-based, header row skipped) ───────────────
export const INV_COLS = {
  TICKER: 0, ACCOUNT_ID: 1, OWNER: 2, ASSET_CLASS: 3, CCY: 4,
  TOTAL_SHARES: 5, COST_BASIS_SGD: 6, CURR_VALUE_SGD: 10,
  UNREALISED_GAIN: 11, GAIN_PCT: 12, DAY_CHANGE_PCT: 14,
}

// ── Column indices — Portfolio Snapshot (0-based, header row skipped) ─────────
// New 6-column schema written by Apps Script + GOOGLEFINANCE formula:
//   A=Date  B=Bryan_Value  C=Joint_Value  D=Nathan_Value  E=Natalie_Value  F=SP500_Close
// All derived metrics (monthly return %, indexed to 100, $ gain) are computed
// in the React app — no extra sheet columns needed.
export const SNAP_COLS = {
  DATE:          0,   // A — date of snapshot (last day of month)
  BRYAN_VALUE:   1,   // B — Bryan total portfolio SGD (investments + cash)
  JOINT_VALUE:   2,   // C — Joint total
  NATHAN_VALUE:  3,   // D — Nathan total
  NATALIE_VALUE: 4,   // E — Natalie total
  SP500_CLOSE:   5,   // F — S&P500 close price (GOOGLEFINANCE formula)
}

// ── Column indices — Inv_Tx (0-based, header row skipped) ────────────────────
export const TX_COLS = {
  DATE: 1, OWNER: 3, TYPE: 6, INV_AMOUNT_SGD: 11,
}

// ============================================================
// Banking ranges
// ============================================================
export const BANK_TX_RANGE       = 'Bank_Tx!A:I'
export const BANK_SUMMARY_RANGE  = 'Bank_Summary!A:H'
export const BANK_BALANCE_RANGE  = 'Bank_Balance!A:E'
export const ACCOUNT_BALANCE_RANGE = 'Account Balance!A:C'

// Account definitions — Bank + Savings only
export const BANK_ACCOUNTS = [
  { id: 'A005', owner: 'Bryan',   label: 'Bryan',   type: 'Bank'    },
  { id: 'A006', owner: 'Bryan',   label: 'Bryan',   type: 'Savings' },
  { id: 'A007', owner: 'Joint',   label: 'Joint',   type: 'Bank'    },
  { id: 'A008', owner: 'Joint',   label: 'Joint',   type: 'Savings' },
  { id: 'A009', owner: 'Nathan',  label: 'Nathan',  type: 'Bank'    },
  { id: 'A010', owner: 'Natalie', label: 'Natalie', type: 'Bank'    },
]

// Savings accounts to show MoM chart for
export const SAVINGS_ACCOUNTS = [
  { id: 'A006', owner: 'Bryan', label: 'Bryan — Savings (A006)', color: '#10b981' },
  { id: 'A008', owner: 'Joint', label: 'Joint — Savings (A008)',  color: '#3b82f6' },
]

// Category colours for spend bars
export const CAT_COLORS = {
  Tax: '#ef4444', Mortgage: '#f87171', House: '#fb923c', Loan: '#f97316',
  Savings: '#8b5cf6', Investment: '#6366f1', Holiday: '#ec4899', Kids: '#f43f5e',
  Insurance: '#94a3b8', Subscription: '#64748b', Food: '#10b981', Groceries: '#34d399',
  Transport: '#06b6d4', Phone: '#0ea5e9', Parents: '#6b7280', CCA: '#a855f7',
  Tuition: '#d946ef', Car: '#f59e0b', Others: '#aaaaaa', Miscellaneous: '#aaaaaa',
  Bank: '#aaaaaa', Transfer: '#aaaaaa', Interest: '#34d399', Salary: '#10b981',
}

// ============================================================
// Holiday Fund range
// ============================================================
export const HOLIDAY_RANGE = 'Holiday Fund!A:H'

// ============================================================
// House Fund range
// ============================================================
export const HOUSE_RANGE = 'House_Fund!A:G'
