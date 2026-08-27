// حسابات هذا التطبيق قائمة على اسم مستخدم بسيط (بدل بريد إلكتروني) لتبسيط
// تجربة الاستخدام، بينما تتطلب Supabase Auth بريداً إلكترونياً تقنياً — لذلك
// نولّد بريداً داخلياً ثابتاً من اسم المستخدم، ولا يُستخدم لإرسال أي رسائل فعلية.
export function usernameToEmail(username) {
  const clean = (username || "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  return `${clean || "user"}@radar.local`;
}
