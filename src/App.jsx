import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ComposedChart, ReferenceLine,
} from 'recharts'
import {
  SHEET_ID, API_KEY, RANGES, OWNERS, ASSET_CLASS_COLORS,
  INV_COLS, SNAP_COLS, TX_COLS,
  BANK_TX_RANGE, BANK_SUMMARY_RANGE, BANK_BALANCE_RANGE, ACCOUNT_BALANCE_RANGE,
  BANK_ACCOUNTS, SAVINGS_ACCOUNTS, CAT_COLORS, HOLIDAY_RANGE, HOUSE_RANGE,
} from './config'

// ─── Colours ─────────────────────────────────────────────────────────────────
const C = {
  bg: '#f2f3f5', card: '#ffffff', border: '#e8e9eb',
  text: '#111111', muted: '#888888', hint: '#cccccc',
  green: '#10b981', red: '#ef4444', blue: '#60a5fa', salmon: '#fca5a5',
  amber: '#f59e0b', tag: '#f5f5f5',
  ownerLines: { Bryan: '#10b981', Joint: '#3b82f6', Nathan: '#f59e0b', Natalie: '#a78bfa' },
  ownerAccent: { Bryan: '#10b981', Joint: '#3b82f6', Nathan: '#f59e0b', Natalie: '#a78bfa', 'All Owners': '#6366f1' },
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const S = {
  app: { padding: '16px', maxWidth: '1200px', margin: '0 auto' },
  pageTabs: {
    display: 'flex', gap: '4px', marginBottom: '16px',
    borderBottom: `1px solid ${C.border}`, paddingBottom: '0',
  },
  pageTab: {
    padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
    border: 'none', background: 'none', color: C.muted,
    borderBottom: '2px solid transparent', marginBottom: '-1px',
    fontWeight: 400, transition: 'all .15s', outline: 'none',
  },
  pageTabActive: { color: C.text, borderBottomColor: C.text, fontWeight: 500 },
  ownerTabs: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' },
  ownerTabLabel: { fontSize: '11px', color: C.muted, marginRight: '2px' },
  tab: {
    padding: '5px 14px', borderRadius: '20px', fontSize: '12px',
    cursor: 'pointer', border: `1px solid ${C.border}`,
    background: C.card, color: '#555', fontWeight: 400,
    transition: 'all .15s', outline: 'none',
  },
  tabActive: { background: '#111', color: '#fff', borderColor: '#111' },
  refreshBtn: {
    marginLeft: 'auto', padding: '5px 10px', borderRadius: '6px',
    border: `1px solid ${C.border}`, background: C.card, color: C.muted,
    cursor: 'pointer', fontSize: '16px', lineHeight: 1,
  },
  card: { background: C.card, borderRadius: '10px', padding: '14px', border: `0.5px solid ${C.border}` },
  cardMb: { background: C.card, borderRadius: '10px', padding: '14px', border: `0.5px solid ${C.border}`, marginBottom: '12px' },
  cardTitle: { fontSize: '12px', fontWeight: 500, color: C.text, marginBottom: '2px' },
  cardSub: { fontSize: '10px', color: C.muted, marginBottom: '10px' },
  kpiLabel: { fontSize: '9px', color: C.muted, fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: '3px' },
  kpiValue: { fontSize: '19px', fontWeight: 600, color: C.text },
  kpiSub: { fontSize: '10px', marginTop: '2px', color: C.muted },
  tag: { display: 'inline-block', marginTop: '8px', fontSize: '9px', color: C.muted, background: C.tag, padding: '2px 5px', borderRadius: '3px' },
  legend: { display: 'flex', gap: '14px', marginTop: '8px', flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: C.muted },
  th: { fontSize: '10px', color: C.muted, fontWeight: 500, textAlign: 'left', padding: '4px 6px', borderBottom: `0.5px solid #f0f0f0`, whiteSpace: 'nowrap' },
  td: { fontSize: '11px', padding: '4px 6px', borderBottom: `0.5px solid #f9f9f9`, color: '#333' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', fontSize: '13px', color: C.muted },
  error: { padding: '24px', textAlign: 'center', color: C.red },
  banner: { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '8px 14px', marginBottom: '12px', fontSize: '11px', color: '#92400e' },
  secLabel: { fontSize: '9px', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', color: C.hint, marginBottom: '8px' },
}

// ─── XIRR ────────────────────────────────────────────────────────────────────
function calculateXIRR(cashflows, dates) {
  if (!cashflows || cashflows.length < 2) return null
  const t0 = dates[0].getTime()
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000
  const years = dates.map(d => (d.getTime() - t0) / msPerYear)
  const npv = r => cashflows.reduce((s, cf, i) => s + cf / Math.pow(1 + r, years[i]), 0)
  const dnpv = r => cashflows.reduce((s, cf, i) => s - years[i] * cf / Math.pow(1 + r, years[i] + 1), 0)
  let rate = 0.1
  for (let i = 0; i < 200; i++) {
    const f = npv(rate), df = dnpv(rate)
    if (Math.abs(f) < 0.001 || Math.abs(df) < 1e-10) break
    const next = rate - f / df
    rate = next <= -0.9999 ? (rate + -0.9999) / 2 : next
  }
  return isFinite(rate) && rate > -1 ? rate * 100 : null
}

function computeXIRRByOwner(txRows, holdingsMap) {
  const byOwner = {}
  OWNERS.filter(o => o !== 'All Owners').forEach(o => { byOwner[o] = { cfs: [], dates: [] } })
  txRows.slice(1).forEach(r => {
    const owner = String(r[TX_COLS.OWNER] || '').trim()
    const type = String(r[TX_COLS.TYPE] || '').trim()
    const amtSGD = toNum(r[TX_COLS.INV_AMOUNT_SGD])
    const date = parseDate(r[TX_COLS.DATE])
    if (!owner || !byOwner[owner] || amtSGD === null || !date) return
    const cf = (type === 'Buy' || type === 'Deposit') ? -Math.abs(amtSGD) : Math.abs(amtSGD)
    byOwner[owner].cfs.push(cf)
    byOwner[owner].dates.push(date)
  })
  const today = new Date()
  return OWNERS.filter(o => o !== 'All Owners').map(owner => {
    const { cfs, dates } = byOwner[owner]
    const portfolioValue = holdingsMap[owner] || 0
    if (!cfs.length || !portfolioValue) return { owner, xirr: null, value: portfolioValue }
    const combined = cfs.map((cf, i) => ({ cf, date: dates[i] }))
    combined.push({ cf: portfolioValue, date: today })
    combined.sort((a, b) => a.date - b.date)
    const xirr = calculateXIRR(combined.map(c => c.cf), combined.map(c => c.date))
    return { owner, xirr, value: portfolioValue }
  }).filter(x => x.value > 0)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toNum = v => {
  if (v === undefined || v === null || v === '' || v === '—' || v === '-') return null
  const n = parseFloat(String(v).replace(/[$%,]/g, '').trim())
  return isNaN(n) ? null : n
}
const parseDate = v => {
  if (!v) return null
  if (v instanceof Date) return v
  // Handle Excel/Google Sheets serial date numbers (e.g. 45293 = 2023-12-31)
  // Google Sheets API with UNFORMATTED_VALUE returns dates as serial numbers
  const n = Number(v)
  if (!isNaN(n) && n > 40000 && n < 70000) {
    // Excel epoch starts 1899-12-30, JS epoch starts 1970-01-01
    return new Date(Math.round((n - 25569) * 86400 * 1000))
  }
  const d = new Date(String(v).replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}
const normPct = v => v !== null && Math.abs(v) < 1.5 ? v * 100 : v
const fmtSGD = n => new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(n)
const fmtPct = (n, d = 2) => (n >= 0 ? '+' : '') + n.toFixed(d) + '%'

// ─── Fetching ─────────────────────────────────────────────────────────────────
async function fetchRange(range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?key=${API_KEY}&valueRenderOption=UNFORMATTED_VALUE`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status} for "${range}"`)
  }
  return (await res.json()).values || []
}

// ─── Investment data transform ─────────────────────────────────────────────────
function transformInvData({ invRows, cashRows, snapshotRows, txRows }) {
  const holdings = invRows.slice(1).filter(r => r[INV_COLS.TICKER]).map(r => ({
    ticker: String(r[INV_COLS.TICKER] || ''),
    owner: String(r[INV_COLS.OWNER] || ''),
    assetClass: String(r[INV_COLS.ASSET_CLASS] || 'Other'),
    costBasis: toNum(r[INV_COLS.COST_BASIS_SGD]) ?? 0,
    currentValue: toNum(r[INV_COLS.CURR_VALUE_SGD]) ?? 0,
    gainLoss: toNum(r[INV_COLS.UNREALISED_GAIN]) ?? 0,
    gainPct: normPct(toNum(r[INV_COLS.GAIN_PCT]) ?? 0),
    dayChangePct: normPct(toNum(r[INV_COLS.DAY_CHANGE_PCT])),
  }))
  const cashByOwner = {}
  cashRows.slice(1).filter(r => r[2]).forEach(r => {
    const owner = String(r[2] || '').trim()
    cashByOwner[owner] = (cashByOwner[owner] || 0) + (toNum(r[5]) ?? 0)
  })
  const cashHoldings = Object.entries(cashByOwner).map(([owner, value]) => ({
    ticker: 'Cash', owner, assetClass: 'Cash',
    costBasis: value, currentValue: value, gainLoss: 0, gainPct: 0, dayChangePct: null,
  }))
  const allHoldings = [...holdings, ...cashHoldings]

  const ownerValueKeys = {
    Bryan:   SNAP_COLS.BRYAN_VALUE,
    Joint:   SNAP_COLS.JOINT_VALUE,
    Nathan:  SNAP_COLS.NATHAN_VALUE,
    Natalie: SNAP_COLS.NATALIE_VALUE,
  }
  const snapRawRows = snapshotRows.slice(1).filter(r =>
    r[SNAP_COLS.DATE] && toNum(r[SNAP_COLS.BRYAN_VALUE]) !== null
  )
  const snapshotData = snapRawRows.map((r, i) => {
    const date  = parseDate(r[SNAP_COLS.DATE])
    const label = date
      ? date.toLocaleDateString('en-SG', { month: 'short', year: '2-digit' })
      : String(r[SNAP_COLS.DATE])
    const prev  = i > 0 ? snapRawRows[i - 1] : null
    const first = snapRawRows[0]
    const row   = { date: label }

    OWNERS.filter(o => o !== 'All Owners').forEach(owner => {
      const key = ownerValueKeys[owner]
      const v = toNum(r[key]) ?? 0
      const p = prev ? (toNum(prev[key]) ?? v) : v
      const f = toNum(first[key]) ?? v
      row[`${owner}_value`]   = v
      row[`${owner}_ret`]     = p > 0 ? +((v / p - 1) * 100).toFixed(2) : 0
      row[`${owner}_indexed`] = f > 0 ? +((v / f) * 100).toFixed(2) : 100
      row[`${owner}_gain`]    = v - f
    })

    const sp   = toNum(r[SNAP_COLS.SP500_CLOSE])
    const sp_p = prev ? toNum(prev[SNAP_COLS.SP500_CLOSE]) : sp
    const sp_f = toNum(first[SNAP_COLS.SP500_CLOSE])
    row.sp500         = sp
    row.sp500_ret     = (sp && sp_p && sp_p > 0) ? +((sp / sp_p - 1) * 100).toFixed(2) : 0
    row.sp500_indexed = (sp && sp_f && sp_f > 0) ? +((sp / sp_f) * 100).toFixed(2) : 100
    return row
  })

  const portfolioByOwner = {}
  allHoldings.forEach(h => { portfolioByOwner[h.owner] = (portfolioByOwner[h.owner] || 0) + h.currentValue })
  const xirr = computeXIRRByOwner(txRows, portfolioByOwner)
  return { allHoldings, snapshotData, xirr }
}

// Primary bank account per owner — used in both data transform and rendering
const PRIMARY_ACCT = { Bryan: 'A005', Joint: 'A007', Nathan: 'A009', Natalie: 'A010' }

// ─── Banking data transform ───────────────────────────────────────────────────
function transformBankData({ bankTxRows, bankSummaryRows, bankBalanceRows, accountBalanceRows }) {
  const TX = { DATE: 1, ACCT: 2, OWNER: 3, TYPE: 5, CAT: 6, AMT: 7, REMARKS: 8 }

  const accountBalances = {}
  accountBalanceRows.slice(1).filter(r => r[0]).forEach(r => {
    accountBalances[String(r[0])] = toNum(r[2]) ?? 0
  })

  const allTx = bankTxRows.slice(1).filter(r => r[TX.DATE]).map(r => ({
    date: parseDate(r[TX.DATE]),
    acct: String(r[TX.ACCT] || ''),
    owner: String(r[TX.OWNER] || '').trim(),
    type: String(r[TX.TYPE] || ''),
    cat: String(r[TX.CAT] || ''),
    amt: toNum(r[TX.AMT]) ?? 0,
    remarks: String(r[TX.REMARKS] || ''),
  })).filter(t => t.date)

  // Pay period triggers per owner
  // Bryan: triggered by Salary landing in A005 (~24th each month)
  // Joint/Nathan/Natalie: fixed on the 24th of each month — same pay cycle start,
  //   no transaction trigger needed since Bryan's salary funds all downstream transfers.
  const TRIGGERS = {
    Bryan: t => t.acct === 'A005' && t.type === 'Income' && t.cat === 'Salary',
  }
  // Primary (bank) account per owner — defined at module level as PRIMARY_ACCT
  const TRIGGER_LABELS = {
    Bryan:   'Salary credited to A005',
    Joint:   'Pay period from 24th',
    Nathan:  'Pay period from 24th',
    Natalie: 'Pay period from 24th',
  }

  // Bryan: find most recent Salary transaction date as period start
  // Joint/Nathan/Natalie: compute the most recent 24th that has passed
  const today = new Date()
  const payPeriodStart = {}
  OWNERS.filter(o => o !== 'All Owners').forEach(owner => {
    if (owner === 'Bryan') {
      const fn = TRIGGERS.Bryan
      const match = allTx.filter(fn).sort((a, b) => b.date - a.date)
      if (match.length) payPeriodStart[owner] = match[0].date
    } else {
      // Use the 24th of the current month, or the 24th of last month if we haven't reached it yet
      const d = today.getDate() >= 24
        ? new Date(today.getFullYear(), today.getMonth(), 24)
        : new Date(today.getFullYear(), today.getMonth() - 1, 24)
      payPeriodStart[owner] = d
    }
  })

  const payPeriodData = {}
  OWNERS.filter(o => o !== 'All Owners').forEach(owner => {
    const start = payPeriodStart[owner]
    if (!start) {
      payPeriodData[owner] = { income: 0, bankCats: [], savCats: [], netSavings: 0,
        grossToSavings: 0, savingsReturns: [], periodStart: null, daysIn: 0,
        startLabel: '', triggerLabel: TRIGGER_LABELS[owner] }
      return
    }
    const daysIn = Math.floor((today - start) / (1000 * 60 * 60 * 24))
    const periodTx = allTx.filter(t => t.owner === owner && t.date >= start && t.date <= today)
    const startLabel = start.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })

    if (owner === 'Bryan') {
      // Bryan income = A005 Salary + Interest only.
      // Exclude Transfer (return from savings — already in savings box).
      // Exclude Others (used as 'Starting Balance' marker — pre-existing cash, not new income).
      // Exclude A006 income entirely (internal savings movements).
      const income = periodTx
        .filter(t => t.acct === 'A005' && t.type === 'Income'
          && t.cat !== 'Transfer' && t.cat !== 'Others')
        .reduce((s, t) => s + t.amt, 0)
      const grossToSavings = periodTx
        .filter(t => t.acct === 'A005' && t.type === 'Expense' && t.cat === 'Savings')
        .reduce((s, t) => s + Math.abs(t.amt), 0)
      // All A006 expenses reduce what stays in savings — Investment, Holiday, Transfer/Tax, Insurance etc.
      // Each line shown individually in the savings box, labelled by Remarks then Category
      const a006Expenses = periodTx.filter(t => t.acct === 'A006' && t.type === 'Expense')
      const savingsReturns = a006Expenses.map(t => ({ label: t.remarks || t.cat, amt: Math.abs(t.amt) }))
      const totalA006Out = a006Expenses.reduce((s, t) => s + Math.abs(t.amt), 0)
      const netSavings = grossToSavings - totalA006Out
      // Only Transfer-category A006 expenses physically return to A005 bank account.
      // Investment and Holiday are true outflows that leave the system entirely.
      const transfersBackToBank = a006Expenses
        .filter(t => t.cat === 'Transfer')
        .reduce((s, t) => s + Math.abs(t.amt), 0)
      const bankCatMap = {}
      periodTx.filter(t => t.acct === 'A005' && t.type === 'Expense' && t.cat !== 'Savings')
        .forEach(t => { bankCatMap[t.cat] = (bankCatMap[t.cat] || 0) + Math.abs(t.amt) })
      const savCatMap = {}
      periodTx.filter(t => t.acct === 'A006' && t.type === 'Expense' && t.cat !== 'Transfer')
        .forEach(t => { savCatMap[t.cat] = (savCatMap[t.cat] || 0) + Math.abs(t.amt) })
      payPeriodData[owner] = {
        income, grossToSavings, savingsReturns, netSavings, transfersBackToBank,
        bankCats: Object.entries(bankCatMap).map(([n,v])=>({n,v})).sort((a,b)=>b.v-a.v),
        savCats: Object.entries(savCatMap).map(([n,v])=>({n,v})).sort((a,b)=>b.v-a.v),
        periodStart: start, daysIn, startLabel, triggerLabel: TRIGGER_LABELS[owner],
      }
    } else {
      // Non-Bryan: period starts from the 24th (computed above), so periodTx already
      // captures all income and expenses from that date — no separate look-back needed.
      const primaryAcct = PRIMARY_ACCT[owner]
      const income = periodTx
        .filter(t => t.acct === primaryAcct && t.type === 'Income')
        .reduce((s, t) => s + t.amt, 0)
      const catMap = {}
      periodTx.filter(t => t.type === 'Expense')
        .forEach(t => { catMap[t.cat] = (catMap[t.cat] || 0) + Math.abs(t.amt) })
      payPeriodData[owner] = {
        income, grossToSavings: 0, savingsReturns: [], netSavings: 0,
        bankCats: Object.entries(catMap).map(([n,v])=>({n,v})).sort((a,b)=>b.v-a.v),
        savCats: [], periodStart: start, daysIn, startLabel, triggerLabel: TRIGGER_LABELS[owner],
      }
    }
  })

  // YTD from Bank_Tx directly — filter by transaction date in current year
  // More reliable than Bank_Summary which may be empty or have header rows
  const currentYear = new Date().getFullYear()
  const ytdData = {}
  OWNERS.filter(o => o !== 'All Owners').forEach(owner => {
    const catMap = {}
    allTx.filter(t => {
      if (t.owner !== owner) return false
      if (!t.date || t.date.getFullYear() !== currentYear) return false
      if (t.type !== 'Expense') return false
      // Exclude Bryan's internal transfers between his own accounts
      if (owner === 'Bryan' && t.acct === 'A005' && t.cat === 'Savings') return false
      if (owner === 'Bryan' && t.acct === 'A006' && t.cat === 'Transfer') return false
      return true
    }).forEach(t => {
      catMap[t.cat] = (catMap[t.cat] || 0) + Math.abs(t.amt)
    })
    ytdData[owner] = Object.entries(catMap).map(([n,v])=>({n,v})).sort((a,b)=>b.v-a.v)
  })

  // Savings MoM — A006 (Bryan) computed from Bank_Tx directly to capture true net savings
  // (Bank_Balance sheet can misalign when deposits and withdrawals fall in different months).
  // A008 (Joint) uses Bank_Balance as-is.
  const balRows = bankBalanceRows.slice(1).filter(r => r[0] && r[2])
  const savingsHistory = {}

  // Bryan A006: bars show monthly net flow excluding starting capital ('Others' income lump).
  // Running balance line includes ALL transactions so it reflects true account value.
  const a006Tx = allTx.filter(t => t.acct === 'A006').sort((a, b) => a.date - b.date)
  const a006MonthMap = {}
  a006Tx.forEach(t => {
    if (!t.date) return
    const yr = t.date.getFullYear()
    const mo = t.date.getMonth() + 1
    const key = yr + '-' + String(mo).padStart(2, '0')
    if (!a006MonthMap[key]) a006MonthMap[key] = { year: yr, month: mo, flow: 0, balanceDelta: 0 }
    const delta = (t.type === 'Income' ? 1 : -1) * Math.abs(t.amt)
    a006MonthMap[key].balanceDelta += delta
    // Exclude 'Others' income (starting capital one-off) from the flow bar
    if (!(t.type === 'Income' && t.cat === 'Others')) {
      a006MonthMap[key].flow += delta
    }
  })
  let a006Running = 0
  savingsHistory['A006'] = Object.values(a006MonthMap)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .map(m => {
      a006Running += m.balanceDelta
      return { label: monthLabel(m.year, m.month), flow: Math.round(m.flow), balance: Math.round(a006Running) }
    })

  // All other savings accounts (A008 Joint): same pattern as A006.
  // Flow bars exclude 'Others' category income (one-off starting balance lump).
  // Running balance line includes ALL transactions for true account value.
  SAVINGS_ACCOUNTS.filter(sa => sa.id !== 'A006').forEach(sa => {
    const acctTx = allTx.filter(t => t.acct === sa.id).sort((a, b) => a.date - b.date)
    const monthMap = {}
    acctTx.forEach(t => {
      if (!t.date) return
      const yr = t.date.getFullYear()
      const mo = t.date.getMonth() + 1
      const key = yr + '-' + String(mo).padStart(2, '0')
      if (!monthMap[key]) monthMap[key] = { year: yr, month: mo, flow: 0, balanceDelta: 0 }
      const delta = (t.type === 'Income' ? 1 : -1) * Math.abs(t.amt)
      monthMap[key].balanceDelta += delta
      // Exclude 'Others' income (starting capital) from flow bar — same logic as A006
      if (!(t.type === 'Income' && t.cat === 'Others')) {
        monthMap[key].flow += delta
      }
    })
    let running = 0
    savingsHistory[sa.id] = Object.values(monthMap)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
      .map(m => {
        running += m.balanceDelta
        return { label: monthLabel(m.year, m.month), flow: Math.round(m.flow), balance: Math.round(running) }
      })
  })

  return { accountBalances, payPeriodData, ytdData, savingsHistory }
}

function monthLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-SG', { month: 'short', year: '2-digit' })
}

