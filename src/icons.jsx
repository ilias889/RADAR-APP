import React from "react";

function base(paths, extra = {}) {
  return function IconBase({ size = 18, color = "currentColor", className = "", style = {}, ...rest }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        {...rest}
      >
        {paths}
      </svg>
    );
  };
}

export const Radar = base(
  <>
    <path d="M19.07 4.93A10 10 0 1 0 22 12" />
    <path d="M12 12 6.5 6.5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </>
);

export const Search = base(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </>
);

export const Send = base(<path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7Z" />);

export const Radio = base(
  <>
    <circle cx="12" cy="12" r="2" />
    <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" />
  </>
);

export const ShieldCheck = base(
  <>
    <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </>
);

export const ShieldAlert = base(
  <>
    <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" />
    <path d="M12 8v4M12 16h.01" />
  </>
);

export const ShieldX = base(
  <>
    <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" />
    <path d="m9.5 9.5 5 5M14.5 9.5l-5 5" />
  </>
);

export const ShieldQuestion = base(
  <>
    <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" />
    <path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 1.7-2.4 3.4" />
    <path d="M12 16.5h.01" />
  </>
);

export const Clock = base(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </>
);

export const CircleAlert = base(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </>
);

export const Users = base(
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 8.2a3.2 3.2 0 1 1 3.6 3.16" />
    <path d="M15.7 13.2A6.5 6.5 0 0 1 21.5 20" />
  </>
);

export const Store = base(
  <>
    <path d="M3 9.5 4 4h16l1 5.5" />
    <path d="M3 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
    <path d="M5 11v9h14v-9" />
    <path d="M9.5 20v-5.5h5V20" />
  </>
);

export const RefreshCw = base(
  <>
    <path d="M21 12a9 9 0 0 0-15.3-6.4L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 15.3 6.4L21 16" />
    <path d="M21 21v-5h-5" />
  </>
);

export const Trash2 = base(
  <>
    <path d="M4 6h16" />
    <path d="M9 6V4h6v2" />
    <path d="M6 6l1 14h10l1-14" />
    <path d="M10 11v6M14 11v6" />
  </>
);

export const TrendingUp = base(
  <>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M17 7h4v4" />
  </>
);

export const Filter = base(<path d="M4 4h16l-6.5 8v6L10.5 20v-8L4 4Z" />);

export const X = base(<path d="M18 6 6 18M6 6l12 12" />);

export const Lock = base(
  <>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
  </>
);

export const LogOut = base(
  <>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M9 8 4.5 12 9 16" />
    <path d="M4.5 12H15" />
  </>
);

export const LogIn = base(
  <>
    <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
    <path d="M15 8l4.5 4-4.5 4" />
    <path d="M19.5 12H9" />
  </>
);

export const Eye = base(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>
);

export const EyeOff = base(
  <>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.2A9.4 9.4 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.4 4.4M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.4 0 2.6-.3 3.7-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </>
);

export const UserRound = base(
  <>
    <circle cx="12" cy="8" r="4.2" />
    <path d="M4 20a8 8 0 0 1 16 0" />
  </>
);

export const Pencil = base(
  <>
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    <path d="M14.5 5.5l3 3" />
  </>
);

export const Check = base(<path d="M20 6 9 17l-5-5" />);

export const Award = base(
  <>
    <circle cx="12" cy="8" r="5.5" />
    <path d="M9 12.5 7.5 21l4.5-2.5L16.5 21 15 12.5" />
  </>
);

export const CircleAlertFilled = CircleAlert;

export const Plus = base(<path d="M12 5v14M5 12h14" />);

export const UserPlus = base(
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M18.5 8v5M21 10.5h-5" />
  </>
);

export const Key = base(
  <>
    <circle cx="8" cy="16" r="3.2" />
    <path d="M10.2 13.8 19 5l2 2-2 2 2 2-2 2-2-2" />
  </>
);

export const Copy = base(
  <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </>
);

export const Sparkles = base(
  <>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  </>
);

export const LayoutGrid = base(
  <>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </>
);
