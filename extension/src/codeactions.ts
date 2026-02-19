import * as vscode from "vscode";
import type { RenderIssue } from "./types";
import { patternDisplayName } from "./utils/diagnostics";

export class RenderGuardCodeActionProvider implements vscode.CodeActionProvider {
  private issuesByUri = new Map<string, RenderIssue[]>();
  private configuredSeverity = vscode.DiagnosticSeverity.Warning;

  updateIssues(uri: string, issues: RenderIssue[]): void {
    this.issuesByUri.set(uri, issues);
  }

  updateSeverity(severity: vscode.DiagnosticSeverity): void {
    this.configuredSeverity = severity;
  }

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction[] {
    const issues = this.issuesByUri.get(document.uri.toString()) ?? [];
    const actions: vscode.CodeAction[] = [];

    for (const issue of issues) {
      if (!issue.fix) continue;
      if (!issue.range.intersection(range)) continue;

      const action = new vscode.CodeAction(
        `RenderGuard: ${issue.fix.title}`,
        vscode.CodeActionKind.QuickFix
      );

      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(document.uri, issue.fix.range, issue.fix.replacement);
      action.diagnostics = [
        new vscode.Diagnostic(issue.range, issue.message, this.configuredSeverity),
      ];
      action.isPreferred = true;

      actions.push(action);
    }

    const patternsInRange = new Set(
      issues
        .filter((i) => i.range.intersection(range))
        .map((i) => i.pattern)
    );

    for (const patternId of patternsInRange) {
      const action = new vscode.CodeAction(
        `RenderGuard: Disable "${patternDisplayName(patternId)}" check`,
        vscode.CodeActionKind.QuickFix
      );
      action.command = {
        command: "renderguard.disablePattern",
        title: `Disable ${patternDisplayName(patternId)}`,
        arguments: [patternId],
      };
      actions.push(action);
    }

    return actions;
  }
}
