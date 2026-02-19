import traverse from "@babel/traverse";
import * as t from "@babel/types";
import * as vscode from "vscode";
import type { PatternDetector, RenderIssue } from "../types";

/**
 * Detects array index used as key in .map() JSX output.
 *
 * Bad:  list.map((item, i) => <Item key={i} />)
 * Bad:  list.map((item, index) => <Item key={index} />)
 * Good: list.map((item) => <Item key={item.id} />)
 *
 * Index keys cause unnecessary remounts when the list order changes.
 */
export const unstableKeysDetector: PatternDetector = {
  id: "unstableKeys",

  detect(ast, _document) {
    const issues: RenderIssue[] = [];

    traverse(ast, {
      CallExpression(path) {
        // Match: something.map(...)
        if (!t.isMemberExpression(path.node.callee)) return;
        if (!t.isIdentifier(path.node.callee.property, { name: "map" })) return;

        const callback = path.node.arguments[0];
        if (!callback) return;
        if (!t.isArrowFunctionExpression(callback) && !t.isFunctionExpression(callback)) {
          return;
        }

        // Get the index parameter name (2nd param)
        const indexParam = callback.params[1];
        if (!indexParam || !t.isIdentifier(indexParam)) return;
        const indexName = indexParam.name;

        // Search for key={indexName} in JSX within this callback
        path.traverse({
          JSXAttribute(attrPath) {
            if (!t.isJSXIdentifier(attrPath.node.name, { name: "key" })) return;

            const value = attrPath.node.value;
            if (!t.isJSXExpressionContainer(value)) return;

            const expr = value.expression;
            if (!t.isIdentifier(expr, { name: indexName })) return;

            const loc = attrPath.node.loc;
            if (!loc) return;

            issues.push({
              message: `Array index "${indexName}" used as key. This can cause incorrect component reuse and unnecessary remounts when the list changes. Use a stable, unique identifier instead.`,
              range: new vscode.Range(
                loc.start.line - 1,
                loc.start.column,
                loc.end.line - 1,
                loc.end.column
              ),
              pattern: "unstableKeys",
              severity: "high",
            });
          },
        });
      },
    });

    return issues;
  },
};