// ─── Combined data hook ────────────────────────────────────────────────────────
const isMockMode = () => SHEET_ID === 'YOUR_SHEET_ID_HERE' || API_KEY === 'YOUR_API_KEY_HERE'

// Mock Holiday Fund rows — same structure as Google Sheets (header + data rows)
function getMockHolidayRows() {
  // Row structure: [SN, Date, Account, Type, Amount, Holiday Year, Trip, Remarks]
  const header = ['SN','Date','Account','Type','Amount','Holiday Year','Trip','Remarks']
  const rows = [
    [1,'2023-07-01','A011','Deposit',1500,2023,null,null],
    [2,'2023-08-01','A011','Deposit',1500,2023,null,null],
    [3,'2023-09-01','A011','Deposit',1500,2023,null,null],
    [4,'2023-10-01','A011','Deposit',1500,2023,null,null],
    [5,'2023-11-01','A011','Deposit',1500,2023,null,null],
    [6,'2023-12-01','A011','Deposit',1500,2023,null,null],
    [7,'2023-12-22','A011','Deposit',8000,2023,null,'Bryan AWS'],
    [8,'2024-01-02','A011','Deposit',1500,2024,null,null],
    [9,'2024-02-02','A011','Deposit',1500,2024,null,null],
    [10,'2024-02-24','A011','Deposit',5000,2024,null,'Bryan Sign On Bonus'],
    [11,'2024-03-01','A011','Deposit',1500,2024,null,null],
    [12,'2024-04-01','A011','Deposit',1500,2024,null,null],
    [13,'2024-04-26','A011','Deposit',10000,2024,null,'Bryan Annual Bonus'],
    [14,'2024-05-01','A011','Deposit',1500,2024,null,null],
    [15,'2024-06-02','A011','Deposit',1500,2024,null,null],
    [16,'2024-07-01','A011','Deposit',1500,2024,null,null],
    [17,'2024-07-24','A011','Deposit',5000,2024,null,'Jade Bonus'],
    [18,'2024-08-01','A011','Deposit',1500,2024,null,null],
    [19,'2024-09-02','A011','Deposit',1500,2024,null,null],
    [20,'2024-10-01','A011','Deposit',1500,2024,null,null],
    [21,'2024-11-01','A011','Deposit',1500,2024,null,null],
    [22,'2024-12-01','A011','Deposit',1500,2024,null,null],
    [23,'2024-12-25','A011','Deposit',8000,2024,null,'Bryan AWS'],
    [24,'2025-01-02','A011','Deposit',1500,2025,null,null],
    [25,'2025-02-01','A011','Deposit',1500,2025,null,null],
    [26,'2025-03-03','A011','Deposit',1500,2025,null,null],
    [27,'2025-03-29','A011','Deposit',10000,2025,null,'Bryan Annual Bonus'],
    [28,'2025-04-01','A011','Deposit',1500,2025,null,null],
    [29,'2025-05-02','A011','Deposit',1500,2025,null,null],
    [30,'2025-06-02','A011','Deposit',1500,2025,null,null],
    [31,'2025-07-01','A011','Deposit',1500,2025,null,null],
    [32,'2025-08-01','A011','Deposit',1500,2025,null,null],
    [33,'2025-09-01','A011','Deposit',1500,2025,null,null],
    [34,'2025-10-01','A011','Deposit',1500,2025,null,null],
    [35,'2025-11-03','A011','Deposit',1500,2025,null,null],
    [36,'2025-12-01','A011','Deposit',1500,2025,null,null],
    [37,'2025-12-24','A011','Deposit',6000,2025,null,'Bryan AWS'],
    [38,'2026-01-02','A011','Deposit',1500,2026,null,null],
    [39,'2026-02-02','A011','Deposit',1500,2026,null,null],
    [40,'2026-03-01','A011','Deposit',1500,2026,null,null],
    // Expenses — keyed on Holiday Year (col F), not transaction date
    [41,'2023-07-15','A011','Expense',-184.74,2023,'Penang','Penang & Klang Jul 23 Cruise'],
    [42,'2023-09-10','A011','Expense',-1101.48,2023,'Vietnam','Vietnam'],
    [43,'2023-12-09','A011','Expense',-700,2023,'Bangkok','Bangkok'],
    [44,'2023-12-22','A011','Expense',-382.30,2023,'Bangkok','Bangkok'],
    [45,'2023-12-22','A011','Expense',-3013.85,2023,'Bangkok','Bangkok'],
    [46,'2023-12-22','A011','Expense',-43.70,2023,'Bangkok','Bangkok'],
    [47,'2023-12-24','A011','Expense',-317,2023,'Bangkok','Bangkok'],
    [48,'2024-01-13','A011','Expense',-5105.60,2024,'Brisbane','Brisbane Air Ticket'],
    [49,'2024-03-24','A011','Expense',-746.99,2024,'Singapore','JW Marriott Singapore'],
    [50,'2024-04-21','A011','Expense',-1387.24,2024,'Singapore','W Singapore'],
    [51,'2024-06-22','A011','Expense',-1207.99,2024,'Bali','Bali'],
    [52,'2024-06-22','A011','Expense',-468.41,2024,'Bali','Bali'],
    [53,'2024-06-22','A011','Expense',-75.86,2024,'Bali','Bali'],
    [54,'2024-06-22','A011','Expense',-51.30,2024,'Bali','Bali'],
    [55,'2024-06-22','A011','Expense',-1728.90,2024,'Others','Marriott Points'],
    [56,'2024-07-09','A011','Expense',-140.33,2024,'Brisbane','Brisbane'],
    [57,'2024-08-17','A011','Expense',-594.85,2024,'Phuket','Phuket'],
    [58,'2024-08-24','A011','Expense',-357.78,2024,'Malaysia','Malaysia'],
    [59,'2024-08-09','A011','Expense',-3097.59,2024,'Malaysia','Malaysia'],
    [60,'2024-09-22','A011','Expense',-5026.52,2024,'Brisbane','Brisbane'],
    [61,'2024-11-03','A011','Expense',-810.10,2024,'Brisbane','Brisbane'],
    [62,'2024-11-17','A011','Expense',-801.94,2024,'Hong Kong','HK'],
    [63,'2024-11-23','A011','Expense',-1268.63,2024,'Brisbane','Brisbane'],
    [64,'2024-11-29','A011','Expense',-4660,2024,'Brisbane','Brisbane'],
    [65,'2024-12-14','A011','Expense',-385.26,2024,'Brisbane','Brisbane'],
    [66,'2024-12-14','A011','Expense',-3125.09,2024,'Brisbane','Brisbane'],
    [67,'2024-12-14','A011','Expense',-1133.08,2024,'Brisbane','Brisbane'],
    [68,'2024-12-22','A011','Expense',-307.88,2024,'Brisbane','Brisbane'],
    [69,'2024-12-22','A011','Expense',-182,2024,'Brisbane','Brisbane'],
    [70,'2024-10-15','A011','Expense',-1520.80,2024,'Bali','Bali Air Ticket'],
    [71,'2023-12-02','A011','Expense',-781.60,2024,'Phuket','Phuket Air Ticket'],
    [72,'2023-10-15','A011','Expense',-447,2024,'Brisbane','Deposit Brisbane Cruise'],
    [73,'2025-01-04','A011','Expense',-44.57,2024,'Brisbane','Brisbane'],
    [74,'2024-07-14','A011','Expense',-5916.20,2025,'UK','UK Air Tickets'],
    [75,'2024-12-25','A011','Expense',-2516,2025,'UK','UK'],
    [76,'2025-02-25','A011','Expense',-1451.19,2025,'UK','UK'],
    [77,'2025-03-07','A011','Expense',-124.20,2025,'Singapore','W Singapore'],
    [78,'2025-03-15','A011','Expense',-1402.32,2025,'Singapore','W Singapore'],
    [79,'2025-03-15','A011','Expense',-378.24,2025,'UK','UK'],
    [80,'2025-04-04','A011','Expense',-62.60,2025,'Singapore','St Regis'],
    [81,'2025-04-04','A011','Expense',-2084.89,2025,'Vietnam','Vietnam'],
    [82,'2025-05-01','A011','Expense',-1164.23,2025,'Singapore','Westin'],
    [83,'2025-05-12','A011','Expense',-2000,2025,'UK','UK'],
    [84,'2025-05-16','A011','Expense',-540.70,2025,'UK','UK'],
    [85,'2025-05-23','A011','Expense',-2550,2025,'UK','UK'],
    [86,'2025-05-31','A011','Expense',-292.02,2025,'UK','UK'],
    [87,'2025-05-31','A011','Expense',-478.40,2025,'Singapore','JW Marriott'],
    [88,'2025-06-05','A011','Expense',-300,2025,'UK','UK'],
    [89,'2025-06-07','A011','Expense',-161.87,2025,'UK','UK'],
    [90,'2025-06-11','A011','Expense',-3000,2025,'UK','UK'],
    [91,'2025-06-22','A011','Income',165.28,2025,'UK','UK refund'],
    [92,'2025-06-22','A011','Expense',-2880.31,2025,'UK','UK'],
    [93,'2025-06-26','A011','Income',768,2025,'UK','UK refund'],
    [94,'2025-06-28','A011','Income',1000,2025,'UK','UK refund'],
    [95,'2025-06-29','A011','Expense',-1880,2025,'UK','UK'],
    [96,'2025-07-28','A011','Expense',-500,2025,'Malaysia','Malaysia'],
    [97,'2025-11-02','A011','Expense',-962.60,2026,'Vietnam','Danang'],
    [98,'2025-10-15','A011','Expense',-2000,2026,'NZ','NZ'],
    [99,'2025-11-05','A011','Expense',-2000,2026,'NZ','NZ'],
    [100,'2025-11-22','A011','Expense',-272.80,2026,'Hong Kong','Hong Kong'],
    [101,'2025-11-29','A011','Expense',-1841.60,2026,'Bangkok','Bangkok'],
    [102,'2025-11-29','A011','Expense',-68.93,2025,'Vietnam','Vietnam'],
    [103,'2025-12-14','A011','Expense',-1100,2025,'Vietnam','Vietnam'],
    [104,'2025-12-21','A011','Expense',-1683.16,2025,'Vietnam','Vietnam'],
    [105,'2025-12-21','A011','Expense',-197.15,2026,'NZ','NZ'],
    [106,'2025-12-24','A011','Expense',-710.68,2025,'Vietnam','Vietnam'],
    [107,'2025-12-31','A011','Expense',-1207.94,2025,'Singapore','St Regis'],
    [108,'2025-11-14','A011','Expense',-2015.02,2025,'Koh Samui','Koh Samui'],
    [109,'2026-03-07','A011','Expense',-4840.40,2026,'NZ','NZ'],
  ]
  return [header, ...rows]
}

