'use client'
import { useEffect, useState, useCallback } from 'react'
import Papa from 'papaparse'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────
interface UserRow {
  'User ID': string
  'Name': string
  'Tab Clicked': string
  'Timestamp': string
  'General Feedback': string
  'Registered Mobile Number': string
  'Course Name': string
  'Course Related Feedback': string
}

// ─── Tab groupings (mirrors your Excel logic) ────────────────────────────────
const TAB_GROUPS: Record<string, string[]> = {
  'Quant Formula Sheet': [
    'Quant Formula Sheet','Quant Formula Sheet Tab','Quant Menu','Quant Tab',
    'Quant Tab Clicked','Quant Topic Viewed','Quant View: SI-CI','Quant View: Statistics',
    'Quant: Average','Quant: Mensuration 2D','Quant: Mensuration 3D',
    'Quant: Profit & Loss','Quant: Statistics','Viewed Quant: Mensuration 2D',
  ],
  'Infographics': [
    'Image: Budget 2026-27','Info View: Budget 2026-27','Info View: WPL 2026',
    'Infographic Viewed','Infographics','Infographics Menu','Infographics Tab',
    'Viewed Image: Budget 2026-27',
  ],
  'Study Plans': [
    'Plans Tab','Study Plan Archive Day Viewed','Study Plan Archive Opened',
    'Study Plan Selected','Study Plans','Study Plans Tab',
  ],
  'AI Doubt Solver': ['AI Doubt Solver Tab','AI_DOUBT_QUERY','AI_DOUBT_QUERY_IMAGE'],
  'Trending Tests': ['Trending Tests Tab'],
  'Super Pass': ['Super Pass Course Selected','Super Pass Live Classes Tab','Super Pass Tab'],
  'Feedback Hub': [
    'FEEDBACK','FEEDBACK_SUBMITTED','Feedback Hub Tab','Feedback Menu',
    'Feedback Request Triggered','SUBMIT_COURSE_FEED','SUBMIT_GEN_FEED',
  ],
  'Assignment': ['Assignment Tab'],
  'Free PDFs': ['Free PDFs Tab'],
}

const TAB_COLORS = [
  '#6c63ff','#00d4aa','#ff6b6b','#ffd166','#06d6a0',
  '#118ab2','#ef476f','#ffc43d','#1b998b','#e9c46a',
]

