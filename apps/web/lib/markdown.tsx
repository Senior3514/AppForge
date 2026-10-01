import type { ReactNode } from "react";

/** Renders the small Markdown subset our generated documents use (#, ##, -, **bold**, paragraphs) as React nodes. No HTML is injected. */
export function renderMarkdown(md: string): ReactNode[] {
  const inline = (s: string): ReactNode[] => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) out.push(<ul key={`u${out.length}`} className="my-3 list-disc space-y-1 ps-6">{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; };
  for (const line of md.split("\n")) {
    if (line.startsWith("- ")) { list.push(line.slice(2)); continue; }
    flush();
    if (line.startsWith("## ")) out.push(<h2 key={out.length} className="mt-6 text-xl font-semibold">{inline(line.slice(3))}</h2>);
    else if (line.startsWith("# ")) out.push(<h1 key={out.length} className="text-3xl font-bold">{inline(line.slice(2))}</h1>);
    else if (line.trim()) out.push(<p key={out.length} className="my-3">{inline(line)}</p>);
  }
  flush();
  return out;
}
