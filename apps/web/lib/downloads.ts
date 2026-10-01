/** Installer files are published by .github/workflows/release.yml with these fixed names, so "latest" links never go stale. */
export const RELEASES = "https://github.com/Senior3514/AppForge/releases/latest";
export const DOWNLOADS = [
  { os: "mac", file: "AppForge-mac-arm64.dmg" }, // Apple Silicon: a browser cannot tell it apart from Intel, so Intel gets its own link
  { os: "macIntel", file: "AppForge-mac-x64.dmg" },
  { os: "win", file: "AppForge-win.exe" },
  { os: "linux", file: "AppForge-linux.AppImage" },
] as const;
export type Os = (typeof DOWNLOADS)[number]["os"];
export type DetectedOs = "mac" | "win" | "linux";
export const downloadUrl = (file: string) => `${RELEASES}/download/${file}`;

export function detectOs(userAgent: string): DetectedOs {
  if (/Windows/i.test(userAgent)) return "win";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "mac";
  return "linux";
}
