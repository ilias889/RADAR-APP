// ============================================================
// طبقة اتصال خفيفة بـ Supabase مبنية على fetch مباشرة (بدون حزمة supabase-js)،
// لأن REST API الخاصة بـ Supabase (PostgREST + GoTrue) موثّقة وثابتة ويمكن
// التعامل معها مباشرة. تعمل هذه الطبقة كبديل حقيقي لـ window.storage القديمة.
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_CONFIGURED } from "./config.js";

const REST = `${SUPABASE_URL}/rest/v1`;
const AUTH = `${SUPABASE_URL}/auth/v1`;
const SESSION_KEY = "radar_supabase_session";

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}

let currentSession = loadSession();

function authHeader() {
  const token = currentSession?.access_token || SUPABASE_ANON_KEY;
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
}

async function parseJsonSafe(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch (e) { return text; }
}

async function refreshSession() {
  if (!currentSession?.refresh_token) return false;
  const res = await fetch(`${AUTH}/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: currentSession.refresh_token }),
  });
  if (!res.ok) { currentSession = null; saveSession(null); return false; }
  const data = await parseJsonSafe(res);
  currentSession = data;
  saveSession(data);
  return true;
}

/** يرسل طلباً مع إعادة محاولة تلقائية مرة واحدة إذا انتهت صلاحية الجلسة (401) */
async function authedFetch(url, options = {}) {
  const doFetch = () =>
    fetch(url, { ...options, headers: { ...authHeader(), ...(options.headers || {}) } });
  let res = await doFetch();
  if (res.status === 401 && currentSession) {
    const refreshed = await refreshSession();
    if (refreshed) res = await doFetch();
  }
  return res;
}

/* ---------------- المصادقة ---------------- */

export function getCurrentUser() {
  return currentSession?.user || null;
}

export function isLoggedIn() {
  return !!currentSession?.access_token;
}

export async function signUp(email, password, storeName) {
  const res = await fetch(`${AUTH}/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { store_name: storeName } }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.msg || data?.error_description || data?.message || "تعذّر إنشاء الحساب");
  if (data?.access_token) {
    currentSession = data;
    saveSession(data);
  }
  // إذا كان تأكيد البريد مفعّلاً في إعدادات المشروع، لن يصل access_token هنا
  return data;
}

export async function signIn(email, password) {
  const res = await fetch(`${AUTH}/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error_description || data?.msg || "بيانات الدخول غير صحيحة");
  currentSession = data;
  saveSession(data);
  return data;
}

export async function signOut() {
  if (currentSession?.access_token) {
    await fetch(`${AUTH}/logout`, {
      method: "POST",
      headers: authHeader(),
    }).catch(() => {});
  }
  currentSession = null;
  saveSession(null);
}

export async function restoreSession() {
  currentSession = loadSession();
  if (currentSession?.refresh_token) {
    const ok = await refreshSession();
    if (!ok) return null;
  }
  return getCurrentUser();
}

/* ---------------- ملف التاجر (profiles) ---------------- */

export async function getMyProfile() {
  const uid = getCurrentUser()?.id;
  if (!uid) return null;
  const res = await authedFetch(`${REST}/profiles?id=eq.${uid}&select=*`);
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error("تعذّر جلب بيانات الحساب");
  return Array.isArray(data) ? data[0] || null : null;
}

/* ---------------- البلاغات (reports) ---------------- */

export async function listAllReports() {
  const res = await authedFetch(`${REST}/reports?select=*&order=created_at.desc&limit=500`);
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error("تعذّر تحميل البلاغات");
  return data || [];
}

export async function listReportsByPhone(phone) {
  const res = await authedFetch(`${REST}/reports?phone=eq.${encodeURIComponent(phone)}&select=*&order=created_at.desc`);
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error("تعذّر تحميل البلاغات");
  return data || [];
}

export async function listMyReports() {
  const uid = getCurrentUser()?.id;
  if (!uid) return [];
  const res = await authedFetch(`${REST}/reports?reporter_user_id=eq.${uid}&select=*&order=created_at.desc`);
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error("تعذّر تحميل بلاغاتك");
  return data || [];
}

export async function addReport({ phone, type, details, reporter }) {
  const uid = getCurrentUser()?.id || null;
  const res = await authedFetch(`${REST}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify([{ phone, type, details: details || "", reporter: reporter || "مجهول", reporter_user_id: uid }]),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || "تعذّر إرسال البلاغ");
  return Array.isArray(data) ? data[0] : data;
}

export async function updateReport(id, patch) {
  const res = await authedFetch(`${REST}/reports?id=eq.${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || "تعذّر تحديث البلاغ");
  return Array.isArray(data) ? data[0] : data;
}

export async function deleteReport(id) {
  const res = await authedFetch(`${REST}/reports?id=eq.${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await parseJsonSafe(res);
    throw new Error(data?.message || "تعذّر حذف البلاغ — تأكد أن حسابك مسؤول (is_admin)");
  }
  return true;
}

export { IS_CONFIGURED };
