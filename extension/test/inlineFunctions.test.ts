import { describe, it, expect } from "vitest";
import { detectIssues } from "./helpers";
import { inlineFunctionsDetector } from "../src/patterns/inlineFunctions";

describe("inlineFunctions detector", () => {
  it("flags inline arrow function as prop", () => {
    const issues = detectIssues(
      inlineFunctionsDetector,
      `const A = () => <button onClick={() => console.log("x")}>go</button>;`
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].pattern).toBe("inlineFunctions");
  });

  it("flags inline function expression as prop", () => {
    const issues = detectIssues(
      inlineFunctionsDetector,
      `const A = () => <button onClick={function() { return 1; }}>go</button>;`
    );
    expect(issues).toHaveLength(1);
  });

  it("ignores named function references", () => {
    const issues = detectIssues(
      inlineFunctionsDetector,
      `const A = () => { const fn = () => {}; return <button onClick={fn} />; };`
    );
    expect(issues).toHaveLength(0);
  });

  it("ignores string and number props", () => {
    const issues = detectIssues(
      inlineFunctionsDetector,
      `const A = () => <div className="x" tabIndex={0} />;`
    );
    expect(issues).toHaveLength(0);
  });

  it("provides a quick fix with useCallback", () => {
    const issues = detectIssues(
      inlineFunctionsDetector,
      `const A = () => <button onClick={() => {}}>go</button>;`
    );
    expect(issues[0].fix).toBeDefined();
    expect(issues[0].fix!.replacement).toContain("useCallback");
  });

  it("flags multiple inline functions", () => {
    const code = `const A = () => (
      <div onClick={() => {}} onMouseEnter={() => {}} />
    );`;
    const issues = detectIssues(inlineFunctionsDetector, code);
    expect(issues).toHaveLength(2);
  });
});
