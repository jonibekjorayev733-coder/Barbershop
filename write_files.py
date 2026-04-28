
tsx = '''import { useState } from "react";
import "./App.css";

type Page = "dashboard" | "barbers" | "bookings";
type BookingStatus = "completed" | "pending" | "cancelled";

interface Barber {
  id: string; name: string; specialty: string; phone: string;
  rating: number; totalCuts: number; todayCuts: number;
  status: "available" | "busy" | "off";
  initials: string; color: string; gradient: string;
}
interface Booking {
  id: string; client: string; phone: string; barber: string;
  service: string; price: number; time: string; date: string;
  status: BookingStatus;
}

const barbers: Barber[] = [
  { id:"b1", name:"Marcus Johnson",  specialty:"Fade & Design",  phone:"+1 555-0101", rating:4.9, totalCuts:1240, todayCuts:7, status:"busy",      initials:"MJ", color:"#818cf8", gradient:"linear-gradient(135deg,#6366f1,#818cf8)" },
  { id:"b2", name:"Diego Reyes",     specialty:"Classic Cuts",   phone:"+1 555-0102", rating:4.7, totalCuts:980,  todayCuts:4, status:"available",  initials:"DR", color:"#38bdf8", gradient:"linear-gradient(135deg,#0ea5e9,#38bdf8)" },
  { id:"b3", name:"Kai Thompson",    specialty:"Beard Styling",  phone:"+1 555-0103", rating:4.8, totalCuts:1105, todayCuts:5, status:"available",  initials:"KT", color:"#34d399", gradient:"linear-gradient(135deg,#10b981,#34d399)" },
  { id:"b4", name:"Andre Smith",     specialty:"Color & Tints",  phone:"+1 555-0104", rating:4.6, totalCuts:760,  todayCuts:3, status:"off",        initials:"AS", color:"#f87171", gradient:"linear-gradient(135deg,#ef4444,#f87171)" },
];

const bookings: Booking[] = [
  { id:"#BK001", client:"James Carter",   phone:"555-0201", barber:"Marcus Johnson", service:"Fade + Design",  price:45, time:"9:00 AM",  date:"2026-04-27", status:"completed" },
  { id:"#BK002", client:"Tyler Banks",    phone:"555-0202", barber:"Marcus Johnson", service:"Classic Cut",    price:30, time:"10:30 AM", date:"2026-04-27", status:"completed" },
  { id:"#BK003", client:"Andre Williams", phone:"555-0203", barber:"Kai Thompson",   service:"Beard Trim",     price:25, time:"11:00 AM", date:"2026-04-27", status:"completed" },
  { id:"#BK004", client:"Devon Miles",    phone:"555-0204", barber:"Diego Reyes",    service:"Classic Cut",    price:30, time:"1:00 PM",  date:"2026-04-27", status:"pending"   },
  { id:"#BK005", client:"Carlos Mendez",  phone:"555-0205", barber:"Kai Thompson",   service:"Fade + Design",  price:45, time:"2:30 PM",  date:"2026-04-27", status:"pending"   },
  { id:"#BK006", client:"Raj Patel",      phone:"555-0206", barber:"Diego Reyes",    service:"Color & Tints",  price:60, time:"3:00 PM",  date:"2026-04-27", status:"cancelled" },
  { id:"#BK007", client:"Sam Wilson",     phone:"555-0207", barber:"Marcus Johnson", service:"Fade + Design",  price:45, time:"4:00 PM",  date:"2026-04-27", status:"pending"   },
  { id:"#BK008", client:"Leo Martin",     phone:"555-0208", barber:"Kai Thompson",   service:"Full Grooming",  price:80, time:"5:00 PM",  date:"2026-04-27", status:"pending"   },
];

const chartData = [
  { day:"Mon", completed:12, pending:3 },{ day:"Tue", completed:18, pending:5 },
  { day:"Wed", completed:15, pending:4 },{ day:"Thu", completed:22, pending:6 },
  { day:"Fri", completed:28, pending:8 },{ day:"Sat", completed:35, pending:10 },
  { day:"Sun", completed:8,  pending:2 },
];
const maxChart = Math.max(...chartData.map(d => d.completed + d.pending));

const IGrid   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>;
const IUsers  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const ICal    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const ISciss  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>;
const ITrend  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
const IBell   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const ISearch = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IStar   = () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IPhone  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.4 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6 6l.9-.9a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const ILogout = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IPlus   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IFilter = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
const IDollar = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const ICheck  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;

function StatCard({ value, label, sub, gradient, icon }: {
  value: string; label: string; sub: string; gradient: string; icon: React.ReactNode;
}) {
  return (
    <div className="sc" style={{ background: gradient }}>
      <div className="sc-top">
        <div className="sc-icon">{icon}</div>
        <span className="sc-badge">{sub}</span>
      </div>
      <div className="sc-value">{value}</div>
      <div className="sc-label">{label}</div>
      <div className="sc-glow" />
    </div>
  );
}

function BookingsTable({ rows }: { rows: Booking[] }) {
  return (
    <div className="tbl-wrap">
      <table className="dtable">
        <thead>
          <tr>
            <th>Client</th><th>Barber</th><th>Service</th>
            <th>Date &amp; Time</th><th>Price</th><th>Status</th><th>ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>
                <div className="client-cell">
                  <div className="c-av" style={{ background: barbers.find(b => b.name === r.barber)?.gradient || "linear-gradient(135deg,#6366f1,#818cf8)" }}>{r.client[0]}</div>
                  <div><strong>{r.client}</strong><small>{r.phone}</small></div>
                </div>
              </td>
              <td><span className="barber-tag">{r.barber}</span></td>
              <td>{r.service}</td>
              <td><strong>{r.time}</strong><small>{r.date}</small></td>
              <td><strong className="price-tag">${r.price}</strong></td>
              <td><span className={"badge b-" + r.status}>{r.status}</span></td>
              <td><span className="bk-id">{r.id}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const completed = bookings.filter(b => b.status === "completed").length;
  const pending   = bookings.filter(b => b.status === "pending").length;
  const revenue   = bookings.filter(b => b.status === "completed").reduce((s, b) => s + b.price, 0);
  return (
    <>
      <div className="ph">
        <div>
          <div className="ph-eyebrow">Overview</div>
          <h2 className="ph-title">Dashboard</h2>
          <p className="ph-sub">Monday, April 27, 2026</p>
        </div>
        <button className="btn-glow" onClick={() => onNavigate("bookings")}><IPlus /> New Booking</button>
      </div>

      <div className="sc-row">
        <StatCard value={String(bookings.length)}                          label="Total Bookings" sub="Today"      gradient="linear-gradient(135deg,#1e40af,#3b82f6)" icon={<ICal />} />
        <StatCard value={String(barbers.filter(b=>b.status!=="off").length)} label="Active Barbers" sub="On duty"  gradient="linear-gradient(135deg,#0f172a,#1e293b)" icon={<IUsers />} />
        <StatCard value={String(completed)}                                label="Completed"      sub="Done today" gradient="linear-gradient(135deg,#065f46,#059669)" icon={<ICheck />} />
        <StatCard value={String(pending)}                                  label="Pending"        sub="Awaiting"   gradient="linear-gradient(135deg,#78350f,#d97706)" icon={<ISciss />} />
      </div>

      <div className="mid-grid">
        <div className="glass-card chart-card">
          <div className="gc-head">
            <div>
              <div className="gc-eyebrow">Analytics</div>
              <h3>Weekly Bookings</h3>
              <p>Completed vs Pending — this week</p>
            </div>
            <div className="legend">
              <div className="leg-item"><span className="leg-dot blue-dot" />Completed</div>
              <div className="leg-item"><span className="leg-dot dim-dot" />Pending</div>
            </div>
          </div>
          <div className="chart-area">
            <div className="y-lines">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="y-line" style={{ bottom: `${i * 25}%` }}>
                  <span>{Math.round(maxChart * i / 4)}</span>
                </div>
              ))}
            </div>
            <div className="bars-row">
              {chartData.map(d => (
                <div className="bar-col" key={d.day}>
                  <div className="bar-stack">
                    <div className="bar-seg bar-completed" style={{ height: `${(d.completed / maxChart) * 180}px` }} />
                    <div className="bar-seg bar-pending"   style={{ height: `${(d.pending   / maxChart) * 180}px` }} />
                  </div>
                  <span className="bar-lbl">{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card perf-card">
          <div className="gc-head">
            <div>
              <div className="gc-eyebrow">Team</div>
              <h3>Barber Performance</h3>
              <p>Today&apos;s completion</p>
            </div>
            <button className="link-btn" onClick={() => onNavigate("barbers")}>View all →</button>
          </div>
          <div className="perf-list">
            {barbers.map(b => {
              const total = b.todayCuts + (b.status === "busy" ? 2 : 1);
              const pct   = Math.round((b.todayCuts / total) * 100);
              return (
                <div className="perf-row" key={b.id}>
                  <div className="p-av" style={{ background: b.gradient }}>{b.initials}</div>
                  <div className="p-info">
                    <div className="p-top"><strong>{b.name}</strong><span>{pct}%</span></div>
                    <div className="track"><div className="track-fill" style={{ width: pct + "%", background: b.gradient }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rev-row">
        <div className="glass-card rev-card">
          <div className="rev-ico"><IDollar /></div>
          <div className="rev-val">${revenue}</div>
          <div className="rev-lbl">Today&apos;s Revenue</div>
          <div className="rev-sub">From {completed} bookings</div>
        </div>
        <div className="glass-card rev-card">
          <div className="rev-ico"><ITrend /></div>
          <div className="rev-val">${completed > 0 ? Math.round(revenue / completed) : 0}</div>
          <div className="rev-lbl">Avg. per Booking</div>
          <div className="rev-sub">Per completed service</div>
        </div>
        <div className="glass-card rev-card">
          <div className="rev-ico" style={{ background: "linear-gradient(135deg,#6366f1,#818cf8)" }}><IUsers /></div>
          <div className="rev-val" style={{ fontSize: "26px" }}>Marcus</div>
          <div className="rev-lbl">Top Barber</div>
          <div className="rev-sub">7 cuts · ⭐ 4.9</div>
        </div>
      </div>

      <div className="glass-card table-card">
        <div className="gc-head tc-head">
          <div>
            <div className="gc-eyebrow">Latest</div>
            <h3>Recent Bookings</h3>
            <p>Today&apos;s appointments</p>
          </div>
          <button className="link-btn" onClick={() => onNavigate("bookings")}>View all →</button>
        </div>
        <BookingsTable rows={bookings.slice(0, 6)} />
      </div>
    </>
  );
}

function BookingsPage() {
  const [filter, setFilter] = useState<"all" | BookingStatus>("all");
  const filtered = filter === "all" ? bookings : bookings.filter(b => b.status === filter);
  return (
    <>
      <div className="ph">
        <div>
          <div className="ph-eyebrow">Management</div>
          <h2 className="ph-title">Bookings</h2>
          <p className="ph-sub">All appointments</p>
        </div>
        <button className="btn-glow"><IPlus /> New Booking</button>
      </div>
      <div className="ftabs">
        {(["all", "completed", "pending", "cancelled"] as const).map(f => (
          <button key={f} className={"ftab " + (filter === f ? "ft-active" : "")} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="fc">{f === "all" ? bookings.length : bookings.filter(b => b.status === f).length}</span>
          </button>
        ))}
        <button className="filter-btn"><IFilter /> Filter</button>
      </div>
      <div className="glass-card table-card"><BookingsTable rows={filtered} /></div>
    </>
  );
}

function BarbersPage() {
  return (
    <>
      <div className="ph">
        <div>
          <div className="ph-eyebrow">Team</div>
          <h2 className="ph-title">Barbers</h2>
          <p className="ph-sub">Manage your crew</p>
        </div>
        <button className="btn-glow"><IPlus /> Add Barber</button>
      </div>
      <div className="sc-row">
        <StatCard value={String(barbers.length)}                                   label="Total Staff"  sub="All barbers"  gradient="linear-gradient(135deg,#1e40af,#3b82f6)" icon={<IUsers />} />
        <StatCard value={String(barbers.filter(b=>b.status==="available").length)} label="Available"    sub="Right now"    gradient="linear-gradient(135deg,#065f46,#059669)" icon={<ITrend />} />
        <StatCard value={String(barbers.filter(b=>b.status==="busy").length)}      label="Busy"         sub="With client"  gradient="linear-gradient(135deg,#78350f,#d97706)" icon={<ISciss />} />
        <StatCard value={String(barbers.filter(b=>b.status==="off").length)}       label="Day Off"      sub="Not on duty"  gradient="linear-gradient(135deg,#0f172a,#1e293b)" icon={<ICal />} />
      </div>
      <div className="barbers-grid">
        {barbers.map(b => (
          <div className="barber-card" key={b.id}>
            <div className="barber-card-glow" style={{ background: b.color + "22" }} />
            <div className="bcard-top">
              <div className="b-av" style={{ background: b.gradient }}>{b.initials}</div>
              <span className={"pill pill-" + b.status}>{b.status}</span>
            </div>
            <h4 className="b-name">{b.name}</h4>
            <p className="b-spec">{b.specialty}</p>
            <div className="b-stats">
              <div className="bst"><span className="bst-ico" style={{ color: b.color }}><IStar /></span>{b.rating}</div>
              <div className="bst"><span className="bst-ico"><ISciss /></span>{b.totalCuts} total</div>
              <div className="bst"><span className="bst-ico"><ICal /></span>{b.todayCuts} today</div>
            </div>
            <div className="b-progress">
              <div className="b-prog-top"><span>Today</span><span>{b.todayCuts} cuts</span></div>
              <div className="b-track"><div style={{ width: Math.min(100, b.todayCuts * 14) + "%", background: b.gradient }} className="b-fill" /></div>
            </div>
            <hr className="b-hr" />
            <div className="b-phone"><span style={{ color: b.color }}><IPhone /></span>{b.phone}</div>
            <div className="b-actions">
              <button className="ba-sec">Schedule</button>
              <button className="ba-pri" style={{ background: b.gradient }}>Edit Profile</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const nav = [
    { id: "dashboard" as Page, label: "Dashboard", icon: <IGrid /> },
    { id: "barbers"   as Page, label: "Barbers",   icon: <IUsers /> },
    { id: "bookings"  as Page, label: "Bookings",  icon: <ICal /> },
  ];
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sb-top">
          <div className="sb-brand">
            <div className="sb-logo"><ISciss /></div>
            <div>
              <div className="sb-name">Sharp Cuts</div>
              <div className="sb-tag">Admin Panel</div>
            </div>
          </div>
          <nav className="sb-nav">
            {nav.map(n => (
              <button key={n.id} className={"nav-item " + (page === n.id ? "active" : "")} onClick={() => setPage(n.id)}>
                <span className="nav-ico">{n.icon}</span>
                <span>{n.label}</span>
                {page === n.id && <span className="nav-pip" />}
              </button>
            ))}
          </nav>
        </div>
        <div className="sb-foot">
          <div className="sb-admin">
            <div className="sb-av">A</div>
            <div>
              <div className="sb-aname">Admin</div>
              <div className="sb-arole">Super Admin</div>
            </div>
          </div>
          <button className="logout-btn"><ILogout /> Sign Out</button>
        </div>
      </aside>

      <div className="main-wrap">
        <header className="topbar">
          <div className="tb-left">
            <div className="search-wrap">
              <span className="s-ico"><ISearch /></span>
              <input className="s-inp" placeholder="Search bookings, barbers\u2026" />
            </div>
          </div>
          <div className="tb-right">
            <div className="tb-date">Mon, Apr 27</div>
            <button className="icon-btn"><IBell /><span className="n-dot" /></button>
            <div className="tb-av">A</div>
          </div>
        </header>
        <main className="content">
          {page === "dashboard" && <DashboardPage onNavigate={setPage} />}
          {page === "barbers"   && <BarbersPage />}
          {page === "bookings"  && <BookingsPage />}
        </main>
      </div>
    </div>
  );
}
'''

