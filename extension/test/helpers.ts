import { parse } from "@babel/parser";
import type { File } from "@babel/types";
import type { PatternDetector, RenderIssue } from "../src/types";

export function parseCode(code: string): File {
  return parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
    errorRecovery: true,
  });
}

export function mockDocument(code: string) {
  const lines = code.split("\n");
  return {
    getText(range?: any) {
      if (!range) return code;
      const sl = range.startLine ?? range.start?.line ?? 0;
      const el = range.endLine ?? range.end?.line ?? sl;
      const sc = range.startChar ?? range.start?.character ?? 0;
      const ec =
        range.endChar ?? range.end?.character ?? lines[el]?.length ?? 0;
      if (sl === el) return lines[sl]?.substring(sc, ec) ?? "";
      const result = [lines[sl]?.substring(sc) ?? ""];
      for (let i = sl + 1; i < el; i++) result.push(lines[i] ?? "");
      result.push(lines[el]?.substring(0, ec) ?? "");
      return result.join("\n");
    },
    languageId: "typescriptreact",
  } as any;
}

export function detectIssues(
  detector: PatternDetector,
  code: string
): RenderIssue[] {
  const ast = parseCode(code);
  const doc = mockDocument(code);
  return detector.detect(ast, doc);
}
