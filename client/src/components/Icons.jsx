// client/src/components/Icons.jsx
// Inline SVG icons — all 16×16 viewBox, currentColor, strokeWidth 1.5

export const IconSettings = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="8" cy="8" r="2.5" />
    <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
  </svg>
);

export const IconLogout = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M6 2.5H3a1 1 0 00-1 1v9a1 1 0 001 1h3" />
    <path d="M10.5 11l3-3-3-3" />
    <path d="M13.5 8H6" />
  </svg>
);

export const IconSend = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M14 2L7 9" />
    <path d="M14 2L9.5 14 7 9 2 6.5 14 2z" />
  </svg>
);

export const IconMore = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
    <circle cx="8" cy="3.5" r="1.2" />
    <circle cx="8" cy="8" r="1.2" />
    <circle cx="8" cy="12.5" r="1.2" />
  </svg>
);

export const IconLock = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <rect x="3" y="7" width="10" height="8" rx="1.5" />
    <path d="M5.5 7V5.5a2.5 2.5 0 015 0V7" />
  </svg>
);

export const IconAlert = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M8 1.5L14.5 13H1.5L8 1.5z" />
    <path d="M8 6v3" />
    <circle cx="8" cy="11" r=".5" fill="currentColor" stroke="none" />
  </svg>
);

export const IconClose = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="M12 4L4 12M4 4l8 8" />
  </svg>
);

export const IconBack = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M10 3L5 8l5 5" />
  </svg>
);

export const IconSearch = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
);

export const IconEye = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);

export const IconEyeOff = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M2 2l12 12" />
    <path d="M6.7 6.7A2 2 0 0 0 8 10a2 2 0 0 0 1.3-3.3" />
    <path d="M9.9 9.9C9.3 10.3 8.7 10.5 8 10.5c-4.5 0-7-5-7-5a12.5 12.5 0 0 1 2.9-3.3M3.6 3.6A12.5 12.5 0 0 0 1 8s2.5 5 7 5a7 7 0 0 0 2-.3" />
    <path d="M6 3.5A7 7 0 0 1 8 3c4.5 0 7 5 7 5a12.5 12.5 0 0 1-1.6 2.3" />
  </svg>
);

export const IconGroup = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const IconCrown = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M2.5 19h19v2h-19zM22.5 7l-5 5-5-7-5 7-5-5 2.5 12h15z" />
  </svg>
);

export const IconPlus = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const IconLeave = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const IconTrash = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

export const IconAttach = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M13.5 7.5l-5.8 5.8a3.2 3.2 0 01-4.5-4.5L9.5 2.5a2.1 2.1 0 013 3L6.2 11.8a1.1 1.1 0 01-1.5-1.5L10.5 4.5" />
  </svg>
);

export const IconDownload = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M8 2v8.5M4.5 7.5L8 11l3.5-3.5" />
    <path d="M2.5 12.5v1a1 1 0 001 1h9a1 1 0 001-1v-1" />
  </svg>
);

export const IconFile = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M9 1.5H4a1.5 1.5 0 00-1.5 1.5v10A1.5 1.5 0 004 14.5h8a1.5 1.5 0 001.5-1.5V6L9 1.5z" />
    <path d="M9 1.5V6h4.5" />
  </svg>
);

export const IconCheck = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M3 8.5l3.5 3.5L13 4" />
  </svg>
);

export const IconCheckDouble = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M1.5 8.5l3.5 3.5L11.5 5" />
    <path d="M5.5 8.5l3.5 3.5L15.5 5" />
  </svg>
);

export const IconClock = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 1.5" />
  </svg>
);

export const IconRetry = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M2 8a6 6 0 0111.5-2.5M14 2v3.5h-3.5" />
    <path d="M14 8a6 6 0 01-11.5 2.5M2 14v-3.5h3.5" />
  </svg>
);

export const IconEmoji = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M5.5 6.5v.5M10.5 6.5v.5" />
    <path d="M5.5 9.5a3.5 3.5 0 005 0" />
  </svg>
);

export const IconCopy = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1" />
    <path d="M10.5 5.5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v6.5a1 1 0 001 1h2.5" />
  </svg>
);

export const IconStar = ({ size = 16, filled = false, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M8 1.5l2 4 4.5.7-3.3 3.1.8 4.5L8 11.5l-4 2.3.8-4.5L1.5 6.2l4.5-.7z" />
  </svg>
);
