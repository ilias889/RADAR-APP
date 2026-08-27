import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Radar,
  RefreshCw,
  Send,
  Clock,
  Store,
  Radio,
  Trash2,
  TrendingUp,
  X,
  UserRound,
  Pencil,
  Check,
  Award,
  CircleAlert,
  Plus,
  LogIn,
  UserPlus,
  Lock,
  Eye,
  EyeOff,
  LogOut,
} from "./icons.jsx";
import {
  signUp,
  signIn,
  signOut,
  restoreSession,
  isLoggedIn,
  getMyProfile,
  listMyReports,
  addReport,
  updateReport,
  deleteReport,
  IS_CONFIGURED,
} from "./supabase.js";

const TYPE_META = {
  fake_order: { label: "طلب وهمي", weight: 30, color: "var(--danger)" },
  repeated_refusal: { label: "رفض استلام متكرر", weight: 18, color: "var(--warn)" },
  wrong_address: { label: "عنوان غير صحيح", weight: 10, color: "var(--accent)" },
  abuse: { label: "إساءة تجاه المندوب", weight: 22, color: "var(--info)" },
};

import { usernameToEmail } from "./authHelpers.js";

function maskPhone(digits) {
  if (!digits) return "—";
  if (digits.length <= 4) return digits;
  return "•".repeat(digits.length - 4) + digits.slice(-4);
}

