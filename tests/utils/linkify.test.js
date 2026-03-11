import { describe, it, expect } from "vitest";
import { parseLinks } from "../../client/src/utils/linkify.js";

describe("parseLinks", () => {
  it("returns plain text unchanged", () => {
    const result = parseLinks("hello world");
    expect(result).toEqual([{ type: "text", value: "hello world" }]);
  });

  it("detects https URLs", () => {
    const result = parseLinks("check https://example.com ok");
    expect(result).toEqual([
      { type: "text", value: "check " },
      { type: "link", value: "https://example.com", href: "https://example.com" },
      { type: "text", value: " ok" },
    ]);
  });

  it("detects http URLs", () => {
    const result = parseLinks("go to http://test.org/path?q=1 now");
    expect(result[1]).toEqual({
      type: "link",
      value: "http://test.org/path?q=1",
      href: "http://test.org/path?q=1",
    });
  });

  it("detects www URLs and prefixes https", () => {
    const result = parseLinks("visit www.example.com today");
    expect(result[1]).toEqual({
      type: "link",
      value: "www.example.com",
      href: "https://www.example.com",
    });
  });

  it("strips trailing punctuation", () => {
    const result = parseLinks("see https://example.com.");
    expect(result[1].value).toBe("https://example.com");
    expect(result[2]).toEqual({ type: "text", value: "." });
  });

  it("strips trailing comma", () => {
    const result = parseLinks("https://a.com, https://b.com");
    expect(result[0]).toEqual({ type: "link", value: "https://a.com", href: "https://a.com" });
  });

  it("strips trailing paren when no opener in URL", () => {
    const result = parseLinks("(see https://example.com)");
    expect(result[1]).toEqual({
      type: "link",
      value: "https://example.com",
      href: "https://example.com",
    });
  });

  it("keeps parens that are part of the URL", () => {
    const result = parseLinks("https://en.wikipedia.org/wiki/Thing_(test)");
    expect(result[0].value).toBe("https://en.wikipedia.org/wiki/Thing_(test)");
  });

  it("blocks javascript: scheme", () => {
    const result = parseLinks("javascript:alert(1)");
    expect(result).toEqual([{ type: "text", value: "javascript:alert(1)" }]);
  });

  it("blocks data: scheme", () => {
    const result = parseLinks("data:text/html,<h1>hi</h1>");
    expect(result).toEqual([{ type: "text", value: "data:text/html,<h1>hi</h1>" }]);
  });

  it("handles multiple URLs in one string", () => {
    const result = parseLinks("a https://x.com b https://y.com c");
    const links = result.filter((r) => r.type === "link");
    expect(links.length).toBe(2);
    expect(links[0].href).toBe("https://x.com");
    expect(links[1].href).toBe("https://y.com");
  });

  it("handles empty string", () => {
    expect(parseLinks("")).toEqual([{ type: "text", value: "" }]);
  });
});
