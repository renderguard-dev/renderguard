import * as vscode from "vscode";
import type { ComponentInfo, RenderIssue } from "./types";
import { calculateRiskScore, riskLabel, patternDisplayName } from "./utils/diagnostics";

type TreeItem = FileItem | ComponentItem | IssueItem;

class FileItem extends vscode.TreeItem {
  constructor(
    public readonly fileName: string,
    public readonly components: ComponentInfo[]
  ) {
    super(fileName, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon("file-code");
    this.contextValue = "file";
  }
}

class ComponentItem extends vscode.TreeItem {
  constructor(public readonly component: ComponentInfo) {
    const score = calculateRiskScore(component.issues);
    const hasIssues = component.issues.length > 0;

    super(
      `${component.name}: ${riskLabel(score)}`,
      hasIssues
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    this.iconPath = new vscode.ThemeIcon(
      score === 0 ? "pass" : score <= 5 ? "warning" : "error",
      score === 0
        ? new vscode.ThemeColor("testing.iconPassed")
        : score <= 5
          ? new vscode.ThemeColor("list.warningForeground")
          : new vscode.ThemeColor("list.errorForeground")
    );

    this.command = {
      command: "revealLine",
      title: "Go to component",
      arguments: [{ lineNumber: component.startLine + 1, at: "center" }],
    };

    this.tooltip = `${component.name} — ${component.issues.length} issue(s), risk score ${score}`;
    this.contextValue = "component";
  }
}

class IssueItem extends vscode.TreeItem {
  constructor(public readonly issue: RenderIssue) {
    super(issue.message, vscode.TreeItemCollapsibleState.None);

    const iconName =
      issue.severity === "high" ? "error" : issue.severity === "medium" ? "warning" : "info";
    const color =
      issue.severity === "high"
        ? new vscode.ThemeColor("list.errorForeground")
        : issue.severity === "medium"
          ? new vscode.ThemeColor("list.warningForeground")
          : new vscode.ThemeColor("list.deemphasizedForeground");

    this.iconPath = new vscode.ThemeIcon(iconName, color);
    this.description = patternDisplayName(issue.pattern);

    this.command = {
      command: "revealLine",
      title: "Go to issue",
      arguments: [{ lineNumber: issue.range.start.line + 1, at: "center" }],
    };

    this.tooltip = `[${issue.severity.toUpperCase()}] ${issue.message}`;
    this.contextValue = "issue";
  }
}

export class RenderGuardTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private fileName = "";
  private components: ComponentInfo[] = [];

  refresh(fileName: string, components: ComponentInfo[]): void {
    this.fileName = fileName;
    this.components = components;
    this._onDidChangeTreeData.fire();
  }

  clear(): void {
    this.fileName = "";
    this.components = [];
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      if (this.components.length === 0) return [];
      return [new FileItem(this.fileName, this.components)];
    }

    if (element instanceof FileItem) {
      return element.components.map((c) => new ComponentItem(c));
    }

    if (element instanceof ComponentItem) {
      return element.component.issues.map((i) => new IssueItem(i));
    }

    return [];
  }
}