function getMockInvData() {
  // Raw snapshots: [date-string, Bryan, Joint, Nathan, Natalie, SP500-close]
  // These are illustrative — update with real brokerage values if you have them.
  const rawSnap = [
    ['2025-11-30', 175000,  375000,  90000,  85000, 5910],
    ['2025-12-31', 180200,  384500,  93500,  87300, 5882],
    ['2026-01-31', 187600,  402000,  98100,  92200, 6141],
    ['2026-02-28', 191200,  412500, 104200,  97600, 5955],
    ['2026-03-31', 183500,  396000, 101300,  94100, 5612],
    ['2026-04-18', 197062,  420245, 107354,  99272, 5300],
  ]
  const ownerCols = { Bryan: 1, Joint: 2, Nathan: 3, Natalie: 4 }

  const snapshotData = rawSnap.map((r, i) => {
    const date  = new Date(r[0])
    const label = date.toLocaleDateString('en-SG', { month: 'short', year: '2-digit' })
    const prev  = i > 0 ? rawSnap[i - 1] : null
    const first = rawSnap[0]
    const row   = { date: label }

    Object.entries(ownerCols).forEach(([owner, col]) => {
      const v = r[col]
      const p = prev ? prev[col] : v
      const f = first[col]
      row[`${owner}_value`]   = v
      row[`${owner}_ret`]     = p > 0 ? +((v / p - 1) * 100).toFixed(2) : 0
      row[`${owner}_indexed`] = f > 0 ? +((v / f) * 100).toFixed(2) : 100
      row[`${owner}_gain`]    = v - f
    })

    const sp = r[5], sp_p = prev ? prev[5] : sp, sp_f = first[5]
    row.sp500         = sp
    row.sp500_ret     = sp_p > 0 ? +((sp / sp_p - 1) * 100).toFixed(2) : 0
    row.sp500_indexed = sp_f > 0 ? +((sp / sp_f) * 100).toFixed(2) : 100
    return row
  })

  return {
    allHoldings: [
      { ticker: 'CSPX',                       owner: 'Bryan',   assetClass: 'ETF',    costBasis: 18714,  currentValue: 24341,  gainLoss: 5627,   gainPct: 30.1,  dayChangePct: 1.38  },
      { ticker: 'Dimensional World 80/20_SGD', owner: 'Bryan',   assetClass: 'Fund',   costBasis: 43000,  currentValue: 51949,  gainLoss: 8949,   gainPct: 20.8,  dayChangePct: null  },
      { ticker: 'LON:EXUS',                   owner: 'Bryan',   assetClass: 'ETF',    costBasis: 19107,  currentValue: 20598,  gainLoss: 1491,   gainPct: 7.8,   dayChangePct: 1.61  },
      { ticker: 'D05',                         owner: 'Bryan',   assetClass: 'Equity', costBasis: 12475,  currentValue: 17175,  gainLoss: 4700,   gainPct: 37.7,  dayChangePct: null  },
      { ticker: 'S68',                         owner: 'Bryan',   assetClass: 'Equity', costBasis: 12259,  currentValue: 17064,  gainLoss: 4805,   gainPct: 39.2,  dayChangePct: null  },
      { ticker: 'NVO',                         owner: 'Bryan',   assetClass: 'Equity', costBasis: 21253,  currentValue: 15439,  gainLoss: -5813,  gainPct: -27.4, dayChangePct: -1.00 },
      { ticker: 'IWQU',                        owner: 'Bryan',   assetClass: 'ETF',    costBasis: 12780,  currentValue: 13382,  gainLoss: 602,    gainPct: 4.7,   dayChangePct: 1.12  },
      { ticker: 'Cash',                        owner: 'Bryan',   assetClass: 'Cash',   costBasis: 8737,   currentValue: 8737,   gainLoss: 0,      gainPct: 0,     dayChangePct: null  },
      { ticker: 'HKG:0700',                   owner: 'Joint',   assetClass: 'Equity', costBasis: 18036,  currentValue: 33094,  gainLoss: 15058,  gainPct: 83.5,  dayChangePct: -1.26 },
      { ticker: 'O39',                         owner: 'Joint',   assetClass: 'Equity', costBasis: 29811,  currentValue: 40896,  gainLoss: 11085,  gainPct: 37.2,  dayChangePct: null  },
      { ticker: 'Joint_iFAST DPMS',            owner: 'Joint',   assetClass: 'Fund',   costBasis: 50212,  currentValue: 60772,  gainLoss: 10560,  gainPct: 21.0,  dayChangePct: null  },
      { ticker: 'Cash',                        owner: 'Joint',   assetClass: 'Cash',   costBasis: 76193,  currentValue: 76193,  gainLoss: 0,      gainPct: 0,     dayChangePct: null  },
      { ticker: 'Nathan_iFAST DPMS',           owner: 'Nathan',  assetClass: 'Fund',   costBasis: 44700,  currentValue: 51737,  gainLoss: 7037,   gainPct: 15.7,  dayChangePct: null  },
      { ticker: 'CSPX',                        owner: 'Nathan',  assetClass: 'ETF',    costBasis: 16582,  currentValue: 20446,  gainLoss: 3864,   gainPct: 23.3,  dayChangePct: 1.38  },
      { ticker: 'Cash',                        owner: 'Nathan',  assetClass: 'Cash',   costBasis: 195,    currentValue: 195,    gainLoss: 0,      gainPct: 0,     dayChangePct: null  },
      { ticker: 'Natalie_iFAST DPMS',          owner: 'Natalie', assetClass: 'Fund',   costBasis: 36500,  currentValue: 43164,  gainLoss: 6664,   gainPct: 18.3,  dayChangePct: null  },
      { ticker: 'CSPX',                        owner: 'Natalie', assetClass: 'ETF',    costBasis: 15160,  currentValue: 18499,  gainLoss: 3339,   gainPct: 22.0,  dayChangePct: 1.38  },
      { ticker: 'Cash',                        owner: 'Natalie', assetClass: 'Cash',   costBasis: 263,    currentValue: 263,    gainLoss: 0,      gainPct: 0,     dayChangePct: null  },
    ],
    snapshotData,
    xirr: [
      { owner: 'Bryan',   xirr: 40.4, value: 197062 },
      { owner: 'Joint',   xirr: 24.1, value: 420245 },
      { owner: 'Nathan',  xirr: 22.6, value: 107354 },
      { owner: 'Natalie', xirr: 19.8, value: 99272  },
    ],
  }
}

