import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import * as vscode from "vscode";
import type { PatternDetector, RenderIssue } from "../types";

/**
 * Detects function components that receive props but aren't wrapped in React.memo.
 *
 * Heuristic: a component is a candidate for React.memo if it:
 * 1. Has a PascalCase name (React component naming convention)
 * 2. Accepts props (has parameters)
 * 3. Returns JSX
 * 4. Has no useState/useReducer (stateful components re-render on state change anyway)
 * 5. Isn't already wrapped in React.memo or memo()
 */
export const missingMemoDetector: PatternDetector = {
  id: "missingMemo",

  detect(ast, _document) {
    const issues: RenderIssue[] = [];
    const memoWrapped = collectMemoWrapped(ast);

    traverse(ast, {
      // const MyComponent = (props) => { ... }
      VariableDeclarator(path) {
        if (!t.isIdentifier(path.node.id)) return;
        const name = path.node.id.name;
        if (!isComponentName(name)) return;
        if (memoWrapped.has(name)) return;

        const init = path.node.init;
        if (!init) return;

        // Skip if already wrapped: const X = memo(...)
        if (
          t.isCallExpression(init) &&
          (isMemoCall(init.callee))
        ) {
          return;
        }

        const fn = t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)
          ? init
          : null;
        if (!fn) return;
        if (fn.params.length === 0) return;
        if (usesState(path)) return;
        if (!returnsJSX(path)) return;

        const loc = path.node.id.loc;
        if (!loc) return;

        issues.push({
          message: `Component "${name}" accepts props but isn't wrapped in React.memo. It will re-render whenever its parent re-renders, even with identical props.`,
          range: new vscode.Range(
            loc.start.line - 1,
            loc.start.column,
            loc.end.line - 1,
            loc.end.column
          ),
          pattern: "missingMemo",
          severity: "low",
        });
      },

      // function MyComponent(props) { ... }
      FunctionDeclaration(path) {
        const name = path.node.id?.name;
        if (!name || !isComponentName(name)) return;
        if (memoWrapped.has(name)) return;
        if (path.node.params.length === 0) return;
        if (usesState(path)) return;
        if (!returnsJSX(path)) return;

        const loc = path.node.id!.loc;
        if (!loc) return;

        issues.push({
          message: `Component "${name}" accepts props but isn't wrapped in React.memo. It will re-render whenever its parent re-renders, even with identical props.`,
          range: new vscode.Range(
            loc.start.line - 1,
            loc.start.column,
            loc.end.line - 1,
            loc.end.column
          ),
          pattern: "missingMemo",
          severity: "low",
        });
      },
    });

    return issues;
  },
};

function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function isMemoCall(callee: t.Expression | t.V8IntrinsicIdentifier): boolean {
  if (t.isIdentifier(callee) && callee.name === "memo") return true;
  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.object) &&
    callee.object.name === "React" &&
    t.isIdentifier(callee.property) &&
    callee.property.name === "memo"
  ) {
    return true;
  }
  return false;
}

function collectMemoWrapped(ast: t.File): Set<string> {
  const wrapped = new Set<string>();
  traverse(ast, {
    CallExpression(path) {
      if (!isMemoCall(path.node.callee)) return;
      const arg = path.node.arguments[0];
      if (t.isIdentifier(arg)) {
        wrapped.add(arg.name);
      }
    },
  });
  return wrapped;
}

function usesState(path: NodePath): boolean {
  let found = false;
  path.traverse({
    CallExpression(inner: NodePath<t.CallExpression>) {
      if (
        t.isIdentifier(inner.node.callee) &&
        (inner.node.callee.name === "useState" || inner.node.callee.name === "useReducer")
      ) {
        found = true;
        inner.stop();
      }
    },
  });
  return found;
}

function returnsJSX(path: NodePath): boolean {
  let found = false;
  path.traverse({
    JSXElement() {
      found = true;
    },
    JSXFragment() {
      found = true;
    },
  });
  return found;
}
