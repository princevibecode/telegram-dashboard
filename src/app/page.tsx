'use client'
import { useEffect, useState, useCallback } from 'react'
import Papa from 'papaparse'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts'

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

const TAB_GROUPS: Record<string, string[]> = {
  'Study Plans': ['Plans Tab','Study Plan Archive Day Viewed','Study Plan Archive Opened','Study Plan Selected','Study Plans','Study Plans Tab'],
  'Quant Formula Sheet': ['Quant Formula Sheet','Quant Formula Sheet Tab','Quant Menu','Quant Tab','Quant Tab Clicked','Quant Topic Viewed','Quant View: SI-CI','Quant View: Statistics','Quant: Average','Quant: Mensuration 2D','Quant: Mensuration 3D','Quant: Profit & Loss','Quant: Statistics','Viewed Quant: Mensuration 2D'],
  'Infographics': ['Image: Budget 2026-27','Info View: Budget 2026-27','Info View: WPL 2026','Infographic Viewed','Infographics','Infographics Menu','Infographics Tab','Viewed Image: Budget 2026-27'],
  'Super Pass': ['Super Pass Course Selected','Super Pass Live Classes Tab','Super Pass Tab'],
  'Trending Tests': ['Trending Tests Tab'],
  'AI Doubt Solver': ['AI Doubt Solver Tab','AI_DOUBT_QUERY','AI_DOUBT_QUERY_IMAGE'],
  'Feedback Hub': ['FEEDBACK','FEEDBACK_SUBMITTED','Feedback Hub Tab','Feedback Menu','Feedback Request Triggered','SUBMIT_COURSE_FEED','SUBMIT_GEN_FEED'],
}

const SUB_TOPICS: Record<string, string[]> = {
  'Study Plans': ['Study Plans Tab','Study Plan Selected','Study Plan Archive Opened','Study Plan Archive Day Viewed'],
  'Quant Formula Sheet': ['Quant Topic Viewed','Quant Formula Sheet Tab','Quant View: SI-CI','Quant View: Statistics','Quant: Average','Quant: Mensuration 2D','Quant: Mensuration 3D','Quant: Profit & Loss','Quant: Statistics','Viewed Quant: Mensuration 2D','Quant Formula Sheet'],
  'Infographics': ['Infographic Viewed','Infographics Tab','Image: Budget 2026-27','Info View: Budget 2026-27','Info View: WPL 2026','Viewed Image: Budget 2026-27'],
  'Super Pass': ['Super Pass Tab','Super Pass Live Classes Tab','Super Pass Course Selected'],
  'Trending Tests': ['Trending Tests Tab'],
  'AI Doubt Solver': ['AI Doubt Solver Tab','AI_DOUBT_QUERY','AI_DOUBT_QUERY_IMAGE'],
  'Feedback Hub': ['Feedback Hub Tab','Feedback Menu','FEEDBACK','FEEDBACK_SUBMITTED','Feedback Request Triggered','SUBMIT_COURSE_FEED','SUBMIT_GEN_FEED'],
}

const TAB_COLORS = ['#6c63ff','#00d4aa','#ff6b6b','#ffd166','#06d6a0','#118ab2','#ef476f']

const MARCH_30 = new Date('2026-03-30T00:00:00')

