/** Design tokens shared by web and runtime. Pure data + colour math, no platform imports. */

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;
export const fontSize = { caption: 12, body: 16, title: 20, headline: 28, display: 40 } as const;

/** Font stacks per script. Hebrew, Arabic/Persian, CJK and Devanagari need explicit families to render well. */
export const fontFamily = {
  latin: "Inter, system-ui, sans-serif",
  hebrew: "Heebo, 'Noto Sans Hebrew', system-ui, sans-serif",
  arabic: "'Noto Sans Arabic', Vazirmatn, system-ui, sans-serif",
  cyrillic: "Inter, system-ui, sans-serif",
  japanese: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', system-ui, sans-serif",
  korean: "'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif",
  chinese: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
  devanagari: "'Noto Sans Devanagari', 'Nirmala UI', system-ui, sans-serif",
} as const;

const SCRIPT_OF: Record<string, keyof typeof fontFamily> = {
  he: "hebrew", ar: "arabic", fa: "arabic", ru: "cyrillic", uk: "cyrillic",
  ja: "japanese", ko: "korean", zh: "chinese", hi: "devanagari",
};
export const scriptOf = (locale: string): keyof typeof fontFamily => SCRIPT_OF[locale] ?? "latin";

const hex = /^#[0-9a-fA-F]{6}$/;
const toRgb = (c: string): [number, number, number] => {
  if (!hex.test(c)) throw new Error(`invalid hex colour: ${c}`);
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
};
const toHex = (rgb: number[]) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

export function luminance(c: string): number {
  const [r, g, b] = toRgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const mix = (a: string, b: string, t: number) => toHex(toRgb(a).map((v, i) => v + (toRgb(b)[i]! - v) * t));

export interface Palette {
  primary: string; onPrimary: string; background: string; surface: string; text: string; mutedText: string; border: string;
}

/** Builds a light or dark palette from one brand colour, guaranteeing WCAG AA (4.5:1) for text pairs. */
export function paletteFromPrimary(primary: string, mode: "light" | "dark" = "light"): Palette {
  const bg = mode === "light" ? "#ffffff" : "#0f1115";
  const text = mode === "light" ? "#14161a" : "#f3f4f6";
  const onPrimary = contrast(primary, "#ffffff") >= contrast(primary, "#000000") ? "#ffffff" : "#000000";
  return {
    primary, onPrimary, background: bg,
    surface: mix(bg, primary, 0.06), text,
    mutedText: mix(text, bg, 0.35), border: mix(bg, text, 0.14),
  };
}
