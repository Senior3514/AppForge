"use client";
import { useEffect, useState } from "react";
import { t, type Locale } from "@appforge/i18n";
import { DOWNLOADS, RELEASES, detectOs, downloadUrl, type DetectedOs } from "../lib/downloads";
import { Icon } from "./art";

/** Primary button for the visitor's OS (detected in the browser), plus every platform below it. */
export function DownloadButtons({ locale, id }: { locale: Locale; id?: string }) {
  const [os, setOs] = useState<DetectedOs>("mac");
  useEffect(() => { setOs(detectOs(navigator.userAgent)); }, []);
  const main = DOWNLOADS.find((d) => d.os === os)!;
  return (
    <div id={id} className="scroll-mt-24">
      <a href={downloadUrl(main.file)} className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-lg" data-testid="download-main">
        <Icon name="bolt" size={20} />{t(locale, `dl.for.${os}` as never)}
      </a>
      <p className="mt-3 text-sm text-slate-600">
        {DOWNLOADS.filter((d) => d.os !== os).map((d, i) => (
          <span key={d.os}>{i > 0 && " · "}<a className="underline" href={downloadUrl(d.file)}>{t(locale, `dl.os.${d.os}` as never)}</a></span>
        ))}
        {" · "}<a className="underline" href={RELEASES}>{t(locale, "dl.allReleases")}</a>
      </p>
    </div>
  );
}

export function DownloadSection({ locale }: { locale: Locale }) {
  const points = ["dl.p1", "dl.p2", "dl.p3"] as const;
  return (
    <section aria-labelledby="download" className="py-16">
      <div className="glass rounded-[2rem] p-8 sm:p-12">
        <h2 id="download" className="text-3xl font-bold tracking-tight sm:text-4xl">{t(locale, "dl.title")}</h2>
        <p className="mt-3 max-w-2xl text-slate-600">{t(locale, "dl.body")}</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {points.map((k) => <li key={k} className="rounded-2xl bg-white/70 p-4 text-sm ring-1 ring-slate-200">{t(locale, k)}</li>)}
        </ul>
        <div className="mt-8"><DownloadButtons locale={locale} /></div>
        <p className="mt-6 max-w-2xl text-xs text-slate-500">{t(locale, "dl.unsigned")}</p>
      </div>
    </section>
  );
}
