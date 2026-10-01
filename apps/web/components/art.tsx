import type { ReactNode } from "react";

/** Brand mark: a rounded tile with a spark, used in the header, favicon and footer. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4f46e5" /><stop offset=".55" stopColor="#7c3aed" /><stop offset="1" stopColor="#ec4899" /></linearGradient></defs>
      <rect width="32" height="32" rx="9" fill="url(#lg)" />
      <path d="M16 6l2.2 6.3L24.5 14l-6.3 2.2L16 22.5l-2.2-6.3L7.5 14l6.3-1.7L16 6z" fill="#fff" />
      <circle cx="24" cy="23" r="2" fill="#fff" opacity=".85" />
    </svg>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const icons: Record<string, ReactNode> = {
  hero: <><rect x="3" y="5" width="18" height="11" rx="2.5" {...stroke} /><path d="M7 10h6M7 13h9" {...stroke} /><rect x="3" y="18.5" width="7" height="2" rx="1" {...stroke} /></>,
  text: <><path d="M4 7h16M4 12h16M4 17h10" {...stroke} /></>,
  list: <><path d="M9 7h11M9 12h11M9 17h11" {...stroke} /><circle cx="4.5" cy="7" r="1.2" fill="currentColor" /><circle cx="4.5" cy="12" r="1.2" fill="currentColor" /><circle cx="4.5" cy="17" r="1.2" fill="currentColor" /></>,
  booking: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" {...stroke} /><path d="M3.5 10h17M8 3v4M16 3v4" {...stroke} /><path d="M9 15l2 2 4-4" {...stroke} /></>,
  catalog: <><path d="M5 8h14l-1.3 10.2a2 2 0 01-2 1.8H8.3a2 2 0 01-2-1.8L5 8z" {...stroke} /><path d="M9 8V6.5a3 3 0 016 0V8" {...stroke} /></>,
  loyalty: <><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19.5l1-5.8-4.2-4.1 5.8-.8L12 3.5z" {...stroke} /></>,
  contact: <><path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" {...stroke} /><circle cx="12" cy="10" r="2.5" {...stroke} /></>,
  radio: <><circle cx="12" cy="12" r="2" fill="currentColor" /><path d="M7.8 7.8a6 6 0 000 8.4M16.2 7.8a6 6 0 010 8.4M5 5a10 10 0 000 14M19 5a10 10 0 010 14" {...stroke} /></>,
  announcements: <><path d="M4 10v4l11 4V6L4 10z" {...stroke} /><path d="M7 14.5V19a1.5 1.5 0 003 0v-3" {...stroke} /><path d="M18 9a4 4 0 010 6" {...stroke} /></>,
  // generic UI icons
  users: <><circle cx="9" cy="8" r="3.2" {...stroke} /><path d="M3.5 19c.6-3.3 2.9-5 5.5-5s4.9 1.7 5.5 5" {...stroke} /><path d="M16 5.2a3 3 0 010 5.6M17.5 14.3c1.7.6 2.7 2.1 3 4.7" {...stroke} /></>,
  chart: <><path d="M4 20V5M4 20h16" {...stroke} /><path d="M8 16v-4M12 16V8M16 16v-6" {...stroke} /></>,
  cash: <><rect x="3" y="6.5" width="18" height="11" rx="2.5" {...stroke} /><circle cx="12" cy="12" r="2.6" {...stroke} /></>,
  repeat: <><path d="M4 12a8 8 0 0113.7-5.6L20 8.5M20 4v4.5h-4.5" {...stroke} /><path d="M20 12a8 8 0 01-13.7 5.6L4 15.5M4 20v-4.5h4.5" {...stroke} /></>,
  globe: <><circle cx="12" cy="12" r="9" {...stroke} /><path d="M3 12h18M12 3c2.6 2.6 4 5.6 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.6-4-9s1.4-6.4 4-9z" {...stroke} /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" {...stroke} /><path d="M10.5 18.5h3" {...stroke} /></>,
  bolt: <><path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z" {...stroke} /></>,
  shield: <><path d="M12 3l7.5 3v5.5c0 4.4-3 8-7.5 9.5-4.5-1.5-7.5-5.1-7.5-9.5V6L12 3z" {...stroke} /><path d="M9 12l2 2 4-4" {...stroke} /></>,
  check: <path d="M5 12.5l4.2 4.2L19 7" {...stroke} />,
};

export type IconName = keyof typeof icons;
export function Icon({ name, size = 22, className }: { name: string; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>{icons[name] ?? icons.text}</svg>;
}

/** Gradient tile with an icon, used for modules and features. */
export function IconTile({ name, size = 44 }: { name: string; size?: number }) {
  return <span className="icon-tile inline-flex shrink-0 items-center justify-center rounded-2xl" style={{ width: size, height: size }}><Icon name={name} size={size * 0.5} /></span>;
}