function getMockBankData() {
  const today = new Date()
  const bryPay = new Date(today.getFullYear(), 1, 24)
  const othPay = new Date(today.getFullYear(), 1, 28)
  const dB = Math.max(0, Math.floor((today - bryPay) / 86400000))
  const dO = Math.max(0, Math.floor((today - othPay) / 86400000))
  return {
    accountBalances: { A005: 1207.40, A006: 13950, A007: 3005.76, A008: 11189.21, A009: 619.98, A010: 4524.10 },
    payPeriodData: {
      Bryan: {
        income: 17881.05, daysIn: dB, startLabel: '24 Feb 2026', // Salary + Interest only, excludes $355 starting balance
        grossToSavings: 4750,
        // All A006 outflows: Investment to iFAST, Holiday to OCBC, Tax transfer back to A005
        savingsReturns: [
          { label: 'Transfer to IFAST', amt: 1000 },
          { label: 'Transfer to OCBC', amt: 1500 },
          { label: 'Tax', amt: 1100 },
        ],
        netSavings: 1150,
        bankCats: [
          { n: 'House', v: 9750 }, { n: 'Tax', v: 2872.57 }, { n: 'Insurance', v: 208.30 },
          { n: 'Parents', v: 300 }, { n: 'Subscription', v: 87.72 }, { n: 'Food', v: 76.18 },
          { n: 'Phone', v: 18 }, { n: 'Transport', v: 4.04 }, { n: 'Miscellaneous', v: 10 }, { n: 'Car', v: 1.14 },
        ],
        savCats: [{ n: 'Holiday', v: 1500 }, { n: 'Investment', v: 1000 }],
        triggerLabel: 'Salary credited to A005',
      },
      Joint: {
        income: 22500, daysIn: dO, startLabel: '28 Feb 2026',
        grossToSavings: 0, savingsReturns: [], netSavings: 0,
        bankCats: [
          { n: 'Mortgage', v: 9234 }, { n: 'Loan', v: 2000 }, { n: 'Kids', v: 3600 },
          { n: 'Holiday', v: 1500 }, { n: 'Investment', v: 1500 }, { n: 'Tax', v: 490 },
          { n: 'Food', v: 166.54 }, { n: 'Groceries', v: 108.55 }, { n: 'Subscription', v: 79.78 },
          { n: 'House', v: 219 }, { n: 'Others', v: 384.41 }, { n: 'Savings', v: 100 }, { n: 'Car', v: 100 },
        ],
        savCats: [], triggerLabel: "Bryan's transfer received in A007",
      },
      Nathan: {
        income: 3169.08, daysIn: dO, startLabel: '28 Feb 2026',
        grossToSavings: 0, savingsReturns: [], netSavings: 0,
        bankCats: [{ n: 'Tuition', v: 1719.10 }, { n: 'CCA', v: 680 }, { n: 'Investment', v: 150 }],
        savCats: [], triggerLabel: 'Parents allowance received in A009',
      },
      Natalie: {
        income: 6345.40, daysIn: dO, startLabel: '28 Feb 2026',
        grossToSavings: 0, savingsReturns: [], netSavings: 0,
        bankCats: [{ n: 'CCA', v: 830 }, { n: 'Tuition', v: 791.30 }, { n: 'Investment', v: 200 }],
        savCats: [], triggerLabel: 'Parents allowance received in A010',
      },
    },
    ytdData: {
      Bryan: [
        { n: 'House', v: 9750 }, { n: 'Tax', v: 2872.57 }, { n: 'Insurance', v: 253.25 },
        { n: 'Holiday', v: 1500 }, { n: 'Investment', v: 1000 }, { n: 'Parents', v: 300 },
        { n: 'Subscription', v: 87.72 }, { n: 'Food', v: 198 }, { n: 'Phone', v: 18 },
        { n: 'Transport', v: 12 }, { n: 'Miscellaneous', v: 30 }, { n: 'Car', v: 1.14 },
      ],
      Joint: [
        { n: 'Mortgage', v: 9234 }, { n: 'Kids', v: 3600 }, { n: 'Loan', v: 2000 },
        { n: 'Others', v: 384.41 }, { n: 'Holiday', v: 1500 }, { n: 'Investment', v: 1500 },
        { n: 'Tax', v: 490 }, { n: 'Food', v: 166.54 }, { n: 'Groceries', v: 108.55 },
        { n: 'House', v: 219 }, { n: 'Subscription', v: 79.78 }, { n: 'Car', v: 100 }, { n: 'Savings', v: 100 },
      ],
      Nathan: [{ n: 'Tuition', v: 1719.10 }, { n: 'CCA', v: 680 }, { n: 'Investment', v: 150 }],
      Natalie: [{ n: 'CCA', v: 830 }, { n: 'Tuition', v: 791.30 }, { n: 'Investment', v: 200 }],
    },
    savingsHistory: {
      // A006: flow excludes starting capital, balance includes all
      // Feb flow = +$4750 (deposit only), balance = $17550 (incl $12800 starting capital)
      // Mar flow = -$3600 (outflows), balance = $13950
      A006: [{ label: 'Feb 26', flow: 4750, balance: 17550 }, { label: 'Mar 26', flow: -3600, balance: 13950 }],
      // A008: flow excludes starting capital $8969, balance includes all
      // Feb flow = +$1900 (Transfer deposit only), balance = $10,869
      // Mar flow = +$320, balance = $11,189
      A008: [{ label: 'Feb 26', flow: 1900, balance: 10869 }, { label: 'Mar 26', flow: 320, balance: 11189 }],
    },
  }
}



// ─── House Fund transform ─────────────────────────────────────────────────────
function transformHouseData({ houseRows }) {
  // Cols (0-based): SN|Date|Account|Type|Category|Amount|Remarks
  const H = { DATE: 1, TYPE: 3, CAT: 4, AMT: 5 }

  const currentYear = new Date().getFullYear()
  const rows = houseRows.slice(1).filter(r => r[H.TYPE])

  // ── YTD: transaction date in current year ────────────────────────────────
  const ytdSaved = rows
    .filter(r => {
      const d = parseDate(r[H.DATE])
      return d && d.getFullYear() === currentYear &&
        (String(r[H.TYPE]) === 'Deposit' || String(r[H.TYPE]) === 'Income')
    })
    .reduce((s, r) => s + (toNum(r[H.AMT]) ?? 0), 0)

  const ytdSpent = rows
    .filter(r => {
      const d = parseDate(r[H.DATE])
      return d && d.getFullYear() === currentYear && String(r[H.TYPE]) === 'Expense'
    })
    .reduce((s, r) => s + Math.abs(toNum(r[H.AMT]) ?? 0), 0)

  // ── Category breakdown for current year ──────────────────────────────────
  const currentYearCats = (() => {
    const map = {}
    rows.filter(r => {
      const d = parseDate(r[H.DATE])
      return d && d.getFullYear() === currentYear && String(r[H.TYPE]) === 'Expense'
    }).forEach(r => {
      const cat = String(r[H.CAT] || 'Other').trim()
      map[cat] = (map[cat] || 0) + Math.abs(toNum(r[H.AMT]) ?? 0)
    })
    return Object.entries(map).map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v)
  })()

  // ── Annual chart: all years, grouped by transaction year + category ───────
  const allYears = [...new Set(rows.filter(r => r[H.DATE]).map(r => {
    const d = parseDate(r[H.DATE])
    return d ? d.getFullYear() : null
  }).filter(Boolean))].sort()

  // All-time category totals for sort order (highest = bottom of stack)
  const allCatTotals = {}
  rows.filter(r => String(r[H.TYPE]) === 'Expense').forEach(r => {
    const cat = String(r[H.CAT] || 'Other').trim()
    allCatTotals[cat] = (allCatTotals[cat] || 0) + Math.abs(toNum(r[H.AMT]) ?? 0)
  })
  const catSortOrder = Object.entries(allCatTotals)
    .sort((a, b) => b[1] - a[1]).map(([c]) => c)

  // Per-year-per-category spend map
  const yearCatData = {}
  allYears.forEach(yr => { yearCatData[yr] = {} })
  rows.filter(r => String(r[H.TYPE]) === 'Expense').forEach(r => {
    const d = parseDate(r[H.DATE])
    if (!d) return
    const yr = d.getFullYear()
    const cat = String(r[H.CAT] || 'Other').trim()
    yearCatData[yr][cat] = (yearCatData[yr][cat] || 0) + Math.abs(toNum(r[H.AMT]) ?? 0)
  })

  // Year totals for bar labels
  const yearTotals = {}
  allYears.forEach(yr => {
    yearTotals[yr] = Object.values(yearCatData[yr]).reduce((s, v) => s + v, 0)
  })

  // Saved per year (Deposit + Income)
  const yearSaved = {}
  allYears.forEach(yr => { yearSaved[yr] = 0 })
  rows.filter(r => String(r[H.TYPE]) === 'Deposit' || String(r[H.TYPE]) === 'Income').forEach(r => {
    const d = parseDate(r[H.DATE])
    if (!d) return
    const yr = d.getFullYear()
    yearSaved[yr] = (yearSaved[yr] || 0) + (toNum(r[H.AMT]) ?? 0)
  })

  // Avg annual spend (exclude current year)
  const completeYears = allYears.filter(y => y < currentYear)
  const avgAnnual = completeYears.length
    ? Math.round(completeYears.reduce((s, y) => s + (yearTotals[y] || 0), 0) / completeYears.length)
    : 0

  return {
    ytdSaved, ytdSpent, currentYearCats, avgAnnual,
    allYears, yearCatData, yearTotals, yearSaved, catSortOrder,
  }
}

// Dynamic colour palette for house categories
// Covers known categories; unknown ones get a fallback from the extended palette
const HOUSE_CAT_COLORS = {
  House: '#3b82f6', Car: '#f59e0b', Helper: '#10b981', Misc: '#94a3b8',
  Interest: '#a78bfa', Deposit: '#34d399', Renovation: '#ef4444',
  Garden: '#059669', Insurance: '#64748b', Appliance: '#0ea5e9',
}
const HOUSE_FALLBACK_COLORS = [
  '#6366f1','#ec4899','#06b6d4','#84cc16','#f97316','#8b5cf6','#14b8a6',
]
const houseCatColorCache = {}
let houseFallbackIdx = 0
function houseCatColor(name) {
  if (HOUSE_CAT_COLORS[name]) return HOUSE_CAT_COLORS[name]
  if (!houseCatColorCache[name]) {
    houseCatColorCache[name] = HOUSE_FALLBACK_COLORS[houseFallbackIdx % HOUSE_FALLBACK_COLORS.length]
    houseFallbackIdx++
  }
  return houseCatColorCache[name]
}

function getMockHouseRows() {
  const header = ['SN','Date','Account','Type','Category','Amount','Remarks']
  const rows = [
    [1,'2024-01-02','A012','Deposit','Deposit',4753.91,'Starting Balance'],
    [2,'2024-01-02','A012','Deposit','Deposit',1500,null],[3,'2024-02-01','A012','Deposit','Deposit',1500,null],
    [4,'2024-03-01','A012','Deposit','Deposit',1500,null],[5,'2024-04-01','A012','Deposit','Deposit',1500,null],
    [6,'2024-05-01','A012','Deposit','Deposit',1500,null],[7,'2024-06-01','A012','Deposit','Deposit',1500,null],
    [8,'2024-07-01','A012','Deposit','Deposit',1500,null],[9,'2024-08-01','A012','Deposit','Deposit',1500,null],
    [10,'2024-09-01','A012','Deposit','Deposit',1500,null],[11,'2024-10-01','A012','Deposit','Deposit',1500,null],
    [12,'2024-11-01','A012','Deposit','Deposit',1500,null],[13,'2024-12-01','A012','Deposit','Deposit',1500,null],
    [14,'2025-01-02','A012','Deposit','Deposit',1500,null],[15,'2025-02-02','A012','Deposit','Deposit',1500,null],
    [16,'2025-03-02','A012','Deposit','Deposit',1500,null],[17,'2025-04-01','A012','Deposit','Deposit',1500,null],
    [18,'2025-05-01','A012','Deposit','Deposit',1500,null],[19,'2025-06-01','A012','Deposit','Deposit',1500,null],
    [20,'2025-07-01','A012','Deposit','Deposit',1500,null],[21,'2025-08-01','A012','Deposit','Deposit',1500,null],
    [22,'2025-09-01','A012','Deposit','Deposit',1500,null],[23,'2025-10-01','A012','Deposit','Deposit',1500,null],
    [24,'2025-11-01','A012','Deposit','Deposit',1500,null],[25,'2025-12-01','A012','Deposit','Deposit',1500,null],
    [26,'2026-01-01','A012','Deposit','Deposit',1500,null],[27,'2026-02-01','A012','Deposit','Deposit',1500,null],
    [28,'2026-03-01','A012','Deposit','Deposit',1500,null],
    // Expenses
    [29,'2024-03-20','A012','Expense','Car',-511.54,'Car Servicing'],
    [30,'2024-04-06','A012','Expense','Helper',-381.00,"Nancy's Air Tickets"],
    [31,'2024-05-12','A012','Expense','Helper',-975.00,"Nancy's Insurance"],
    [32,'2024-07-13','A012','Expense','House',-124.00,'Dolphin Machine GST'],
    [33,'2024-07-20','A012','Expense','House',-145.00,'Gardener'],
    [34,'2024-07-20','A012','Expense','Car',-375.00,'LTA EV Charger'],
    [35,'2024-08-04','A012','Expense','Misc',-417.20,'Aladdin Concert Tickets'],
    [36,'2024-08-04','A012','Expense','House',-250.00,"Worker's Ang Pow"],
    [37,'2024-08-07','A012','Expense','House',-1260.04,'Ecoline Servicing'],
    [38,'2024-08-17','A012','Expense','Car',-2277.71,'Car Insurance 2024-2026'],
    [39,'2024-08-23','A012','Expense','House',-80.00,'Plumber'],
    [40,'2024-08-23','A012','Expense','Car',-398.00,'Ceramic Coating'],
    [41,'2024-09-07','A012','Expense','Car',-95.00,'Car Wash'],
    [42,'2024-10-12','A012','Expense','House',-337.90,'Alfrex Water Servicing'],
    [43,'2024-10-27','A012','Expense','House',-18.00,"Nancy's Light"],
    [44,'2024-11-22','A012','Expense','Car',-48.00,'Car Wash'],
    [45,'2024-11-24','A012','Expense','House',-695.86,'Fire Insurance Chubbs'],
    [46,'2024-11-24','A012','Expense','House',-542.59,'Fire Insurance GE'],
    [47,'2024-11-29','A012','Expense','House',-130.80,'Aircon Leak'],
    [48,'2024-12-14','A012','Expense','House',-398.70,'Coffee Machine Service'],
    [49,'2024-12-31','A012','Expense','House',-799.00,'Steigen Laundry System'],
    [50,'2025-01-01','A012','Expense','House',-323.46,'Philips Dehumidifier'],
    [51,'2025-01-03','A012','Expense','House',-2256.00,'Entertainment Rm Sofa'],
    [52,'2025-01-12','A012','Expense','House',-390.00,'Window Film'],
    [53,'2025-01-15','A012','Expense','House',-313.00,'Philips Dehumidifier'],
    [54,'2025-01-20','A012','Expense','House',-125.00,'Service Stove'],
    [55,'2025-01-22','A012','Expense','House',-1227.82,'Repair Stove'],
    [56,'2025-02-25','A012','Expense','House',-163.95,'Control4 Annual'],
    [57,'2025-03-15','A012','Expense','House',-234.35,'LG Washing Machine Repair'],
    [58,'2025-03-22','A012','Expense','Helper',-356.40,"Nancy's Air Tickets"],
    [59,'2025-04-04','A012','Expense','House',-2255.90,'Entertainment Rm Sofa'],
    [60,'2025-04-18','A012','Expense','House',-200.43,'Hasegawa Chopping Board'],
    [61,'2025-04-19','A012','Expense','House',-80.00,'Sofa delivery'],
    [62,'2025-05-04','A012','Expense','Misc',-7.56,'Transfer to Mortgage'],
    [63,'2025-05-04','A012','Expense','House',-410.00,'TV Console'],
    [64,'2025-05-23','A012','Expense','Helper',-200.00,'Nancy going home'],
    [65,'2025-06-01','A012','Expense','House',-280.00,'Entertainment Room Curtain'],
    [66,'2025-07-20','A012','Expense','Car',-1902.00,'Road Tax'],
    [67,'2025-08-01','A012','Expense','House',-100.00,'Gardener'],
    [68,'2025-08-08','A012','Expense','House',-92.65,'LG Washing Machine Repair'],
    [69,'2025-09-14','A012','Expense','House',-120.80,'Taobao House Stuff'],
    [70,'2025-09-18','A012','Expense','House',-337.90,'Alfrex Water Servicing'],
    [71,'2025-09-24','A012','Expense','House',-880.00,'Aircon Servicing Contract'],
    [72,'2025-10-03','A012','Expense','House',-739.50,'Replace Swisspro Compressor'],
    [73,'2025-10-08','A012','Expense','House',-340.00,'Balmuda Toaster'],
    [74,'2025-10-08','A012','Expense','House',-473.20,'Solar Service'],
    [75,'2025-11-28','A012','Expense','Misc',-2.00,'Transfer to Mortgage'],
    [76,'2025-12-24','A012','Expense','House',-310.11,'Transformer'],
    [77,'2025-12-26','A012','Expense','Car',-148.00,'Car Spa'],
    [78,'2026-03-07','A012','Expense','House',-157.11,'Control4 Annual'],
    [79,'2026-03-07','A012','Expense','Helper',-379.50,"Nancy's Air Tickets"],
    // Interest income
    [80,'2024-09-30','A012','Income','Interest',1.29,null],[81,'2024-10-31','A012','Income','Interest',1.24,null],
    [82,'2024-11-30','A012','Income','Interest',1.25,null],[83,'2024-12-31','A012','Income','Interest',1.04,null],
    [84,'2025-02-01','A012','Income','Interest',1.08,null],[85,'2025-03-01','A012','Income','Interest',1.02,null],
    [86,'2025-03-06','A012','Expense','Misc',-2.00,'statement fees'],
    [87,'2025-03-30','A012','Income','Interest',1.18,null],[88,'2025-04-30','A012','Income','Interest',1.46,null],
    [89,'2025-06-01','A012','Income','Interest',1.42,null],[90,'2025-06-30','A012','Income','Interest',1.20,null],
    [91,'2025-07-31','A012','Income','Interest',1.20,null],[92,'2025-08-30','A012','Income','Interest',1.25,null],
    [93,'2025-09-30','A012','Income','Interest',1.32,null],[94,'2025-10-31','A012','Income','Interest',1.35,null],
    [95,'2025-11-30','A012','Income','Interest',1.19,null],
    [96,'2026-01-01','A012','Income','Interest',1.26,null],[97,'2026-02-01','A012','Income','Interest',1.40,null],
    [98,'2026-02-02','A012','Income','Interest',43.40,'Bonus Interest'],
    [99,'2026-03-01','A012','Income','Interest',1.38,null],[100,'2026-03-02','A012','Income','Interest',42.78,'Bonus Interest'],
  ]
  return [header, ...rows]
}

