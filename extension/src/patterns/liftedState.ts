import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import * as vscode from "vscode";
import type { PatternDetector, RenderIssue } from "../types";

/**
 * Detects useState/useReducer in a parent component where both the state
 * variable and setter are only passed to a single child (the state could
 * live in that child instead).
 *
 * Bad:
 *   const Parent = () => {
 *     const [count, setCount] = useState(0);
 *     return <Counter count={count} setCount={setCount} />;
 *   };
 *
 * Good (state used in own logic):
 *   const Parent = () => {
 *     const [count, setCount] = useState(0);
 *     return <div>{count}<Counter setCount={setCount} /></div>;
 *   };
 */
export const liftedStateDetector: PatternDetector = {
  id: "liftedState",

  detect(ast, _document) {
    const issues: RenderIssue[] = [];

    traverse(ast, {
      VariableDeclarator(path) {
        checkComponent(path, issues);
      },
      FunctionDeclaration(path) {
        if (!path.node.id || !/^[A-Z]/.test(path.node.id.name)) return;
        analyzeStateUsage(path, issues);
      },
    });

    return issues;
  },
};

function checkComponent(
  path: NodePath<t.VariableDeclarator>,
  issues: RenderIssue[]
): void {
  if (!t.isIdentifier(path.node.id)) return;
  if (!/^[A-Z]/.test(path.node.id.name)) return;

  const init = path.node.init;
  if (!init) return;
  if (!t.isArrowFunctionExpression(init) && !t.isFunctionExpression(init)) return;

  analyzeStateUsage(path, issues);
}

interface StateBinding {
  stateName: string;
  setterName: string | null;
  loc: t.SourceLocation;
}

function analyzeStateUsage(path: NodePath, issues: RenderIssue[]): void {
  const stateBindings = collectStateBindings(path);

  for (const binding of stateBindings) {
    const names = [binding.stateName];
    if (binding.setterName) names.push(binding.setterName);

    const jsxChildren = new Map<string, Set<string>>();
    const usedInOwnLogic = new Set<string>();

    path.traverse({
      JSXAttribute(attrPath) {
        const value = attrPath.node.value;
        if (!t.isJSXExpressionContainer(value)) return;
        const expr = value.expression;
        if (!t.isIdentifier(expr)) return;
        if (!names.includes(expr.name)) return;

        const jsxElement = findParentJSXElement(attrPath);
        if (!jsxElement) return;

        const elementName = getJSXElementName(jsxElement);
        if (!elementName) return;

        const set = jsxChildren.get(elementName) ?? new Set();
        set.add(expr.name);
        jsxChildren.set(elementName, set);
      },

      Identifier(idPath: NodePath<t.Identifier>) {
        if (!names.includes(idPath.node.name)) return;

        // Skip binding sites (parameter definitions, destructured bindings)
        const parent = idPath.parent;
        if (t.isArrayPattern(parent)) return;
        if (
          t.isObjectProperty(parent) && parent.value === idPath.node &&
          t.isObjectPattern(idPath.parentPath?.parent)
        ) return;

        if (isInsideJSXAttributeValue(idPath)) return;
        usedInOwnLogic.add(idPath.node.name);
      },
    });

    // Flag if all state identifiers go to exactly one child and aren't used elsewhere
    if (usedInOwnLogic.size > 0) continue;

    const childNames = [...jsxChildren.keys()];
    if (childNames.length !== 1) continue;

    const passedNames = jsxChildren.get(childNames[0])!;
    const allPassed = names.every((n) => passedNames.has(n));
    if (!allPassed) continue;

    issues.push({
      message: `State "${binding.stateName}" is only passed to <${childNames[0]} />. Consider moving the useState call into that component instead.`,
      range: new vscode.Range(
        binding.loc.start.line - 1,
        binding.loc.start.column,
        binding.loc.end.line - 1,
        binding.loc.end.column
      ),
      pattern: "liftedState",
      severity: "low",
    });
  }
}

function collectStateBindings(path: NodePath): StateBinding[] {
  const bindings: StateBinding[] = [];

  path.traverse({
    VariableDeclarator(varPath) {
      const init = varPath.node.init;
      if (!init || !t.isCallExpression(init)) return;

      let isStateHook = false;
      if (t.isIdentifier(init.callee, { name: "useState" })) isStateHook = true;
      if (t.isIdentifier(init.callee, { name: "useReducer" })) isStateHook = true;
      if (
        t.isMemberExpression(init.callee) &&
        t.isIdentifier(init.callee.object, { name: "React" }) &&
        t.isIdentifier(init.callee.property) &&
        (init.callee.property.name === "useState" ||
          init.callee.property.name === "useReducer")
      ) {
        isStateHook = true;
      }
      if (!isStateHook) return;

      // Destructured: const [state, setState] = useState(...)
      const id = varPath.node.id;
      if (!t.isArrayPattern(id)) return;

      const stateEl = id.elements[0];
      const setterEl = id.elements[1];
      if (!stateEl || !t.isIdentifier(stateEl)) return;

      const loc = varPath.node.loc;
      if (!loc) return;

      bindings.push({
        stateName: stateEl.name,
        setterName: t.isIdentifier(setterEl) ? setterEl.name : null,
        loc,
      });
    },
  });

  return bindings;
}

function findParentJSXElement(
  path: NodePath
): t.JSXOpeningElement | null {
  let current: NodePath | null = path.parentPath;
  while (current) {
    if (t.isJSXOpeningElement(current.node)) return current.node;
    if (t.isJSXElement(current.node)) return current.node.openingElement;
    current = current.parentPath;
  }
  return null;
}

function getJSXElementName(el: t.JSXOpeningElement): string | null {
  if (t.isJSXIdentifier(el.name)) return el.name.name;
  if (t.isJSXMemberExpression(el.name)) {
    if (t.isJSXIdentifier(el.name.property)) return el.name.property.name;
  }
  return null;
}

function isInsideJSXAttributeValue(path: NodePath): boolean {
  let current: NodePath | null = path.parentPath;
  while (current) {
    if (t.isJSXExpressionContainer(current.node)) {
      return current.parentPath != null && t.isJSXAttribute(current.parentPath.node);
    }
    if (t.isJSXElement(current.node) || t.isJSXFragment(current.node)) return false;
    current = current.parentPath;
  }
  return false;
}