/** Illustrations for the three "how it works" steps. Decorative, so hidden from assistive tech. */
export function StepArt({ n }: { n: 1 | 2 | 3 }) {
  return (
    <svg viewBox="0 0 240 150" className="h-36 w-full" aria-hidden>
      <defs>
        <linearGradient id={`sa${n}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4f46e5" /><stop offset="1" stopColor="#ec4899" /></linearGradient>
        <linearGradient id={`sb${n}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eef2ff" /><stop offset="1" stopColor="#fdf2f8" /></linearGradient>
      </defs>
      <rect width="240" height="150" rx="18" fill={`url(#sb${n})`} />
      {n === 1 && (<>
        <rect x="28" y="28" width="132" height="44" rx="14" fill="#fff" stroke="#c7d2fe" />
        <rect x="42" y="42" width="70" height="7" rx="3.5" fill="#c7d2fe" /><rect x="42" y="56" width="98" height="7" rx="3.5" fill="#e2e8f0" />
        <rect x="84" y="84" width="128" height="40" rx="14" fill={`url(#sa${n})`} />
        <rect x="98" y="97" width="80" height="7" rx="3.5" fill="#fff" opacity=".9" /><rect x="98" y="109" width="52" height="7" rx="3.5" fill="#fff" opacity=".6" />
        <path d="M196 30l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z" fill="#f59e0b" />
      </>)}
      {n === 2 && (<>
        <rect x="82" y="14" width="76" height="124" rx="16" fill="#0f172a" />
        <rect x="88" y="22" width="64" height="108" rx="11" fill="#fff" />
        <rect x="88" y="22" width="64" height="26" rx="11" fill={`url(#sa${n})`} />
        <rect x="96" y="58" width="48" height="14" rx="6" fill="#eef2ff" /><rect x="96" y="78" width="48" height="14" rx="6" fill="#eef2ff" /><rect x="96" y="98" width="30" height="14" rx="6" fill="#fce7f3" />
        <circle cx="46" cy="52" r="4" fill="#a5b4fc" /><circle cx="196" cy="92" r="5" fill="#f9a8d4" /><circle cx="204" cy="40" r="3" fill="#a5b4fc" />
      </>)}
      {n === 3 && (<>
        <path d="M120 22c18 10 28 32 24 62l-14 8-8 18-10-14-14-6c-4-30 4-52 22-68z" fill="#fff" stroke="#c7d2fe" strokeWidth="2" />
        <circle cx="120" cy="62" r="9" fill={`url(#sa${n})`} />
        <path d="M110 108c0 12-6 20-6 20s10-2 16-12M130 108c0 12 6 20 6 20s-10-2-16-12" fill="#f59e0b" opacity=".85" />
        <circle cx="52" cy="40" r="3" fill="#a5b4fc" /><circle cx="196" cy="48" r="4" fill="#f9a8d4" /><circle cx="182" cy="106" r="3" fill="#a5b4fc" />
        <rect x="30" y="100" width="42" height="26" rx="8" fill="#fff" stroke="#c7d2fe" /><rect x="168" y="30" width="44" height="26" rx="8" fill="#fff" stroke="#fbcfe8" />
      </>)}
    </svg>
  );
}
