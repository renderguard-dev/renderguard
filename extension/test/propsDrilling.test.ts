import { describe, it, expect } from "vitest";
import { detectIssues } from "./helpers";
import { propsDrillingDetector } from "../src/patterns/propsDrilling";

describe("propsDrilling detector", () => {
  it("flags prop passed straight to child without own use", () => {
    const code = `const Layout = ({ theme }: any) => (
      <Sidebar theme={theme} />
    );`;
    const issues = detectIssues(propsDrillingDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("theme");
    expect(issues[0].message).toContain("passed through");
  });

  it("flags multiple drilled props", () => {
    const code = `const Layout = ({ theme, locale }: any) => (
      <Sidebar theme={theme} locale={locale} />
    );`;
    const issues = detectIssues(propsDrillingDetector, code);
    expect(issues).toHaveLength(2);
  });

  it("does not flag prop used in own logic", () => {
    const code = `const Layout = ({ theme }: any) => (
      <div className={theme}><Sidebar /></div>
    );`;
    const issues = detectIssues(propsDrillingDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("does not flag prop used in both own logic and passed to child", () => {
    const code = `const Layout = ({ theme }: any) => (
      <div className={theme}><Sidebar theme={theme} /></div>
    );`;
    const issues = detectIssues(propsDrillingDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("skips children prop", () => {
    const code = `const Layout = ({ children }: any) => (
      <div>{children}</div>
    );`;
    const issues = detectIssues(propsDrillingDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("skips className prop", () => {
    const code = `const Layout = ({ className }: any) => (
      <div className={className} />
    );`;
    const issues = detectIssues(propsDrillingDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("does not flag components without props", () => {
    const code = `const Layout = () => <div />;`;
    const issues = detectIssues(propsDrillingDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("works with function declaration components", () => {
    const code = `function Layout({ theme }: any) {
      return <Sidebar theme={theme} />;
    }`;
    const issues = detectIssues(propsDrillingDetector, code);
    expect(issues).toHaveLength(1);
  });

  it("does not flag prop used in a hook", () => {
    const code = `const Layout = ({ userId }: any) => {
      useEffect(() => { fetch(userId); }, [userId]);
      return <Child userId={userId} />;
    };`;
    const issues = detectIssues(propsDrillingDetector, code);
    expect(issues).toHaveLength(0);
  });
});
