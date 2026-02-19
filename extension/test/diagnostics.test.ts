import { describe, it, expect } from "vitest";
import {
  calculateRiskScore,
  riskLabel,
  patternDisplayName,
} from "../src/utils/diagnostics";
import type { RenderIssue } from "../src/types";

function makeIssue(severity: RenderIssue["severity"]): RenderIssue {
  return {
    message: "test",
    range: new (require("./vscode-shim.cjs").Range)(0, 0, 0, 0),
    pattern: "inlineObjects",
    severity,
  };
}

describe("calculateRiskScore", () => {
  it("returns 0 for no issues", () => {
    expect(calculateRiskScore([])).toBe(0);
  });

  it("scores high=3, medium=2, low=1", () => {
    expect(calculateRiskScore([makeIssue("high")])).toBe(3);
    expect(calculateRiskScore([makeIssue("medium")])).toBe(2);
    expect(calculateRiskScore([makeIssue("low")])).toBe(1);
  });

  it("sums multiple issues", () => {
    expect(
      calculateRiskScore([makeIssue("high"), makeIssue("medium"), makeIssue("low")])
    ).toBe(6);
  });
});

describe("riskLabel", () => {
  it("returns correct labels for score ranges", () => {
    expect(riskLabel(0)).toContain("No re-render risks");
    expect(riskLabel(1)).toContain("Low risk");
    expect(riskLabel(2)).toContain("Low risk");
    expect(riskLabel(3)).toContain("Medium risk");
    expect(riskLabel(5)).toContain("Medium risk");
    expect(riskLabel(6)).toContain("High risk");
    expect(riskLabel(10)).toContain("High risk");
  });
});

describe("patternDisplayName", () => {
  it("returns display name for all patterns", () => {
    expect(patternDisplayName("inlineObjects")).toBe("Inline Object/Array");
    expect(patternDisplayName("inlineFunctions")).toBe("Inline Function");
    expect(patternDisplayName("missingMemo")).toBe("Missing React.memo");
    expect(patternDisplayName("unstableKeys")).toBe("Unstable Key");
    expect(patternDisplayName("unstableDeps")).toBe("Unstable Dependencies");
    expect(patternDisplayName("broadContext")).toBe("Broad Context Consumer");
  });
});
