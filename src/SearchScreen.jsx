import React, { useState, useEffect, useCallback } from "react";
import {
  Radar,
  Search,
  Send,
  Radio,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  ShieldX,
  Clock,
  CircleAlert,
  Users,
  Store,
} from "./icons.jsx";
import { listAllReports, addReport, IS_CONFIGURED } from "./supabase.js";

const TYPE_META = {
  fake_order: { label: "طلب وهمي", weight: 30 },
  repeated_refusal: { label: "رفض استلام متكرر", weight: 18 },
  wrong_address: { label: "عنوان غير صحيح", weight: 10 },
  abuse: { label: "إساءة تجاه المندوب", weight: 22 },
};

const SEED_REPORTS = [
  {
    id: "seed-1",
    phone: "0512345678",
    type: "fake_order",
    details: "تم تأكيد الطلب هاتفياً ثم رفض الاستلام دون سبب.",
    date: daysAgoISO(1),
    reporter: "متجر النور",
  },
  {
    id: "seed-2",
    phone: "0512345678",
    type: "repeated_refusal",
    details: "ثالث مرة يرفض استلام نفس المنتج من متاجر مختلفة.",
    date: daysAgoISO(4),
    reporter: "خدمة التوصيل السريع",
  },
  {
    id: "seed-2b",
    phone: "0512345678",
    type: "repeated_refusal",
    details: "رفض الاستلام دون رد على مكالمات التأكيد.",
    date: daysAgoISO(9),
    reporter: "متجر الأمل",
  },
  {
    id: "seed-3",
    phone: "0555000111",
    type: "wrong_address",
    details: "العنوان المُدخل غير موجود، تم التواصل ولم يُرد.",
    date: daysAgoISO(2),
    reporter: "متجر الأمل",
  },
  {
    id: "seed-4",
    phone: "0599888777",
    type: "abuse",
    details: "تعامل غير لائق مع مندوب التوصيل عند التسليم.",
    date: daysAgoISO(6),
    reporter: "مندوب توصيل مستقل",
  },
];

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(d.getHours() - Math.floor(Math.random() * 5));
  return d.toISOString();
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

function maskPhone(digits) {
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
  if (phoneReports.length === 0) {
    return { score: 0, level: "none", uniqueReporters: 0 };
  }
  const raw = phoneReports.reduce(
    (acc, r) => acc + (TYPE_META[r.type]?.weight || 10),
    0
  );
  // بلاغات من مصادر مستقلة متعددة (تجار/مناديب مختلفون) تُعزز موثوقية التقييم
  const diversityBonus = Math.min(15, (uniqueReporters - 1) * 8);
  const score = Math.min(100, raw + Math.max(0, diversityBonus));
  let level = "low";
  if (score >= 60) level = "high";
  else if (score >= 30) level = "medium";
  return { score, level, uniqueReporters };
}

const LEVEL_META = {
  none: {
    label: "لا توجد بلاغات مسجّلة",
    sub: "كن أول من يوثّق تجربته مع هذا الرقم",
    color: "var(--muted-signal)",
    Icon: ShieldQuestion,
  },
  low: {
    label: "لا مؤشرات خطر واضحة",
    sub: "بلاغ واحد محدود الأثر — يُنصح بالمتابعة العادية",
    color: "var(--safe)",
    Icon: ShieldCheck,
  },
  medium: {
    label: "يستدعي الحذر",
    sub: "توجد بلاغات سابقة تستحق التأكيد قبل الشحن",
    color: "var(--warn)",
    Icon: ShieldAlert,
  },
  high: {
    label: "خطورة مرتفعة",
    sub: "نمط بلاغات متكرر — يُنصح بالتأكيد الهاتفي أو رفض الطلب",
    color: "var(--danger)",
    Icon: ShieldX,
  },
};

