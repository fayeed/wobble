import fs from "fs";
import path from "path";
import type { RunResult } from "./types.js";

// Each run appends one HistoryEntry to .wobble/history.jsonl (newline-delimited JSON).
// JSONL means we can append without reading/parsing the whole file, and old entries
// are never rewritten — making it safe to commit to version control.

export interface HistoryEvalSnapshot {
  evalType: string;
  passCount: number;
  totalRuns: number;
  passRate: number;
  passed: boolean;
}

export interface HistoryCaseSnapshot {
  input: string;
  evals: HistoryEvalSnapshot[];
}

export interface HistoryTestSnapshot {
  testId: string;
  cases: HistoryCaseSnapshot[];
  error?: string;
}

export interface HistoryEntry {
  runAt: string;           // ISO timestamp
  passed: number;
  failed: number;
  totalCost: number;
  tests: HistoryTestSnapshot[];
}

export interface TrendPoint {
  runAt: string;
  passRate: number;        // fraction of evals that passed this run (across all tests)
  passed: number;
  failed: number;
  cost: number;
}

export interface EvalTrendPoint {
  runAt: string;
  passCount: number;
  totalRuns: number;
  passRate: number;
  passed: boolean;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function appendHistory(
  results: RunResult[],
  passed: number,
  failed: number,
  totalCost: number,
  historyPath: string
): void {
  const dir = path.dirname(historyPath);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });

  const entry: HistoryEntry = {
    runAt: new Date().toISOString(),
    passed,
    failed,
    totalCost,
    tests: results.map((r) => ({
      testId: r.testId,
      error: r.error,
      cases: r.caseResults.map((c) => ({
        input: c.input,
        evals: c.evals.map((e) => ({
          evalType: e.type,
          passCount: e.passCount ?? (e.passed ? 1 : 0),
          totalRuns: e.totalRuns ?? 1,
          passRate: e.totalRuns ? (e.passCount ?? (e.passed ? 1 : 0)) / e.totalRuns : (e.passed ? 1 : 0),
          passed: e.passed,
        })),
      })),
    })),
  };

  fs.appendFileSync(historyPath, JSON.stringify(entry) + "\n", "utf-8");
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function loadHistory(historyPath: string): HistoryEntry[] {
  if (!fs.existsSync(historyPath)) return [];
  const lines = fs.readFileSync(historyPath, "utf-8").split("\n").filter(Boolean);
  const entries: HistoryEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as HistoryEntry);
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}

// ─── Query ────────────────────────────────────────────────────────────────────

/** Overall pass-rate trend across all entries. */
export function overallTrend(entries: HistoryEntry[]): TrendPoint[] {
  return entries.map((e) => {
    const total = e.passed + e.failed;
    return {
      runAt: e.runAt,
      passRate: total > 0 ? e.passed / total : 0,
      passed: e.passed,
      failed: e.failed,
      cost: e.totalCost,
    };
  });
}

/** Per-eval trend for a specific testId + input + evalType. */
export function evalTrend(
  entries: HistoryEntry[],
  testId: string,
  input: string,
  evalType: string
): EvalTrendPoint[] {
  const points: EvalTrendPoint[] = [];
  for (const entry of entries) {
    const test = entry.tests.find((t) => t.testId === testId);
    if (!test) continue;
    const caseSnap = test.cases.find((c) => c.input === input);
    if (!caseSnap) continue;
    const evalSnap = caseSnap.evals.find((e) => e.evalType === evalType);
    if (!evalSnap) continue;
    points.push({
      runAt: entry.runAt,
      passCount: evalSnap.passCount,
      totalRuns: evalSnap.totalRuns,
      passRate: evalSnap.passRate,
      passed: evalSnap.passed,
    });
  }
  return points;
}

/** Find the first entry where a specific eval started failing (after passing). */
export function findFirstFailure(
  entries: HistoryEntry[],
  testId: string,
  input: string,
  evalType: string
): HistoryEntry | null {
  const trend = evalTrend(entries, testId, input, evalType);
  let wasPassing = false;
  for (let i = 0; i < trend.length; i++) {
    if (trend[i].passed) {
      wasPassing = true;
    } else if (wasPassing) {
      return entries[i];
    }
  }
  return null;
}
