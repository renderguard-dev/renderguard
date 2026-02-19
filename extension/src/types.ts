import type * as vscode from "vscode";

export interface RenderIssue {
  message: string;
  range: vscode.Range;
  pattern: PatternId;
  severity: "high" | "medium" | "low";
  fix?: QuickFix;
}

export interface QuickFix {
  title: string;
  replacement: string;
  range: vscode.Range;
}

export type PatternId =
  | "inlineObjects"
  | "inlineFunctions"
  | "missingMemo"
  | "unstableKeys"
  | "unstableDeps"
  | "broadContext"
  | "derivedState"
  | "propsDrilling"
  | "liftedState";

export interface ComponentInfo {
  name: string;
  startLine: number;
  endLine: number;
  issues: RenderIssue[];
}

export interface PatternDetector {
  id: PatternId;
  detect(
    ast: import("@babel/types").File,
    document: vscode.TextDocument
  ): RenderIssue[];
}

export interface RenderGuardConfig {
  enable: boolean;
  severity: vscode.DiagnosticSeverity;
  enableCodeLens: boolean;
  patterns: Record<PatternId, boolean>;
}
