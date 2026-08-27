// طبقة توافق: تنفّذ نفس واجهة window.storage التي تتوقعها مكوّنات التطبيق
// (get/set/delete/list) لكن باستخدام localStorage الحقيقي في المتصفح،
// لأن window.storage الأصلية خاصة ببيئة معاينة Claude ولا توجد خارجها.
// ملاحظة: بما أن هذا تطبيق مستقل بدون خادم خلفي، "shared" هنا تعني
// "مشتركة بين تبويبات هذا الجهاز فقط" وليست مشتركة بين مستخدمين مختلفين فعلياً.

function ns(key, shared) {
  return (shared ? "radar_shared:" : "radar_personal:") + key;
}

window.storage = {
  async get(key, shared = false) {
    const raw = localStorage.getItem(ns(key, shared));
    if (raw === null) throw new Error(`key not found: ${key}`);
    return { key, value: raw, shared };
  },
  async set(key, value, shared = false) {
    localStorage.setItem(ns(key, shared), value);
    return { key, value, shared };
  },
  async delete(key, shared = false) {
    localStorage.removeItem(ns(key, shared));
    return { key, deleted: true, shared };
  },
  async list(prefix = "", shared = false) {
    const full = ns(prefix, shared);
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(full)) {
        keys.push(k.slice((shared ? "radar_shared:" : "radar_personal:").length));
      }
    }
    return { keys, prefix, shared };
  },
};
