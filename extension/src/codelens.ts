import * as vscode from "vscode";
import { RenderGuardAnalyzer } from "./analyzer";
import { calculateRiskScore, riskLabel } from "./utils/diagnostics";
import type { RenderGuardConfig } from "./types";

export class RenderGuardCodeLensProvider implements vscode.CodeLensProvider {
  private analyzer: RenderGuardAnalyzer;
  private config: RenderGuardConfig;
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(analyzer: RenderGuardAnalyzer, config: RenderGuardConfig) {
    this.analyzer = analyzer;
    this.config = config;
  }

  updateConfig(config: RenderGuardConfig): void {
    this.config = config;
    this._onDidChangeCodeLenses.fire();
  }

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!this.config.enable || !this.config.enableCodeLens) return [];

    const { components } = this.analyzer.analyze(document, this.config.patterns);
    const lenses: vscode.CodeLens[] = [];

    for (const component of components) {
      const score = calculateRiskScore(component.issues);
      const range = new vscode.Range(component.startLine, 0, component.startLine, 0);

      lenses.push(
        new vscode.CodeLens(range, {
          title: `$(shield) ${component.name}: ${riskLabel(score)}`,
          command: "renderguard.showComponentIssues",
          arguments: [component],
        })
      );
    }

    return lenses;
  }
}