// ─── Holiday Fund transform ───────────────────────────────────────────────────
function transformHolidayData({ holidayRows }) {
  // Cols (0-based): SN|Date|Account|Type|Amount|Holiday Year|Trip|Remarks
  const H = { DATE: 1, TYPE: 3, AMT: 4, HOL_YEAR: 5, TRIP: 6, REMARKS: 7 }

  const currentYear = new Date().getFullYear()
  const rows = holidayRows.slice(1).filter(r => r[H.TYPE])

  // ── YTD: keyed on TRANSACTION DATE year (not Holiday Year) ──────────────────
  const ytdDeposits = rows
    .filter(r => {
      const d = parseDate(r[H.DATE])
      return d && d.getFullYear() === currentYear && String(r[H.TYPE]) === 'Deposit'
    })
    .reduce((s, r) => s + (toNum(r[H.AMT]) ?? 0), 0)

  const ytdExpenses = rows
    .filter(r => {
      const d = parseDate(r[H.DATE])
      return d && d.getFullYear() === currentYear && String(r[H.TYPE]) === 'Expense'
    })
    .reduce((s, r) => s + Math.abs(toNum(r[H.AMT]) ?? 0), 0)

  // ── Current-year Holiday Year totals (spend + deposits by Holiday Year) ──────
  const currentHolYearSpend = rows
    .filter(r => Number(r[H.HOL_YEAR]) === currentYear && String(r[H.TYPE]) === 'Expense')
    .reduce((s, r) => s + Math.abs(toNum(r[H.AMT]) ?? 0), 0)

  // Current Holiday Year confirmed trips (Holiday Year = currentYear, type = Expense)
  const currentYearTrips = (() => {
    const map = {}
    rows.filter(r => Number(r[H.HOL_YEAR]) === currentYear && String(r[H.TYPE]) === 'Expense')
      .forEach(r => {
        const trip = String(r[H.TRIP] || 'Other').trim()
        map[trip] = (map[trip] || 0) + Math.abs(toNum(r[H.AMT]) ?? 0)
      })
    return Object.entries(map).map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v)
  })()

  // ── Annual chart: grouped by Holiday Year, then trip ─────────────────────────
  // All-time trip totals used to determine sort order (highest = bottom of stack)
  const allTripTotals = {}
  rows.filter(r => String(r[H.TYPE]) === 'Expense').forEach(r => {
    const trip = String(r[H.TRIP] || 'Other').trim()
    allTripTotals[trip] = (allTripTotals[trip] || 0) + Math.abs(toNum(r[H.AMT]) ?? 0)
  })
  // Sort descending — first in array = rendered at bottom of stack
  const tripSortOrder = Object.entries(allTripTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([trip]) => trip)

  // Build per-year-per-trip map
  const holYears = [...new Set(rows.filter(r => r[H.HOL_YEAR]).map(r => Number(r[H.HOL_YEAR])))].sort()
  const yearTripData = {}
  holYears.forEach(yr => { yearTripData[yr] = {} })
  rows.filter(r => String(r[H.TYPE]) === 'Expense' && r[H.HOL_YEAR]).forEach(r => {
    const yr = Number(r[H.HOL_YEAR])
    const trip = String(r[H.TRIP] || 'Other').trim()
    yearTripData[yr][trip] = (yearTripData[yr][trip] || 0) + Math.abs(toNum(r[H.AMT]) ?? 0)
  })

  // Year totals for data labels on top of bars
  const yearTotals = {}
  holYears.forEach(yr => {
    yearTotals[yr] = Object.values(yearTripData[yr]).reduce((s, v) => s + v, 0)
  })

  // Deposits per holiday year (for the dashed line)
  const yearDeposits = {}
  rows.filter(r => String(r[H.TYPE]) === 'Deposit' && r[H.HOL_YEAR]).forEach(r => {
    const yr = Number(r[H.HOL_YEAR])
    yearDeposits[yr] = (yearDeposits[yr] || 0) + (toNum(r[H.AMT]) ?? 0)
  })

  // Avg annual spend across all complete years (exclude current year)
  const completeYears = holYears.filter(y => y < currentYear)
  const avgAnnual = completeYears.length
    ? Math.round(completeYears.reduce((s, y) => s + (yearTotals[y] || 0), 0) / completeYears.length)
    : 0

  return {
    ytdDeposits, ytdExpenses, currentHolYearSpend,
    currentYearTrips, avgAnnual,
    holYears, yearTripData, yearTotals, yearDeposits, tripSortOrder,
  }
}

// Colour palette for trips — consistent across renders
const TRIP_COLORS = {
  UK: '#ef4444', Brisbane: '#3b82f6', NZ: '#06b6d4', Vietnam: '#10b981',
  Singapore: '#8b5cf6', Bangkok: '#f59e0b', Malaysia: '#a78bfa', Bali: '#60a5fa',
  'Koh Samui': '#f97316', Others: '#94a3b8', Phuket: '#93c5fd', 'Hong Kong': '#ec4899',
  Penang: '#34d399', Danang: '#0ea5e9',
}
const tripColor = (name) => TRIP_COLORS[name] || '#94a3b8'

