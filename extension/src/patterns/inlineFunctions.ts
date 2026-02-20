import traverse from "@babel/traverse";
import * as t from "@babel/types";
import * as vscode from "vscode";
import type { PatternDetector, RenderIssue } from "../types";

/**
 * Detects inline arrow functions / function expressions passed as JSX props.
 *
 * Bad:  <Child onClick={() => handleClick(id)} />
 * Good: <Child onClick={handleClick} />
 * Good: const onClick = useCallback(() => handleClick(id), [id]);
 *
 * Inline functions create a new reference every render.
 */
export const inlineFunctionsDetector: PatternDetector = {
  id: "inlineFunctions",

  detect(ast, document) {
    const issues: RenderIssue[] = [];

    traverse(ast, {
      JSXAttribute(path) {
        const value = path.node.value;
        if (!t.isJSXExpressionContainer(value)) return;

        const expr = value.expression;
        if (!t.isExpression(expr)) return;

        const isArrow = t.isArrowFunctionExpression(expr);
        const isFnExpr = t.isFunctionExpression(expr);
        if (!isArrow && !isFnExpr) return;

        const attrName = t.isJSXIdentifier(path.node.name)
          ? path.node.name.name
          : null;

        const loc = expr.loc;
        if (!loc) return;

        const range = new vscode.Range(
          loc.start.line - 1,
          loc.start.column,
          loc.end.line - 1,
          loc.end.column
        );

        issues.push({
          message: `Inline function creates a new reference on every render. This matters if the child is wrapped in React.memo — otherwise it's usually fine.`,
          range,
          pattern: "inlineFunctions",
          severity: "medium",
          fix: buildFix(attrName, document, range),
        });
      },
    });

    return issues;
  },
};

function buildFix(
  propName: string | null,
  document: vscode.TextDocument,
  range: vscode.Range
): { title: string; replacement: string; range: vscode.Range } | undefined {
  if (!propName) return undefined;

  const originalText = document.getText(range);
  const handlerName = `handle${propName.charAt(0).toUpperCase()}${propName.slice(1)}`;

  return {
    title: `Wrap with useCallback: const ${handlerName} = useCallback(${originalText}, [])`,
    replacement: `useCallback(${originalText}, [/* deps */])`,
    range,
  };
}
