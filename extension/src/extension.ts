import * as vscode from "vscode";
import { RenderGuardAnalyzer } from "./analyzer";
import { RenderGuardCodeLensProvider } from "./codelens";
import { RenderGuardCodeActionProvider } from "./codeactions";
import { RenderGuardTreeProvider } from "./treeview";
import { issueToDiagnostic } from "./utils/diagnostics";
import type { RenderGuardConfig, PatternId, ComponentInfo } from "./types";

const SUPPORTED_LANGUAGES = [
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
];

export function activate(context: vscode.ExtensionContext): void {
  const analyzer = new RenderGuardAnalyzer();
  const diagnostics = vscode.languages.createDiagnosticCollection("RenderGuard");
  let config = readConfig();

  const codeLensProvider = new RenderGuardCodeLensProvider(analyzer, config);
  const codeActionProvider = new RenderGuardCodeActionProvider();
  const treeProvider = new RenderGuardTreeProvider();

  const selector = SUPPORTED_LANGUAGES.map((lang) => ({
    language: lang,
    scheme: "file",
  }));

  context.subscriptions.push(
    diagnostics,
    vscode.languages.registerCodeLensProvider(selector, codeLensProvider),
    vscode.languages.registerCodeActionsProvider(selector, codeActionProvider, {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }),
    vscode.window.registerTreeDataProvider("renderguard.componentTree", treeProvider)
  );

  const analyzeDocument = (document: vscode.TextDocument) => {
    if (!config.enable) {
      diagnostics.delete(document.uri);
      treeProvider.clear();
      return;
    }
    if (!SUPPORTED_LANGUAGES.includes(document.languageId)) return;

    const { issues, components } = analyzer.analyze(document, config.patterns);
    diagnostics.set(
      document.uri,
      issues.map((issue) => issueToDiagnostic(issue, config.severity))
    );
    codeActionProvider.updateSeverity(config.severity);
    codeActionProvider.updateIssues(document.uri.toString(), issues);

    const fileName = document.uri.path.split("/").pop() ?? document.uri.path;
    treeProvider.refresh(fileName, components);
  };

  let analyzeTimeout: ReturnType<typeof setTimeout> | undefined;
  const debouncedAnalyze = (document: vscode.TextDocument) => {
    if (analyzeTimeout) clearTimeout(analyzeTimeout);
    analyzeTimeout = setTimeout(() => analyzeDocument(document), 500);
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(analyzeDocument),
    vscode.workspace.onDidSaveTextDocument(analyzeDocument),
    vscode.workspace.onDidChangeTextDocument((e) => debouncedAnalyze(e.document)),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        analyzeDocument(editor.document);
      } else {
        treeProvider.clear();
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnostics.delete(doc.uri);
    }),
    { dispose: () => { if (analyzeTimeout) clearTimeout(analyzeTimeout); } }
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("renderguard")) {
        config = readConfig();
        codeLensProvider.updateConfig(config);
        vscode.workspace.textDocuments.forEach(analyzeDocument);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "renderguard.showComponentIssues",
      (component: ComponentInfo) => {
        if (component.issues.length === 0) {
          vscode.window.showInformationMessage(
            `${component.name}: No re-render risks detected.`
          );
          return;
        }
        vscode.window.showQuickPick(
          component.issues.map((i) => `[${i.severity.toUpperCase()}] ${i.message}`),
          {
            title: `RenderGuard: ${component.name} (${component.issues.length} issues)`,
            canPickMany: false,
          }
        );
      }
    ),

    vscode.commands.registerCommand(
      "renderguard.disablePattern",
      async (patternId: PatternId) => {
        const wsConfig = vscode.workspace.getConfiguration("renderguard");
        const patterns = wsConfig.get<Record<string, boolean>>("patterns") ?? {};
        patterns[patternId] = false;
        await wsConfig.update("patterns", patterns, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(
          `RenderGuard: Disabled "${patternId}" check.`
        );
      }
    ),

    vscode.commands.registerCommand("renderguard.analyzeFile", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) analyzeDocument(editor.document);
    }),

    vscode.commands.registerCommand("renderguard.refreshTree", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) analyzeDocument(editor.document);
    })
  );

  // Analyze already-open documents on activation
  vscode.workspace.textDocuments.forEach(analyzeDocument);
}

export function deactivate(): void {}

function readConfig(): RenderGuardConfig {
  const cfg = vscode.workspace.getConfiguration("renderguard");

  const severityMap: Record<string, vscode.DiagnosticSeverity> = {
    error: vscode.DiagnosticSeverity.Error,
    warning: vscode.DiagnosticSeverity.Warning,
    information: vscode.DiagnosticSeverity.Information,
    hint: vscode.DiagnosticSeverity.Hint,
  };

  return {
    enable: cfg.get<boolean>("enable", true),
    severity:
      severityMap[cfg.get<string>("severity", "warning")!] ??
      vscode.DiagnosticSeverity.Warning,
    enableCodeLens: cfg.get<boolean>("enableCodeLens", true),
    patterns: cfg.get("patterns", {
      inlineObjects: true,
      inlineFunctions: true,
      missingMemo: true,
      unstableKeys: true,
      unstableDeps: true,
      broadContext: true,
      derivedState: true,
      propsDrilling: true,
      liftedState: true,
    }),
  };
}
