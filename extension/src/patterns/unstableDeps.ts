import traverse from "@babel/traverse";
import * as t from "@babel/types";
import * as vscode from "vscode";
import type { PatternDetector, RenderIssue } from "../types";

const HOOKS_WITH_DEPS = new Set(["useMemo", "useCallback", "useEffect", "useLayoutEffect"]);

/**
 * Detects useMemo/useCallback/useEffect with missing or empty dependency arrays,
 * or with inline expressions in the dep array that change every render.
 *
 * Bad:  useMemo(() => compute(a, b))          // missing deps entirely
 * Bad:  useCallback(() => fn(x), [])          // empty deps when closure captures variables
 * Bad:  useMemo(() => x, [{ a: 1 }])          // object literal in deps
 * Good: useMemo(() => compute(a, b), [a, b])
 */
export const unstableDepsDetector: PatternDetector = {
  id: "unstableDeps",

  detect(ast, _document) {
    const issues: RenderIssue[] = [];

    traverse(ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        let hookName: string | null = null;

        if (t.isIdentifier(callee) && HOOKS_WITH_DEPS.has(callee.name)) {
          hookName = callee.name;
        } else if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: "React" }) &&
          t.isIdentifier(callee.property) &&
          HOOKS_WITH_DEPS.has(callee.property.name)
        ) {
          hookName = callee.property.name;
        }

        if (!hookName) return;

        const args = path.node.arguments;

        // Check for missing dependency array (useMemo/useCallback require it)
        if (
          (hookName === "useMemo" || hookName === "useCallback") &&
          args.length < 2
        ) {
          const loc = path.node.loc;
          if (!loc) return;

          issues.push({
            message: `${hookName} is missing its dependency array. Without it, the value is recomputed on every render, defeating the purpose of memoization.`,
            range: new vscode.Range(
              loc.start.line - 1,
              loc.start.column,
              loc.end.line - 1,
              loc.end.column
            ),
            pattern: "unstableDeps",
            severity: "high",
          });
          return;
        }

        // Check for unstable values in the dependency array
        const depsArg = args[1];
        if (!depsArg || !t.isArrayExpression(depsArg)) return;

        for (const element of depsArg.elements) {
          if (!element || !t.isExpression(element)) continue;

          let unstableKind: string | null = null;

          if (t.isObjectExpression(element)) {
            unstableKind = "object literal";
          } else if (t.isArrayExpression(element)) {
            unstableKind = "array literal";
          } else if (
            t.isArrowFunctionExpression(element) ||
            t.isFunctionExpression(element)
          ) {
            unstableKind = "function";
          } else if (
            t.isTemplateLiteral(element) &&
            element.expressions.length > 0
          ) {
            unstableKind = "template literal with expressions";
          }

          if (unstableKind) {
            const loc = element.loc;
            if (!loc) continue;

            issues.push({
              message: `Unstable ${unstableKind} in ${hookName} dependency array. This creates a new reference every render, causing the hook to re-run on every render.`,
              range: new vscode.Range(
                loc.start.line - 1,
                loc.start.column,
                loc.end.line - 1,
                loc.end.column
              ),
              pattern: "unstableDeps",
              severity: "high",
            });
          }
        }
      },
    });

    return issues;
  },
};
