import { describe, it, expect } from "vitest";
import { detectIssues } from "./helpers";
import { unstableKeysDetector } from "../src/patterns/unstableKeys";

describe("unstableKeys detector", () => {
  it("flags index used as key in .map()", () => {
    const code = `const A = () => (
      <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
    );`;
    const issues = detectIssues(unstableKeysDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("index");
  });

  it("flags with any index param name", () => {
    const code = `const A = () => (
      <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    );`;
    const issues = detectIssues(unstableKeysDetector, code);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('"i"');
  });

  it("ignores stable keys", () => {
    const code = `const A = () => (
      <ul>{items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>
    );`;
    const issues = detectIssues(unstableKeysDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("ignores when index param is not used as key", () => {
    const code = `const A = () => (
      <ul>{items.map((item, index) => <li key={item.id}>{index}: {item.name}</li>)}</ul>
    );`;
    const issues = detectIssues(unstableKeysDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("ignores .map() without second parameter", () => {
    const code = `const A = () => (
      <ul>{items.map((item) => <li key={item.id}>{item}</li>)}</ul>
    );`;
    const issues = detectIssues(unstableKeysDetector, code);
    expect(issues).toHaveLength(0);
  });

  it("works with function expression callbacks", () => {
    const code = `const A = () => (
      <ul>{items.map(function(item, idx) { return <li key={idx}>{item}</li>; })}</ul>
    );`;
    const issues = detectIssues(unstableKeysDetector, code);
    expect(issues).toHaveLength(1);
  });
});