function normalizePhone(raw) {
  if (!raw) return "";
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const extendedArabicIndic = "۰۱۲۳۴۵۶۷۸۹";
  let converted = "";
  for (const ch of raw) {
    const ai = arabicIndic.indexOf(ch);
    if (ai !== -1) { converted += ai; continue; }
    const eai = extendedArabicIndic.indexOf(ch);
    if (eai !== -1) { converted += eai; continue; }
    converted += ch;
  }
  return converted.replace(/[^0-9]/g, "");
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

function levelForCount(n) {
  if (n >= 10) return { label: "مساهم موثوق", color: "var(--safe)" };
  if (n >= 3) return { label: "مساهم نشط", color: "var(--accent)" };
  return { label: "مساهم جديد", color: "var(--muted)" };
}

function Ring({ segments, total }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--grid-line)" strokeWidth="13" />
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
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="13"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              transform="rotate(-90 70 70)"
              style={{ transition: "stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease" }}
            />
          );
        })}
    </svg>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState("loading"); // loading | auth | dashboard
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [signupForm, setSignupForm] = useState({ username: "", password: "", confirm: "", storeName: "" });

  const [currentUser, setCurrentUser] = useState(null); // { username, storeName }

  const [allReports, setAllReports] = useState([]);
  const [ready, setReady] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ type: "fake_order", details: "" });
  const [pendingDelete, setPendingDelete] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newReport, setNewReport] = useState({ phone: "", type: "fake_order", details: "" });
  const [addError, setAddError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      if (!IS_CONFIGURED) {
        setStage("auth");
        return;
      }
      try {
        const user = await restoreSession();
        if (!user) {
          setStage("auth");
          return;
        }
        const profile = await getMyProfile();
        setCurrentUser({
          username: (user.email || "").split("@")[0],
          storeName: profile?.store_name || "",
        });
        setStage("dashboard");
      } catch (e) {
        setStage("auth");
      }
    })();
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const rows = await listMyReports();
      setAllReports(rows.map((r) => ({ ...r, date: r.created_at })));
      setLastSync(new Date());
    } catch (e) {
      // مشكلة اتصال أو صلاحيات — نُبقي آخر بيانات معروضة كما هي
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (stage !== "dashboard") return;
    loadReports();
    const interval = setInterval(loadReports, 6000);
    return () => clearInterval(interval);
  }, [stage, loadReports]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!pendingDelete) return;
    const t = setTimeout(() => setPendingDelete(null), 3000);
    return () => clearTimeout(t);
  }, [pendingDelete]);

  async function handleSignup(e) {
    e.preventDefault();
    const username = signupForm.username.trim();
    const storeName = signupForm.storeName.trim();
    if (!username || username.length < 3) {
      setAuthError("اسم المستخدم يجب أن يكون 3 أحرف على الأقل");
      return;
    }
    if (!storeName) {
      setAuthError("أدخل اسم متجرك أو مندوبك");
      return;
    }
    if (signupForm.password.length < 6) {
      setAuthError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (signupForm.password !== signupForm.confirm) {
      setAuthError("كلمتا المرور غير متطابقتين");
      return;
    }
    if (!IS_CONFIGURED) {
      setAuthError("لم يتم ربط التطبيق بقاعدة بيانات بعد — راجع ملف الإعداد");
      return;
    }
    setAuthBusy(true);
    try {
      await signUp(usernameToEmail(username), signupForm.password, storeName);
      if (!isLoggedIn()) {
        setAuthError("تم إنشاء الحساب، لكن يبدو أن تأكيد البريد مفعّل في إعدادات مشروعك — عطّله من Supabase (Authentication → Providers → Email → Confirm email) لتفعيل الدخول الفوري");
        setAuthBusy(false);
        return;
      }
      setAuthError("");
      setSignupForm({ username: "", password: "", confirm: "", storeName: "" });
      setCurrentUser({ username, storeName });
      setStage("dashboard");
    } catch (e) {
      setAuthError(e.message || "تعذّر إنشاء الحساب، حاول مجدداً");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const username = loginForm.username.trim();
    if (!username || !loginForm.password) {
      setAuthError("أدخل اسم المستخدم وكلمة المرور");
      return;
    }
    if (!IS_CONFIGURED) {
      setAuthError("لم يتم ربط التطبيق بقاعدة بيانات بعد — راجع ملف الإعداد");
      return;
    }
    setAuthBusy(true);
    try {
      await signIn(usernameToEmail(username), loginForm.password);
      const profile = await getMyProfile();
      setAuthError("");
      setLoginForm({ username: "", password: "" });
      setCurrentUser({ username, storeName: profile?.store_name || username });
      setStage("dashboard");
    } catch (e) {
      setAuthError("اسم المستخدم أو كلمة المرور غير صحيحة");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    await signOut().catch(() => {});
    setCurrentUser(null);
    setStage("auth");
    setAuthMode("login");
    setAuthError("");
  }

  const myReports = useMemo(
    () => [...allReports].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [allReports]
  );

  const typeCounts = useMemo(() => {
    const counts = {};
    Object.keys(TYPE_META).forEach((k) => (counts[k] = 0));
    myReports.forEach((r) => {
      if (counts[r.type] !== undefined) counts[r.type] += 1;
    });
    return counts;
  }, [myReports]);

  const segments = Object.entries(TYPE_META).map(([key, meta]) => ({
    key,
    label: meta.label,
    color: meta.color,
    count: typeCounts[key] || 0,
  }));

  const trend = useMemo(() => {
    const days = last14Days();
    const counts = Object.fromEntries(days.map((d) => [d, 0]));
    myReports.forEach((r) => {
      const k = dayKey(r.date);
      if (counts[k] !== undefined) counts[k] += 1;
    });
    const max = Math.max(1, ...Object.values(counts));
    return days.map((d) => ({ day: d, count: counts[d], pct: counts[d] / max }));
  }, [myReports]);

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    return myReports.filter((r) => {
      const d = new Date(r.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [myReports]);

  const level = levelForCount(myReports.length);

  function startEdit(r) {
    setEditingId(r.id);
    setEditDraft({ type: r.type, details: r.details || "" });
  }

  async function saveEdit(id) {
    try {
      const updated = await updateReport(id, { type: editDraft.type, details: editDraft.details.trim() });
      setAllReports((prev) => prev.map((r) => (r.id === id ? { ...updated, date: updated.created_at } : r)));
      setEditingId(null);
      setToast("تم تحديث البلاغ");
    } catch (e) {
      setToast(e.message || "تعذّر تحديث البلاغ");
    }
  }

  async function handleDelete(id) {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    try {
      await deleteReport(id);
      setAllReports((prev) => prev.filter((r) => r.id !== id));
      setPendingDelete(null);
      setToast("تم حذف البلاغ");
    } catch (e) {
      setPendingDelete(null);
      setToast(e.message || "تعذّر حذف البلاغ");
    }
  }

  async function handleAddReport(e) {
    e.preventDefault();
    const digits = normalizePhone(newReport.phone);
    if (digits.length < 8) {
      setAddError("أدخل رقم هاتف صحيح (8 أرقام على الأقل)");
      return;
    }
    setAddError("");
    try {
      const inserted = await addReport({
        phone: digits,
        type: newReport.type,
        details: newReport.details.trim(),
        reporter: currentUser?.storeName || "",
      });
      setAllReports((prev) => [{ ...inserted, date: inserted.created_at }, ...prev]);
      setNewReport({ phone: "", type: "fake_order", details: "" });
      setShowAddForm(false);
      setToast("تم إرسال بلاغك بنجاح");
    } catch (e) {
      setAddError(e.message || "تعذّر إرسال البلاغ");
    }
  }

  return (
    <div className="radar-user" dir="rtl" lang="ar">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=El+Messiri:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

        .radar-user {
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
        .radar-user *, .radar-user *::before, .radar-user *::after { box-sizing: border-box; }

        .rd-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 24px 16px;
          max-width: 860px;
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

        .id-pill {
          display: flex; align-items: center; gap: 7px;
          background: var(--panel-2);
          border: 1px solid var(--grid-line);
          border-radius: 999px;
          padding: 7px 13px;
          font-size: 12.5px;
          color: var(--text);
        }
        .id-pill svg { color: var(--accent); }
        .switch-btn {
          background: transparent;
          color: var(--muted);
          border: 1px solid var(--grid-line);
          padding: 7px 13px; border-radius: 999px; font-size: 12px;
          cursor: pointer; font-family: inherit;
        }
        .switch-btn:hover { color: var(--text); border-color: var(--accent); }

        .rd-main { max-width: 860px; margin: 0 auto; padding: 26px 24px 0; }

        .level-banner {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--panel);
          border: 1px solid var(--grid-line);
          border-radius: 16px;
          padding: 18px 20px;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .level-left { display: flex; align-items: center; gap: 12px; }
        .level-icon {
          width: 42px; height: 42px; border-radius: 12px;
          background: var(--panel-2);
          display: flex; align-items: center; justify-content: center;
        }
        .level-name { font-family: 'El Messiri', sans-serif; font-weight: 700; font-size: 16px; }
        .level-sub { color: var(--muted); font-size: 12px; margin-top: 2px; }
        .add-btn {
          display: flex; align-items: center; gap: 6px;
          background: var(--accent); color: var(--void);
          border: none; border-radius: 10px;
          padding: 10px 16px; font-family: inherit; font-weight: 600; font-size: 13px;
          cursor: pointer;
        }
        .add-btn:hover { opacity: 0.92; }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
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
        .stat-value { font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 600; line-height: 1.1; }
        .stat-label { color: var(--muted); font-size: 12px; margin-top: 3px; }

        .panel-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
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

        .donut-wrap { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; justify-content: center; }
        .legend { display: flex; flex-direction: column; gap: 9px; flex: 1; min-width: 150px; }
        .legend-row { display: flex; align-items: center; gap: 9px; font-size: 12.5px; }
        .legend-dot { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
        .legend-label { color: var(--muted); flex: 1; }
        .legend-count { font-family: 'IBM Plex Mono', monospace; color: var(--text); }
        .empty-hint { text-align: center; color: var(--muted-signal); font-size: 13px; padding: 26px 0; }

        .trend-chart { display: flex; align-items: flex-end; gap: 4px; height: 100px; margin-top: 4px; }
        .trend-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 5px; }
        .trend-bar { width: 100%; max-width: 18px; background: var(--accent); border-radius: 3px 3px 0 0; min-height: 3px; transition: height 0.5s ease; }
        .trend-label { font-size: 9px; color: var(--muted-signal); font-family: 'IBM Plex Mono', monospace; white-space: nowrap; }

        .add-form {
          background: var(--panel-2);
          border: 1px solid var(--grid-line);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .rd-label { font-size: 12px; color: var(--muted); margin-bottom: 5px; display: block; }
        .rd-input, .rd-select, .rd-textarea {
          width: 100%;
          background: var(--panel);
          border: 1px solid var(--grid-line);
          border-radius: 9px;
          padding: 10px 12px;
          color: var(--text);
          font-family: inherit;
          font-size: 13.5px;
        }
        .rd-input:focus, .rd-select:focus, .rd-textarea:focus { outline: none; border-color: var(--accent); }
        .rd-input { direction: ltr; text-align: right; font-family: 'IBM Plex Mono', monospace; }
        .rd-textarea { resize: vertical; min-height: 60px; font-family: inherit; }
        .form-row-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .btn-primary {
          background: var(--accent); color: var(--void); border: none;
          padding: 9px 16px; border-radius: 9px; font-weight: 600; font-size: 13px;
          cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 6px;
        }
        .btn-ghost {
          background: transparent; color: var(--muted); border: 1px solid var(--grid-line);
          padding: 9px 16px; border-radius: 9px; font-size: 13px;
          cursor: pointer; font-family: inherit;
        }
        .field-error { color: var(--danger); font-size: 12px; display: flex; align-items: center; gap: 5px; margin-top: -2px; }

        .my-list { display: flex; flex-direction: column; gap: 10px; }
        .my-item {
          background: var(--panel-2);
          border: 1px solid var(--grid-line);
          border-radius: 12px;
          padding: 13px 15px;
        }
        .my-item-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 7px; flex-wrap: wrap; }
        .my-item-left { display: flex; align-items: center; gap: 10px; }
        .my-phone { font-family: 'IBM Plex Mono', monospace; font-size: 13px; direction: ltr; color: var(--text); }
        .badge { font-size: 11px; padding: 4px 9px; border-radius: 999px; }
        .badge-danger { background: rgba(251,95,77,0.15); color: var(--danger); }
        .badge-warn { background: rgba(243,183,63,0.15); color: var(--warn); }
        .my-item-actions { display: flex; gap: 6px; }
        .icon-btn {
          border: none; background: transparent; color: var(--muted-signal);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 8px; transition: all 0.15s;
        }
        .icon-btn:hover { color: var(--accent); background: rgba(62,214,184,0.12); }
        .icon-btn.danger:hover { color: var(--danger); background: rgba(251,95,77,0.12); }
        .icon-btn.confirm { color: var(--danger); background: rgba(251,95,77,0.18); }
        .my-details { color: var(--muted); font-size: 13px; line-height: 1.6; margin-bottom: 6px; }
        .my-time { color: var(--muted-signal); font-size: 11px; display: flex; align-items: center; gap: 4px; }

        .toast {
          position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%);
          background: var(--panel-2);
          border: 1px solid var(--accent);
          color: var(--text);
          padding: 11px 18px;
          border-radius: 999px;
          font-size: 13px;
          display: flex; align-items: center; gap: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          z-index: 20;
        }

        .id-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .id-card {
          width: 100%; max-width: 360px;
          background: var(--panel);
          border: 1px solid var(--grid-line);
          border-radius: 18px;
          padding: 30px 26px;
          text-align: center;
        }
        .id-icon {
          width: 52px; height: 52px; border-radius: 14px;
          background: var(--panel-2);
          border: 1px solid var(--grid-line);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
        }
        .id-title { font-family: 'El Messiri', sans-serif; font-weight: 700; font-size: 19px; margin-bottom: 4px; }
        .id-sub { color: var(--muted); font-size: 12.5px; margin-bottom: 20px; line-height: 1.7; }

        .auth-tabs {
          display: flex; gap: 4px;
          background: var(--panel-2);
          border: 1px solid var(--grid-line);
          border-radius: 11px;
          padding: 4px;
          margin-bottom: 20px;
        }
        .auth-tab {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--muted);
          font-family: inherit;
          font-size: 12.5px;
          padding: 9px 6px;
          border-radius: 8px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .auth-tab.active { background: var(--panel); color: var(--accent); font-weight: 600; }
        .auth-field { position: relative; margin-bottom: 11px; text-align: right; }
        .auth-input {
          width: 100%;
          background: var(--panel-2);
          border: 1px solid var(--grid-line);
          border-radius: 10px;
          padding: 11px 14px;
          color: var(--text);
          font-family: 'IBM Plex Sans Arabic', sans-serif;
          font-size: 13.5px;
          text-align: right;
        }
        .auth-input.mono { font-family: 'IBM Plex Mono', monospace; direction: ltr; text-align: right; }
        .auth-input:focus { outline: none; border-color: var(--accent); }
        .auth-input.with-eye { padding-left: 40px; }
        .auth-eye {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: var(--muted-signal); cursor: pointer;
          display: flex; align-items: center;
        }
        .auth-eye:hover { color: var(--accent); }
        .auth-error {
          color: var(--danger);
          font-size: 12px;
          margin-bottom: 12px;
          display: flex; align-items: center; gap: 6px;
          justify-content: center;
        }
        .auth-note {
          color: var(--muted-signal);
          font-size: 10.5px;
          margin-top: 18px;
          line-height: 1.7;
          border-top: 1px solid var(--grid-line);
          padding-top: 14px;
        }

        @media (max-width: 720px) {
          .stats-row { grid-template-columns: 1fr 1fr; }
          .panel-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {stage === "loading" && (
        <div className="id-screen"><RefreshCw size={22} className="spin" color="var(--accent)" /></div>
      )}

      {stage === "auth" && (
        <div className="id-screen">
          <div className="id-card">
            <div className="id-icon"><Lock size={22} color="var(--accent)" /></div>
            <div className="id-title">لوحتي الشخصية</div>
            <div className="id-sub">سجّل دخولك لعرض بلاغاتك الخاصة وإدارتها.</div>

            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${authMode === "login" ? "active" : ""}`}
                onClick={() => { setAuthMode("login"); setAuthError(""); }}
              >
                <LogIn size={14} /> تسجيل الدخول
              </button>
              <button
                type="button"
                className={`auth-tab ${authMode === "signup" ? "active" : ""}`}
                onClick={() => { setAuthMode("signup"); setAuthError(""); }}
              >
                <UserPlus size={14} /> حساب جديد
              </button>
            </div>

            {authMode === "login" ? (
              <div>
                <div className="auth-field">
                  <input
                    className="auth-input mono"
                    placeholder="اسم المستخدم"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="auth-field">
                  <input
                    className="auth-input mono with-eye"
                    type={showPassword ? "text" : "password"}
                    placeholder="كلمة المرور"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") handleLogin(e); }}
                  />
                  <button type="button" className="auth-eye" onClick={() => setShowPassword((s) => !s)}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {authError && <div className="auth-error"><CircleAlert size={13} /> {authError}</div>}
                <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} type="button" onClick={handleLogin} disabled={authBusy}>
                  {authBusy ? "جارِ الدخول…" : "تسجيل الدخول"}
                </button>
              </div>
            ) : (
              <div>
                <div className="auth-field">
                  <input
                    className="auth-input"
                    placeholder="اسم متجرك أو مندوبك"
                    value={signupForm.storeName}
                    onChange={(e) => setSignupForm({ ...signupForm, storeName: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="auth-field">
                  <input
                    className="auth-input mono"
                    placeholder="اسم المستخدم"
                    value={signupForm.username}
                    onChange={(e) => setSignupForm({ ...signupForm, username: e.target.value })}
                  />
                </div>
                <div className="auth-field">
                  <input
                    className="auth-input mono with-eye"
                    type={showPassword ? "text" : "password"}
                    placeholder="كلمة المرور"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                  />
                  <button type="button" className="auth-eye" onClick={() => setShowPassword((s) => !s)}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div className="auth-field">
                  <input
                    className="auth-input mono"
                    type={showPassword ? "text" : "password"}
                    placeholder="تأكيد كلمة المرور"
                    value={signupForm.confirm}
                    onChange={(e) => setSignupForm({ ...signupForm, confirm: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSignup(e); }}
                  />
                </div>
                {authError && <div className="auth-error"><CircleAlert size={13} /> {authError}</div>}
                <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} type="button" onClick={handleSignup} disabled={authBusy}>
                  {authBusy ? "جارِ الإنشاء…" : "إنشاء الحساب"}
                </button>
              </div>
            )}

            <div className="auth-note">
              {IS_CONFIGURED
                ? <>الحسابات مؤمّنة عبر Supabase Auth الحقيقي (تشفير كلمات مرور، جلسات آمنة). قبل الإطلاق التجاري: فعّل تأكيد البريد وحماية من محاولات الدخول المتكررة.</>
                : <>⚠️ لم يتم ربط التطبيق بقاعدة بيانات بعد — عدّل src/config.js ببيانات مشروع Supabase الخاص بك.</>
              }
            </div>
          </div>
        </div>
      )}

      {stage === "dashboard" && (
        <>
          <header className="rd-header">
            <div className="rd-brand">
              <div className="rd-brand-icon"><Radar size={19} color="var(--accent)" /></div>
              <div>
                <div className="rd-title">لوحتي الشخصية</div>
                <div className="rd-sub">RADAR // بلاغاتك ونشاطك</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="id-pill"><UserRound size={14} /> {currentUser?.storeName}</span>
              <button className="switch-btn" onClick={handleLogout}><LogOut size={13} style={{ marginLeft: 4 }} /> تسجيل خروج</button>
            </div>
          </header>

          <main className="rd-main">
            <div className="level-banner">

              <div className="level-left">
                <div className="level-icon"><Award size={20} color={level.color} /></div>
                <div>
                  <div className="level-name" style={{ color: level.color }}>{level.label}</div>
                  <div className="level-sub">{myReports.length} {myReports.length === 1 ? "بلاغ مُرسل" : "بلاغات مُرسلة"} إجمالاً</div>
                </div>
              </div>
              <button className="add-btn" onClick={() => setShowAddForm((s) => !s)}>
                <Plus size={15} /> بلاغ جديد
              </button>
            </div>

            {showAddForm && (
              <div className="add-form">
                <div>
                  <label className="rd-label">رقم الهاتف</label>
                  <input
                    className="rd-input"
                    placeholder="05xxxxxxxx"
                    value={newReport.phone}
                    onChange={(e) => setNewReport({ ...newReport, phone: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddReport(e); }}
                    inputMode="numeric"
                  />
                  {addError && <div className="field-error"><CircleAlert size={13} /> {addError}</div>}
                </div>
                <div>
                  <label className="rd-label">نوع البلاغ</label>
                  <select
                    className="rd-select"
                    value={newReport.type}
                    onChange={(e) => setNewReport({ ...newReport, type: e.target.value })}
                  >
                    {Object.entries(TYPE_META).map(([key, m]) => (
                      <option key={key} value={key}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="rd-label">تفاصيل إضافية (اختياري)</label>
                  <textarea
                    className="rd-textarea"
                    placeholder="اكتب ما حدث بإيجاز…"
                    value={newReport.details}
                    onChange={(e) => setNewReport({ ...newReport, details: e.target.value })}
                  />
                </div>
                <div className="form-row-actions">
                  <button type="button" className="btn-ghost" onClick={() => setShowAddForm(false)}>إلغاء</button>
                  <button type="button" className="btn-primary" onClick={handleAddReport}><Send size={14} /> إرسال</button>
                </div>
              </div>
            )}

            <div className="stats-row">
              <StatCard icon={<Radio size={17} />} label="إجمالي بلاغاتك" value={myReports.length} />
              <StatCard icon={<TrendingUp size={17} />} label="هذا الشهر" value={thisMonthCount} />
              <StatCard icon={<Store size={17} />} label="أرقام وثّقتها" value={new Set(myReports.map((r) => r.phone)).size} />
            </div>

            <div className="panel-grid">
              <div className="panel">
                <h3 className="panel-title"><Radar size={15} /> أنواع بلاغاتك</h3>
                {myReports.length === 0 ? (
                  <div className="empty-hint">لم ترسل أي بلاغ بعد</div>
                ) : (
                  <div className="donut-wrap">
                    <Ring segments={segments} total={myReports.length} />
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
                <h3 className="panel-title"><TrendingUp size={15} /> نشاطك خلال آخر 14 يوماً</h3>
                {myReports.length === 0 ? (
                  <div className="empty-hint">لا يوجد نشاط لعرضه بعد</div>
                ) : (
                  <div className="trend-chart">
                    {trend.map((t) => (
                      <div className="trend-bar-col" key={t.day}>
                        <div className="trend-bar" style={{ height: `${Math.max(4, t.pct * 78)}px` }} title={`${t.count} بلاغ`} />
                        <span className="trend-label">{dayLabel(t.day)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="panel">
              <h3 className="panel-title"><Store size={15} /> بلاغاتي</h3>
              {myReports.length === 0 ? (
                <div className="empty-hint">لم ترسل أي بلاغ بعد — استخدم زر "بلاغ جديد" أعلاه</div>
              ) : (
                <div className="my-list">
                  {myReports.map((r) => {
                    const danger = TYPE_META[r.type]?.weight >= 20;
                    const isEditing = editingId === r.id;
                    return (
                      <div className="my-item" key={r.id}>
                        <div className="my-item-top">
                          <div className="my-item-left">
                            <span className="my-phone">{maskPhone(r.phone)}</span>
                            {!isEditing && (
                              <span className={`badge ${danger ? "badge-danger" : "badge-warn"}`}>
                                {TYPE_META[r.type]?.label}
                              </span>
                            )}
                          </div>
                          <div className="my-item-actions">
                            {isEditing ? (
                              <button className="icon-btn" onClick={() => saveEdit(r.id)} title="حفظ"><Check size={14} /></button>
                            ) : (
                              <button className="icon-btn" onClick={() => startEdit(r)} title="تعديل"><Pencil size={14} /></button>
                            )}
                            <button
                              className={`icon-btn danger ${pendingDelete === r.id ? "confirm" : ""}`}
                              onClick={() => handleDelete(r.id)}
                              title={pendingDelete === r.id ? "اضغط للتأكيد" : "حذف"}
                            >
                              {pendingDelete === r.id ? <X size={14} /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        </div>

                        {isEditing ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                            <select
                              className="rd-select"
                              value={editDraft.type}
                              onChange={(e) => setEditDraft({ ...editDraft, type: e.target.value })}
                            >
                              {Object.entries(TYPE_META).map(([key, m]) => (
                                <option key={key} value={key}>{m.label}</option>
                              ))}
                            </select>
                            <textarea
                              className="rd-textarea"
                              value={editDraft.details}
                              onChange={(e) => setEditDraft({ ...editDraft, details: e.target.value })}
                            />
                          </div>
                        ) : (
                          <>
                            {r.details && <div className="my-details">{r.details}</div>}
                            <div className="my-time"><Clock size={11} /> {relativeTime(r.date)}</div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </>
      )}

      {toast && <div className="toast"><Check size={15} color="var(--accent)" /> {toast}</div>}
    </div>
  );
}