function useAppData() {
  const [invData, setInvData]         = useState(null)
  const [bankData, setBankData]       = useState(null)
  const [holidayData, setHolidayData] = useState(null)
  const [houseData, setHouseData]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const isMock = isMockMode()

  const load = useCallback(async () => {
    if (isMock) {
      setInvData(getMockInvData())
      setBankData(getMockBankData())
      setHolidayData(transformHolidayData({ holidayRows: getMockHolidayRows() }))
      setHouseData(transformHouseData({ houseRows: getMockHouseRows() }))
      setLoading(false)
      return
    }
    setLoading(true); setError(null)
    try {
      const [invRows, cashRows, snapshotRows, txRows,
             bankTxRows, bankSummaryRows, bankBalanceRows, accountBalanceRows,
             holidayRows, houseRows] = await Promise.all([
        fetchRange(RANGES.INVESTMENTS),
        fetchRange(RANGES.CASH),
        fetchRange(RANGES.SNAPSHOT),
        fetchRange(RANGES.INV_TX),
        fetchRange(BANK_TX_RANGE),
        fetchRange(BANK_SUMMARY_RANGE),
        fetchRange(BANK_BALANCE_RANGE),
        fetchRange(ACCOUNT_BALANCE_RANGE),
        fetchRange(HOLIDAY_RANGE),
        fetchRange(HOUSE_RANGE),
      ])
      setInvData(transformInvData({ invRows, cashRows, snapshotRows, txRows }))
      setBankData(transformBankData({ bankTxRows, bankSummaryRows, bankBalanceRows, accountBalanceRows }))
      setHolidayData(transformHolidayData({ holidayRows }))
      setHouseData(transformHouseData({ houseRows }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [isMock])

  useEffect(() => { load() }, [load])
  return { invData, bankData, holidayData, houseData, loading, error, reload: load, isMock }
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────
const Tag = ({ children }) => <span style={S.tag}>{children}</span>

function LegendLine({ color, label, dashed }) {
  return (
    <span style={S.legendItem}>
      <span style={{ width: 18, height: 3, borderRadius: 2, display: 'inline-block', background: dashed ? 'transparent' : color, backgroundImage: dashed ? `repeating-linear-gradient(to right,${color} 0,${color} 4px,transparent 4px,transparent 7px)` : undefined }} />
      {label}
    </span>
  )
}
function LegendSquare({ color, label }) {
  return (
    <span style={S.legendItem}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}
function KPICard({ label, value, sub, color, source }) {
  return (
    <div style={S.card}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={{ ...S.kpiValue, color: color || C.text }}>{value}</div>
      <div style={{ ...S.kpiSub, color: color || C.muted }}>{sub}</div>
      <Tag>{source}</Tag>
    </div>
  )
}

// ─── Investment page components ───────────────────────────────────────────────
function GrowthChart({ data, owner }) {
  const [mode, setMode] = useState('indexed') // 'indexed' | 'gain'

  if (!data || data.length < 2) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 11 }}>
        Run snapshotToday() in Apps Script to add your first data point
      </div>
    )
  }

  const isAll     = owner === 'All Owners'
  const ownerList = OWNERS.filter(o => o !== 'All Owners')
  const oc        = C.ownerLines[owner] || C.green

  // Build chart data from pre-computed snapshot fields
  const chartData = data.map(r => {
    const row = { date: r.date }
    if (isAll) {
      ownerList.forEach(o => {
        row[o] = mode === 'indexed' ? r[`${o}_indexed`] : r[`${o}_gain`]
      })
    } else {
      row['Portfolio'] = mode === 'indexed' ? r[`${owner}_indexed`] : r[`${owner}_gain`]
    }
    if (mode === 'indexed') row['S&P500'] = r.sp500_indexed
    return row
  })

  const fmtY = v => {
    if (mode === 'gain') {
      if (v === 0) return 'S$0'
      return (v >= 0 ? '+' : '') + (Math.abs(v) >= 1000 ? 'S$' + (v / 1000).toFixed(0) + 'k' : 'S$' + v)
    }
    return v.toFixed(0)
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 11 }}>
        <div style={{ fontWeight: 500, marginBottom: 4, color: C.muted }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.stroke || '#333', marginTop: 2 }}>
            <span style={{ color: C.muted }}>{p.name}:</span>{' '}
            <span style={{ fontWeight: 500 }}>
              {mode === 'gain'
                ? (p.value >= 0 ? '+' : '') + fmtSGD(p.value)
                : p.value?.toFixed(1)
              }
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 10 }}>
        {[
          { key: 'indexed', label: 'Indexed to 100' },
          { key: 'gain',    label: 'S$ Gain'         },
        ].map(m => (
          <button key={m.key} onClick={() => setMode(m.key)} style={{
            padding: '3px 10px', borderRadius: 5, fontSize: 10, cursor: 'pointer',
            border: `1px solid ${C.border}`,
            background: mode === m.key ? '#111' : C.card,
            color:      mode === m.key ? '#fff' : C.muted,
            fontWeight: mode === m.key ? 500 : 400,
            transition: 'all .1s',
          }}>
            {m.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} tickFormatter={fmtY} />
          <Tooltip content={<CustomTooltip />} />

          {/* Owner lines */}
          {isAll
            ? ownerList.map(o => (
                <Line key={o} type="monotone" dataKey={o}
                  stroke={C.ownerLines[o]} strokeWidth={2} dot={false} />
              ))
            : <Line type="monotone" dataKey="Portfolio"
                stroke={oc} strokeWidth={2.5} dot={false} />
          }

          {/* S&P500 benchmark — indexed mode only */}
          {mode === 'indexed' && (
            <Line type="monotone" dataKey="S&P500"
              stroke="#f87171" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div style={S.legend}>
        {isAll
          ? ownerList.map(o => <LegendLine key={o} color={C.ownerLines[o]} label={o} />)
          : <LegendLine color={oc} label={owner} />
        }
        {mode === 'indexed' && <LegendLine color="#f87171" label="S&P500" dashed />}
        {mode === 'gain' && <span style={{ fontSize: 10, color: C.hint }}>S$ gain from first snapshot</span>}
      </div>
    </div>
  )
}
function AllocationBars({ data }) {
  if (!data?.length) return <div style={{ color: C.muted, fontSize: 11 }}>No data</div>
  return (
    <div>
      {data.map(item => (
        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: '#555', width: 70, flexShrink: 0 }}>{item.name}</span>
          <div style={{ flex: 1, height: 10, background: '#f0f0f0', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${item.barWidth ?? item.pct}%`, height: '100%', background: item.color, borderRadius: 5 }} />
          </div>
          <span style={{ fontSize: 11, color: C.muted, width: 36, textAlign: 'right', flexShrink: 0 }}>{item.pctDisplay ?? item.pct + '%'}</span>
        </div>
      ))}
    </div>
  )
}
function XIRRTable({ data, owner }) {
  const rows = owner === 'All Owners' ? data : data.filter(r => r.owner === owner)
  if (!rows.length) return <div style={{ fontSize: 11, color: C.muted }}>No transaction data yet</div>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr><th style={S.th}>Owner</th><th style={S.th}>XIRR</th><th style={S.th}>Total Value (SGD)</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.owner}>
            <td style={S.td}>{r.owner}</td>
            <td style={{ ...S.td, fontWeight: 500, color: r.xirr === null ? C.muted : r.xirr >= 0 ? C.green : C.red }}>
              {r.xirr !== null ? fmtPct(r.xirr, 1) : '—'}
            </td>
            <td style={S.td}>{fmtSGD(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
function HoldingsTable({ data }) {
  const [sort, setSort] = useState({ key: 'currentValue', dir: -1 })
  const toggle = key => setSort(s => s.key === key ? { key, dir: s.dir * -1 } : { key, dir: -1 })
  const arr = key => sort.key === key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''
  const sorted = [...data].sort((a, b) => ((a[sort.key] ?? -Infinity) - (b[sort.key] ?? -Infinity)) * sort.dir)
  return (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={S.th}>Ticker</th><th style={S.th}>Owner</th>
          <th style={{ ...S.th, cursor: 'pointer' }} onClick={() => toggle('currentValue')}>Value{arr('currentValue')}</th>
          <th style={{ ...S.th, cursor: 'pointer' }} onClick={() => toggle('gainPct')}>Gain%{arr('gainPct')}</th>
          <th style={{ ...S.th, cursor: 'pointer' }} onClick={() => toggle('dayChangePct')}>Day Δ{arr('dayChangePct')}</th>
        </tr></thead>
        <tbody>
          {sorted.slice(0, 7).map((h, i) => (
            <tr key={`${h.ticker}-${h.owner}-${i}`}>
              <td style={{ ...S.td, fontWeight: 500 }}>{h.ticker}</td>
              <td style={S.td}>{h.owner}</td>
              <td style={S.td}>{fmtSGD(h.currentValue)}</td>
              <td style={{ ...S.td, color: h.gainPct > 0 ? C.green : h.gainPct < 0 ? C.red : C.muted }}>{h.gainPct !== 0 ? fmtPct(h.gainPct) : '—'}</td>
              <td style={{ ...S.td, color: h.dayChangePct === null ? C.muted : h.dayChangePct < 0 ? C.red : C.green }}>{h.dayChangePct !== null ? fmtPct(h.dayChangePct) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 7 && <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>+ {data.length - 7} more rows</div>}
    </>
  )
}
function MonthlyChart({ data, owner }) {
  if (!data?.length) return <div style={{ height: 155, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 11 }}>Add monthly rows to Portfolio Snapshot</div>
  const oc = C.ownerLines[owner] || C.green
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null
    return <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 11 }}><div style={{ fontWeight: 500, marginBottom: 4 }}>{label}</div>{payload.map(p => <div key={p.name} style={{ color: p.value >= 0 ? C.green : C.red }}>{p.name}: {p.value >= 0 ? '+' : ''}{p.value?.toFixed(2)}%</div>)}</div>
  }
  return (
    <ResponsiveContainer width="100%" height={155}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} tickFormatter={v => v + '%'} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="portfolio" name={owner === 'All Owners' ? 'Avg Portfolio' : owner} radius={[3, 3, 0, 0]}>
          {data.map((e, i) => <Cell key={i} fill={e.portfolio >= 0 ? oc : oc + '99'} />)}
        </Bar>
        <Bar dataKey="sp500" name="S&P500" radius={[3, 3, 0, 0]}>
          {data.map((e, i) => <Cell key={i} fill={e.sp500 >= 0 ? C.salmon : '#fecaca'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function filterByOwner(holdings, owner) {
  return owner === 'All Owners' ? holdings : holdings.filter(h => h.owner === owner)
}
function computeKPIs(holdings) {
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0)
  const totalCost  = holdings.reduce((s, h) => s + h.costBasis, 0)
  const totalGain  = totalValue - totalCost
  const gainPct    = totalCost > 0 ? (totalGain / totalCost) * 100 : 0
  const tradeable  = holdings.filter(h => h.dayChangePct !== null)
  const best  = tradeable.length ? tradeable.reduce((b, h) => h.dayChangePct > b.dayChangePct ? h : b) : null
  const worst = tradeable.length ? tradeable.reduce((w, h) => h.dayChangePct < w.dayChangePct ? h : w) : null
  return { totalValue, totalGain, gainPct, best, worst }
}
function computeAllocation(holdings) {
  const map = {}
  holdings.forEach(h => { map[h.assetClass] = (map[h.assetClass] || 0) + h.currentValue })
  const total = Object.values(map).reduce((a, b) => a + b, 0)
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({
    name, value,
    pct: Math.round((value / total) * 100),
    pctDisplay: value / total < 0.005 ? '<1%' : Math.round((value / total) * 100) + '%',
    barWidth: Math.max((value / total) * 100, 0.5), // min 0.5% so bar is always visible
    color: ASSET_CLASS_COLORS[name] || ASSET_CLASS_COLORS.Other,
  }))
}

function getMonthlyData(snapshotData, owner) {
  // Skip first row — it's the baseline (ret = 0, no prior month to compare)
  const rows = snapshotData.slice(1)
  if (!rows.length) return []

  if (owner === 'All Owners') {
    return rows.map(r => {
      const ownerList = OWNERS.filter(o => o !== 'All Owners')
      const rets = ownerList.map(o => r[`${o}_ret`] || 0)
      return {
        month:     r.date,
        portfolio: +(rets.reduce((a, b) => a + b, 0) / rets.length).toFixed(2),
        sp500:     +((r.sp500_ret || 0)).toFixed(2),
      }
    })
  }
  return rows.map(r => ({
    month:     r.date,
    portfolio: +((r[`${owner}_ret`] || 0)).toFixed(2),
    sp500:     +((r.sp500_ret || 0)).toFixed(2),
  }))
}

// ─── Investment page ───────────────────────────────────────────────────────────
function InvestmentPage({ data, reload }) {
  const [owner, setOwner] = useState('All Owners')
  const filtered    = filterByOwner(data.allHoldings, owner)
  const kpis        = computeKPIs(filtered)
  const allocation  = computeAllocation(filtered)
  const monthlyData = getMonthlyData(data.snapshotData, owner)
  const oc = C.ownerLines[owner] || C.green
  return (
    <div>
      <div style={S.ownerTabs}>
        <span style={S.ownerTabLabel}>View:</span>
        {OWNERS.map(o => <button key={o} onClick={() => setOwner(o)} style={{ ...S.tab, ...(owner === o ? S.tabActive : {}) }}>{o}</button>)}
        <button onClick={reload} style={S.refreshBtn} title="Refresh">⟳</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
        <KPICard label="Total Portfolio (SGD)" value={fmtSGD(kpis.totalValue)} sub="Investments + Cash" source="Inv_Holdings + Cash Holding" />
        <KPICard label="Unrealised Gain" value={(kpis.totalGain >= 0 ? '+' : '') + fmtSGD(kpis.totalGain)} sub={fmtPct(kpis.gainPct) + ' total return'} color={kpis.totalGain >= 0 ? C.green : C.red} source="Inv_Holdings" />
        <KPICard label="Today's Best" value={kpis.best ? `${kpis.best.ticker} ${fmtPct(kpis.best.dayChangePct)}` : '—'} sub="Day change %" color={C.green} source="Inv_Holdings" />
        <KPICard label="Today's Worst" value={kpis.worst ? `${kpis.worst.ticker} ${fmtPct(kpis.worst.dayChangePct)}` : '—'} sub="Day change %" color={kpis.worst && kpis.worst.dayChangePct < 0 ? C.red : C.text} source="Inv_Holdings" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>Portfolio growth vs benchmark (indexed to 100)</div>
          <div style={S.cardSub}>{owner === 'All Owners' ? 'All owners — indexed to 100' : `${owner} vs S&P500`} · Toggle for S$ gain</div>
          <GrowthChart data={data.snapshotData} owner={owner} />
          <Tag>Portfolio_Snapshot</Tag>
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Allocation by asset class</div>
          <div style={S.cardSub}>{owner} — Weight %</div>
          <AllocationBars data={allocation} />
          <Tag>Inv_Holdings + Cash Holding</Tag>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 12, marginBottom: 12 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>XIRR by owner</div>
          <div style={S.cardSub}>Calculated from Inv_Tx + current portfolio value</div>
          <XIRRTable data={data.xirr} owner={owner} />
          <Tag>Inv_Tx (calculated)</Tag>
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Holdings detail</div>
          <div style={S.cardSub}>Click column headers to sort</div>
          <HoldingsTable data={filtered} />
          <Tag>Inv_Holdings + Cash Holding</Tag>
        </div>
      </div>
      <div style={S.cardMb}>
        <div style={S.cardTitle}>Monthly portfolio return % vs S&P500</div>
        <div style={S.cardSub}>{owner === 'All Owners' ? 'Average across all owners' : owner} — Month × Return %</div>
        <MonthlyChart data={monthlyData} owner={owner} />
        <div style={S.legend}>
          <LegendSquare color={oc} label={owner === 'All Owners' ? 'Avg Portfolio' : owner} />
          <LegendSquare color={C.salmon} label="S&P500" />
        </div>
        <Tag>Portfolio_Snapshot</Tag>
      </div>
    </div>
  )
}

// ─── Banking page components ─────────────────────────────────────────────────

function AccountBalanceTiles({ owner, accountBalances }) {
  const list = owner === 'All Owners' ? BANK_ACCOUNTS : BANK_ACCOUNTS.filter(a => a.owner === owner)
  const cols = list.length <= 2 ? 'repeat(2,1fr)' : 'repeat(3,1fr)'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, marginBottom: 12 }}>
      {list.map(a => {
        const accent = C.ownerAccent[a.owner] || '#6366f1'
        return (
          <div key={a.id} style={{ ...S.card, borderLeft: `3px solid ${accent}`, borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>{a.label}</span>
              <span style={{ fontSize: 9, color: C.muted, background: C.tag, padding: '1px 5px', borderRadius: 3 }}>{a.type}</span>
              <span style={{ fontSize: 9, color: C.hint, marginLeft: 'auto' }}>{a.id}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>{fmtSGD(accountBalances[a.id] ?? 0)}</div>
            <div style={{ fontSize: 9, color: C.hint, marginTop: 2 }}>Current balance</div>
          </div>
        )
      })}
    </div>
  )
}

// Spend bars — accepts section label and cats array
function SpendSection({ sectionLabel, cats, allMax }) {
  if (!cats?.length) return null
  const max = allMax ?? cats[0]?.v ?? 1
  return (
    <div>
      {sectionLabel && <div style={{ fontSize: 9, color: C.hint, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6, marginTop: 10 }}>{sectionLabel}</div>}
      {cats.map(c => {
        const col = CAT_COLORS[c.n] || '#aaaaaa'
        return (
          <div key={c.n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span style={{ fontSize: 11, color: C.text, width: 96, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.n}</span>
            <div style={{ flex: 1, height: 9, background: '#f0f0f0', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(c.v / max * 100)}%`, height: '100%', background: col, borderRadius: 5 }} />
            </div>
            <span style={{ fontSize: 10, color: C.muted, width: 62, textAlign: 'right', flexShrink: 0 }}>
              {c.v >= 1000 ? 'S$' + (c.v / 1000).toFixed(1) + 'k' : 'S$' + Math.round(c.v)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Bryan savings box — shows gross, itemised returns, net
function BryanSavingsBox({ grossToSavings, savingsReturns, netSavings }) {
  if (!grossToSavings) return null
  return (
    <div style={{ background: '#faf5ff', border: '0.5px solid #e9d5ff', borderRadius: 8, padding: '10px 12px', margin: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
        <span style={{ fontSize: 11, color: '#6b21a8' }}>Gross to savings (A005→A006)</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#6b21a8' }}>{fmtSGD(grossToSavings)}</span>
      </div>
      {savingsReturns.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', paddingLeft: 10 }}>
          <span style={{ fontSize: 10, color: '#7c3aed' }}>↩ Returned ({r.label})</span>
          <span style={{ fontSize: 11, color: '#059669' }}>−{fmtSGD(r.amt)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '0.5px solid #e9d5ff', marginTop: 6, paddingTop: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#6b21a8' }}>Net true savings</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#6b21a8' }}>{fmtSGD(netSavings)}</span>
      </div>
    </div>
  )
}

// Pay period summary — income, savings box (Bryan), outflows, remaining + progress bars
function PayPeriodSummary({ period, bankBalance }) {
  const { income, bankCats, savCats, grossToSavings, savingsReturns, netSavings, daysIn, startLabel } = period
  const bankOutflow = (bankCats || []).reduce((s, c) => s + c.v, 0)
  const savOutflow  = (savCats  || []).reduce((s, c) => s + c.v, 0)
  const totalOutflow = bankOutflow + savOutflow
  const returnsTotal = savingsReturns?.reduce((s, r) => s + r.amt, 0) || 0
  // Remaining = actual current bank account balance (ground truth).
  // Reconstructing from flows is unreliable — use the real balance instead.
  const remaining = bankBalance ?? 0
  // Budget used % = (income - remaining) / income, capped at 100%
  const totalUsed = income - remaining
  const usedPct = income > 0 ? Math.min(Math.round(totalUsed / income * 100), 100) : 100
  const remPct = Math.max(0, 100 - usedPct)
  const col = remPct > 30 ? C.green : remPct > 10 ? C.amber : C.red
  const dayPct = Math.min(Math.round(daysIn / 30 * 100), 100)
  const sumRow = (label, val, color, bold) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `0.5px solid #f5f5f5` }}>
      <span style={{ fontSize: 11, color: bold ? C.text : C.muted, fontWeight: bold ? 500 : 400 }}>{label}</span>
      <span style={{ fontSize: bold ? 15 : 13, fontWeight: 500, color }}>{val}</span>
    </div>
  )
  return (
    <div>
      {sumRow('Income received', fmtSGD(income), C.green, false)}
      {grossToSavings > 0 && <BryanSavingsBox grossToSavings={grossToSavings} savingsReturns={savingsReturns} netSavings={netSavings} />}
      {sumRow('External outflows', '−' + fmtSGD(totalOutflow), C.red, false)}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.text }}>Remaining</span>
        <span style={{ fontSize: 17, fontWeight: 600, color: col }}>{remaining >= 0 ? fmtSGD(remaining) : '−' + fmtSGD(Math.abs(remaining))}</span>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: C.muted }}>Budget used</span>
          <span style={{ fontSize: 9, color: col, fontWeight: 500 }}>{usedPct}%</span>
        </div>
        <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: usedPct + '%', height: '100%', background: col, borderRadius: 4 }} />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: C.muted }}>Days elapsed · since {startLabel}</span>
          <span style={{ fontSize: 9, color: C.hint }}>{daysIn}d / ~30d</span>
        </div>
        <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: dayPct + '%', height: '100%', background: '#94a3b8', borderRadius: 3 }} />
        </div>
      </div>
    </div>
  )
}