const START_DATE = new Date('2026-02-17')

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseDate(raw: string): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function fmt(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [csvUrl, setCsvUrl] = useState(process.env.NEXT_PUBLIC_SHEET_CSV_URL || '')
  const [inputUrl, setInputUrl] = useState(process.env.NEXT_PUBLIC_SHEET_CSV_URL || '')
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async (url: string) => {
    if (!url) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(url)
      const text = await res.text()
      const parsed = Papa.parse<UserRow>(text, { header: true, skipEmptyLines: true })
      setRows(parsed.data)
      setLastRefresh(new Date())
    } catch {
      setError('Could not fetch CSV. Make sure the Google Sheet is published and the URL is correct.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (csvUrl) load(csvUrl)
  }, [csvUrl, load])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!csvUrl) return
    const t = setInterval(() => load(csvUrl), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [csvUrl, load])

  // ── Computed metrics ──────────────────────────────────────────────────────
  const filtered = rows.filter(r => {
    const d = parseDate(r['Timestamp'])
    return d && d >= START_DATE
  })

  const totalEntries = filtered.length

  const uniqueUsers = new Set(
    filtered.filter(r => r['User ID']).map(r => r['User ID'])
  ).size

  // Tab click counts
  const tabCounts: Record<string, number> = {}
  for (const [tab, keywords] of Object.entries(TAB_GROUPS)) {
    tabCounts[tab] = filtered.filter(r => keywords.includes(r['Tab Clicked'])).length
  }
  const totalTabClicks = Object.values(tabCounts).reduce((a, b) => a + b, 0)

  // Tab chart data
  const tabChartData = Object.entries(tabCounts)
    .map(([name, clicks]) => ({ name, clicks }))
    .sort((a, b) => b.clicks - a.clicks)

  // Pie data
  const pieData = tabChartData.filter(d => d.clicks > 0)

  // Date-wise data
  const dateMap: Record<string, { entries: number; users: Set<string> }> = {}
  filtered.forEach(r => {
    const d = parseDate(r['Timestamp'])
    if (!d) return
    const key = d.toISOString().split('T')[0]
    if (!dateMap[key]) dateMap[key] = { entries: 0, users: new Set() }
    dateMap[key].entries++
    if (r['User ID']) dateMap[key].users.add(r['User ID'])
  })
  const dateChartData = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: fmt(new Date(date)),
      entries: v.entries,
      users: v.users.size,
    }))

  // Recent 10 rows table
  const recentRows = [...filtered]
    .sort((a, b) => {
      const da = parseDate(a['Timestamp'])
      const db = parseDate(b['Timestamp'])
      return (db?.getTime() ?? 0) - (da?.getTime() ?? 0)
    })
    .slice(0, 10)

  const statusLabel = (clicks: number) =>
    clicks > 500 ? '🔥 High' : clicks > 100 ? '✅ Medium' : '⚠️ Low'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', color: '#e8eaf6', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Header */}
      <header style={{ background: '#1a1d2e', borderBottom: '1px solid #2a2f4e', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            📱 <span style={{ color: '#6c63ff' }}>Telegram Bot</span> — Analytics Dashboard
          </h1>
          <p style={{ fontSize: '0.78rem', color: '#8892b0', marginTop: 3 }}>
            📊 Data from Feb 17, 2026 onwards
            {lastRefresh && ` · Last refreshed: ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          onClick={() => load(csvUrl)}
          disabled={loading || !csvUrl}
          style={{ background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '⟳ Refreshing…' : '↻ Refresh'}
        </button>
      </header>

      {/* CSV URL bar */}
      <div style={{ background: '#20243a', borderBottom: '1px solid #2a2f4e', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.82rem', color: '#8892b0', whiteSpace: 'nowrap' }}>📄 Google Sheet CSV URL:</span>
        <input
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          placeholder="Paste your published CSV URL here…"
          style={{ flex: 1, minWidth: 260, background: '#0f1117', border: '1px solid #2a2f4e', borderRadius: 8, padding: '7px 12px', color: '#e8eaf6', fontSize: '0.82rem', outline: 'none' }}
        />
        <button
          onClick={() => setCsvUrl(inputUrl)}
          style={{ background: '#00d4aa', color: '#0f1117', border: 'none', borderRadius: 8, padding: '7px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
        >
          Load
        </button>
      </div>

      {error && (
        <div style={{ margin: '16px 28px', background: '#3d1a1a', border: '1px solid #ff6b6b', borderRadius: 10, padding: '12px 16px', color: '#ff6b6b', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {!csvUrl && !loading && (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#8892b0' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>📋</div>
          <p style={{ fontSize: '1rem' }}>Paste your Google Sheet CSV URL above and click <strong style={{ color: '#00d4aa' }}>Load</strong> to see your dashboard.</p>
          <p style={{ fontSize: '0.8rem', marginTop: 10 }}>Go to Google Sheets → File → Share → Publish to web → Users sheet → CSV format → Publish → Copy URL</p>
        </div>
      )}

      {csvUrl && rows.length === 0 && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#8892b0' }}>No data found. Check your CSV URL or add data to the Users sheet.</div>
      )}

      {rows.length > 0 && (
        <main style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Key Metrics */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {[
              { icon: '📝', label: 'Total Entries', value: totalEntries, color: '#6c63ff' },
              { icon: '👥', label: 'Unique Users', value: uniqueUsers, color: '#00d4aa' },
              { icon: '🖱️', label: 'Total Tab Clicks', value: totalTabClicks, color: '#ffd166' },
              { icon: '📅', label: 'Active Days', value: dateChartData.length, color: '#ff6b6b' },
            ].map(m => (
              <div key={m.label} style={{ background: '#1a1d2e', border: '1px solid #2a2f4e', borderRadius: 14, padding: '20px 22px' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{m.icon}</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: m.color }}>{m.value.toLocaleString()}</div>
                <div style={{ fontSize: '0.82rem', color: '#8892b0', marginTop: 4 }}>{m.label}</div>
              </div>
            ))}
          </section>

          {/* Charts row */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>

            {/* Bar chart - Tab clicks */}
            <div style={{ background: '#1a1d2e', border: '1px solid #2a2f4e', borderRadius: 14, padding: 20 }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, color: '#c8caff' }}>🖱️ Tab Clicks Breakdown</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={tabChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" tick={{ fill: '#8892b0', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#e8eaf6', fontSize: 11 }} width={120} />
                  <Tooltip contentStyle={{ background: '#20243a', border: '1px solid #2a2f4e', borderRadius: 8, color: '#e8eaf6' }} />
                  <Bar dataKey="clicks" radius={[0, 6, 6, 0]}>
                    {tabChartData.map((_, i) => (
                      <Cell key={i} fill={TAB_COLORS[i % TAB_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart */}
            <div style={{ background: '#1a1d2e', border: '1px solid #2a2f4e', borderRadius: 14, padding: 20 }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, color: '#c8caff' }}>🥧 Tab Distribution</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="clicks" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={TAB_COLORS[i % TAB_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#20243a', border: '1px solid #2a2f4e', borderRadius: 8, color: '#e8eaf6' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Line chart - date wise */}
          <div style={{ background: '#1a1d2e', border: '1px solid #2a2f4e', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, color: '#c8caff' }}>📅 Daily Activity</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dateChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f4e" />
                <XAxis dataKey="date" tick={{ fill: '#8892b0', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#20243a', border: '1px solid #2a2f4e', borderRadius: 8, color: '#e8eaf6' }} />
                <Legend />
                <Line type="monotone" dataKey="entries" stroke="#6c63ff" strokeWidth={2} dot={false} name="Entries" />
                <Line type="monotone" dataKey="users" stroke="#00d4aa" strokeWidth={2} dot={false} name="Unique Users" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tab Summary Table */}
          <div style={{ background: '#1a1d2e', border: '1px solid #2a2f4e', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, color: '#c8caff' }}>📊 Tab Summary Table</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2f4e' }}>
                    {['Tab Name', 'Total Clicks', '% of Total', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#8892b0', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabChartData.map((row, i) => (
                    <tr key={row.name} style={{ borderBottom: '1px solid #1e2235', background: i % 2 === 0 ? 'transparent' : '#20243a' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 500 }}>{row.name}</td>
                      <td style={{ padding: '9px 12px', color: TAB_COLORS[i % TAB_COLORS.length], fontWeight: 700 }}>{row.clicks.toLocaleString()}</td>
                      <td style={{ padding: '9px 12px', color: '#8892b0' }}>{totalTabClicks > 0 ? ((row.clicks / totalTabClicks) * 100).toFixed(1) : 0}%</td>
                      <td style={{ padding: '9px 12px' }}>{statusLabel(row.clicks)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid #2a2f4e', fontWeight: 700 }}>
                    <td style={{ padding: '9px 12px' }}>TOTAL</td>
                    <td style={{ padding: '9px 12px', color: '#ffd166' }}>{totalTabClicks.toLocaleString()}</td>
                    <td style={{ padding: '9px 12px' }}>100%</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ background: '#1a1d2e', border: '1px solid #2a2f4e', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, color: '#c8caff' }}>🕐 Recent Activity (Latest 10)</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2f4e' }}>
                    {['User ID', 'Name', 'Tab Clicked', 'Timestamp'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#8892b0', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e2235', background: i % 2 === 0 ? 'transparent' : '#20243a' }}>
                      <td style={{ padding: '8px 12px', color: '#6c63ff', fontFamily: 'monospace' }}>{r['User ID']}</td>
                      <td style={{ padding: '8px 12px' }}>{r['Name'] || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#00d4aa' }}>{r['Tab Clicked']}</td>
                      <td style={{ padding: '8px 12px', color: '#8892b0' }}>{r['Timestamp']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      )}
    </div>
  )
}
