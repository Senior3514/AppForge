import type { AppSpec } from "@appforge/modules";
import { paletteFromPrimary, scriptOf } from "@appforge/ui-tokens";

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const FONT = "DejaVu Sans, Noto Sans, Noto Sans Hebrew, Noto Sans Arabic, sans-serif";

/** One or two letters: first letters of the first two words (so "Glow Studio" → "GS", "סטודיו גלואו" → "סג"). */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0]!.toLocaleUpperCase());
  return letters.join("") || "A";
}

const darken = (hex: string, t: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, "0")).join("");

export type BrandAsset = "icon-1024" | "icon-512" | "adaptive-foreground" | "adaptive-background" | "splash" | "favicon";
export const BRAND_ASSETS: Record<BrandAsset, { width: number; height: number; transparent?: boolean; note: string }> = {
  "icon-1024": { width: 1024, height: 1024, note: "App Store icon (no transparency, square; iOS rounds the corners)" },
  "icon-512": { width: 512, height: 512, note: "Google Play icon" },
  "adaptive-foreground": { width: 1024, height: 1024, transparent: true, note: "Android adaptive icon foreground (artwork kept inside the central safe zone)" },
  "adaptive-background": { width: 1024, height: 1024, note: "Android adaptive icon background" },
  splash: { width: 1284, height: 2778, note: "Splash screen" },
  favicon: { width: 48, height: 48, note: "Web favicon" },
};

export function assetSvg(spec: AppSpec, asset: BrandAsset): string {
  const { width: w, height: h } = BRAND_ASSETS[asset];
  const { primary, onPrimary } = paletteFromPrimary(spec.theme.primary);
  const grad = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="${darken(primary, 0.3)}"/></linearGradient></defs>`;
  const letters = esc(monogram(spec.name));
  const big = letters.length > 1 ? 0.36 : 0.5;
  const mono = (size: number, cx: number, cy: number) =>
    `<text x="${cx}" y="${cy}" font-family="${FONT}" font-weight="700" font-size="${size}" fill="${onPrimary}" text-anchor="middle" dominant-baseline="central">${letters}</text>`;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  switch (asset) {
    case "adaptive-foreground": // Android masks to ~66% of the canvas, so keep artwork inside it.
      return `${open}${mono(w * big * 0.66, w / 2, h / 2)}</svg>`;
    case "splash":
      return `${open}${grad}<rect width="${w}" height="${h}" fill="url(#g)"/>${mono(w * 0.3, w / 2, h / 2 - 60)}<text x="${w / 2}" y="${h / 2 + w * 0.22}" font-family="${FONT}" font-size="${w * 0.06}" fill="${onPrimary}" text-anchor="middle">${esc(spec.name)}</text></svg>`;
    default:
      return `${open}${grad}<rect width="${w}" height="${h}" fill="${asset === "adaptive-background" ? primary : "url(#g)"}"/>${asset === "adaptive-background" ? "" : mono(w * big, w / 2, h / 2)}</svg>`;
  }
}

const SUFFIXES: Record<"en" | "he", string[]> = { en: ["App", "Hub", "Club", "Go"], he: ["אפליקציה", "האב", "קלאב", "גו"] };
export function nameSuggestions(spec: AppSpec): string[] {
  const base = spec.name.replace(/\s+(app|hub|club|go)$/i, "").trim();
  const suf = SUFFIXES[spec.locale === "he" ? "he" : "en"];
  return [...new Set([spec.name, ...suf.map((s) => `${base} ${s}`), spec.locale === "he" ? `${base} שלי` : `My ${base}`])].filter((n) => n.length <= 30).slice(0, 5);
}

const PAIRS = { modern: ["Inter", "Inter"], classic: ["Lora", "Inter"], rounded: ["Nunito", "Nunito"] } as const;
export function typography(spec: AppSpec) {
  const script = scriptOf(spec.locale);
  if (script === "hebrew") return { heading: "Heebo", body: "Heebo", note: "Heebo covers Hebrew and Latin with matching weights." };
  if (script === "arabic") return { heading: "Noto Sans Arabic", body: "Noto Sans Arabic", note: "Noto Sans Arabic covers Arabic and Latin." };
  const [heading, body] = PAIRS[spec.theme.font];
  return { heading, body, note: "Open-licensed Google Fonts (SIL OFL)." };
}

export function brandingKit(spec: AppSpec) {
  return {
    names: nameSuggestions(spec),
    palette: { light: paletteFromPrimary(spec.theme.primary, "light"), dark: paletteFromPrimary(spec.theme.primary, "dark") },
    typography: typography(spec),
    monogram: monogram(spec.name),
    assets: Object.entries(BRAND_ASSETS).map(([id, a]) => ({ id, width: a.width, height: a.height, note: a.note })),
  };
}
