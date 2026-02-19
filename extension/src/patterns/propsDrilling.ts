import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import * as vscode from "vscode";
import type { PatternDetector, RenderIssue } from "../types";

const SKIP_PROPS = new Set(["children", "className", "style", "key", "ref", "id"]);

/**
 * Detects components that receive a prop and pass it straight through
 * to a child JSX element without using it in their own logic.
 *
 * Bad:  const Layout = ({ theme }) => <Sidebar theme={theme} />;
 * Good: const Layout = ({ theme }) => <div className={theme}><Sidebar /></div>;
 */
export const propsDrillingDetector: PatternDetector = {
  id: "propsDrilling",

  detect(ast, _document) {
    const issues: RenderIssue[] = [];

    traverse(ast, {
      VariableDeclarator(path) {
        if (!t.isIdentifier(path.node.id)) return;
        if (!/^[A-Z]/.test(path.node.id.name)) return;
        const init = path.node.init;
        if (!init) return;
        if (!t.isArrowFunctionExpression(init) && !t.isFunctionExpression(init)) return;
        const bodyPath = path.get("init") as NodePath<t.ArrowFunctionExpression | t.FunctionExpression>;
        const body = bodyPath.get("body");
        analyzeComponent(body, init.params, path.node.id.name, issues);
      },
      FunctionDeclaration(path) {
        if (!path.node.id || !/^[A-Z]/.test(path.node.id.name)) return;
        const body = path.get("body");
        analyzeComponent(body, path.node.params, path.node.id.name, issues);
      },
    });

    return issues;
  },
};

function analyzeComponent(
  bodyPath: NodePath,
  params: Array<t.Identifier | t.Pattern | t.RestElement>,
  componentName: string,
  issues: RenderIssue[]
): void {
  const propNames = extractDestructuredProps(params);
  if (propNames.size === 0) return;

  const forwarded = new Map<string, t.SourceLocation>();
  const jsxAttrCount = new Map<string, number>();
  const totalRefCount = new Map<string, number>();

  for (const name of propNames) {
    jsxAttrCount.set(name, 0);
    totalRefCount.set(name, 0);
  }

  // Traverse only the function body (excludes parameter bindings)
  bodyPath.traverse({
    JSXAttribute(attrPath) {
      const value = attrPath.node.value;
      if (!t.isJSXExpressionContainer(value)) return;
      const expr = value.expression;
      if (!t.isIdentifier(expr)) return;
      if (!propNames.has(expr.name)) return;

      // Only count as "forwarded" if the parent JSX element is a component (PascalCase)
      const opening = attrPath.parent;
      if (
        t.isJSXOpeningElement(opening) &&
        t.isJSXIdentifier(opening.name) &&
        /^[A-Z]/.test(opening.name.name)
      ) {
        jsxAttrCount.set(expr.name, (jsxAttrCount.get(expr.name) ?? 0) + 1);
        if (!forwarded.has(expr.name) && attrPath.node.loc) {
          forwarded.set(expr.name, attrPath.node.loc);
        }
      }
    },

    Identifier(idPath: NodePath<t.Identifier>) {
      if (!propNames.has(idPath.node.name)) return;
      totalRefCount.set(
        idPath.node.name,
        (totalRefCount.get(idPath.node.name) ?? 0) + 1
      );
    },
  });

  for (const [propName, loc] of forwarded) {
    if (SKIP_PROPS.has(propName)) continue;

    const total = totalRefCount.get(propName) ?? 0;
    const jsxAttr = jsxAttrCount.get(propName) ?? 0;

    // Every reference to this prop is inside a JSX attribute — it's being drilled
    if (total > 0 && total === jsxAttr) {
      issues.push({
        message: `Prop "${propName}" is passed through ${componentName} without being used. Consider using context or moving the prop closer to where it's needed.`,
        range: new vscode.Range(
          loc.start.line - 1,
          loc.start.column,
          loc.end.line - 1,
          loc.end.column
        ),
        pattern: "propsDrilling",
        severity: "low",
      });
    }
  }
}

function extractDestructuredProps(
  params: Array<t.Identifier | t.Pattern | t.RestElement>
): Set<string> {
  const names = new Set<string>();
  const firstParam = params[0];
  if (!firstParam) return names;

  if (t.isObjectPattern(firstParam)) {
    for (const prop of firstParam.properties) {
      if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
        names.add(prop.key.name);
      }
    }
  }

  return names;
}
