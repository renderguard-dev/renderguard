import { describe, it, expect } from "vitest";
import { detectIssues } from "./helpers";
import { liftedStateDetector } from "../src/patterns/liftedState";

describe("liftedState detector", () => {
  it("flags useState passed to a single child only", () => {
    const code = `const Parent = () => {
      const [count, setCount] = useState(0);
      return <Counter count={count} setCount={setCount} />;
    };`;
    const issues = detectIssues(liftedStateDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("count");
    expect(issues[0].message).toContain("Counter");
  });

  it("does not flag state used in own logic", () => {
    const code = `const Parent = () => {
      const [count, setCount] = useState(0);
      return <div>{count}<Counter setCount={setCount} /></div>;
    };`;
    const issues = detectIssues(liftedStateDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("does not flag state passed to multiple children", () => {
    const code = `const Parent = () => {
      const [count, setCount] = useState(0);
      return (
        <div>
          <Display count={count} />
          <Controls setCount={setCount} />
        </div>
      );
    };`;
    const issues = detectIssues(liftedStateDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("does not flag state used in hooks", () => {
    const code = `const Parent = () => {
      const [count, setCount] = useState(0);
      useEffect(() => { console.log(count); }, [count]);
      return <Counter setCount={setCount} />;
    };`;
    const issues = detectIssues(liftedStateDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("does not flag state used in conditions", () => {
    const code = `const Parent = () => {
      const [loading, setLoading] = useState(false);
      if (loading) return <Spinner />;
      return <Form setLoading={setLoading} />;
    };`;
    const issues = detectIssues(liftedStateDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("does not flag when only state (no setter) is passed", () => {
    const code = `const Parent = () => {
      const [count, setCount] = useState(0);
      return <Display count={count} />;
    };`;
    // Setter not passed to any child — state isn't fully delegated
    const issues = detectIssues(liftedStateDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("works with function declaration components", () => {
    const code = `function Parent() {
      const [count, setCount] = useState(0);
      return <Counter count={count} setCount={setCount} />;
    }`;
    const issues = detectIssues(liftedStateDetector, code);
    expect(issues).toHaveLength(1);
  });

  it("works with useReducer", () => {
    const code = `const Parent = () => {
      const [state, dispatch] = useReducer(reducer, init);
      return <Child state={state} dispatch={dispatch} />;
    };`;
    const issues = detectIssues(liftedStateDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("state");
  });

  it("does not flag components without useState", () => {
    const code = `const Parent = () => <Child />;`;
    const issues = detectIssues(liftedStateDetector, code);
    expect(issues).toHaveLength(0);
  });
});
