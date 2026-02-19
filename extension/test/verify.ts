/**
 * Standalone verification script that runs the detectors outside of VS Code.
 * Usage: npx tsx --require ./test/register-shim.cjs test/verify.ts
 */
import * as fs from "fs";
import * as path from "path";
import { parse } from "@babel/parser";
import { inlineObjectsDetector } from "../src/patterns/inlineObjects";
import { inlineFunctionsDetector } from "../src/patterns/inlineFunctions";
import { missingMemoDetector } from "../src/patterns/missingMemo";
import { unstableKeysDetector } from "../src/patterns/unstableKeys";
import { unstableDepsDetector } from "../src/patterns/unstableDeps";
import { broadContextDetector } from "../src/patterns/broadContext";

const fixtureFile = path.join(__dirname, "fixtures", "sample.tsx");
const code = fs.readFileSync(fixtureFile, "utf-8");

const ast = parse(code, {
  sourceType: "module",
  plugins: ["jsx", "typescript"],
  errorRecovery: true,
});

const lines = code.split("\n");

const mockDocument = {
  getText(range?: any) {
    if (!range) return code;
    const sl = range.startLine ?? range.start?.line ?? 0;
    const el = range.endLine ?? range.end?.line ?? sl;
    const sc = range.startChar ?? range.start?.character ?? 0;
    const ec = range.endChar ?? range.end?.character ?? lines[el]?.length ?? 0;
    if (sl === el) return lines[sl]?.substring(sc, ec) ?? "";
    const result = [lines[sl]?.substring(sc) ?? ""];
    for (let i = sl + 1; i < el; i++) result.push(lines[i] ?? "");
    result.push(lines[el]?.substring(0, ec) ?? "");
    return result.join("\n");
  },
  languageId: "typescriptreact",
} as any;

const detectors = [
  inlineObjectsDetector,
  inlineFunctionsDetector,
  missingMemoDetector,
  unstableKeysDetector,
  unstableDepsDetector,
  broadContextDetector,
];

console.log("=== RenderGuard Verification ===\n");
console.log(`Analyzing: ${fixtureFile}\n`);

let total = 0;
for (const detector of detectors) {
  const issues = detector.detect(ast, mockDocument);
  total += issues.length;
  console.log(`[${detector.id}] ${issues.length} issue(s)`);
  for (const issue of issues) {
    console.log(`  Line ${issue.range.start.line + 1}: ${issue.message}`);
  }
  console.log();
}

console.log(`Total: ${total} issue(s) detected.\n`);

const expected: Record<string, number> = {
  inlineObjects: 1,
  inlineFunctions: 1,
  missingMemo: 3,   // BadKeys, PureChild, BadProvider all accept props without memo
  unstableKeys: 1,
  unstableDeps: 2,
  broadContext: 2,   // inline Provider value + broad consumer
};

let pass = true;
for (const detector of detectors) {
  const issues = detector.detect(ast, mockDocument);
  const exp = expected[detector.id] ?? 0;
  if (issues.length !== exp) {
    console.error(`FAIL: ${detector.id} expected ${exp} but got ${issues.length}`);
    pass = false;
  }
}

if (pass) {
  console.log("✓ All detectors produced expected results.");
} else {
  console.error("✗ Some detectors did not match expectations.");
  process.exit(1);
}
