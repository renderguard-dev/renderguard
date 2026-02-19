import { describe, it, expect } from "vitest";
import { detectIssues } from "./helpers";
import { inlineObjectsDetector } from "../src/patterns/inlineObjects";

describe("inlineObjects detector", () => {
  it("flags inline object literal as prop", () => {
    const issues = detectIssues(
      inlineObjectsDetector,
      `const A = () => <div style={{ color: "red" }} />;`
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].pattern).toBe("inlineObjects");
    expect(issues[0].message).toContain("object");
  });

  it("flags inline array literal as prop", () => {
    const issues = detectIssues(
      inlineObjectsDetector,
      `const A = () => <List items={[1, 2, 3]} />;`
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("array");
  });

  it("ignores key prop", () => {
    const issues = detectIssues(
      inlineObjectsDetector,
      `const A = () => <Item key={{ id: 1 }} />;`
    );
    expect(issues).toHaveLength(0);
  });

  it("ignores Provider value prop (handled by broadContext)", () => {
    const issues = detectIssues(
      inlineObjectsDetector,
      `const A = () => <Ctx.Provider value={{ user: "x" }}><div /></Ctx.Provider>;`
    );
    expect(issues).toHaveLength(0);
  });

  it("ignores variable references as props", () => {
    const issues = detectIssues(
      inlineObjectsDetector,
      `const A = () => { const s = {}; return <div style={s} />; };`
    );
    expect(issues).toHaveLength(0);
  });

  it("flags multiple inline objects in same component", () => {
    const code = `const A = () => (
      <div style={{ color: "red" }} data-config={{ x: 1 }} />
    );`;
    const issues = detectIssues(inlineObjectsDetector, code);
    expect(issues).toHaveLength(2);
  });

  it("provides a quick fix suggestion", () => {
    const issues = detectIssues(
      inlineObjectsDetector,
      `const A = () => <div style={{ color: "red" }} />;`
    );
    expect(issues[0].fix).toBeDefined();
    expect(issues[0].fix!.title).toContain("useMemo");
  });
});
