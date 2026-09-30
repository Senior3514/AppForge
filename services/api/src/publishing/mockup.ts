import type { AppSpec, Block } from "@appforge/modules";
import { dirOf } from "@appforge/i18n";
import { tr } from "@appforge/spec";
import { paletteFromPrimary } from "@appforge/ui-tokens";
import { esc } from "./branding";

const FONT = "DejaVu Sans, Noto Sans, Noto Sans Hebrew, Noto Sans Arabic, sans-serif";
const W = 390;

export const STORE_SCREENSHOT_SIZES = {
  ios: { width: 1290, height: 2796, note: "App Store 6.7-inch" },
  android: { width: 1080, height: 1920, note: "Google Play phone" },
} as const;

/** Simplified drawing of a screen from its spec. These are generated mock-ups, not captures from a running device. */
export function screenshotSvg(spec: AppSpec, screenId: string, size: { width: number; height: number }, dark = false): string {
  const screen = spec.screens.find((s) => s.id === screenId) ?? spec.screens[0]!;
  const H = Math.round((W * size.height) / size.width);
  const p = paletteFromPrimary(spec.theme.primary, dark ? "dark" : "light");
  const rtl = dirOf(spec.locale) === "rtl";
  const T = (s: string) => esc(tr(spec, spec.locale, s));
  const x0 = rtl ? W - 16 : 16;
  const anchor = rtl ? "end" : "start";
  const text = (x: number, y: number, s: string, o: { size?: number; weight?: number; fill?: string; anchor?: string } = {}) =>
    `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${o.size ?? 14}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? p.text}" text-anchor="${o.anchor ?? anchor}">${s}</text>`;
  const card = (y: number, h: number) => `<rect x="12" y="${y}" width="${W - 24}" height="${h}" rx="${spec.theme.radius}" fill="${p.surface}" stroke="${p.border}"/>`;

  let y = 92; // below the header
  const out: string[] = [];
  const rows = (id: string) => spec.dataModels.find((m) => m.id === id)?.seed.slice(0, 5) ?? [];

  const draw = (b: Block) => {
    switch (b.module) {
      case "hero": {
        out.push(`<rect x="12" y="${y}" width="${W - 24}" height="150" rx="${spec.theme.radius}" fill="${p.primary}"/>`,
          text(x0 + (rtl ? -8 : 8), y + 58, T(b.props.headline), { size: 26, weight: 700, fill: p.onPrimary }),
          text(x0 + (rtl ? -8 : 8), y + 86, T(b.props.subtitle), { size: 13, fill: p.onPrimary }));
        y += 166; break;
      }
      case "text": out.push(text(x0, y + 18, T(b.props.body.slice(0, 48)))); y += 34; break;
      case "list": case "announcements": case "catalog": {
        const props = b.props as { collection: string; titleField?: string; subtitleField?: string | null };
        const tf = props.titleField ?? "name";
        for (const r of rows(props.collection)) {
          out.push(card(y, 54), text(x0 + (rtl ? -10 : 10), y + 24, T(String(r[tf] ?? "")), { weight: 600 }));
          const sub = props.subtitleField ? r[props.subtitleField] : r.price;
          if (sub !== undefined) out.push(text(x0 + (rtl ? -10 : 10), y + 42, esc(String(sub)), { size: 12, fill: p.mutedText }));
          y += 62;
        }
        break;
      }
      case "loyalty": {
        out.push(card(y, 110));
        const n = Math.min(b.props.goal, 10);
        for (let i = 0; i < n; i++) out.push(`<circle cx="${(rtl ? W - 36 - i * 32 : 36 + i * 32)}" cy="${y + 34}" r="12" fill="${i < 4 ? p.primary : "none"}" stroke="${p.primary}" stroke-width="2"/>`);
        out.push(text(x0 + (rtl ? -10 : 10), y + 86, T(b.props.reward), { weight: 600 })); y += 122; break;
      }
      case "booking": {
        out.push(card(y, 150), `<rect x="28" y="${y + 16}" width="${W - 56}" height="36" rx="8" fill="${p.background}" stroke="${p.border}"/>`,
          `<rect x="28" y="${y + 62}" width="${W - 56}" height="36" rx="8" fill="${p.background}" stroke="${p.border}"/>`,
          `<rect x="28" y="${y + 108}" width="120" height="32" rx="${spec.theme.radius}" fill="${p.primary}"/>`,
          text(88, y + 129, T(b.props.submitLabel), { size: 12, weight: 600, fill: p.onPrimary, anchor: "middle" })); y += 164; break;
      }
      case "contact": out.push(card(y, 70), text(x0 + (rtl ? -10 : 10), y + 28, T(b.props.address || "—")), text(x0 + (rtl ? -10 : 10), y + 52, T(b.props.phone || b.props.hours || ""), { fill: p.mutedText })); y += 82; break;
      case "radio": out.push(card(y, 80), text(x0 + (rtl ? -10 : 10), y + 32, T(b.props.station), { weight: 600 }), `<circle cx="${rtl ? 50 : W - 50}" cy="${y + 40}" r="18" fill="${p.primary}"/>`); y += 92; break;
    }
  };
  for (const b of screen.blocks) if (y < H - 120) draw(b);

  const nav = spec.navigation.map((id) => spec.screens.find((s) => s.id === id)!);
  const slot = W / nav.length;
  const order = rtl ? [...nav].reverse() : nav;
  const tabs = order.map((s, i) => text(slot * i + slot / 2, H - 28, T(s.title), { size: 11, weight: 500, fill: s.id === screen.id ? p.primary : p.mutedText, anchor: "middle" })).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<rect width="${W}" height="${H}" fill="${p.background}"/>
<rect width="${W}" height="72" fill="${p.primary}"/>
${text(x0, 52, T(spec.name), { size: 19, weight: 700, fill: p.onPrimary })}
${out.join("\n")}
<rect y="${H - 58}" width="${W}" height="58" fill="${p.surface}"/><line x1="0" x2="${W}" y1="${H - 58}" y2="${H - 58}" stroke="${p.border}"/>
${tabs}</svg>`;
}
