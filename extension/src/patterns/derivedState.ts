import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import * as vscode from "vscode";
import type { PatternDetector, RenderIssue } from "../types";

const TRANSFORM_METHODS = new Set([
  "filter",
  "map",
  "sort",
  "reduce",
  "slice",
  "find",
  "findIndex",
  "flatMap",
  "every",
  "some",
  "concat",
  "reverse",
  "flat",
]);

const OBJECT_TRANSFORMS = new Set(["keys", "values", "entries", "fromEntries"]);

/**
 * Detects derived values computed from state/props in the render body
 * without useMemo.
 *
 * Bad:  const filtered = items.filter(i => i.active);
 * Bad:  const sorted = [...data].sort((a, b) => a - b);
 * Bad:  const keys = Object.keys(config);
 * Good: const filtered = useMemo(() => items.filter(i => i.active), [items]);
 */
export const derivedStateDetector: PatternDetector = {
  id: "derivedState",

  detect(ast, _document) {
    const issues: RenderIssue[] = [];

    traverse(ast, {
      VariableDeclarator(path) {
        if (!isInsideComponent(path)) return;
        if (isInsideHookCallback(path)) return;

        const init = path.node.init;
        if (!init) return;

        const match = matchTransformCall(init);
        if (!match) return;

        const loc = init.loc;
        if (!loc) return;

        issues.push({
          message: `Derived value computed via ${match} without useMemo. This recalculates on every render. Wrap in useMemo with appropriate dependencies.`,
          range: new vscode.Range(
            loc.start.line - 1,
            loc.start.column,
            loc.end.line - 1,
            loc.end.column
          ),
          pattern: "derivedState",
          severity: "medium",
        });
      },
    });

    return issues;
  },
};

function matchTransformCall(node: t.Expression): string | null {
  // Direct method call: items.filter(...)
  if (t.isCallExpression(node) && t.isMemberExpression(node.callee)) {
    const prop = node.callee.property;
    if (t.isIdentifier(prop) && TRANSFORM_METHODS.has(prop.name)) {
      // Chained: [...x].sort(...) — the callee.object is another call/array
      return `.${prop.name}()`;
    }
  }

  // Object.keys/values/entries(...)
  if (
    t.isCallExpression(node) &&
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.object, { name: "Object" }) &&
    t.isIdentifier(node.callee.property) &&
    OBJECT_TRANSFORMS.has(node.callee.property.name)
  ) {
    return `Object.${node.callee.property.name}()`;
  }

  // Spread-then-method: [...items].sort(...)
  if (t.isCallExpression(node) && t.isMemberExpression(node.callee)) {
    const obj = node.callee.object;
    if (t.isArrayExpression(obj) && obj.elements.length > 0) {
      const firstEl = obj.elements[0];
      if (firstEl && t.isSpreadElement(firstEl)) {
        const prop = node.callee.property;
        if (t.isIdentifier(prop) && TRANSFORM_METHODS.has(prop.name)) {
          return `[...spread].${prop.name}()`;
        }
      }
    }
  }

  return null;
}

function isInsideComponent(path: NodePath): boolean {
  let current: NodePath | null = path;
  while (current) {
    if (
      t.isArrowFunctionExpression(current.node) ||
      t.isFunctionExpression(current.node) ||
      t.isFunctionDeclaration(current.node)
    ) {
      const parent = current.parentPath;
      if (parent && t.isVariableDeclarator(parent.node)) {
        const id = parent.node.id;
        if (t.isIdentifier(id) && /^[A-Z]/.test(id.name)) return true;
      }
      if (t.isFunctionDeclaration(current.node) && current.node.id) {
        if (/^[A-Z]/.test(current.node.id.name)) return true;
      }
      return false;
    }
    current = current.parentPath;
  }
  return false;
}

function isInsideHookCallback(path: NodePath): boolean {
  let current: NodePath | null = path.parentPath;
  while (current) {
    if (t.isCallExpression(current.node)) {
      const callee = current.node.callee;
      if (t.isIdentifier(callee)) {
        if (
          callee.name === "useMemo" ||
          callee.name === "useCallback" ||
          callee.name === "useEffect" ||
          callee.name === "useLayoutEffect"
        ) {
          return true;
        }
      }
    }
    // Stop at the component function boundary
    if (
      t.isArrowFunctionExpression(current.node) ||
      t.isFunctionExpression(current.node) ||
      t.isFunctionDeclaration(current.node)
    ) {
      const parent = current.parentPath;
      if (parent && t.isVariableDeclarator(parent.node)) {
        const id = parent.node.id;
        if (t.isIdentifier(id) && /^[A-Z]/.test(id.name)) break;
      }
      if (t.isFunctionDeclaration(current.node) && current.node.id) {
        if (/^[A-Z]/.test(current.node.id.name)) break;
      }
    }
    current = current.parentPath;
  }
  return false;
}