// Cascade diagram for All Owners view
function CascadeDiagram() {
  const rows = [
    { owner: 'Bryan', color: C.ownerLines.Bryan, bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', trigger: 'Salary credited to A005', date: '~24th each month' },
    { owner: 'Joint', color: C.ownerLines.Joint, bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', trigger: "Bryan's transfer received in A007", date: '~28th each month' },
    { owner: 'Nathan', color: C.ownerLines.Nathan, bg: '#fffbeb', border: '#fde68a', text: '#92400e', trigger: 'Parents allowance received in A009', date: '~28th each month' },
    { owner: 'Natalie', color: C.ownerLines.Natalie, bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8', trigger: 'Parents allowance received in A010', date: '~28th each month' },
  ]
  return (
    <div style={{ background: '#f8faff', border: '0.5px solid #dbeafe', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: C.text, marginBottom: 10 }}>Pay periods are triggered automatically each month</div>
      {rows.map((r, i) => (
        <div key={r.owner}>
          {i > 0 && <div style={{ fontSize: 10, color: '#93c5fd', paddingLeft: 4, paddingBottom: 2 }}>↓</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: C.text, width: 58, flexShrink: 0 }}>{r.owner}</span>
            <span style={{ fontSize: 10, color: C.muted, flex: 1 }}>{r.trigger}</span>
            <span style={{ fontSize: 9, background: r.bg, border: `0.5px solid ${r.border}`, color: r.text, borderRadius: 10, padding: '1px 8px', flexShrink: 0 }}>{r.date}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Savings MoM: ComposedChart with bar (net flow) + line (running balance)
function SavingsChart({ history, color, balanceOnly = false }) {
  if (!history?.length) return <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 11 }}>No data yet</div>
  const fmtTick = v => (Math.abs(v) >= 1000 ? (v < 0 ? '-' : '') + 'S$' + (Math.abs(v) / 1000).toFixed(0) + 'k' : 'S$' + v)
  if (balanceOnly) {
    return (
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} tickFormatter={fmtTick} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `1px solid ${C.border}` }}
            formatter={val => [fmtSGD(val), 'Balance']} />
          <Line type="monotone" dataKey="balance" stroke={color} strokeWidth={2} dot={{ r: 4, fill: color }} />
        </LineChart>
      </ResponsiveContainer>
    )
  }
  const minFlow = Math.min(0, ...history.map(h => h.flow ?? 0))
  const maxVal  = Math.max(...history.map(h => Math.max(h.flow ?? 0, h.balance ?? 0)))
  const domainMin = Math.floor(minFlow * 1.3 / 1000) * 1000
  const domainMax = Math.ceil(maxVal  * 1.1 / 1000) * 1000
  return (
    <ResponsiveContainer width="100%" height={140}>
      <ComposedChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} />
        <YAxis domain={[domainMin, domainMax]} tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false}
          tickFormatter={fmtTick} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `1px solid ${C.border}` }}
          formatter={(val, name) => [(val < 0 ? '-' : '') + fmtSGD(Math.abs(val)), name === 'flow' ? 'Net flow' : 'Balance']} />
        <ReferenceLine y={0} stroke={C.border} strokeWidth={1} />
        <Bar dataKey="flow" name="flow" radius={[3, 3, 0, 0]}>
          {history.map((e, i) => <Cell key={i} fill={(e.flow ?? 0) >= 0 ? '#10b981cc' : C.red + 'cc'} />)}
        </Bar>
        <Line type="monotone" dataKey="balance" name="balance" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}


