import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import * as vscode from "vscode";
import type { PatternDetector, RenderIssue } from "../types";

/**
 * Detects inline object/array literals passed as JSX props.
 *
 * Bad:  <Child style={{ color: 'red' }} />
 * Bad:  <Child items={[1, 2, 3]} />
 * Good: <Child style={styles} />
 *
 * These create new references on every render, defeating shallow comparison
 * in React.memo or shouldComponentUpdate.
 */
export const inlineObjectsDetector: PatternDetector = {
  id: "inlineObjects",

  detect(ast, document) {
    const issues: RenderIssue[] = [];

    traverse(ast, {
      JSXAttribute(path) {
        const value = path.node.value;
        if (!t.isJSXExpressionContainer(value)) return;

        const expr = value.expression;
        if (!t.isExpression(expr)) return;

        const isInlineObject = t.isObjectExpression(expr);
        const isInlineArray = t.isArrayExpression(expr);

        if (!isInlineObject && !isInlineArray) return;

        const attrName = t.isJSXIdentifier(path.node.name)
          ? path.node.name.name
          : null;
        // Skip `key` props and Provider `value` props (handled by broadContext)
        if (attrName === "key") return;
        if (attrName === "value" && isProviderElement(path)) return;

        const loc = expr.loc;
        if (!loc) return;

        const kind = isInlineObject ? "object" : "array";
        const range = new vscode.Range(
          loc.start.line - 1,
          loc.start.column,
          loc.end.line - 1,
          loc.end.column
        );

        issues.push({
          message: `Inline ${kind} literal creates a new reference on every render. Extract to a variable or useMemo.`,
          range,
          pattern: "inlineObjects",
          severity: "medium",
          fix: buildFix(kind, attrName, expr, range, document),
        });
      },
    });

    return issues;
  },
};

function isProviderElement(attrPath: NodePath<t.JSXAttribute>): boolean {
  const opening = attrPath.parent;
  if (!t.isJSXOpeningElement(opening)) return false;
  const name = opening.name;
  return (
    t.isJSXMemberExpression(name) &&
    t.isJSXIdentifier(name.property, { name: "Provider" })
  );
}

function buildFix(
  kind: string,
  propName: string | null,
  _expr: t.Expression,
  range: vscode.Range,
  document: vscode.TextDocument
): { title: string; replacement: string; range: vscode.Range } | undefined {
  if (!propName) return undefined;

  const originalText = document.getText(range);
  const varName = `${propName}Value`;
  const memoized = `useMemo(() => (${originalText}), [])`;

  return {
    title: `Extract to useMemo: const ${varName} = useMemo(...)`,
    replacement: memoized,
    range,
  };
}
