// ============================================================
// STEP 1: Paste your Google Sheet ID (from the URL bar)
// Sheet URL: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
// ============================================================
export const SHEET_ID = 1CA163l7NJy38iDqivzAcFsisT0-Vo-3S6VuiPnYphN4

// ============================================================
// STEP 2: Paste your Google Sheets API Key
// How to get one:
//   1. Go to https://console.cloud.google.com
//   2. Create a new project (or use existing)
//   3. Enable "Google Sheets API"
//   4. Go to Credentials → Create Credentials → API Key
//   5. (Optional) Restrict key to Google Sheets API + your Vercel domain
// ============================================================
export const API_KEY = AIzaSyDzP1jwpX_94Lo0ZhOW41iL7_9EZObx4Ic

// ============================================================
// Ranges — these match your actual sheet tab names exactly
//
// IMPORTANT: Ranges use open-ended column notation (e.g. A:O)
// with NO row number — this tells the Sheets API to return ALL
// rows that contain data, up to the very last one. New rows you
// add to any tab are picked up automatically on the next fetch.
// Never change these to e.g. A1:O200 — that would cap the rows.
// ============================================================
export const RANGES = {
  // Cols: Ticker|Account ID|Owner|Asset Class|CCY|Total Shares|
  //       Cost Basis (SGD)|Current Price|Live FX Rate|Curr Value (Native)|
  //       Curr Value (SGD)|Unrealised Gain (SGD)|Gain %|Weight %|Day Change %
  INVESTMENTS: 'Inv_Holdings!A:O',

  // Note: "Cash Holding" has a space, not underscore — must match exactly
  // Cols: Cash Label|Account ID|Owner|CCY|Balance|Balance (SGD)
  CASH: 'Cash Holding!A:F',

  // Cols: Snapshot Date|Bryan Investment|Bryan_S&P500|Monthly Return_B|
  //       Joint Investment|Joint_S&P500|Monthly Return_Joint|
  //       Nathan Investment|Nathan_S&P500|Monthly Return_N1|
  //       Natalie Investment|Natalie_S&P500|Monthly Return_N2|
  //       S&P 500|S&P 500 Indexed|Bryan_Indexed|Joint_Indexed|Nathan_Indexed|Natalie_Indexed
  SNAPSHOT: 'Portfolio Snapshot!A:S',

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

// Column indices — Inv_Holdings (0-based, header row skipped)
export const INV_COLS = {
  TICKER: 0, ACCOUNT_ID: 1, OWNER: 2, ASSET_CLASS: 3, CCY: 4,
  TOTAL_SHARES: 5, COST_BASIS_SGD: 6, CURR_VALUE_SGD: 10,
  UNREALISED_GAIN: 11, GAIN_PCT: 12, DAY_CHANGE_PCT: 14,
}

// Column indices — Portfolio Snapshot (0-based, header row skipped)
export const SNAP_COLS = {
  DATE: 0,
  BRYAN_VALUE: 1,    BRYAN_SP500: 2,    BRYAN_MONTHLY_RET: 3,
  JOINT_VALUE: 4,    JOINT_SP500: 5,    JOINT_MONTHLY_RET: 6,
  NATHAN_VALUE: 7,   NATHAN_SP500: 8,   NATHAN_MONTHLY_RET: 9,
  NATALIE_VALUE: 10, NATALIE_SP500: 11, NATALIE_MONTHLY_RET: 12,
  SP500_INDEXED: 14,
  BRYAN_INDEXED: 15, JOINT_INDEXED: 16, NATHAN_INDEXED: 17, NATALIE_INDEXED: 18,
}

// Column indices — Inv_Tx (0-based, header row skipped)
export const TX_COLS = {
  DATE: 1, OWNER: 3, TYPE: 6, INV_AMOUNT_SGD: 11,
}

// ============================================================
// Banking ranges
// Cols: SN|Date|Account ID|Owner|Function|Type|Category|Amount|Remarks
// ============================================================
export const BANK_TX_RANGE = 'Bank_Tx!A:I'

// Cols: Year|Month|Account ID|Owner|Function|Type|Category|Amount (SGD)
export const BANK_SUMMARY_RANGE = 'Bank_Summary!A:H'

// Cols: Year|Month|Account ID|Owner|Net Flow (SGD)
export const BANK_BALANCE_RANGE = 'Bank_Balance!A:E'

// Cols: Account|Type|Balance
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
// Cols: SN|Date|Account|Type|Amount|Holiday Year|Trip|Remarks
// ============================================================
export const HOLIDAY_RANGE = 'Holiday Fund!A:H'

// ============================================================
// House Fund range
// Cols: SN|Date|Account|Type|Category|Amount|Remarks
// ============================================================
export const HOUSE_RANGE = 'House_Fund!A:G'
