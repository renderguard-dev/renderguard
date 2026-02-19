import { describe, it, expect } from "vitest";
import { detectIssues } from "./helpers";
import { broadContextDetector } from "../src/patterns/broadContext";

describe("broadContext detector", () => {
  describe("inline Provider values", () => {
    it("flags inline object in Provider value", () => {
      const code = `const A = () => <Ctx.Provider value={{ user: "x" }}><div /></Ctx.Provider>;`;
      const issues = detectIssues(broadContextDetector, code);
      const providerIssues = issues.filter((i) =>
        i.message.includes("Provider")
      );
      expect(providerIssues).toHaveLength(1);
      expect(providerIssues[0].severity).toBe("high");
    });

    it("includes context name in message", () => {
      const code = `const A = () => <AppContext.Provider value={{ x: 1 }}><div /></AppContext.Provider>;`;
      const issues = detectIssues(broadContextDetector, code);
      expect(issues.some((i) => i.message.includes("AppContext"))).toBe(true);
    });

    it("ignores variable reference in Provider value", () => {
      const code = `const A = () => { const v = {}; return <Ctx.Provider value={v}><div /></Ctx.Provider>; };`;
      const issues = detectIssues(broadContextDetector, code);
      const providerIssues = issues.filter((i) =>
        i.message.includes("Provider")
      );
      expect(providerIssues).toHaveLength(0);
    });

    it("ignores non-Provider elements with value prop", () => {
      const code = `const A = () => <input value={{ x: 1 }} />;`;
      const issues = detectIssues(broadContextDetector, code);
      const providerIssues = issues.filter((i) =>
        i.message.includes("Provider")
      );
      expect(providerIssues).toHaveLength(0);
    });
  });

  describe("broad consumers", () => {
    it("flags non-destructured useContext", () => {
      const code = `const A = () => { const ctx = useContext(AppCtx); return <div>{ctx.x}</div>; };`;
      const issues = detectIssues(broadContextDetector, code);
      const consumerIssues = issues.filter((i) =>
        i.message.includes("Consuming")
      );
      expect(consumerIssues).toHaveLength(1);
      expect(consumerIssues[0].message).toContain("AppCtx");
    });

    it("ignores destructured useContext", () => {
      const code = `const A = () => { const { theme } = useContext(AppCtx); return <div>{theme}</div>; };`;
      const issues = detectIssues(broadContextDetector, code);
      const consumerIssues = issues.filter((i) =>
        i.message.includes("Consuming")
      );
      expect(consumerIssues).toHaveLength(0);
    });

    it("handles React.useContext syntax", () => {
      const code = `const A = () => { const ctx = React.useContext(Ctx); return <div />; };`;
      const issues = detectIssues(broadContextDetector, code);
      const consumerIssues = issues.filter((i) =>
        i.message.includes("Consuming")
      );
      expect(consumerIssues).toHaveLength(1);
    });
  });
});
