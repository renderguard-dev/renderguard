import { describe, it, expect } from "vitest";
import { detectIssues } from "./helpers";
import { missingMemoDetector } from "../src/patterns/missingMemo";

describe("missingMemo detector", () => {
  it("flags arrow component that accepts props", () => {
    const issues = detectIssues(
      missingMemoDetector,
      `const Card = (props: { name: string }) => <div>{props.name}</div>;`
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Card");
    expect(issues[0].message).toContain("React.memo");
  });

  it("flags function declaration component that accepts props", () => {
    const code = `function Card(props: { name: string }) { return <div>{props.name}</div>; }`;
    const issues = detectIssues(missingMemoDetector, code);
    expect(issues).toHaveLength(1);
  });

  it("ignores components already wrapped in memo()", () => {
    const code = `import { memo } from "react";
const Card = memo((props: { name: string }) => <div>{props.name}</div>);`;
    const issues = detectIssues(missingMemoDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("ignores components wrapped in React.memo()", () => {
    const code = `const Card = React.memo((props: { name: string }) => <div>{props.name}</div>);`;
    const issues = detectIssues(missingMemoDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("ignores components with no props", () => {
    const code = `const Card = () => <div>hello</div>;`;
    const issues = detectIssues(missingMemoDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("ignores stateful components (useState)", () => {
    const code = `const Card = (props: { x: number }) => {
      const [v, setV] = useState(0);
      return <div>{props.x}{v}</div>;
    };`;
    const issues = detectIssues(missingMemoDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("ignores stateful components (useReducer)", () => {
    const code = `const Card = (props: { x: number }) => {
      const [state, dispatch] = useReducer(reducer, init);
      return <div>{props.x}</div>;
    };`;
    const issues = detectIssues(missingMemoDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("ignores lowercase functions (not components)", () => {
    const code = `const helper = (props: any) => <div />;`;
    const issues = detectIssues(missingMemoDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("ignores components that don't return JSX", () => {
    const code = `const Util = (props: { x: number }) => props.x * 2;`;
    const issues = detectIssues(missingMemoDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("detects memo-wrapped component passed by reference", () => {
    const code = `const Card = (props: { name: string }) => <div>{props.name}</div>;
const MemoCard = React.memo(Card);`;
    const issues = detectIssues(missingMemoDetector, code);
    expect(issues).toHaveLength(0);
  });
});
