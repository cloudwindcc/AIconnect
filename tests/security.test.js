import { describe, expect, it } from "vitest";
import { escapeAttr, escapeHtml, safeText } from "../src/security/html.js";

describe("HTML safety", () => {
  it("escapes imported HTML before rendering", () => {
    expect(escapeHtml(`<img src=x onerror=alert(1)>`)).toBe("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("escapes attributes", () => {
    expect(escapeAttr(`" onclick="bad"`)).toContain("&quot;");
  });

  it("returns fallback for empty text", () => {
    expect(safeText(" ", "fallback")).toBe("fallback");
  });
});
