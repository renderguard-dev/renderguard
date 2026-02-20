import traverse from "@babel/traverse";
import * as t from "@babel/types";
import * as vscode from "vscode";
import type { PatternDetector, RenderIssue } from "../types";

/**
 * Detects useContext calls where the result is used without destructuring
 * or where only a small subset of the context value is used.
 *
 * Bad:  const ctx = useContext(AppContext);  // subscribes to ALL changes
 *       return <div>{ctx.theme}</div>;       // but only uses .theme
 *
 * Good: const { theme } = useContext(ThemeContext);  // narrow context
 *
 * Also flags context providers with inline object values:
 * Bad:  <Ctx.Provider value={{ user, theme }}>  // new object every render
 * Good: const value = useMemo(() => ({ user, theme }), [user, theme]);
 *       <Ctx.Provider value={value}>
 */
export const broadContextDetector: PatternDetector = {
  id: "broadContext",

  detect(ast, _document) {
    const issues: RenderIssue[] = [];

    detectInlineProviderValues(ast, issues);
    detectBroadConsumers(ast, issues);

    return issues;
  },
};

function detectInlineProviderValues(ast: t.File, issues: RenderIssue[]): void {
  traverse(ast, {
    JSXAttribute(path) {
      if (!t.isJSXIdentifier(path.node.name, { name: "value" })) return;

      // The parent node of a JSXAttribute is the JSXOpeningElement
      const parent = path.parent;
      if (!t.isJSXOpeningElement(parent)) return;

      const elementName = parent.name;
      if (!t.isJSXMemberExpression(elementName)) return;
      if (!t.isJSXIdentifier(elementName.property, { name: "Provider" })) return;

      const attrValue = path.node.value;
      if (!t.isJSXExpressionContainer(attrValue)) return;

      const expr = attrValue.expression;
      if (!t.isExpression(expr)) return;

      if (t.isObjectExpression(expr)) {
        const loc = expr.loc;
        if (!loc) return;

        const contextName = t.isJSXIdentifier(elementName.object)
          ? elementName.object.name
          : "Context";

        issues.push({
          message: `Inline object in ${contextName}.Provider value creates a new reference every render, causing all consumers to re-render. Consider extracting to useMemo if the provider has many consumers.`,
          range: new vscode.Range(
            loc.start.line - 1,
            loc.start.column,
            loc.end.line - 1,
            loc.end.column
          ),
          pattern: "broadContext",
          severity: "high",
        });
      }
    },
  });
}

function detectBroadConsumers(ast: t.File, issues: RenderIssue[]): void {
  traverse(ast, {
    VariableDeclarator(path) {
      const init = path.node.init;
      if (!init || !t.isCallExpression(init)) return;

      // Match useContext(SomeContext)
      let isUseContext = false;
      if (t.isIdentifier(init.callee, { name: "useContext" })) {
        isUseContext = true;
      } else if (
        t.isMemberExpression(init.callee) &&
        t.isIdentifier(init.callee.object, { name: "React" }) &&
        t.isIdentifier(init.callee.property, { name: "useContext" })
      ) {
        isUseContext = true;
      }
      if (!isUseContext) return;

      // If using destructuring, the developer is already being selective — skip
      if (t.isObjectPattern(path.node.id)) return;

      // Non-destructured: const ctx = useContext(...)
      if (!t.isIdentifier(path.node.id)) return;

      const contextArg = init.arguments[0];
      const contextName = t.isIdentifier(contextArg) ? contextArg.name : "Context";

      const loc = path.node.loc;
      if (!loc) return;

      issues.push({
        message: `Consuming entire "${contextName}" without destructuring. This component re-renders on any context change. Consider destructuring only the needed values if the context updates frequently.`,
        range: new vscode.Range(
          loc.start.line - 1,
          loc.start.column,
          loc.end.line - 1,
          loc.end.column
        ),
        pattern: "broadContext",
        severity: "medium",
      });
    },
  });
}