function Gauge({ score, level, scanning }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const meta = LEVEL_META[level];
  const offset = scanning ? c : c * (1 - score / 100);
  return (
    <div className="gauge-wrap">
      <svg width="150" height="150" viewBox="0 0 150 150">
        <circle
          cx="75"
          cy="75"
          r={r}
          fill="none"
          stroke="var(--grid-line)"
          strokeWidth="10"
        />
        {!scanning && (
          <circle
            cx="75"
            cy="75"
            r={r}
            fill="none"
            stroke={meta.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform="rotate(-90 75 75)"
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1), stroke 0.4s" }}
          />
        )}
        {scanning && (
          <circle
            cx="75"
            cy="75"
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${c * 0.22} ${c}`}
            transform="rotate(-90 75 75)"
            className="sweep-ring"
          />
        )}
      </svg>
      <div className="gauge-center">
        {scanning ? (
          <Radar size={30} className="spin-icon" color="var(--accent)" />
        ) : (
          <>
            <span className="gauge-score">{score}</span>
            <span className="gauge-max">/100</span>
          </>
        )}
      </div>
    </div>
  );
}

function TypeBadge({ type }) {
  const meta = TYPE_META[type];
  const danger = meta.weight >= 20;
  return (
    <span className={`badge ${danger ? "badge-danger" : "badge-warn"}`}>
      {meta.label}
    </span>
  );
}

export default function SearchScreen() {
  const [tab, setTab] = useState("search");
  const [reports, setReports] = useState(SEED_REPORTS);
  const [ready, setReady] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [scannedPhone, setScannedPhone] = useState("");
  const [toast, setToast] = useState("");

  const [form, setForm] = useState({ phone: "", type: "fake_order", details: "", reporter: "" });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!IS_CONFIGURED) {
        // لم يتم ربط المشروع بقاعدة بيانات Supabase بعد — نعرض بيانات تجريبية محلية فقط
        if (mounted) { setReports(SEED_REPORTS); setReady(true); }
        return;
      }
      try {
        const rows = await listAllReports();
        if (mounted) setReports(rows.map((r) => ({ ...r, date: r.created_at })));
      } catch (e) {
        if (mounted) setReports(SEED_REPORTS);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  function handleScan(e) {
    if (e && e.preventDefault) e.preventDefault();
    const digits = normalizePhone(phoneInput);
    if (digits.length < 8) {
      setPhoneError("أدخل رقم هاتف صحيح (8 أرقام على الأقل)");
      setResult(null);
      return;
    }
    setPhoneError("");
    setScanning(true);
    setResult(null);
    setScannedPhone(digits);
    setTimeout(() => {
      setReports((currentReports) => {
        const matched = currentReports.filter((r) => r.phone === digits);
        setResult({ ...computeResult(matched), reports: matched });
        return currentReports;
      });
      setScanning(false);
    }, 900);
  }

  async function handleSubmitReport(e) {
    if (e && e.preventDefault) e.preventDefault();
    const digits = normalizePhone(form.phone);
    if (digits.length < 8) {
      setFormError("أدخل رقم هاتف صحيح (8 أرقام على الأقل)");
      return;
    }
    setFormError("");
    const reporterLabel = form.reporter.trim() || `مُبلّغ مجهول #${Math.floor(1000 + Math.random() * 9000)}`;
    if (!IS_CONFIGURED) {
      setFormError("لم يتم ربط التطبيق بقاعدة بيانات بعد — راجع ملف الإعداد");
      return;
    }
    try {
      const inserted = await addReport({ phone: digits, type: form.type, details: form.details.trim(), reporter: reporterLabel });
      setReports((prev) => [{ ...inserted, date: inserted.created_at }, ...prev]);
      setForm({ phone: "", type: "fake_order", details: "", reporter: "" });
      setToast("تم إرسال البلاغ وإضافته إلى قاعدة البيانات المشتركة");
      setTab("feed");
    } catch (err) {
      setFormError(err.message || "تعذّر إرسال البلاغ، تحقق من الاتصال");
    }
  }

  const feedSorted = [...reports].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  return (
    <div className="radar-app" dir="rtl" lang="ar">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=El+Messiri:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

        .radar-app {
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
          font-family: 'IBM Plex Sans Arabic', sans-serif;
          background: radial-gradient(ellipse at 50% -10%, #12241f 0%, var(--void) 55%);
          color: var(--text);
          min-height: 100vh;
          width: 100%;
          box-sizing: border-box;
          padding: 0 0 40px;
        }
        .radar-app *, .radar-app *::before, .radar-app *::after { box-sizing: border-box; }

        .rd-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 24px 16px;
          max-width: 720px;
          margin: 0 auto;
          border-bottom: 1px solid var(--grid-line);
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

        .rd-nav { display: flex; gap: 6px; }
        .rd-nav button {
          background: transparent;
          border: 1px solid transparent;
          color: var(--muted);
          font-family: inherit;
          font-size: 13.5px;
          padding: 8px 14px;
          border-radius: 999px;
          cursor: pointer;
          display: flex; align-items: center; gap: 6px;
          transition: all 0.2s;
        }
        .rd-nav button:hover { color: var(--text); }
        .rd-nav button.active {
          background: var(--panel-2);
          border-color: var(--grid-line);
          color: var(--accent);
        }

        .rd-main { max-width: 720px; margin: 0 auto; padding: 32px 24px 0; }

        .rd-hero { text-align: center; margin-bottom: 26px; }
        .rd-hero h1 {
          font-family: 'El Messiri', sans-serif;
          font-size: 26px;
          font-weight: 600;
          margin: 0 0 8px;
        }
        .rd-hero p { color: var(--muted); font-size: 14.5px; margin: 0; line-height: 1.7; }

        .search-form { display: flex; gap: 10px; margin-bottom: 8px; }
        .rd-input-wrap { position: relative; flex: 1; }
        .rd-input {
          width: 100%;
          background: var(--panel);
          border: 1px solid var(--grid-line);
          color: var(--text);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 16px;
          letter-spacing: 1px;
          padding: 14px 16px;
          border-radius: 12px;
          outline: none;
          transition: border-color 0.2s;
          direction: ltr;
          text-align: right;
        }
        .rd-input:focus { border-color: var(--accent); }
        .rd-input::placeholder { font-family: 'IBM Plex Sans Arabic', sans-serif; letter-spacing: normal; color: var(--muted-signal); }

        .rd-scan-btn {
          background: var(--accent);
          color: #062420;
          border: none;
          border-radius: 12px;
          padding: 0 22px;
          font-family: inherit;
          font-weight: 600;
          font-size: 14.5px;
          display: flex; align-items: center; gap: 8px;
          cursor: pointer;
          transition: filter 0.2s, transform 0.05s;
        }
        .rd-scan-btn:hover { filter: brightness(1.08); }
        .rd-scan-btn:active { transform: scale(0.97); }
        .rd-scan-btn:disabled { opacity: 0.6; cursor: default; }

        .field-error {
          color: var(--danger);
          font-size: 12.5px;
          margin: 8px 2px 0;
          display: flex; align-items: center; gap: 5px;
        }

        .result-card {
          margin-top: 26px;
          background: var(--panel);
          border: 1px solid var(--grid-line);
          border-radius: 18px;
          padding: 28px;
          display: flex;
          gap: 24px;
          align-items: center;
          animation: fadeUp 0.4s ease;
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        .gauge-wrap { position: relative; width: 150px; height: 150px; flex-shrink: 0; }
        .gauge-center {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .gauge-score { font-family: 'IBM Plex Mono', monospace; font-size: 34px; font-weight: 600; line-height: 1; }
        .gauge-max { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); }

        .sweep-ring { animation: sweep 1.1s linear infinite; transform-origin: 75px 75px; }
        @keyframes sweep { to { transform: rotate(270deg); } }
        .spin-icon { animation: spin 1.1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .result-info { flex: 1; min-width: 0; }
        .result-phone { font-family: 'IBM Plex Mono', monospace; color: var(--muted); font-size: 13px; margin-bottom: 6px; direction: ltr; text-align: right; }
        .result-label { font-family: 'El Messiri', sans-serif; font-size: 19px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .result-sub { color: var(--muted); font-size: 13.5px; line-height: 1.6; }

        .result-stats { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .stat-chip {
          display: flex; align-items: center; gap: 6px;
          background: var(--panel-2);
          border: 1px solid var(--grid-line);
          color: var(--text);
          font-size: 12.5px;
          font-family: 'IBM Plex Mono', monospace;
          padding: 6px 12px;
          border-radius: 999px;
        }

        .report-list { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
        .report-item {
          background: var(--panel);
          border: 1px solid var(--grid-line);
          border-radius: 12px;
          padding: 14px 16px;
        }
        .report-item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .report-time { color: var(--muted-signal); font-size: 11.5px; font-family: 'IBM Plex Mono', monospace; display: flex; align-items: center; gap: 4px; }
        .report-details { color: var(--muted); font-size: 13px; line-height: 1.6; }
        .report-reporter {
          display: flex; align-items: center; gap: 5px;
          color: var(--muted-signal);
          font-size: 11.5px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed var(--grid-line);
        }

        .badge {
          font-size: 11.5px;
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 600;
          white-space: nowrap;
        }
        .badge-danger { background: rgba(251,95,77,0.15); color: var(--danger); }
        .badge-warn { background: rgba(243,183,63,0.15); color: var(--warn); }

        .rd-form { display: flex; flex-direction: column; gap: 16px; margin-top: 6px; }
        .rd-label { font-size: 13px; color: var(--muted); margin-bottom: 7px; display: block; }
        .rd-select, .rd-textarea {
          width: 100%;
          background: var(--panel);
          border: 1px solid var(--grid-line);
          color: var(--text);
          font-family: 'IBM Plex Sans Arabic', sans-serif;
          font-size: 14.5px;
          padding: 12px 14px;
          border-radius: 10px;
          outline: none;
          transition: border-color 0.2s;
        }
        .rd-select:focus, .rd-textarea:focus { border-color: var(--accent); }
        .rd-textarea { resize: vertical; min-height: 90px; line-height: 1.6; }

        .submit-btn {
          background: var(--panel-2);
          border: 1px solid var(--accent);
          color: var(--accent);
          border-radius: 12px;
          padding: 13px;
          font-family: inherit;
          font-weight: 600;
          font-size: 14.5px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .submit-btn:hover { background: var(--accent); color: #062420; }

        .feed-note {
          color: var(--muted-signal);
          font-size: 12.5px;
          margin-bottom: 18px;
          display: flex; align-items: center; gap: 6px;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--muted);
        }

        .toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--panel-2);
          border: 1px solid var(--accent);
          color: var(--text);
          padding: 12px 22px;
          border-radius: 999px;
          font-size: 13.5px;
          display: flex; align-items: center; gap: 8px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.4);
          animation: fadeUp 0.3s ease;
          z-index: 50;
        }

        .footnote {
          max-width: 720px;
          margin: 36px auto 0;
          padding: 16px 24px 0;
          border-top: 1px solid var(--grid-line);
          color: var(--muted-signal);
          font-size: 11.5px;
          text-align: center;
          line-height: 1.8;
        }

        @media (max-width: 480px) {
          .rd-header { padding: 18px 16px 14px; }
          .rd-main { padding: 26px 16px 0; }
          .rd-title { font-size: 18px; }
          .result-card { flex-direction: column; text-align: center; padding: 22px; }
          .result-phone, .result-label, .result-sub { text-align: center; justify-content: center; }
          .result-stats { justify-content: center; }
          .search-form { flex-direction: column; }
          .rd-scan-btn { padding: 13px; justify-content: center; }
        }
      `}</style>

      <header className="rd-header">
        <div className="rd-brand">
          <div className="rd-brand-icon"><Radar size={19} color="var(--accent)" /></div>
          <div>
            <div className="rd-title">رادار</div>
            <div className="rd-sub">RADAR // فحص جماعي لطلبات التوصيل</div>
          </div>
        </div>
        <nav className="rd-nav">
          <button className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}>
            <Search size={15} /> بحث
          </button>
          <button className={tab === "report" ? "active" : ""} onClick={() => setTab("report")}>
            <Send size={15} /> إبلاغ
          </button>
          <button className={tab === "feed" ? "active" : ""} onClick={() => setTab("feed")}>
            <Radio size={15} /> السجل
          </button>
        </nav>
      </header>

      <main className="rd-main">
        {tab === "search" && (
          <>
            <div className="rd-hero">
              <h1>افحص رقم العميل قبل تنفيذ الطلب</h1>
              <p>أدخل رقم الهاتف لمعرفة أي بلاغات سابقة من تجار أو مناديب آخرين</p>
            </div>

            <div className="search-form">
              <div className="rd-input-wrap">
                <input
                  className="rd-input"
                  placeholder="05xxxxxxxx"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleScan(e); }}
                  inputMode="numeric"
                />
              </div>
              <button className="rd-scan-btn" type="button" onClick={handleScan} disabled={scanning}>
                <Radar size={17} className={scanning ? "spin-icon" : ""} />
                {scanning ? "جارِ الفحص" : "افحص الرقم"}
              </button>
            </div>
            {phoneError && (
              <div className="field-error"><CircleAlert size={14} /> {phoneError}</div>
            )}

            {(scanning || result) && (
              <div className="result-card">
                <Gauge score={result?.score || 0} level={result?.level || "none"} scanning={scanning} />
                <div className="result-info">
                  <div className="result-phone">{scannedPhone.replace(/(\d{2})(?=\d)/g, "$1 ")}</div>
                  {scanning ? (
                    <>
                      <div className="result-label">جارِ مسح السجل المشترك…</div>
                      <div className="result-sub">نبحث عبر بلاغات جميع التجار والمناديب المسجّلين</div>
                    </>
                  ) : (
                    (() => {
                      const meta = LEVEL_META[result.level];
                      return (
                        <>
                          <div className="result-label" style={{ color: meta.color }}>
                            <meta.Icon size={19} /> {meta.label}
                          </div>
                          <div className="result-sub">{meta.sub}</div>
                          {result.reports.length > 0 && (
                            <div className="result-stats">
                              <span className="stat-chip">
                                <Users size={13} /> {result.uniqueReporters} {result.uniqueReporters === 1 ? "مُبلّغ" : "مُبلّغين"}
                              </span>
                              <span className="stat-chip">
                                <Radio size={13} /> {result.reports.length} {result.reports.length === 1 ? "بلاغ" : "بلاغات"}
                              </span>
                            </div>
                          )}
                        </>
                      );
                    })()
                  )}
                </div>
              </div>
            )}

            {result && result.reports.length > 0 && (
              <div className="report-list">
                {result.reports.map((r) => (
                  <div className="report-item" key={r.id}>
                    <div className="report-item-top">
                      <TypeBadge type={r.type} />
                      <span className="report-time"><Clock size={11} /> {relativeTime(r.date)}</span>
                    </div>
                    {r.details && <div className="report-details">{r.details}</div>}
                    <div className="report-reporter"><Store size={12} /> {r.reporter}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "report" && (
          <>
            <div className="rd-hero">
              <h1>وثّق تجربتك مع هذا الرقم</h1>
              <p>بلاغك يُضاف إلى السجل المشترك ويساعد تجاراً ومناديب آخرين</p>
            </div>
            <div className="rd-form">
              <div>
                <label className="rd-label">رقم الهاتف</label>
                <input
                  className="rd-input"
                  placeholder="05xxxxxxxx"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmitReport(e); }}
                  inputMode="numeric"
                />
                {formError && (
                  <div className="field-error"><CircleAlert size={14} /> {formError}</div>
                )}
              </div>
              <div>
                <label className="rd-label">نوع البلاغ</label>
                <select
                  className="rd-select"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
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
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                />
              </div>
              <div>
                <label className="rd-label">اسم متجرك أو مندوبك (اختياري)</label>
                <input
                  className="rd-input"
                  style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", letterSpacing: "normal", textAlign: "right" }}
                  placeholder="مثال: متجر النور — يظهر هذا للعامة لإثبات مصداقية البلاغ"
                  value={form.reporter}
                  onChange={(e) => setForm({ ...form, reporter: e.target.value })}
                />
              </div>
              <button className="submit-btn" type="button" onClick={handleSubmitReport}>
                <Send size={16} /> إرسال البلاغ
              </button>
            </div>
          </>
        )}

        {tab === "feed" && (
          <>
            <div className="rd-hero" style={{ marginBottom: 18 }}>
              <h1>سجل النشاط المشترك</h1>
            </div>
            <div className="feed-note">
              <Radio size={13} /> تُعرض آخر أرقام الهاتف جزئياً حفاظاً على الخصوصية
            </div>
            {feedSorted.length === 0 ? (
              <div className="empty-state">لا توجد بلاغات بعد — كن أول من يُبلغ</div>
            ) : (
              <div className="report-list">
                {feedSorted.map((r) => (
                  <div className="report-item" key={r.id}>
                    <div className="report-item-top">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "var(--muted)", direction: "ltr" }}>
                          {maskPhone(r.phone)}
                        </span>
                        <TypeBadge type={r.type} />
                      </div>
                      <span className="report-time"><Clock size={11} /> {relativeTime(r.date)}</span>
                    </div>
                    {r.details && <div className="report-details">{r.details}</div>}
                    <div className="report-reporter"><Store size={12} /> {r.reporter}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <div className="footnote">
        {IS_CONFIGURED
          ? <>البيانات مشتركة فعلياً بين كل من يستخدم هذا التطبيق عبر قاعدة بيانات حقيقية.<br />قبل الإطلاق التجاري: أضف حماية من البلاغات الكيدية وتحققاً من هوية المُبلّغ.</>
          : <>⚠️ لم يتم ربط التطبيق بقاعدة بيانات بعد — عدّل src/config.js ببيانات مشروع Supabase الخاص بك.<br />حالياً تُعرض بيانات تجريبية محلية فقط.</>
        }
      </div>

      {toast && <div className="toast"><ShieldCheck size={15} color="var(--accent)" /> {toast}</div>}
    </div>
  );
}
