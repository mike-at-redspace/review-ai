import { describe, expect, it } from "vitest";
import { parseReviewResponse } from "./parser.js";

describe("parseReviewResponse", () => {
  it("parses a standard issue block", () => {
    const raw = `### [warning] smell: Example
**File:** \`src/a.ts\`
**Description:** Line too long
**Suggestion:** Wrap it`;

    const issues = parseReviewResponse(raw);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      id: 1,
      severity: "warning",
      category: "smell",
      title: "Example",
      file: "src/a.ts",
      description: "Line too long",
      suggestion: "Wrap it",
      ignored: false,
    });
  });
});
