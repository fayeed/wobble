import fs from "fs";
import path from "path";
import type { RunResult } from "./types.js";

// Keyed by "testId::input::evalType" — stable across case/eval reordering.
// Using "::" as separator (single ":" can appear in testIds like "my-suite:case").
interface BaselineRecord {
  passCount: number;
  totalRuns: number;
  // Derived pass rate = passCount / totalRuns, stored for human readability
  passRate: number;
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
  baselineRate: number;
  currentRate: number;
}

export interface Improvement {
  testId: string;
  input: string;
  evalType: string;
  baselineRate: number;
  currentRate: number;
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
        const passCount = e.passCount ?? (e.passed ? 1 : 0);
        const totalRuns = e.totalRuns ?? 1;
        entries[key] = {
          passCount,
          totalRuns,
          passRate: totalRuns > 0 ? passCount / totalRuns : 0,
          evalType: e.type,
        };
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

    // Legacy: flat array with only passed: boolean (pre-versioned format)
    if (Array.isArray(parsed)) {
      const entries: Record<string, BaselineRecord> = {};
      for (const e of parsed as Array<{ testId: string; input: string; evalType: string; passed: boolean }>) {
        if (e.testId && e.evalType) {
          const passCount = e.passed ? 1 : 0;
          entries[makeKey(e.testId, e.input ?? "", e.evalType)] = {
            passCount, totalRuns: 1, passRate: passCount, evalType: e.evalType,
          };
        }
      }
      return { version: 1, writtenAt: "", entries };
    }

    // v1 entries that predate passCount/totalRuns (only had passed: boolean)
    if (parsed?.version === 1 && parsed.entries) {
      const entries: Record<string, BaselineRecord> = {};
      for (const [key, rec] of Object.entries(parsed.entries as Record<string, {
        passed?: boolean; passCount?: number; totalRuns?: number; passRate?: number; evalType: string;
      }>)) {
        const passCount = rec.passCount ?? (rec.passed ? 1 : 0);
        const totalRuns = rec.totalRuns ?? 1;
        entries[key] = {
          passCount,
          totalRuns,
          passRate: rec.passRate ?? (totalRuns > 0 ? passCount / totalRuns : 0),
          evalType: rec.evalType,
        };
      }
      return { version: 1, writtenAt: parsed.writtenAt ?? "", entries };
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

  for (const [key, cur] of Object.entries(currentEntries)) {
    const base = baseline.entries[key];
    if (!base) {
      const [testId, input, evalType] = key.split("::");
      newChecks.push({ testId, input, evalType });
      continue;
    }

    // Use a 5pp threshold to avoid flagging float noise when runs/config are identical.
    const delta = cur.passRate - base.passRate;
    const [testId, input, evalType] = key.split("::");

    if (delta < -0.05) {
      regressions.push({ testId, input, evalType, baselineRate: base.passRate, currentRate: cur.passRate });
    } else if (delta > 0.05) {
      improvements.push({ testId, input, evalType, baselineRate: base.passRate, currentRate: cur.passRate });
    }
  }

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