css = '''
/* ═══════════════════════════════════════════════════════════════
   SHARP CUTS — Dark + Ice Blue Premium Admin Panel
   ═══════════════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:        #060b14;
  --bg2:       #0a1628;
  --bg3:       #0d1f3c;
  --surface:   rgba(255,255,255,0.04);
  --surface2:  rgba(255,255,255,0.07);
  --border:    rgba(255,255,255,0.08);
  --border2:   rgba(100,160,255,0.15);
  --blue:      #3b82f6;
  --blue-dim:  rgba(59,130,246,0.15);
  --text:      #f0f6ff;
  --text2:     #94a3b8;
  --text3:     #475569;
  --glow-blue: 0 0 60px rgba(59,130,246,0.12);
  --radius:    16px;
  --radius-sm: 10px;
}

body {
  font-family: "Inter", -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

svg { display: block; }
strong { font-weight: 600; }
small  { display: block; color: var(--text2); font-size: 11px; margin-top: 2px; }
button { cursor: pointer; font-family: inherit; }
input  { font-family: inherit; outline: none; border: none; background: transparent; }
hr     { border: none; border-top: 1px solid var(--border); }

#root { width: 100%; min-height: 100vh; }

/* ── Background mesh ── */
body::before {
  content: "";
  position: fixed; inset: 0; z-index: -1;
  background:
    radial-gradient(ellipse 80% 60% at 20% -10%, rgba(59,130,246,0.18) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 110%, rgba(99,102,241,0.12) 0%, transparent 60%),
    radial-gradient(ellipse 40% 40% at 50% 50%, rgba(14,165,233,0.05) 0%, transparent 70%),
    var(--bg);
}

/* ════════════════════ LAYOUT ════════════════════ */
.layout {
  display: grid;
  grid-template-columns: 252px 1fr;
  min-height: 100vh;
}
.main-wrap {
  display: flex; flex-direction: column;
  min-height: 100vh; overflow: hidden;
  background: transparent;
}
.content {
  flex: 1; padding: 32px 32px 48px;
  overflow-y: auto;
}

/* ════════════════════ SIDEBAR ════════════════════ */
.sidebar {
  background: rgba(6,11,20,0.95);
  border-right: 1px solid var(--border2);
  display: flex; flex-direction: column;
  position: sticky; top: 0; height: 100vh;
  backdrop-filter: blur(20px);
  box-shadow: 4px 0 40px rgba(0,0,0,0.4);
}

.sb-top { flex: 1; padding: 0 0 8px; }

.sb-brand {
  display: flex; align-items: center; gap: 12px;
  padding: 24px 20px 22px;
  border-bottom: 1px solid var(--border);
}
.sb-logo {
  width: 40px; height: 40px; border-radius: 12px;
  background: linear-gradient(135deg, #1e40af, #3b82f6);
  display: flex; align-items: center; justify-content: center;
  color: #fff; flex-shrink: 0;
  box-shadow: 0 4px 20px rgba(59,130,246,0.4);
}
.sb-logo svg { width: 18px; height: 18px; }
.sb-name { font-size: 17px; font-weight: 800; color: #fff; letter-spacing: -.03em; }
.sb-tag  { font-size: 11px; color: var(--text3); margin-top: 2px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; }

.sb-nav { padding: 20px 12px; display: flex; flex-direction: column; gap: 2px; }

.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px; border-radius: var(--radius-sm);
  font-size: 13.5px; font-weight: 500; color: var(--text2);
  border: none; background: transparent; text-align: left; width: 100%;
  transition: all .2s; position: relative;
}
.nav-item:hover { background: var(--surface2); color: var(--text); }
.nav-item.active {
  background: linear-gradient(135deg, rgba(30,64,175,0.5), rgba(59,130,246,0.3));
  color: #fff; font-weight: 600;
  border: 1px solid rgba(59,130,246,0.3);
  box-shadow: 0 4px 20px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.1);
}
.nav-ico { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.nav-ico svg { width: 16px; height: 16px; }
.nav-pip {
  position: absolute; right: 12px;
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--blue);
  box-shadow: 0 0 8px var(--blue);
}

.sb-foot {
  padding: 16px 12px;
  border-top: 1px solid var(--border);
}
.sb-admin { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.sb-av {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff; font-size: 14px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  box-shadow: 0 4px 16px rgba(99,102,241,0.4);
}
.sb-aname { font-size: 13px; font-weight: 600; color: var(--text); }
.sb-arole { font-size: 11px; color: var(--text3); margin-top: 1px; }
.logout-btn {
  display: flex; align-items: center; gap: 8px;
  background: var(--surface); border: 1px solid var(--border);
  color: var(--text2); font-size: 13px; padding: 9px 12px;
  border-radius: var(--radius-sm); width: 100%; transition: all .2s;
}
.logout-btn:hover { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #fca5a5; }
.logout-btn svg { width: 15px; height: 15px; }

/* ════════════════════ TOPBAR ════════════════════ */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 32px; height: 64px;
  background: rgba(6,11,20,0.85);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(20px);
  position: sticky; top: 0; z-index: 20;
}
.search-wrap {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface2); border: 1px solid var(--border2);
  border-radius: var(--radius-sm); padding: 9px 16px; width: 340px;
  transition: all .2s;
}
.search-wrap:focus-within {
  border-color: rgba(59,130,246,0.4);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}
.s-ico { color: var(--text3); display: flex; }
.s-ico svg { width: 15px; height: 15px; }
.s-inp { font-size: 13px; color: var(--text); width: 100%; }
.s-inp::placeholder { color: var(--text3); }
.tb-right { display: flex; align-items: center; gap: 10px; }
.tb-date { font-size: 12px; color: var(--text3); font-weight: 500; margin-right: 4px; }
.icon-btn {
  width: 38px; height: 38px; border-radius: var(--radius-sm);
  background: var(--surface); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: var(--text2); position: relative; transition: all .2s;
}
.icon-btn:hover { background: var(--surface2); border-color: var(--border2); color: var(--text); }
.icon-btn svg { width: 16px; height: 16px; }
.n-dot {
  position: absolute; top: 8px; right: 8px;
  width: 7px; height: 7px; border-radius: 50%;
  background: #3b82f6;
  box-shadow: 0 0 8px #3b82f6;
  border: 2px solid var(--bg);
}
.tb-av {
  width: 38px; height: 38px; border-radius: var(--radius-sm);
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff; font-size: 15px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(99,102,241,0.4);
}

/* ════════════════════ PAGE HEADER ════════════════════ */
.ph {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 28px; gap: 16px;
}
.ph-eyebrow {
  font-size: 11px; font-weight: 700; color: var(--blue);
  text-transform: uppercase; letter-spacing: .1em; margin-bottom: 6px;
}
.ph-title { font-size: 32px; font-weight: 800; letter-spacing: -.04em; color: var(--text); }
.ph-sub   { color: var(--text2); font-size: 14px; margin-top: 4px; }
.btn-glow {
  display: flex; align-items: center; gap: 8px;
  background: linear-gradient(135deg, #1d4ed8, #3b82f6);
  color: #fff; border: none; border-radius: var(--radius-sm);
  padding: 11px 20px; font-size: 13px; font-weight: 600;
  white-space: nowrap; transition: all .2s;
  box-shadow: 0 4px 24px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
}
.btn-glow:hover {
  background: linear-gradient(135deg, #2563eb, #60a5fa);
  box-shadow: 0 6px 32px rgba(59,130,246,0.6), inset 0 1px 0 rgba(255,255,255,0.2);
  transform: translateY(-1px);
}
.btn-glow svg { width: 14px; height: 14px; }

/* ════════════════════ STAT CARDS ════════════════════ */
.sc-row {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 16px; margin-bottom: 20px;
}
.sc {
  border-radius: var(--radius); padding: 22px;
  position: relative; overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
  transition: transform .2s, box-shadow .2s;
}
.sc:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
}
.sc-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
.sc-icon {
  width: 38px; height: 38px; border-radius: 10px;
  background: rgba(255,255,255,0.15);
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.9);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
}
.sc-icon svg { width: 17px; height: 17px; }
.sc-badge {
  font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.7);
  text-transform: uppercase; letter-spacing: .08em;
  background: rgba(255,255,255,0.12); padding: 3px 8px; border-radius: 999px;
}
.sc-value { font-size: 48px; font-weight: 900; letter-spacing: -.06em; color: #fff; line-height: 1; margin-bottom: 6px; }
.sc-label { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.75); }
.sc-glow {
  position: absolute; bottom: -30px; right: -30px;
  width: 100px; height: 100px; border-radius: 50%;
  background: rgba(255,255,255,0.06);
  pointer-events: none;
}

/* ════════════════════ GLASS CARDS ════════════════════ */
.glass-card {
  background: rgba(13,31,60,0.6);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
}

.gc-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px; padding: 22px 22px 0;
}
.gc-eyebrow {
  font-size: 10px; font-weight: 700; color: var(--blue);
  text-transform: uppercase; letter-spacing: .1em; margin-bottom: 4px;
}
.gc-head h3 { font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -.02em; }
.gc-head p  { font-size: 12px; color: var(--text2); margin-top: 3px; }
.link-btn {
  background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2);
  color: var(--blue); font-size: 12px; font-weight: 600;
  padding: 6px 12px; border-radius: 8px; white-space: nowrap;
  transition: all .2s;
}
.link-btn:hover { background: rgba(59,130,246,0.2); border-color: rgba(59,130,246,0.4); }

/* ════════════════════ MID GRID ════════════════════ */
.mid-grid {
  display: grid; grid-template-columns: 1.7fr 1fr;
  gap: 16px; margin-bottom: 20px;
}

/* ── Bar Chart ── */
.chart-card { padding-bottom: 22px; }
.legend {
  display: flex; flex-direction: column; gap: 6px;
  padding-right: 4px;
}
.leg-item { display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--text2); }
.leg-dot  { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.blue-dot { background: linear-gradient(135deg,#1d4ed8,#3b82f6); box-shadow: 0 2px 8px rgba(59,130,246,0.5); }
.dim-dot  { background: rgba(255,255,255,0.15); }

.chart-area {
  position: relative; margin: 24px 22px 8px;
  height: 220px; display: flex;
}
.y-lines {
  position: absolute; left: 0; right: 0; bottom: 0;
  top: 0; pointer-events: none;
}
.y-line {
  position: absolute; left: 0; right: 0;
  border-top: 1px solid rgba(255,255,255,0.05);
  display: flex; align-items: flex-end;
}
.y-line span {
  font-size: 10px; color: var(--text3); padding-right: 4px;
  transform: translateY(50%); line-height: 1; margin-left: auto;
}
.bars-row {
  display: flex; align-items: flex-end; gap: 14px;
  height: 200px; width: 100%;
  padding-bottom: 20px; z-index: 1;
}
.bar-col { display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 1; }
.bar-stack { display: flex; align-items: flex-end; gap: 4px; height: 180px; }
.bar-seg {
  flex: 1; border-radius: 6px 6px 2px 2px; min-width: 12px;
  transition: opacity .2s; cursor: pointer;
}
.bar-seg:hover { opacity: .8; filter: brightness(1.2); }
.bar-completed {
  background: linear-gradient(to top, #1d4ed8, #60a5fa);
  box-shadow: 0 -4px 16px rgba(59,130,246,0.3);
}
.bar-pending { background: rgba(255,255,255,0.12); }
.bar-lbl { font-size: 11px; color: var(--text3); font-weight: 600; margin-bottom: 0; }

/* ── Performance ── */
.perf-card { padding-bottom: 22px; }
.perf-list { padding: 18px 22px 0; display: flex; flex-direction: column; gap: 18px; }
.perf-row  { display: flex; align-items: center; gap: 12px; }
.p-av {
  width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
  color: #fff; font-size: 13px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}
.p-info { flex: 1; }
.p-top { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 7px; color: var(--text); }
.p-top span { color: var(--blue); font-size: 12px; font-weight: 700; }
.track { width: 100%; height: 5px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; }
.track-fill { height: 100%; border-radius: 999px; transition: width .4s ease; box-shadow: 0 0 8px rgba(255,255,255,0.2); }

/* ════════════════════ REVENUE ROW ════════════════════ */
.rev-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 20px; }
.rev-card { padding: 24px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.rev-ico {
  width: 44px; height: 44px; border-radius: 12px; margin-bottom: 10px;
  background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.2);
  display: flex; align-items: center; justify-content: center; color: var(--blue);
  box-shadow: 0 4px 16px rgba(59,130,246,0.15);
}
.rev-ico svg { width: 20px; height: 20px; }
.rev-val { font-size: 34px; font-weight: 900; letter-spacing: -.04em; color: var(--text); }
.rev-lbl { font-size: 12px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: .04em; margin-top: 2px; }
.rev-sub { font-size: 11px; color: var(--text3); margin-top: 2px; }

/* ════════════════════ TABLE ════════════════════ */
.table-card { padding-bottom: 0; overflow: hidden; }
.tc-head { margin-bottom: 0; border-bottom: 1px solid var(--border); padding-bottom: 18px; }
.tbl-wrap { overflow-x: auto; }
.dtable { width: 100%; border-collapse: collapse; min-width: 720px; }
.dtable thead th {
  padding: 14px 20px; text-align: left;
  font-size: 10.5px; font-weight: 700; color: var(--text3);
  text-transform: uppercase; letter-spacing: .06em;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid var(--border);
}
.dtable tbody td {
  padding: 14px 20px; font-size: 13px; color: var(--text);
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background .15s;
}
.dtable tbody tr:last-child td { border-bottom: none; }
.dtable tbody tr:hover td { background: rgba(59,130,246,0.04); }
.client-cell { display: flex; align-items: center; gap: 10px; }
.c-av {
  width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
  color: #fff; font-size: 13px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 12px rgba(0,0,0,0.3);
}
.barber-tag {
  background: rgba(59,130,246,0.1); color: #93c5fd;
  font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 6px;
  border: 1px solid rgba(59,130,246,0.15);
}
.price-tag { color: #34d399; font-size: 14px; font-weight: 700; }
.bk-id { font-size: 11.5px; color: var(--text3); font-family: monospace; }

/* ── Badges ── */
.badge {
  display: inline-flex; align-items: center;
  padding: 4px 10px; border-radius: 6px;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
}
.b-completed { background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.2); }
.b-pending   { background: rgba(245,158,11,0.12);  color: #fbbf24; border: 1px solid rgba(245,158,11,0.2); }
.b-cancelled { background: rgba(239,68,68,0.12);   color: #f87171; border: 1px solid rgba(239,68,68,0.2); }

/* ════════════════════ FILTER TABS ════════════════════ */
.ftabs { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.ftab {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 16px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 500; color: var(--text2);
  border: 1px solid var(--border); background: var(--surface);
  transition: all .2s;
}
.ftab:hover { border-color: var(--border2); color: var(--text); }
.ftab.ft-active {
  background: linear-gradient(135deg,rgba(30,64,175,0.5),rgba(59,130,246,0.3));
  color: #fff; border-color: rgba(59,130,246,0.4);
  box-shadow: 0 4px 20px rgba(59,130,246,0.2);
}
.fc {
  background: rgba(255,255,255,0.1); color: var(--text2);
  font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px;
}
.ft-active .fc { background: rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); }
.filter-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 9px 16px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 500; color: var(--text2);
  border: 1px solid var(--border); background: var(--surface); margin-left: auto;
  transition: all .2s;
}
.filter-btn svg { width: 13px; height: 13px; }
.filter-btn:hover { border-color: var(--border2); color: var(--text); }

/* ════════════════════ BARBERS GRID ════════════════════ */
.barbers-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
.barber-card {
  background: rgba(13,31,60,0.6);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  padding: 22px;
  position: relative; overflow: hidden;
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  transition: transform .2s, box-shadow .2s;
}
.barber-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 48px rgba(0,0,0,0.35);
  border-color: rgba(100,160,255,0.25);
}
.barber-card-glow {
  position: absolute; top: -40px; right: -40px;
  width: 120px; height: 120px; border-radius: 50%;
  filter: blur(40px); pointer-events: none;
}
.bcard-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
.b-av {
  width: 56px; height: 56px; border-radius: 14px; flex-shrink: 0;
  color: #fff; font-size: 20px; font-weight: 900;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 24px rgba(0,0,0,0.4);
}
.b-name { font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
.b-spec { font-size: 12px; color: var(--text2); margin-bottom: 16px; }

.pill {
  padding: 4px 10px; border-radius: 6px;
  font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
}
.pill-available { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.2); }
.pill-busy      { background: rgba(245,158,11,0.15);  color: #fbbf24; border: 1px solid rgba(245,158,11,0.2); }
.pill-off       { background: rgba(255,255,255,0.07); color: var(--text3); border: 1px solid var(--border); }

.b-stats { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.bst { display: flex; align-items: center; gap: 9px; font-size: 13px; color: var(--text); }
.bst-ico { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; color: var(--text3); }
.bst-ico svg { width: 13px; height: 13px; }

.b-progress { margin-bottom: 14px; }
.b-prog-top { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--text2); margin-bottom: 6px; font-weight: 600; }
.b-track { width: 100%; height: 5px; background: rgba(255,255,255,0.07); border-radius: 999px; overflow: hidden; }
.b-fill  { height: 100%; border-radius: 999px; transition: width .4s; box-shadow: 0 0 8px rgba(255,255,255,0.15); }

.b-hr { margin-bottom: 14px; border-color: var(--border); }
.b-phone { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text2); margin-bottom: 14px; }
.b-phone svg { width: 13px; height: 13px; }
.b-actions { display: flex; gap: 8px; }
.ba-sec, .ba-pri {
  flex: 1; padding: 9px; border-radius: 9px;
  font-size: 12px; font-weight: 600; border: none; transition: all .2s;
}
.ba-sec { background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
.ba-sec:hover { background: rgba(255,255,255,0.1); color: var(--text); }
.ba-pri { color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
.ba-pri:hover { filter: brightness(1.15); transform: translateY(-1px); }

/* ════════════════════ RESPONSIVE ════════════════════ */
@media (max-width: 1400px) { .barbers-grid { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 1200px) {
  .sc-row  { grid-template-columns: repeat(2,1fr); }
  .mid-grid { grid-template-columns: 1fr; }
  .rev-row  { grid-template-columns: 1fr; }
}
@media (max-width: 1000px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; }
  .sb-top { display: flex; align-items: center; gap: 0; }
  .sb-foot { display: none; }
  .content { padding: 20px; }
  .search-wrap { width: 200px; }
  .barbers-grid { grid-template-columns: 1fr; }
}
'''

with open('c:/Users/NotebookService/Desktop/barber/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(tsx)
with open('c:/Users/NotebookService/Desktop/barber/src/App.css', 'w', encoding='utf-8') as f:
    f.write(css)
print("Done! TSX:", len(tsx.splitlines()), "lines | CSS:", len(css.splitlines()), "lines")
