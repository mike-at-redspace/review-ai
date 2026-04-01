import { describe, it, expect } from "vitest";
import { truncateReadFileResult } from "./readFileResultTruncate.js";

const makeLine = (n: number) => `line ${n}`;
const makeLines = (count: number, start = 1) =>
  Array.from({ length: count }, (_, i) => makeLine(start + i)).join("\n");

describe("truncateReadFileResult", () => {
  it("passes through files under maxLines unchanged", () => {
    const text = makeLines(10);
    const result = truncateReadFileResult(text, { file_path: "/a.ts" }, 500);
    expect(result.truncated).toBe(false);
    expect(result.text).toBe(text);
  });

  it("passes through files exactly at maxLines", () => {
    const text = makeLines(5);
    const result = truncateReadFileResult(text, { file_path: "/a.ts" }, 5);
    expect(result.truncated).toBe(false);
    expect(result.text).toBe(text);
  });

  it("truncates files over maxLines and appends pagination hint", () => {
    const text = makeLines(20);
    const result = truncateReadFileResult(text, { file_path: "/a.ts" }, 10);

    expect(result.truncated).toBe(true);
    expect(result.text).toContain("line 1");
    expect(result.text).toContain("line 10");
    expect(result.text).not.toContain("line 11");
    expect(result.text).toContain("[TRUNCATED");
    expect(result.text).toContain('"offset": 11');
    expect(result.text).toContain('"limit": 10');
    expect(result.text).toContain("/a.ts");
  });

  it("respects offset in args for correct line numbering", () => {
    const text = makeLines(20, 50); // lines 50-69
    const result = truncateReadFileResult(
      text,
      { file_path: "/b.ts", offset: 50 },
      10
    );

    expect(result.truncated).toBe(true);
    expect(result.text).toContain("lines 50–59");
    expect(result.text).toContain('"offset": 60');
  });

  it("handles missing file_path gracefully", () => {
    const text = makeLines(20);
    const result = truncateReadFileResult(text, {}, 10);

    expect(result.truncated).toBe(true);
    expect(result.text).toContain('"file_path": "..."');
  });

  it("handles null/undefined args", () => {
    const text = makeLines(20);
    const result = truncateReadFileResult(text, undefined, 10);

    expect(result.truncated).toBe(true);
    expect(result.text).toContain("[TRUNCATED");
  });
});
