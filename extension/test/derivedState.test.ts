import { describe, it, expect } from "vitest";
import { detectIssues } from "./helpers";
import { derivedStateDetector } from "../src/patterns/derivedState";

describe("derivedState detector", () => {
  it("flags .filter() in component body", () => {
    const code = `const App = (props: { items: any[] }) => {
      const filtered = props.items.filter(i => i.active);
      return <div>{filtered.length}</div>;
    };`;
    const issues = detectIssues(derivedStateDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain(".filter()");
  });

  it("flags .sort() in component body", () => {
    const code = `const App = ({ data }: any) => {
      const sorted = data.sort((a: any, b: any) => a - b);
      return <div />;
    };`;
    const issues = detectIssues(derivedStateDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain(".sort()");
  });

  it("flags .map() in variable assignment (not in JSX)", () => {
    const code = `const App = ({ items }: any) => {
      const names = items.map((i: any) => i.name);
      return <ul>{names.join(", ")}</ul>;
    };`;
    const issues = detectIssues(derivedStateDetector, code);
    expect(issues).toHaveLength(1);
  });

  it("flags .reduce() in component body", () => {
    const code = `const App = ({ items }: any) => {
      const total = items.reduce((sum: number, i: any) => sum + i.price, 0);
      return <div>{total}</div>;
    };`;
    const issues = detectIssues(derivedStateDetector, code);
    expect(issues).toHaveLength(1);
  });

  it("flags Object.keys()", () => {
    const code = `const App = ({ config }: any) => {
      const keys = Object.keys(config);
      return <div>{keys.length}</div>;
    };`;
    const issues = detectIssues(derivedStateDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Object.keys()");
  });

  it("flags [...spread].sort() pattern", () => {
    const code = `const App = ({ data }: any) => {
      const sorted = [...data].sort((a: any, b: any) => a - b);
      return <div />;
    };`;
    const issues = detectIssues(derivedStateDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain(".sort()");
  });

  it("ignores when wrapped in useMemo", () => {
    const code = `const App = ({ items }: any) => {
      const filtered = useMemo(() => items.filter((i: any) => i.active), [items]);
      return <div />;
    };`;
    const issues = detectIssues(derivedStateDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("ignores when inside useEffect", () => {
    const code = `const App = ({ items }: any) => {
      useEffect(() => {
        const filtered = items.filter((i: any) => i.active);
        console.log(filtered);
      }, [items]);
      return <div />;
    };`;
    const issues = detectIssues(derivedStateDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("ignores code outside of components", () => {
    const code = `const filtered = items.filter((i: any) => i.active);
    export default filtered;`;
    const issues = detectIssues(derivedStateDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("ignores simple assignments (no transform call)", () => {
    const code = `const App = ({ x }: any) => {
      const y = x + 1;
      return <div>{y}</div>;
    };`;
    const issues = detectIssues(derivedStateDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("works with function declaration components", () => {
    const code = `function App({ items }: any) {
      const filtered = items.filter((i: any) => i.active);
      return <div />;
    }`;
    const issues = detectIssues(derivedStateDetector, code);
    expect(issues).toHaveLength(1);
  });

  it("provides a useMemo fix for flagged issues", () => {
    const code = `const App = (props: { items: any[] }) => {
      const filtered = props.items.filter(i => i.active);
      return <div />;
    };`;
    const issues = detectIssues(derivedStateDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].fix).toBeDefined();
    expect(issues[0].fix!.title).toContain("useMemo");
    expect(issues[0].fix!.replacement).toContain("useMemo(() =>");
    expect(issues[0].fix!.replacement).toContain(".filter(");
  });
});
