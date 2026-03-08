import fs from "fs";
import path from "path";
import type { RunResult } from "./types.js";

// Keyed by "testId::input::evalType" — stable across case/eval reordering.
// Using "::" as separator (single ":" can appear in testIds like "my-suite:case").
interface BaselineRecord {
  passed: boolean;
  evalType: string;
}

interface BaselineFile {
  version: 1;
  writtenAt: string;
  entries: Record<string, BaselineRecord>;
}

export interface Regression {
  testId: string;
  input: string;
  evalType: string;
}

export interface Improvement {
  testId: string;
  input: string;
  evalType: string;
}

export interface BaselineComparison {
  regressions: Regression[];
  improvements: Improvement[];
  newChecks: Array<{ testId: string; input: string; evalType: string }>;
  removedChecks: Array<{ testId: string; input: string; evalType: string }>;
}

function makeKey(testId: string, input: string, evalType: string): string {
  return `${testId}::${input}::${evalType}`;
}

function buildEntries(results: RunResult[]): Record<string, BaselineRecord> {
  const entries: Record<string, BaselineRecord> = {};
  for (const r of results) {
    for (const c of r.caseResults) {
      for (const e of c.evals) {
        const key = makeKey(r.testId, c.input, e.type);
        entries[key] = { passed: e.passed, evalType: e.type };
      }
    }
  }
  return entries;
}

export function writeBaseline(results: RunResult[], filePath: string): void {
  const dir = path.dirname(filePath);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });

  const file: BaselineFile = {
    version: 1,
    writtenAt: new Date().toISOString(),
    entries: buildEntries(results),
  };
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + "\n", "utf-8");
}

export function loadBaseline(filePath: string): BaselineFile | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    // Accept both the new versioned format and the legacy flat array
    if (Array.isArray(parsed)) {
      // Legacy: [{testId, caseIndex, evalIndex, input, evalType, passed}]
      const entries: Record<string, BaselineRecord> = {};
      for (const e of parsed as Array<{ testId: string; input: string; evalType: string; passed: boolean }>) {
        if (e.testId && e.evalType) {
          entries[makeKey(e.testId, e.input ?? "", e.evalType)] = { passed: e.passed, evalType: e.evalType };
        }
      }
      return { version: 1, writtenAt: "", entries };
    }
    return parsed as BaselineFile;
  } catch {
    return null;
  }
}

export function compareBaseline(baseline: BaselineFile, current: RunResult[]): BaselineComparison {
  const currentEntries = buildEntries(current);

  const regressions: Regression[] = [];
  const improvements: Improvement[] = [];
  const newChecks: BaselineComparison["newChecks"] = [];
  const removedChecks: BaselineComparison["removedChecks"] = [];

  // Checks that exist now
  for (const [key, cur] of Object.entries(currentEntries)) {
    const base = baseline.entries[key];
    if (!base) {
      const [testId, input, evalType] = key.split("::");
      newChecks.push({ testId, input, evalType });
    } else if (base.passed && !cur.passed) {
      const [testId, input, evalType] = key.split("::");
      regressions.push({ testId, input, evalType });
    } else if (!base.passed && cur.passed) {
      const [testId, input, evalType] = key.split("::");
      improvements.push({ testId, input, evalType });
    }
  }

  // Checks in baseline that no longer exist
  for (const key of Object.keys(baseline.entries)) {
    if (!currentEntries[key]) {
      const [testId, input, evalType] = key.split("::");
      removedChecks.push({ testId, input, evalType });
    }
  }

  return { regressions, improvements, newChecks, removedChecks };
}

// Kept for callers that only need the regression list
export function findRegressions(baseline: BaselineFile, current: RunResult[]): Regression[] {
  return compareBaseline(baseline, current).regressions;
}