function parseDate(raw: string): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function fmt(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

const statusLabel = (clicks: number) =>
  clicks > 500 ? '🔥 High' : clicks > 100 ? '✅ Medium' : '⚠️ Low'

const AI_DOUBT_TABS = ['AI_DOUBT_QUERY', 'AI_DOUBT_QUERY_IMAGE']

export default function Dashboard() {
  const [csvUrl, setCsvUrl] = useState(process.env.NEXT_PUBLIC_SHEET_CSV_URL || '')
  const [inputUrl, setInputUrl] = useState(process.env.NEXT_PUBLIC_SHEET_CSV_URL || '')
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [dateFilter, setDateFilter] = useState<'overall' | 'march30'>('overall')
  const [feedbackDays, setFeedbackDays] = useState<7 | 15 | 30>(7)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async (url: string) => {
    if (!url) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`${url}&t=${Date.now()}`)
      const text = await res.text()
      const parsed = Papa.parse<UserRow>(text, { header: true, skipEmptyLines: true })
      setRows(parsed.data)
      setLastRefresh(new Date())
    } catch {
      setError('Could not fetch CSV. Make sure the Google Sheet is published and the URL is correct.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (csvUrl) load(csvUrl) }, [csvUrl, load])
  useEffect(() => {
    if (!csvUrl) return
    const t = setInterval(() => load(csvUrl), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [csvUrl, load])

  // Apply date filter
  const filtered = rows.filter(r => {
    if (!(r['User ID'] || r['Tab Clicked'])) return false
    if (dateFilter === 'march30') {
      const d = parseDate(r['Timestamp'])
      if (!d) return false
      return d >= MARCH_30
    }
    return true
  })

  const totalEntries = filtered.length
  const uniqueUsers = new Set(filtered.filter(r => r['User ID']).map(r => r['User ID'])).size

  const tabCounts: Record<string, number> = {}
  filtered.forEach(r => {
    const tab = r['Tab Clicked']
    if (!tab) return
    for (const [groupName, keywords] of Object.entries(TAB_GROUPS)) {
      if (keywords.includes(tab)) { tabCounts[groupName] = (tabCounts[groupName] || 0) + 1; break }
    }
  })
  const totalTabClicks = Object.values(tabCounts).reduce((a, b) => a + b, 0)
  const tabChartData = Object.entries(tabCounts).map(([name, clicks]) => ({ name, clicks })).sort((a, b) => b.clicks - a.clicks)
  const pieData = tabChartData.filter(d => d.clicks > 0)

  const subTopicData: Record<string, { name: string; count: number; pct: string }[]> = {}
  for (const [tab, subtopics] of Object.entries(SUB_TOPICS)) {
    const tabTotal = tabCounts[tab] || 0
    subTopicData[tab] = subtopics
      .map(st => {
        const count = filtered.filter(r => r['Tab Clicked'] === st).length
        return { name: st, count, pct: tabTotal > 0 ? ((count / tabTotal) * 100).toFixed(1) : '0.0' }
      })
      .filter(s => s.count > 0).sort((a, b) => b.count - a.count)
  }

  // Super Pass courses
  const courseCounts: Record<string, number> = {}
  filtered.forEach(r => {
    if (r['Tab Clicked'] === 'Super Pass Course Selected' && r['Course Name']) {
      const c = r['Course Name'].trim()
      courseCounts[c] = (courseCounts[c] || 0) + 1
    }
  })
  const courseData = Object.entries(courseCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  // Study Plan names from Course Name column (when Tab Clicked = Study Plan Selected)
  const studyPlanCounts: Record<string, number> = {}
  filtered.forEach(r => {
    if (r['Tab Clicked'] === 'Study Plan Selected' && r['Course Name']) {
      const p = r['Course Name'].trim()
      studyPlanCounts[p] = (studyPlanCounts[p] || 0) + 1
    }
  })
  const studyPlanData = Object.entries(studyPlanCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  // Top 5 Infographics from Course Name column
  const infographicCounts: Record<string, number> = {}
  filtered.forEach(r => {
    const tab = r['Tab Clicked']
    if ((tab === 'Infographic Viewed' || tab === 'Info View: Budget 2026-27' || tab === 'Info View: WPL 2026' || tab === 'Image: Budget 2026-27' || tab === 'Viewed Image: Budget 2026-27') && r['Course Name']) {
      const name = r['Course Name'].trim()
      infographicCounts[name] = (infographicCounts[name] || 0) + 1
    }
  })
  const infographicData = Object.entries(infographicCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)

  // Top 5 Quant topics from Course Name column
  const quantTopicCounts: Record<string, number> = {}
  filtered.forEach(r => {
    const tab = r['Tab Clicked']
    if ((tab === 'Quant Topic Viewed' || tab === 'Quant View: SI-CI' || tab === 'Quant View: Statistics' || tab === 'Quant: Average' || tab === 'Quant: Mensuration 2D' || tab === 'Quant: Mensuration 3D' || tab === 'Quant: Profit & Loss' || tab === 'Quant: Statistics' || tab === 'Viewed Quant: Mensuration 2D') && r['Course Name']) {
      const name = r['Course Name'].trim()
      quantTopicCounts[name] = (quantTopicCounts[name] || 0) + 1
    }
  })
  const quantTopicData = Object.entries(quantTopicCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)

  const dateMap: Record<string, { entries: number; users: Set<string> }> = {}
  filtered.forEach(r => {
    const d = parseDate(r['Timestamp'])
    if (!d) return
    const key = d.toISOString().split('T')[0]
    if (!dateMap[key]) dateMap[key] = { entries: 0, users: new Set() }
    dateMap[key].entries++
    if (r['User ID']) dateMap[key].users.add(r['User ID'])
  })
  const dateChartData = Object.entries(dateMap).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date: fmt(new Date(date)), entries: v.entries, users: v.users.size }))

  // General Feedback — filtered by last N days, excluding AI doubt queries
  const now = new Date()
  const feedbackCutoff = new Date(now)
  feedbackCutoff.setDate(now.getDate() - feedbackDays)

  const generalFeedbacks = rows.filter(r => {
    const fb = r['General Feedback']?.trim()
    if (!fb) return false
    if (AI_DOUBT_TABS.includes(r['Tab Clicked'])) return false
    const d = parseDate(r['Timestamp'])
    if (!d) return false
    return d >= feedbackCutoff
  }).map(r => r['General Feedback'].trim())

  const handleCopyFeedback = () => {
    const text = generalFeedbacks.join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const card = { background: '#1a1d2e', border: '1px solid #2a2f4e', borderRadius: 14, padding: 20 } as const
  const ttStyle = { contentStyle: { background: '#20243a', border: '1px solid #2a2f4e', borderRadius: 8, color: '#e8eaf6' } }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', color: '#e8eaf6', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      <header style={{ background: '#1a1d2e', borderBottom: '1px solid #2a2f4e', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>📱 <span style={{ color: '#6c63ff' }}>Telegram Bot</span> — Analytics Dashboard</h1>
          <p style={{ fontSize: '0.78rem', color: '#8892b0', marginTop: 3 }}>{lastRefresh ? `Last refreshed: ${lastRefresh.toLocaleTimeString()}` : 'Paste your CSV URL below to load data'}</p>
        </div>
        <button onClick={() => load(csvUrl)} disabled={loading || !csvUrl}
          style={{ background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', opacity: loading ? 0.6 : 1 }}>
          {loading ? '⟳ Refreshing…' : '↻ Refresh'}
        </button>
      </header>

      <div style={{ background: '#20243a', borderBottom: '1px solid #2a2f4e', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.82rem', color: '#8892b0', whiteSpace: 'nowrap' }}>📄 Google Sheet CSV URL:</span>
        <input value={inputUrl} onChange={e => setInputUrl(e.target.value)}
          placeholder="Paste your published CSV URL here…"
          style={{ flex: 1, minWidth: 260, background: '#0f1117', border: '1px solid #2a2f4e', borderRadius: 8, padding: '7px 12px', color: '#e8eaf6', fontSize: '0.82rem', outline: 'none' }} />
        <button onClick={() => setCsvUrl(inputUrl)}
          style={{ background: '#00d4aa', color: '#0f1117', border: 'none', borderRadius: 8, padding: '7px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
          Load
        </button>
      </div>

      {/* Date Filter */}
      {rows.length > 0 && (
        <div style={{ background: '#0f1117', borderBottom: '1px solid #2a2f4e', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.82rem', color: '#8892b0' }}>🗓️ Filter:</span>
          <button
            onClick={() => setDateFilter('overall')}
            style={{
              background: dateFilter === 'overall' ? '#6c63ff' : '#1a1d2e',
              color: dateFilter === 'overall' ? '#fff' : '#8892b0',
              border: '1px solid #2a2f4e', borderRadius: 8, padding: '6px 18px',
              fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem'
            }}>
            📊 Overall
          </button>
          <button
            onClick={() => setDateFilter('march30')}
            style={{
              background: dateFilter === 'march30' ? '#6c63ff' : '#1a1d2e',
              color: dateFilter === 'march30' ? '#fff' : '#8892b0',
              border: '1px solid #2a2f4e', borderRadius: 8, padding: '6px 18px',
              fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem'
            }}>
            📅 30th March 2026 Onwards
          </button>
        </div>
      )}

      {error && (
        <div style={{ margin: '16px 28px', background: '#3d1a1a', border: '1px solid #ff6b6b', borderRadius: 10, padding: '12px 16px', color: '#ff6b6b', fontSize: '0.85rem' }}>⚠️ {error}</div>
      )}

      {!csvUrl && !loading && (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#8892b0' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>📋</div>
          <p style={{ fontSize: '1rem' }}>Paste your Google Sheet CSV URL above and click <strong style={{ color: '#00d4aa' }}>Load</strong></p>
          <p style={{ fontSize: '0.8rem', marginTop: 10 }}>Google Sheets → File → Share → Publish to web → Users sheet → CSV → Publish → Copy URL</p>
        </div>
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

          {/* Charts */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            <div style={card}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, color: '#c8caff' }}>🖱️ Tab Clicks Breakdown</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={tabChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" tick={{ fill: '#8892b0', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#e8eaf6', fontSize: 11 }} width={120} />
                  <Tooltip {...ttStyle} />
                  <Bar dataKey="clicks" radius={[0, 6, 6, 0]}>
                    {tabChartData.map((_, i) => <Cell key={i} fill={TAB_COLORS[i % TAB_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={card}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, color: '#c8caff' }}>🥧 Tab Distribution</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="clicks" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {pieData.map((_, i) => <Cell key={i} fill={TAB_COLORS[i % TAB_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...ttStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Daily Activity */}
          <div style={card}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, color: '#c8caff' }}>📅 Daily Activity</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dateChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f4e" />
                <XAxis dataKey="date" tick={{ fill: '#8892b0', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} />
                <Tooltip {...ttStyle} />
                <Legend />
                <Line type="monotone" dataKey="entries" stroke="#6c63ff" strokeWidth={2} dot={false} name="Entries" />
                <Line type="monotone" dataKey="users" stroke="#00d4aa" strokeWidth={2} dot={false} name="Unique Users" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tab Summary Table */}
          <div style={card}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, color: '#c8caff' }}>📊 Tab Summary</h2>
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

          {/* Sub-topic Breakdown */}
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, color: '#c8caff' }}>🔍 Sub-Topic Wise Breakdown</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
              {tabChartData.map((tab, ti) => {
                const subtopics = subTopicData[tab.name] || []
                const color = TAB_COLORS[ti % TAB_COLORS.length]
                return (
                  <div key={tab.name} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                    <div style={{ background: color + '22', borderBottom: '1px solid #2a2f4e', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color, fontSize: '0.9rem' }}>{tab.name}</span>
                      <span style={{ background: color, color: '#fff', borderRadius: 20, padding: '2px 12px', fontSize: '0.8rem', fontWeight: 700 }}>{tab.clicks} Total</span>
                    </div>
                    {subtopics.length === 0 ? (
                      <div style={{ padding: '16px', color: '#8892b0', fontSize: '0.82rem' }}>No sub-topic data yet</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #2a2f4e' }}>
                            <th style={{ textAlign: 'left', padding: '8px 16px', color: '#8892b0', fontWeight: 600 }}>#</th>
                            <th style={{ textAlign: 'left', padding: '8px 16px', color: '#8892b0', fontWeight: 600 }}>Sub-Topic / Action</th>
                            <th style={{ textAlign: 'right', padding: '8px 16px', color: '#8892b0', fontWeight: 600 }}>Count</th>
                            <th style={{ textAlign: 'right', padding: '8px 16px', color: '#8892b0', fontWeight: 600 }}>% of Tab</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subtopics.map((st, i) => (
                            <tr key={st.name} style={{ borderBottom: '1px solid #1e2235', background: i % 2 === 0 ? 'transparent' : '#20243a' }}>
                              <td style={{ padding: '7px 16px', color: '#8892b0' }}>{i + 1}</td>
                              <td style={{ padding: '7px 16px' }}>{st.name}</td>
                              <td style={{ padding: '7px 16px', textAlign: 'right', color, fontWeight: 700 }}>{st.count}</td>
                              <td style={{ padding: '7px 16px', textAlign: 'right', color: '#8892b0' }}>{st.pct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Study Plan Names */}
                    {tab.name === 'Study Plans' && studyPlanData.length > 0 && (
                      <div style={{ borderTop: '2px solid #2a2f4e' }}>
                        <div style={{ padding: '10px 16px', color: '#6c63ff', fontWeight: 700, fontSize: '0.85rem', background: '#6c63ff15' }}>
                          📋 Plans Selected by Users
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #2a2f4e' }}>
                              <th style={{ textAlign: 'left', padding: '7px 16px', color: '#8892b0', fontWeight: 600 }}>#</th>
                              <th style={{ textAlign: 'left', padding: '7px 16px', color: '#8892b0', fontWeight: 600 }}>Plan Name</th>
                              <th style={{ textAlign: 'right', padding: '7px 16px', color: '#8892b0', fontWeight: 600 }}>Selections</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studyPlanData.map((p, i) => (
                              <tr key={p.name} style={{ borderBottom: '1px solid #1e2235', background: i % 2 === 0 ? 'transparent' : '#20243a' }}>
                                <td style={{ padding: '7px 16px', color: '#8892b0' }}>{i + 1}</td>
                                <td style={{ padding: '7px 16px', color: '#6c63ff' }}>{p.name}</td>
                                <td style={{ padding: '7px 16px', textAlign: 'right', fontWeight: 700, color: '#6c63ff' }}>{p.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Top 5 Infographics */}
                    {tab.name === 'Infographics' && infographicData.length > 0 && (
                      <div style={{ borderTop: '2px solid #2a2f4e' }}>
                        <div style={{ padding: '10px 16px', color: '#ff6b6b', fontWeight: 700, fontSize: '0.85rem', background: '#ff6b6b15' }}>
                          🖼️ Top 5 Infographics Viewed
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #2a2f4e' }}>
                              <th style={{ textAlign: 'left', padding: '7px 16px', color: '#8892b0', fontWeight: 600 }}>#</th>
                              <th style={{ textAlign: 'left', padding: '7px 16px', color: '#8892b0', fontWeight: 600 }}>Infographic Name</th>
                              <th style={{ textAlign: 'right', padding: '7px 16px', color: '#8892b0', fontWeight: 600 }}>Views</th>
                            </tr>
                          </thead>
                          <tbody>
                            {infographicData.map((inf, i) => (
                              <tr key={inf.name} style={{ borderBottom: '1px solid #1e2235', background: i % 2 === 0 ? 'transparent' : '#20243a' }}>
                                <td style={{ padding: '7px 16px', color: '#8892b0' }}>{i + 1}</td>
                                <td style={{ padding: '7px 16px', color: '#ff6b6b' }}>{inf.name}</td>
                                <td style={{ padding: '7px 16px', textAlign: 'right', fontWeight: 700, color: '#ff6b6b' }}>{inf.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Top 5 Quant Topics */}
                    {tab.name === 'Quant Formula Sheet' && quantTopicData.length > 0 && (
                      <div style={{ borderTop: '2px solid #2a2f4e' }}>
                        <div style={{ padding: '10px 16px', color: '#ffd166', fontWeight: 700, fontSize: '0.85rem', background: '#ffd16615' }}>
                          🔢 Top 5 Quant Topics Viewed
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #2a2f4e' }}>
                              <th style={{ textAlign: 'left', padding: '7px 16px', color: '#8892b0', fontWeight: 600 }}>#</th>
                              <th style={{ textAlign: 'left', padding: '7px 16px', color: '#8892b0', fontWeight: 600 }}>Topic Name</th>
                              <th style={{ textAlign: 'right', padding: '7px 16px', color: '#8892b0', fontWeight: 600 }}>Views</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quantTopicData.map((q, i) => (
                              <tr key={q.name} style={{ borderBottom: '1px solid #1e2235', background: i % 2 === 0 ? 'transparent' : '#20243a' }}>
                                <td style={{ padding: '7px 16px', color: '#8892b0' }}>{i + 1}</td>
                                <td style={{ padding: '7px 16px', color: '#ffd166' }}>{q.name}</td>
                                <td style={{ padding: '7px 16px', textAlign: 'right', fontWeight: 700, color: '#ffd166' }}>{q.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Super Pass Courses */}
                    {tab.name === 'Super Pass' && courseData.length > 0 && (
                      <div style={{ borderTop: '2px solid #2a2f4e' }}>
                        <div style={{ padding: '10px 16px', color: '#ffd166', fontWeight: 700, fontSize: '0.85rem', background: '#ffd16615' }}>
                          📚 Courses Being Viewed
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #2a2f4e' }}>
                              <th style={{ textAlign: 'left', padding: '7px 16px', color: '#8892b0', fontWeight: 600 }}>#</th>
                              <th style={{ textAlign: 'left', padding: '7px 16px', color: '#8892b0', fontWeight: 600 }}>Course Name</th>
                              <th style={{ textAlign: 'right', padding: '7px 16px', color: '#8892b0', fontWeight: 600 }}>Views</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courseData.map((c, i) => (
                              <tr key={c.name} style={{ borderBottom: '1px solid #1e2235', background: i % 2 === 0 ? 'transparent' : '#20243a' }}>
                                <td style={{ padding: '7px 16px', color: '#8892b0' }}>{i + 1}</td>
                                <td style={{ padding: '7px 16px', color: '#ffd166' }}>{c.name}</td>
                                <td style={{ padding: '7px 16px', textAlign: 'right', fontWeight: 700, color: '#ffd166' }}>{c.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── General Feedback Section ── */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ background: '#06d6a022', borderBottom: '1px solid #2a2f4e', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <span style={{ fontWeight: 700, color: '#06d6a0', fontSize: '0.95rem' }}>💬 General Feedback</span>
                <span style={{ marginLeft: 12, background: '#06d6a0', color: '#0f1117', borderRadius: 20, padding: '2px 12px', fontSize: '0.8rem', fontWeight: 700 }}>
                  {generalFeedbacks.length} responses
                </span>
              </div>
              {/* Day filter buttons */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {([7, 15, 30] as const).map(d => (
                  <button key={d} onClick={() => setFeedbackDays(d)}
                    style={{
                      background: feedbackDays === d ? '#06d6a0' : '#1a1d2e',
                      color: feedbackDays === d ? '#0f1117' : '#8892b0',
                      border: '1px solid #2a2f4e', borderRadius: 8,
                      padding: '5px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem'
                    }}>
                    Last {d}d
                  </button>
                ))}
                <button onClick={handleCopyFeedback} disabled={generalFeedbacks.length === 0}
                  style={{
                    background: copied ? '#00d4aa' : '#2a2f4e',
                    color: copied ? '#0f1117' : '#e8eaf6',
                    border: '1px solid #2a2f4e', borderRadius: 8,
                    padding: '5px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
                    transition: 'all 0.2s', opacity: generalFeedbacks.length === 0 ? 0.5 : 1
                  }}>
                  {copied ? '✅ Copied!' : '📋 Copy All'}
                </button>
              </div>
            </div>

            {/* Feedback list */}
            {generalFeedbacks.length === 0 ? (
              <div style={{ padding: '24px 20px', color: '#8892b0', fontSize: '0.85rem', textAlign: 'center' }}>
                No general feedback found for the last {feedbackDays} days.
              </div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: 'auto', padding: '12px 0' }}>
                {generalFeedbacks.map((fb, i) => (
                  <div key={i} style={{
                    padding: '10px 20px',
                    borderBottom: '1px solid #1e2235',
                    background: i % 2 === 0 ? 'transparent' : '#20243a',
                    display: 'flex', gap: 12, alignItems: 'flex-start'
                  }}>
                    <span style={{ color: '#8892b0', fontSize: '0.78rem', minWidth: 24, paddingTop: 2 }}>{i + 1}.</span>
                    <span style={{ fontSize: '0.85rem', lineHeight: 1.6, color: '#e8eaf6' }}>{fb}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tip */}
            <div style={{ padding: '10px 20px', borderTop: '1px solid #2a2f4e', background: '#0f1117', fontSize: '0.75rem', color: '#8892b0' }}>
              💡 Tip: Click <strong style={{ color: '#00d4aa' }}>Copy All</strong> to copy all feedbacks, then paste in ChatGPT or Claude for a summary.
            </div>
          </div>

        </main>
      )}
    </div>
  )
}
