import * as vscode from "vscode";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { File } from "@babel/types";
import { parseDocument, isTypeScriptFile } from "./utils/ast";
import { allDetectors } from "./patterns";
import type { RenderIssue, PatternId, ComponentInfo } from "./types";

export class RenderGuardAnalyzer {
  analyze(
    document: vscode.TextDocument,
    enabledPatterns: Record<PatternId, boolean>
  ): { issues: RenderIssue[]; components: ComponentInfo[] } {
    const ast = this.parseDoc(document);
    if (!ast) return { issues: [], components: [] };

    const issues: RenderIssue[] = [];

    for (const detector of allDetectors) {
      if (!enabledPatterns[detector.id]) continue;
      issues.push(...detector.detect(ast, document));
    }

    const components = this.groupByComponent(ast, issues);

    return { issues, components };
  }

  private parseDoc(document: vscode.TextDocument): File | null {
    const text = document.getText();
    const isTS = isTypeScriptFile(document.languageId);
    return parseDocument(text, isTS);
  }

  private groupByComponent(ast: File, issues: RenderIssue[]): ComponentInfo[] {
    const components: ComponentInfo[] = [];

    traverse(ast, {
      VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
        if (!t.isIdentifier(path.node.id)) return;
        const name = path.node.id.name;
        if (!/^[A-Z]/.test(name)) return;

        const init = path.node.init;
        if (
          !init ||
          (!t.isArrowFunctionExpression(init) && !t.isFunctionExpression(init))
        ) {
          return;
        }

        addComponent(components, name, path.node.loc, issues);
      },

      FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
        const name = path.node.id?.name;
        if (!name || !/^[A-Z]/.test(name)) return;
        addComponent(components, name, path.node.loc, issues);
      },
    });

    return components;
  }
}

function addComponent(
  components: ComponentInfo[],
  name: string,
  loc: t.SourceLocation | null | undefined,
  issues: RenderIssue[]
): void {
  if (!loc) return;

  const startLine = loc.start.line - 1;
  const endLine = loc.end.line - 1;

  components.push({
    name,
    startLine,
    endLine,
    issues: issues.filter(
      (i) => i.range.start.line >= startLine && i.range.end.line <= endLine
    ),
  });
}