// ─── Banking page ─────────────────────────────────────────────────────────────
function BankingPage({ data, reload }) {
  const [owner, setOwner] = useState('All Owners')
  const { accountBalances, payPeriodData, ytdData, savingsHistory } = data
  const isAll = owner === 'All Owners'
  const period = isAll ? null : payPeriodData[owner]
  const ytd = isAll ? null : ytdData[owner]
  const isBryan = owner === 'Bryan'
  const showSavings = isAll || owner === 'Bryan' || owner === 'Joint'

  // Combined all-cats max for Bryan (so bank+savings bars share same scale)
  const bryanAllMax = isBryan && period && (period.bankCats?.length || period.savCats?.length)
    ? Math.max(...[...(period.bankCats || []), ...(period.savCats || [])].map(c => c.v), 1)
    : 1

  const ownerColor = C.ownerLines[owner] || C.green
  const pillStyle = { fontSize: 9, borderRadius: 12, padding: '2px 9px', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 8 }
  const PILL_COLORS = {
    Bryan:   { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' },
    Joint:   { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af' },
    Nathan:  { bg: '#fffbeb', border: '#fde68a', color: '#92400e' },
    Natalie: { bg: '#faf5ff', border: '#e9d5ff', color: '#6b21a8' },
  }
  const pc = PILL_COLORS[owner] || {}

  return (
    <div>
      <div style={S.ownerTabs}>
        <span style={S.ownerTabLabel}>View:</span>
        {OWNERS.map(o => <button key={o} onClick={() => setOwner(o)} style={{ ...S.tab, ...(owner === o ? S.tabActive : {}) }}>{o}</button>)}
        <button onClick={reload} style={S.refreshBtn} title="Refresh">⟳</button>
      </div>

      {/* Account balances — always shown */}
      <div style={S.secLabel}>Account balances</div>
      <AccountBalanceTiles owner={owner} accountBalances={accountBalances} />

      {/* All Owners: cascade diagram only */}
      {isAll && <><div style={S.secLabel}>Pay period cascade</div><CascadeDiagram /></>}

      {/* Per-owner: pay period + YTD */}
      {!isAll && period && (
        <>
          <div style={{ ...S.secLabel, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Pay period</span>
            <span style={{ ...pillStyle, background: pc.bg, border: `0.5px solid ${pc.border}`, color: pc.color }}>
              {period.startLabel} · {period.triggerLabel}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginBottom: 12 }}>
            {/* Spend bars — single combined view, two sections for Bryan */}
            <div style={S.card}>
              <div style={S.cardTitle}>Spending this period</div>
              <div style={S.cardSub}>
                All external outflows · {period.startLabel} → today ·{' '}
                {fmtSGD([...period.bankCats, ...period.savCats].reduce((s, c) => s + c.v, 0))} total
              </div>
              <SpendSection
                sectionLabel={isBryan && period.savCats?.length ? 'Bank (A005)' : null}
                cats={period.bankCats}
                allMax={isBryan ? bryanAllMax : undefined}
              />
              {isBryan && period.savCats?.length > 0 && (
                <SpendSection sectionLabel="Savings (A006)" cats={period.savCats} allMax={bryanAllMax} />
              )}
              <Tag>Bank_Tx</Tag>
            </div>

            {/* Summary */}
            <div style={S.card}>
              <div style={S.cardTitle}>Pay period summary</div>
              <div style={S.cardSub}>Income received vs all outflows</div>
              <PayPeriodSummary period={period} bankBalance={accountBalances[PRIMARY_ACCT[owner]]} />
              <Tag>Bank_Tx</Tag>
            </div>
          </div>

          {/* YTD */}
          <div style={S.secLabel}>Year to date · {new Date().getFullYear()}</div>
          <div style={S.cardMb}>
            <div style={S.cardTitle}>{owner} — all outflows {new Date().getFullYear()} by category</div>
            <div style={S.cardSub}>
              {fmtSGD((ytd || []).reduce((s, c) => s + c.v, 0))} total · internal transfers excluded
            </div>
            {ytd?.length > 0
              ? <SpendSection cats={ytd} />
              : <div style={{ fontSize: 11, color: C.muted }}>No YTD data yet</div>
            }
            <Tag>Bank_Tx</Tag>
          </div>
        </>
      )}

      {/* Savings MoM — Bryan, Joint, or All */}
      {showSavings && (
        <>
          <div style={S.secLabel}>Month-on-month savings</div>
          <div style={{ display: 'grid', gridTemplateColumns: isAll ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 12 }}>
            {SAVINGS_ACCOUNTS.filter(sa => isAll || sa.owner === owner).map(sa => (
              <div key={sa.id} style={S.card}>
                <div style={S.cardTitle}>{sa.label}</div>
                <div style={S.cardSub}>Net flow bars (+ve green / −ve red) · running balance line</div>
                <SavingsChart history={savingsHistory[sa.id]} color={sa.color} />
                <div style={S.legend}>
                  <LegendSquare color="#10b981cc" label="+ve flow" />
                  <LegendSquare color={C.red + 'cc'} label="−ve flow" />
                  <LegendLine color={sa.color} label="Running balance" />
                </div>
                <Tag>Bank_Balance</Tag>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}


// ─── Holiday Fund page ────────────────────────────────────────────────────────
function HolidayPage({ data, reload, accountBalances }) {
  const [drillYear, setDrillYear] = useState(null)
  const {
    ytdDeposits, ytdExpenses, currentHolYearSpend,
    currentYearTrips, avgAnnual,
    holYears, yearTripData, yearTotals, yearDeposits, tripSortOrder,
  } = data

  const currentYear = new Date().getFullYear()
  const fmtK = v => v >= 1000 ? 'S$' + (v / 1000).toFixed(1) + 'k' : 'S$' + Math.round(v)

  // Build Recharts datasets: one bar series per trip (sorted by all-time spend, highest first = bottom)
  // Plus a line for deposits
  const chartData = holYears.map(yr => {
    const row = { year: String(yr), _total: Math.round(yearTotals[yr] || 0), _deposits: Math.round(yearDeposits[yr] || 0) }
    tripSortOrder.forEach(trip => { row[trip] = Math.round(yearTripData[yr]?.[trip] || 0) })
    return row
  })

  const drillData = drillYear !== null ? Object.entries(yearTripData[drillYear] || {})
    .map(([name, v]) => ({ name, v: Math.round(v) })).sort((a, b) => b.v - a.v) : []
  const drillMax = drillData[0]?.v || 1
  const drillTotal = drillData.reduce((s, d) => s + d.v, 0)

  // Custom label above each stacked bar showing total
  const TotalLabel = ({ x, y, width, value }) => {
    if (!value || value === 0) return null
    return (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={500} fill="#374151">
        {fmtK(value)}
      </text>
    )
  }

  // Invisible bar just to carry the label — same height as total
  const totalData = chartData.map(r => ({ ...r, _labelVal: r._total }))

  return (
    <div>
      <div style={S.ownerTabs}>
        <span style={S.ownerTabLabel}>Holiday Fund</span>
        <button onClick={reload} style={S.refreshBtn} title="Refresh">⟳</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
        <KPICard label="Fund balance" value={fmtSGD(accountBalances?.A011 ?? 13575)} sub="A011 current balance" source="Account Balance" />
        <KPICard label={`Saved YTD ${currentYear}`} value={fmtSGD(ytdDeposits)} sub="Deposits by transaction date" color={C.green} source="Holiday Fund" />
        <KPICard label={`Spent YTD ${currentYear}`} value={ytdExpenses > 0 ? fmtSGD(ytdExpenses) : 'S$0'} sub={ytdExpenses > 0 ? 'Expenses by transaction date' : 'No expense transactions yet'} color={ytdExpenses > 0 ? C.red : C.muted} source="Holiday Fund" />
        <KPICard label="Avg annual spend" value={fmtSGD(avgAnnual)} sub="Average across completed years" source="Holiday Fund" />
      </div>

      {/* Saved vs spent */}
      <div style={{ ...S.secLabel }}>Holiday Year {currentYear} — saved vs total spend</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>Saved vs spent · {currentYear} trips</div>
          <div style={S.cardSub}>Deposits in {currentYear} vs total spend on Holiday Year {currentYear} trips (any transaction date)</div>
          {[
            { label: `Saved in ${currentYear} (deposits)`, val: ytdDeposits, color: C.green, pct: currentHolYearSpend > 0 ? Math.round(ytdDeposits / currentHolYearSpend * 100) : 100 },
            { label: `Total spent on ${currentYear} trips`, val: currentHolYearSpend, color: C.red, pct: 100 },
          ].map(row => (
            <div key={row.label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: C.muted }}>{row.label}</span>
                <span style={{ fontSize: 10, fontWeight: 500, color: row.color }}>{fmtSGD(row.val)}</span>
              </div>
              <div style={{ height: 10, background: '#f0f0f0', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${row.pct}%`, height: '100%', background: row.color, borderRadius: 5 }} />
              </div>
            </div>
          ))}
          <Tag>Holiday Fund · A011</Tag>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>{currentYear} trips confirmed</div>
          <div style={S.cardSub}>Total spend by destination · Holiday Year = {currentYear}</div>
          {currentYearTrips.length === 0
            ? <div style={{ fontSize: 11, color: C.muted }}>No {currentYear} trips recorded yet</div>
            : currentYearTrips.map(t => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `0.5px solid #f5f5f5` }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: tripColor(t.name), flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.text, flex: 1 }}>{t.name}</span>
                <div style={{ width: 80, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(t.v / currentYearTrips[0].v * 100)}%`, height: '100%', background: tripColor(t.name), borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: C.text, width: 70, textAlign: 'right' }}>{fmtSGD(t.v)}</span>
              </div>
            ))
          }
          <Tag>Holiday Fund · col F</Tag>
        </div>
      </div>

      {/* Annual stacked bar chart */}
      <div style={S.cardMb}>
        <div style={S.cardTitle}>Annual holiday spend by year</div>
        <div style={S.cardSub}>Grouped by Holiday Year · highest spend trip at bottom · click any bar for breakdown</div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 28, right: 8, bottom: 0, left: -10 }}
            onClick={e => { if (e?.activeLabel) setDrillYear(parseInt(e.activeLabel)) }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#555' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
            {tripSortOrder.map((trip, idx) => (
              <Bar key={trip} dataKey={trip} stackId="a" fill={tripColor(trip)} radius={0}
                label={idx === tripSortOrder.length - 1 ? <TotalLabel /> : false} />
            ))}
            <Line type="monotone" dataKey="_deposits" stroke="#374151" strokeWidth={2}
              strokeDasharray="5 4" dot={{ r: 4, fill: '#374151' }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ ...S.legend, marginTop: 8 }}>
          <LegendLine color="#374151" label="Deposits" dashed />
          <span style={{ fontSize: 10, color: C.hint }}>· Click any bar for trip breakdown</span>
        </div>

        {/* Drill-down panel */}
        {drillYear !== null && (
          <div style={{ background: '#f8faff', border: `0.5px solid #dbeafe`, borderRadius: 8, padding: '12px 14px', marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: C.text }}>
                Holiday Year {drillYear} — {fmtSGD(drillTotal)} total · {drillData.length} destination{drillData.length !== 1 ? 's' : ''}
              </span>
              <button onClick={() => setDrillYear(null)} style={{ fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>✕ close</button>
            </div>
            {drillData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: tripColor(d.name), flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.text, width: 90, flexShrink: 0 }}>{d.name}</span>
                <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(d.v / drillMax * 100)}%`, height: '100%', background: tripColor(d.name), borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 10, color: C.muted, width: 70, textAlign: 'right', flexShrink: 0 }}>{fmtSGD(d.v)}</span>
              </div>
            ))}
          </div>
        )}
        <Tag>Holiday Fund · col F (Holiday Year)</Tag>
      </div>
    </div>
  )
}


// ─── House Fund page ──────────────────────────────────────────────────────────
function HousePage({ data, reload, accountBalances }) {
  const [drillYear, setDrillYear] = useState(null)
  const {
    ytdSaved, ytdSpent, currentYearCats, avgAnnual,
    allYears, yearCatData, yearTotals, yearSaved, catSortOrder,
  } = data

  const currentYear = new Date().getFullYear()
  const fmtK = v => v >= 1000 ? 'S$' + (v / 1000).toFixed(1) + 'k' : 'S$' + Math.round(v)
  const netSaved = ytdSaved - ytdSpent

  const chartData = allYears.map(yr => {
    const row = { year: String(yr), _total: Math.round(yearTotals[yr] || 0), _saved: Math.round(yearSaved[yr] || 0) }
    catSortOrder.forEach(cat => { row[cat] = Math.round(yearCatData[yr]?.[cat] || 0) })
    return row
  })

  const drillData = drillYear !== null
    ? Object.entries(yearCatData[drillYear] || {}).map(([name, v]) => ({ name, v: Math.round(v) })).sort((a, b) => b.v - a.v)
    : []
  const drillMax = drillData[0]?.v || 1

  // Custom label plugin — uses actual bar element x for perfect centering
  const TotalLabel = ({ x, y, width, value }) => {
    if (!value || value === 0) return null
    return (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={500} fill="#374151">
        {fmtK(value)}
      </text>
    )
  }

  return (
    <div>
      <div style={S.ownerTabs}>
        <span style={S.ownerTabLabel}>House Fund</span>
        <button onClick={reload} style={S.refreshBtn} title="Refresh">⟳</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
        <KPICard label="Fund balance" value={fmtSGD(accountBalances?.A012 ?? 20294)} sub="A012 current balance" source="Account Balance" />
        <KPICard label={`Saved YTD ${currentYear}`} value={fmtSGD(ytdSaved)} sub="Deposits + interest income" color={C.green} source="House Fund" />
        <KPICard label={`Spent YTD ${currentYear}`} value={ytdSpent > 0 ? fmtSGD(ytdSpent) : 'S$0'} sub={ytdSpent > 0 ? 'Expenses by transaction date' : 'No expenses yet'} color={ytdSpent > 0 ? C.red : C.muted} source="House Fund" />
        <KPICard label="Avg annual spend" value={fmtSGD(avgAnnual)} sub="Average across completed years" source="House Fund" />
      </div>

      {/* Saved vs spent + current year categories */}
      <div style={S.secLabel}>Year {currentYear} — saved vs spent</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>Saved vs spent · {currentYear}</div>
          <div style={S.cardSub}>Deposits + interest income vs expenses · by transaction date</div>
          {[
            { label: `Saved in ${currentYear} (deposits + interest)`, val: ytdSaved, color: C.green, pct: 100 },
            { label: `Spent in ${currentYear}`, val: ytdSpent, color: C.red, pct: ytdSaved > 0 ? Math.round(ytdSpent / ytdSaved * 100) : 0 },
          ].map(row => (
            <div key={row.label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: C.muted }}>{row.label}</span>
                <span style={{ fontSize: 10, fontWeight: 500, color: row.color }}>{fmtSGD(row.val)}</span>
              </div>
              <div style={{ height: 10, background: '#f0f0f0', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${row.pct}%`, height: '100%', background: row.color, borderRadius: 5 }} />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: `0.5px solid #f0f0f0` }}>
            <span style={{ fontSize: 11, color: C.muted }}>Net saved in {currentYear}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: netSaved >= 0 ? C.green : C.red }}>{fmtSGD(netSaved)}</span>
          </div>
          <Tag>House Fund · A012</Tag>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>{currentYear} expenses by category</div>
          <div style={S.cardSub}>All expense transactions in {currentYear}</div>
          {currentYearCats.length === 0
            ? <div style={{ fontSize: 11, color: C.muted }}>No expenses recorded yet in {currentYear}</div>
            : currentYearCats.map(c => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `0.5px solid #f5f5f5` }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: houseCatColor(c.name), flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.text, flex: 1 }}>{c.name}</span>
                <div style={{ width: 80, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden', marginRight: 10 }}>
                  <div style={{ width: `${Math.round(c.v / currentYearCats[0].v * 100)}%`, height: '100%', background: houseCatColor(c.name), borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: C.text, width: 70, textAlign: 'right' }}>{fmtSGD(c.v)}</span>
              </div>
            ))
          }
          <Tag>House Fund · A012</Tag>
        </div>
      </div>

      {/* Annual stacked bar chart */}
      <div style={S.cardMb}>
        <div style={S.cardTitle}>Annual house fund spend by category</div>
        <div style={S.cardSub}>All years · categories stacked · click any bar for breakdown · dotted line = amount saved</div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={chartData}
            margin={{ top: 28, right: 8, bottom: 0, left: -10 }}
            onClick={e => { if (e?.activeLabel) setDrillYear(parseInt(e.activeLabel)) }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#555' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
            {/* Stacked bars — sorted by all-time total, highest first = bottom */}
            {catSortOrder.map((cat, idx) => (
              <Bar key={cat} dataKey={cat} stackId="a" fill={houseCatColor(cat)} radius={0}
                label={idx === catSortOrder.length - 1 ? <TotalLabel /> : false} />
            ))}
            {/* Saved dotted line — works correctly inside ComposedChart */}
            <Line type="monotone" dataKey="_saved" stroke="#374151" strokeWidth={2}
              strokeDasharray="5 4" dot={{ r: 4, fill: '#374151' }} />
          </ComposedChart>
        </ResponsiveContainer>

        <div style={{ ...S.legend, marginTop: 8 }}>
          <LegendLine color="#374151" label="Saved (deposits + interest)" dashed />
          <span style={{ fontSize: 10, color: C.hint }}>· Click any bar for category breakdown</span>
        </div>

        {/* Drill-down panel */}
        {drillYear !== null && (
          <div style={{ background: '#f8faff', border: `0.5px solid #dbeafe`, borderRadius: 8, padding: '12px 14px', marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: C.text }}>
                {drillYear} — {fmtSGD(Object.values(yearCatData[drillYear] || {}).reduce((s,v)=>s+v,0))} spent · {fmtSGD(yearSaved[drillYear] || 0)} saved
              </span>
              <button onClick={() => setDrillYear(null)} style={{ fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>✕ close</button>
            </div>
            {drillData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: houseCatColor(d.name), flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.text, width: 70, flexShrink: 0 }}>{d.name}</span>
                <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(d.v / drillMax * 100)}%`, height: '100%', background: houseCatColor(d.name), borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 10, color: C.muted, width: 70, textAlign: 'right', flexShrink: 0 }}>{fmtSGD(d.v)}</span>
              </div>
            ))}
          </div>
        )}
        <Tag>House Fund · A012</Tag>
      </div>
    </div>
  )
}

// ─── Root app ──────────────────────────────────────────────────────────────────
export default function App() {
  const { invData, bankData, holidayData, houseData, loading, error, reload, isMock } = useAppData()
  const [page, setPage] = useState('investments')

  if (loading) return <div style={S.loading}><div style={{ textAlign: 'center' }}><div>Loading…</div><div style={{ fontSize: 11, color: C.hint, marginTop: 6 }}>Fetching from Google Sheets</div></div></div>
  if (error) return (
    <div style={S.error}>
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Could not load data</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, maxWidth: 420, margin: '0 auto 16px' }}>{error}</div>
      <button onClick={reload} style={{ padding: '6px 16px', borderRadius: 6, border: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 12 }}>Retry</button>
    </div>
  )

  return (
    <div style={S.app}>
      {isMock && <div style={S.banner}>Showing sample data — configure your Sheet ID and API key in <code>src/config.js</code></div>}

      {/* Top-level page tabs */}
      <div style={S.pageTabs}>
        {[
          { key: 'investments', label: 'Investments' },
          { key: 'banking', label: 'Banking' },
          { key: 'holiday', label: 'Holiday Fund' },
          { key: 'house', label: 'House Fund' },
        ].map(p => (
          <button key={p.key} onClick={() => setPage(p.key)}
            style={{ ...S.pageTab, ...(page === p.key ? S.pageTabActive : {}) }}>
            {p.label}
          </button>
        ))}
      </div>

      {page === 'investments' && invData    && <InvestmentPage data={invData}    reload={reload} />}
      {page === 'banking'     && bankData   && <BankingPage   data={bankData}   reload={reload} />}
      {page === 'holiday'     && holidayData && <HolidayPage  data={holidayData} reload={reload} accountBalances={bankData?.accountBalances} />}
      {page === 'house'       && houseData   && <HousePage    data={houseData}   reload={reload} accountBalances={bankData?.accountBalances} />}
    </div>
  )
}
