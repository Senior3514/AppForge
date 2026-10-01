import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

const html = (md: string) => renderToStaticMarkup(<div>{renderMarkdown(md)}</div>);

describe("renderMarkdown", () => {
  it("renders headings, lists, bold and paragraphs", () => {
    const out = html("# Title\n\nIntro **bold** text\n\n## Sec\n- one\n- two\n\nEnd");
    expect(out).toContain("<h1");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<h2");
    expect(out.match(/<li/g)).toHaveLength(2);
    expect(out).toContain("End");
  });
  it("never injects raw HTML", () => {
    const out = html("<script>alert(1)</script>\n- <img src=x onerror=alert(1)>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
  });
});
