import React, { useState } from "react";
import SearchScreen from "./SearchScreen.jsx";
import MyDashboard from "./MyDashboard.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import { Radar, UserRound, Lock } from "./icons.jsx";
import { supabase } from "./src/config.js";

const TABS = [
  { key: "search", label: "بحث وإبلاغ", Icon: Radar },
  { key: "mine", label: "لوحتي", Icon: UserRound },
  { key: "admin", label: "الإدارة", Icon: Lock },
];

export default function App() {
  const [tab, setTab] = useState("search");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // كلمة السر الخاصة بمدير التطبيق (يمكنك تغييرها هنا)
  const ADMIN_PASSWORD = "PassWord@1234"; 

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdminLoggedIn(true);
      setErrorMsg("");
    } else {
      setErrorMsg("كلمة السر غير صحيحة!");
    }
  };

  return (
    <div className="shell">
      <style>{
        html, body { margin: 0; padding: 0; background: #0a1412; }
        .shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #0a1412;
          font-family: 'IBM Plex Sans Arabic', sans-serif;
        }
        .shell-content {
          flex: 1;
          padding-bottom: 74px;
        }
        .tab-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          background: #0f1c19;
          border-top: 1px solid #1f3630;
          padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
          z-index: 100;
        }
        .tab-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: #5c766c;
          font-family: 'IBM Plex Sans Arabic', sans-serif;
          font-size: 11.5px;
          padding: 6px 4px;
          cursor: pointer;
          border-radius: 12px;
          transition: color 0.15s, background 0.15s;
        }
        .tab-btn.active { color: #3ed6b8; background: #142522; }

        /* تنسيقات واجهة الدخول للأدمن */
        .admin-login-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: #fff;
          text-align: center;
        }
        .admin-input {
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid #1f3630;
          background: #0f1c19;
          color: #fff;
          margin-bottom: 12px;
          width: 80%;
          max-width: 300px;
          text-align: center;
        }
        .admin-btn {
          padding: 10px 24px;
          border-radius: 8px;
          border: none;
          background: #3ed6b8;
          color: #0a1412;
          font-weight: bold;
          cursor: pointer;
        }
      }</style>

      <div className="shell-content">
        {tab === "search" && <SearchScreen />}
        {tab === "mine" && <MyDashboard />}
        {tab === "admin" && (
          isAdminLoggedIn ? (
            <AdminDashboard />
          ) : (
            <div className="admin-login-box" dir="rtl">
              <Lock size={48} color="#3ed6b8" style={{ marginBottom: 16 }} />
              <h2>لوحة الإدارة محمية</h2>
              <p style={{ color: '#5c766c', fontSize: 14 }}>يرجى إدخال كلمة سر المدير للدخول</p>
              
              <form onSubmit={handleAdminLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <input
                  type="password"
                  placeholder="كلمة المرور"
                  className="admin-input"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
                {errorMsg && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 0 }}>{errorMsg}</p>}
                <button type="submit" className="admin-btn">تسجيل الدخول</button>
              </form>
            </div>
          )
        )}
      </div>

      <nav className="tab-bar" dir="rtl">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={tab-btn ${tab === key ? "active" : ""}}
            onClick={() => setTab(key)}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}