import { describe, it, expect } from "vitest";
import { detectIssues } from "./helpers";
import { unstableDepsDetector } from "../src/patterns/unstableDeps";

describe("unstableDeps detector", () => {
  it("flags useMemo without dependency array", () => {
    const code = `const A = () => { const v = useMemo(() => 1); return <div>{v}</div>; };`;
    const issues = detectIssues(unstableDepsDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("missing");
  });

  it("flags useCallback without dependency array", () => {
    const code = `const A = () => { const fn = useCallback(() => {}); return <div onClick={fn} />; };`;
    const issues = detectIssues(unstableDepsDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("missing");
  });

  it("flags object literal in dependency array", () => {
    const code = `const A = () => { const v = useMemo(() => 1, [{ a: 1 }]); return <div>{v}</div>; };`;
    const issues = detectIssues(unstableDepsDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("object literal");
  });

  it("flags array literal in dependency array", () => {
    const code = `const A = () => { const v = useMemo(() => 1, [[1, 2]]); return <div>{v}</div>; };`;
    const issues = detectIssues(unstableDepsDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("array literal");
  });

  it("flags function in dependency array", () => {
    const code = `const A = () => { const v = useMemo(() => 1, [() => {}]); return <div>{v}</div>; };`;
    const issues = detectIssues(unstableDepsDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("function");
  });

  it("flags template literal with expressions in deps", () => {
    const code = "const A = () => { const v = useMemo(() => 1, [`${x}`]); return <div>{v}</div>; };";
    const issues = detectIssues(unstableDepsDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("template literal");
  });

  it("ignores useMemo with proper deps", () => {
    const code = `const A = () => { const v = useMemo(() => a + b, [a, b]); return <div>{v}</div>; };`;
    const issues = detectIssues(unstableDepsDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("ignores useEffect without deps (intentional run-every-render)", () => {
    const code = `const A = () => { useEffect(() => {}); return <div />; };`;
    const issues = detectIssues(unstableDepsDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("handles React.useMemo syntax", () => {
    const code = `const A = () => { const v = React.useMemo(() => 1); return <div>{v}</div>; };`;
    const issues = detectIssues(unstableDepsDetector, code);
    expect(issues).toHaveLength(1);
  });

  it("flags multiple unstable deps in one array", () => {
    const code = `const A = () => { const v = useMemo(() => 1, [{ a: 1 }, [1]]); return <div>{v}</div>; };`;
    const issues = detectIssues(unstableDepsDetector, code);
    expect(issues).toHaveLength(2);
  });

  it("provides a fix to add dependency array for missing deps", () => {
    const code = `const A = () => { const v = useMemo(() => 1); return <div>{v}</div>; };`;
    const issues = detectIssues(unstableDepsDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].fix).toBeDefined();
    expect(issues[0].fix!.title).toContain("Add dependency array");
    expect(issues[0].fix!.replacement).toContain("[/* deps */]");
  });
});
