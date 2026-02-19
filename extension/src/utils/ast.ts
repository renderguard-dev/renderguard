import { parse } from "@babel/parser";
import type { File } from "@babel/types";

export function parseDocument(text: string, isTypeScript: boolean): File | null {
  try {
    return parse(text, {
      sourceType: "module",
      plugins: [
        "jsx",
        ...(isTypeScript ? (["typescript"] as const) : []),
        "classProperties",
        "optionalChaining",
        "nullishCoalescingOperator",
        "decorators-legacy",
      ],
      errorRecovery: true,
    });
  } catch {
    return null;
  }
}

export function isTypeScriptFile(languageId: string): boolean {
  return languageId === "typescript" || languageId === "typescriptreact";
}
