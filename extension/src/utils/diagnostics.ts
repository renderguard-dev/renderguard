import * as vscode from "vscode";
import type { RenderIssue, PatternId } from "../types";

const SEVERITY_MAP: Record<RenderIssue["severity"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function issueToDiagnostic(
  issue: RenderIssue,
  configSeverity: vscode.DiagnosticSeverity
): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    issue.range,
    issue.message,
    configSeverity
  );
  diagnostic.source = "RenderGuard";
  diagnostic.code = issue.pattern;
  return diagnostic;
}

export function calculateRiskScore(issues: RenderIssue[]): number {
  return issues.reduce((score, issue) => score + SEVERITY_MAP[issue.severity], 0);
}

export function riskLabel(score: number): string {
  if (score === 0) return "✓ No re-render risks";
  if (score <= 2) return `⚡ Low risk (${score})`;
  if (score <= 5) return `⚠ Medium risk (${score})`;
  return `🔴 High risk (${score})`;
}

export function patternDisplayName(id: PatternId): string {
  const names: Record<PatternId, string> = {
    inlineObjects: "Inline Object/Array",
    inlineFunctions: "Inline Function",
    missingMemo: "Missing React.memo",
    unstableKeys: "Unstable Key",
    unstableDeps: "Unstable Dependencies",
    broadContext: "Broad Context Consumer",
  };
  return names[id];
}
