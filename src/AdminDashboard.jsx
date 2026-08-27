import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Radar,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  Users,
  Store,
  Radio,
  Trash2,
  TrendingUp,
  Filter,
  X,
  Lock,
  LogOut,
  Eye,
  EyeOff,
} from "./icons.jsx";
import {
  signIn,
  signOut,
  restoreSession,
  getMyProfile,
  listAllReports,
  deleteReport,
  IS_CONFIGURED,
} from "./supabase.js";
import { usernameToEmail } from "./authHelpers.js";

const TYPE_META = {
  fake_order: { label: "طلب وهمي", weight: 30, color: "var(--danger)" },
  repeated_refusal: { label: "رفض استلام متكرر", weight: 18, color: "var(--warn)" },
  wrong_address: { label: "عنوان غير صحيح", weight: 10, color: "var(--accent)" },
  abuse: { label: "إساءة تجاه المندوب", weight: 22, color: "var(--info)" },
};

function maskPhone(digits) {
  if (!digits) return "—";
  if (digits.length <= 4) return digits;
  return "•".repeat(digits.length - 4) + digits.slice(-4);
}

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `منذ ${mins <= 1 ? "دقيقة" : mins + " دقيقة"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ${hours === 1 ? "ساعة" : "ساعات"}`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} ${days === 1 ? "يوم" : "أيام"}`;
}

function computeResult(phoneReports) {
  const uniqueReporters = new Set(
    phoneReports.map((r) => (r.reporter || "").trim().toLowerCase())
  ).size;
  if (phoneReports.length === 0) return { score: 0, level: "none", uniqueReporters: 0 };
  const raw = phoneReports.reduce((acc, r) => acc + (TYPE_META[r.type]?.weight || 10), 0);
  const diversityBonus = Math.min(15, (uniqueReporters - 1) * 8);
  const score = Math.min(100, raw + Math.max(0, diversityBonus));
  let level = "low";
  if (score >= 60) level = "high";
  else if (score >= 30) level = "medium";
  return { score, level, uniqueReporters };
}

const LEVEL_META = {
  low: { label: "منخفضة", color: "var(--safe)", Icon: ShieldCheck },
  medium: { label: "متوسطة", color: "var(--warn)", Icon: ShieldAlert },
  high: { label: "مرتفعة", color: "var(--danger)", Icon: ShieldX },
};

function dayKey(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function last14Days() {
  const out = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function dayLabel(key) {
  const d = new Date(key + "T00:00:00");
  return new Intl.DateTimeFormat("ar", { day: "numeric", month: "short" }).format(d);
}

function Ring({ segments, total }) {
  const r = 58;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150">
      <circle cx="75" cy="75" r={r} fill="none" stroke="var(--grid-line)" strokeWidth="14" />
      {total > 0 &&
        segments.map((s) => {
          if (s.count === 0) return null;
          const frac = s.count / total;
          const dash = frac * c;
          const gap = c - dash;
          const offset = c - acc;
          acc += dash;
          return (
            <circle
              key={s.key}
              cx="75"
              cy="75"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              transform="rotate(-90 75 75)"
              style={{ transition: "stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease" }}
            />
          );
        })}
    </svg>
  );
}

function StatCard({ icon, label, value, tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone || ""}`}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [authStage, setAuthStage] = useState("loading"); // loading | locked | unlocked
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const [reports, setReports] = useState([]);
  const [ready, setReady] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    (async () => {
      if (!IS_CONFIGURED) { setAuthStage("locked"); return; }
      try {
        const user = await restoreSession();
        if (!user) { setAuthStage("locked"); return; }
        const profile = await getMyProfile();
        if (profile?.is_admin) {
          setAuthStage("unlocked");
        } else {
          await signOut().catch(() => {});
          setAuthStage("locked");
        }
      } catch (e) {
        setAuthStage("locked");
      }
    })();
  }, []);

  async function handleUnlock(e) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setAuthError("أدخل اسم المستخدم وكلمة المرور");
      return;
    }
    if (!IS_CONFIGURED) {
      setAuthError("لم يتم ربط التطبيق بقاعدة بيانات بعد — راجع ملف الإعداد");
      return;
    }
    setAuthBusy(true);
    try {
      await signIn(usernameToEmail(username), password);
      const profile = await getMyProfile();
      if (!profile?.is_admin) {
        await signOut().catch(() => {});
        setAuthError("هذا الحساب ليس حساب مسؤول");
        setAuthBusy(false);
        return;
      }
      setAuthError("");
      setPassword("");
      setAuthStage("unlocked");
    } catch (e) {
      setAuthError("بيانات الدخول غير صحيحة");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLock() {
    await signOut().catch(() => {});
    setAuthStage("locked");
    setUsername("");
    setPassword("");
    setAuthError("");
  }

  const loadReports = useCallback(async () => {
    try {
      const rows = await listAllReports();
      setReports(rows.map((r) => ({ ...r, date: r.created_at })));
      setLastSync(new Date());
    } catch (e) {
      // مشكلة اتصال أو صلاحيات — نُبقي آخر بيانات معروضة كما هي
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (authStage !== "unlocked") return;
    loadReports();
    const interval = setInterval(loadReports, 6000);
    return () => clearInterval(interval);
  }, [authStage, loadReports]);

  useEffect(() => {
    if (!pendingDelete) return;
    const t = setTimeout(() => setPendingDelete(null), 3000);
    return () => clearTimeout(t);
  }, [pendingDelete]);

  async function handleDelete(id) {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      setPendingDelete(null);
    } catch (e) {
      setPendingDelete(null);
      // يمكن إضافة تنبيه هنا إذا رغبت بإظهار سبب فشل الحذف
    }
  }

  const typeCounts = useMemo(() => {
    const counts = {};
    Object.keys(TYPE_META).forEach((k) => (counts[k] = 0));
    reports.forEach((r) => {
      if (counts[r.type] !== undefined) counts[r.type] += 1;
    });
    return counts;
  }, [reports]);

  const segments = Object.entries(TYPE_META).map(([key, meta]) => ({
    key,
    label: meta.label,
    color: meta.color,
    count: typeCounts[key] || 0,
  }));

  const byPhone = useMemo(() => {
    const map = new Map();
    reports.forEach((r) => {
      if (!map.has(r.phone)) map.set(r.phone, []);
      map.get(r.phone).push(r);
    });
    return map;
  }, [reports]);

  const topRisky = useMemo(() => {
    const rows = [...byPhone.entries()].map(([phone, list]) => ({
      phone,
      count: list.length,
      lastDate: list.reduce((a, b) => (new Date(b.date) > new Date(a) ? b.date : a), list[0].date),
      ...computeResult(list),
    }));
    return rows
      .filter((r) => r.level !== "none")
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [byPhone]);

  const trend = useMemo(() => {
    const days = last14Days();
    const counts = Object.fromEntries(days.map((d) => [d, 0]));
    reports.forEach((r) => {
      const k = dayKey(r.date);
      if (counts[k] !== undefined) counts[k] += 1;
    });
    const max = Math.max(1, ...Object.values(counts));
    return days.map((d) => ({ day: d, count: counts[d], pct: counts[d] / max }));
  }, [reports]);

  const filteredList = useMemo(() => {
    const list = typeFilter === "all" ? reports : reports.filter((r) => r.type === typeFilter);
    return [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [reports, typeFilter]);

  const totalReports = reports.length;
  const uniqueNumbers = byPhone.size;
  const highRiskCount = [...byPhone.values()].filter((l) => computeResult(l).level === "high").length;
  const uniqueReportersTotal = new Set(reports.map((r) => (r.reporter || "").trim().toLowerCase())).size;

  return (
    <div className="radar-dash" dir="rtl" lang="ar">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=El+Messiri:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

        .radar-dash {
          --void: #0a1412;
          --panel: #0f1c19;
          --panel-2: #142522;
          --grid-line: #1f3630;
          --text: #eaf2ee;
          --muted: #83a196;
          --muted-signal: #5c766c;
          --accent: #3ed6b8;
          --safe: #46d18a;
          --warn: #f3b73f;
          --danger: #fb5f4d;
          --info: #6c8cff;
          font-family: 'IBM Plex Sans Arabic', sans-serif;
          background: radial-gradient(ellipse at 50% -10%, #12241f 0%, var(--void) 55%);
          color: var(--text);
          min-height: 100vh;
          width: 100%;
          box-sizing: border-box;
          padding: 0 0 40px;
        }
        .radar-dash *, .radar-dash *::before, .radar-dash *::after { box-sizing: border-box; }

        .rd-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 24px 16px;
          max-width: 980px;
          margin: 0 auto;
          border-bottom: 1px solid var(--grid-line);
          flex-wrap: wrap;
          gap: 12px;
        }
        .rd-brand { display: flex; align-items: center; gap: 10px; }
        .rd-brand-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(155deg, var(--panel-2), var(--panel));
          border: 1px solid var(--grid-line);
          display: flex; align-items: center; justify-content: center;
        }
        .rd-title { font-family: 'El Messiri', sans-serif; font-weight: 700; font-size: 21px; letter-spacing: 0.2px; }
        .rd-sub { color: var(--muted); font-size: 11.5px; margin-top: 1px; font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.5px; }

        .sync-pill {
          display: flex; align-items: center; gap: 7px;
          background: var(--panel-2);
          border: 1px solid var(--grid-line);
          border-radius: 999px;
          padding: 7px 13px;
          font-size: 12px;
          color: var(--muted);
          font-family: 'IBM Plex Mono', monospace;
          cursor: pointer;
        }
        .sync-pill:hover { color: var(--accent); border-color: var(--accent); }
        .sync-pill svg.spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .rd-main { max-width: 980px; margin: 0 auto; padding: 28px 24px 0; }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 22px;
        }
        .stat-card {
          background: var(--panel);
          border: 1px solid var(--grid-line);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .stat-icon {
          width: 38px; height: 38px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: var(--panel-2);
          color: var(--accent);
          flex-shrink: 0;
        }
        .stat-icon.tone-danger { color: var(--danger); }
        .stat-icon.tone-info { color: var(--info); }
        .stat-value { font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 600; line-height: 1.1; }
        .stat-label { color: var(--muted); font-size: 12px; margin-top: 3px; }

        .panel-grid {
          display: grid;
          grid-template-columns: 1fr 1.3fr;
          gap: 14px;
          margin-bottom: 14px;
        }
        .panel {
          background: var(--panel);
          border: 1px solid var(--grid-line);
          border-radius: 16px;
          padding: 20px;
        }
        .panel-title {
          font-family: 'El Messiri', sans-serif;
          font-weight: 600;
          font-size: 15px;
          margin: 0 0 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .panel-title svg { color: var(--accent); }

        .donut-wrap { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; justify-content: center; }
        .legend { display: flex; flex-direction: column; gap: 9px; flex: 1; min-width: 160px; }
        .legend-row { display: flex; align-items: center; gap: 9px; font-size: 12.5px; }
        .legend-dot { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
        .legend-label { color: var(--muted); flex: 1; }
        .legend-count { font-family: 'IBM Plex Mono', monospace; color: var(--text); }
        .donut-empty { text-align: center; color: var(--muted-signal); font-size: 13px; padding: 30px 0; }

        .risky-list { display: flex; flex-direction: column; gap: 10px; }
        .risky-row {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px;
          background: var(--panel-2);
          border: 1px solid var(--grid-line);
          border-radius: 10px;
        }
        .risky-rank {
          font-family: 'IBM Plex Mono', monospace;
          color: var(--muted-signal);
          font-size: 12px;
          width: 16px;
          text-align: center;
          flex-shrink: 0;
        }
        .risky-phone {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          direction: ltr;
          text-align: right;
          min-width: 92px;
        }
        .risky-bar-wrap { flex: 1; height: 6px; background: var(--grid-line); border-radius: 4px; overflow: hidden; }
        .risky-bar { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
        .risky-score { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; width: 34px; text-align: left; flex-shrink: 0; }
        .risky-meta { display: flex; align-items: center; gap: 4px; font-size: 11px; flex-shrink: 0; }

        .trend-chart { display: flex; align-items: flex-end; gap: 5px; height: 110px; margin-top: 4px; }
        .trend-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 5px; }
        .trend-bar { width: 100%; max-width: 22px; background: var(--accent); border-radius: 3px 3px 0 0; min-height: 3px; transition: height 0.5s ease; }
        .trend-label { font-size: 9.5px; color: var(--muted-signal); font-family: 'IBM Plex Mono', monospace; white-space: nowrap; transform: rotate(0deg); }

        .filter-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .filter-chip {
          border: 1px solid var(--grid-line);
          background: var(--panel-2);
          color: var(--muted);
          font-size: 12.5px;
          padding: 7px 13px;
          border-radius: 999px;
          cursor: pointer;
          font-family: inherit;
        }
        .filter-chip.active { color: var(--void); background: var(--accent); border-color: var(--accent); font-weight: 600; }

        .log-table { display: flex; flex-direction: column; gap: 8px; }
        .log-row {
          display: grid;
          grid-template-columns: 100px 130px 1fr 90px 34px;
          align-items: center;
          gap: 10px;
          padding: 11px 12px;
          background: var(--panel-2);
          border: 1px solid var(--grid-line);
          border-radius: 10px;
          font-size: 12.5px;
        }
        .log-phone { font-family: 'IBM Plex Mono', monospace; direction: ltr; text-align: right; color: var(--muted); }
        .log-badge {
          font-size: 11px; padding: 4px 9px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          white-space: nowrap;
        }
        .log-reporter { color: var(--muted); display: flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .log-time { color: var(--muted-signal); font-size: 11px; display: flex; align-items: center; gap: 4px; white-space: nowrap; }
        .log-del {
          border: none; background: transparent; color: var(--muted-signal);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 8px; transition: all 0.15s;
        }
        .log-del:hover { color: var(--danger); background: rgba(251,95,77,0.12); }
        .log-del.confirm { color: var(--danger); background: rgba(251,95,77,0.18); }

        .empty-state { text-align: center; color: var(--muted-signal); font-size: 13.5px; padding: 34px 0; }

        @media (max-width: 720px) {
          .stats-row { grid-template-columns: repeat(2, 1fr); }
          .panel-grid { grid-template-columns: 1fr; }
          .log-row { grid-template-columns: 82px 1fr 30px; }
          .log-badge, .log-time { display: none; }
        }

        .lock-screen {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .lock-card {
          width: 100%;
          max-width: 360px;
          background: var(--panel);
          border: 1px solid var(--grid-line);
          border-radius: 18px;
          padding: 30px 26px;
          text-align: center;
        }
        .lock-icon {
          width: 52px; height: 52px; border-radius: 14px;
          background: var(--panel-2);
          border: 1px solid var(--grid-line);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
        }
        .lock-title { font-family: 'El Messiri', sans-serif; font-weight: 700; font-size: 19px; margin-bottom: 4px; }
        .lock-sub { color: var(--muted); font-size: 12.5px; margin-bottom: 22px; line-height: 1.7; }
        .lock-field { position: relative; margin-bottom: 12px; }
        .lock-input {
          width: 100%;
          background: var(--panel-2);
          border: 1px solid var(--grid-line);
          border-radius: 10px;
          padding: 12px 42px 12px 14px;
          color: var(--text);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 15px;
          letter-spacing: 2px;
          text-align: center;
          direction: ltr;
        }
        .lock-input:focus { outline: none; border-color: var(--accent); }
        .lock-eye {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: var(--muted-signal); cursor: pointer;
          display: flex; align-items: center;
        }
        .lock-eye:hover { color: var(--accent); }
        .lock-btn {
          width: 100%;
          background: var(--accent);
          color: var(--void);
          border: none;
          border-radius: 10px;
          padding: 12px;
          font-family: inherit;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          margin-top: 6px;
          transition: opacity 0.15s;
        }
        .lock-btn:hover { opacity: 0.9; }
        .lock-error {
          color: var(--danger);
          font-size: 12px;
          margin-top: 10px;
        }
        .lock-note {
          color: var(--muted-signal);
          font-size: 10.5px;
          margin-top: 18px;
          line-height: 1.7;
          border-top: 1px solid var(--grid-line);
          padding-top: 14px;
        }
        .lock-btn-secondary {
          background: transparent;
          color: var(--muted);
          border: 1px solid var(--grid-line);
          display: flex; align-items: center; gap: 6px;
          padding: 7px 13px; border-radius: 999px; font-size: 12px;
          cursor: pointer; font-family: inherit;
        }
        .lock-btn-secondary:hover { color: var(--text); border-color: var(--accent); }
      `}</style>

      {authStage === "loading" && (
        <div className="lock-screen">
          <RefreshCw size={22} className="spin" color="var(--accent)" />
        </div>
      )}

      {authStage === "locked" && (
        <div className="lock-screen">
          <div className="lock-card">
            <div className="lock-icon"><Lock size={22} color="var(--accent)" /></div>
            <div className="lock-title">دخول المسؤول</div>
            <div className="lock-sub">
              {IS_CONFIGURED
                ? "سجّل دخولك بحساب المسؤول للوصول إلى لوحة تحكم رادار."
                : "لم يتم ربط التطبيق بقاعدة بيانات بعد — راجع ملف الإعداد."}
            </div>
            <div className="lock-field">
              <input
                className="lock-input"
                type="text"
                placeholder="اسم المستخدم"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleUnlock(e); }}
                autoFocus
                style={{ paddingLeft: 16 }}
              />
            </div>
            <div className="lock-field">
              <input
                className="lock-input"
                type={showCode ? "text" : "password"}
                placeholder="كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleUnlock(e); }}
              />
              <button type="button" className="lock-eye" onClick={() => setShowCode((s) => !s)}>
                {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button className="lock-btn" type="button" onClick={handleUnlock} disabled={authBusy}>
              {authBusy ? "جارِ الدخول…" : "دخول"}
            </button>
            {authError && <div className="lock-error">{authError}</div>}
            <div className="lock-note">
              حساب الإدارة هو نفس نوع الحساب المستخدم في "لوحتي"، لكن بصلاحية is_admin مفعّلة من قاعدة البيانات مباشرة (راجع تعليمات schema.sql).
            </div>
          </div>
        </div>
      )}

      {authStage === "unlocked" && (
        <>
      <header className="rd-header">
        <div className="rd-brand">
          <div className="rd-brand-icon"><Radar size={19} color="var(--accent)" /></div>
          <div>
            <div className="rd-title">لوحة تحكم رادار</div>
            <div className="rd-sub">RADAR // نظرة عامة على السجل المشترك</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="sync-pill" onClick={loadReports}>
            <RefreshCw size={13} className={!ready ? "spin" : ""} />
            {lastSync ? `آخر تحديث ${relativeTime(lastSync.toISOString())}` : "جارِ التحميل…"}
          </button>
          <button className="lock-btn-secondary" onClick={handleLock}>
            <LogOut size={13} /> قفل
          </button>
        </div>
      </header>

      <main className="rd-main">
        <div className="stats-row">
          <StatCard icon={<Radio size={17} />} label="إجمالي البلاغات" value={totalReports} />
          <StatCard icon={<Users size={17} />} label="أرقام مسجّلة" value={uniqueNumbers} />
          <StatCard icon={<ShieldX size={17} />} label="خطورة مرتفعة" value={highRiskCount} tone="tone-danger" />
          <StatCard icon={<Store size={17} />} label="مُبلّغون فريدون" value={uniqueReportersTotal} tone="tone-info" />
        </div>

        <div className="panel-grid">
          <div className="panel">
            <h3 className="panel-title"><Radar size={15} /> توزيع أنواع البلاغات</h3>
            {totalReports === 0 ? (
              <div className="donut-empty">لا توجد بيانات بعد</div>
            ) : (
              <div className="donut-wrap">
                <Ring segments={segments} total={totalReports} />
                <div className="legend">
                  {segments.map((s) => (
                    <div className="legend-row" key={s.key}>
                      <span className="legend-dot" style={{ background: s.color }} />
                      <span className="legend-label">{s.label}</span>
                      <span className="legend-count">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="panel">
            <h3 className="panel-title"><ShieldAlert size={15} /> الأرقام الأكثر خطورة</h3>
            {topRisky.length === 0 ? (
              <div className="donut-empty">لا توجد أرقام عالية الخطورة حتى الآن</div>
            ) : (
              <div className="risky-list">
                {topRisky.map((r, i) => {
                  const meta = LEVEL_META[r.level];
                  return (
                    <div className="risky-row" key={r.phone}>
                      <span className="risky-rank">{i + 1}</span>
                      <span className="risky-phone">{maskPhone(r.phone)}</span>
                      <span className="risky-bar-wrap">
                        <span className="risky-bar" style={{ width: `${r.score}%`, background: meta.color }} />
                      </span>
                      <span className="risky-score" style={{ color: meta.color }}>{r.score}</span>
                      <span className="risky-meta" style={{ color: "var(--muted-signal)" }}>
                        <Radio size={11} /> {r.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 14 }}>
          <h3 className="panel-title"><TrendingUp size={15} /> النشاط خلال آخر 14 يوماً</h3>
          {totalReports === 0 ? (
            <div className="donut-empty">لا توجد بلاغات لعرض اتجاه النشاط</div>
          ) : (
            <div className="trend-chart">
              {trend.map((t) => (
                <div className="trend-bar-col" key={t.day}>
                  <div
                    className="trend-bar"
                    style={{ height: `${Math.max(4, t.pct * 88)}px` }}
                    title={`${t.count} بلاغ`}
                  />
                  <span className="trend-label">{dayLabel(t.day)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h3 className="panel-title"><Filter size={15} /> سجل كل البلاغات</h3>
          <div className="filter-row">
            <button
              className={`filter-chip ${typeFilter === "all" ? "active" : ""}`}
              onClick={() => setTypeFilter("all")}
            >
              الكل ({reports.length})
            </button>
            {Object.entries(TYPE_META).map(([key, meta]) => (
              <button
                key={key}
                className={`filter-chip ${typeFilter === key ? "active" : ""}`}
                onClick={() => setTypeFilter(key)}
              >
                {meta.label} ({typeCounts[key] || 0})
              </button>
            ))}
          </div>

          {filteredList.length === 0 ? (
            <div className="empty-state">لا توجد بلاغات مطابقة</div>
          ) : (
            <div className="log-table">
              {filteredList.map((r) => {
                const danger = TYPE_META[r.type]?.weight >= 20;
                return (
                  <div className="log-row" key={r.id}>
                    <span className="log-phone">{maskPhone(r.phone)}</span>
                    <span
                      className="log-badge"
                      style={{
                        background: danger ? "rgba(251,95,77,0.15)" : "rgba(243,183,63,0.15)",
                        color: danger ? "var(--danger)" : "var(--warn)",
                      }}
                    >
                      {TYPE_META[r.type]?.label || r.type}
                    </span>
                    <span className="log-reporter"><Store size={11} /> {r.reporter}</span>
                    <span className="log-time"><Clock size={11} /> {relativeTime(r.date)}</span>
                    <button
                      className={`log-del ${pendingDelete === r.id ? "confirm" : ""}`}
                      onClick={() => handleDelete(r.id)}
                      title={pendingDelete === r.id ? "اضغط للتأكيد" : "حذف البلاغ"}
                    >
                      {pendingDelete === r.id ? <X size={14} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      </>
      )}
    </div>
  );
}
