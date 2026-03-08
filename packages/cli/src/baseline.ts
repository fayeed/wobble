import fs from "fs";
import type { RunResult } from "./types.js";

export interface BaselineEntry {
  testId: string;
  caseIndex: number;
  evalIndex: number;
  input: string;
  evalType: string;
  passed: boolean;
}

export type Baseline = BaselineEntry[];

export interface Regression {
  testId: string;
  input: string;
  evalType: string;
}

export function writeBaseline(results: RunResult[], path: string): void {
  const entries: Baseline = [];
  for (const r of results) {
    for (const c of r.caseResults) {
      for (let ei = 0; ei < c.evals.length; ei++) {
        entries.push({
          testId: r.testId,
          caseIndex: c.caseIndex,
          evalIndex: ei,
          input: c.input,
          evalType: c.evals[ei].type,
          passed: c.evals[ei].passed,
        });
      }
    }
  }
  fs.writeFileSync(path, JSON.stringify(entries, null, 2), "utf-8");
}

export function loadBaseline(path: string): Baseline | null {
  if (!fs.existsSync(path)) return null;
  try {
    return JSON.parse(fs.readFileSync(path, "utf-8")) as Baseline;
  } catch {
    return null;
  }
}

export function findRegressions(baseline: Baseline, current: RunResult[]): Regression[] {
  // Build a lookup: "testId:caseIndex:evalIndex" -> passed
  const baselineMap = new Map<string, boolean>();
  for (const e of baseline) {
    baselineMap.set(`${e.testId}:${e.caseIndex}:${e.evalIndex}`, e.passed);
  }

  const regressions: Regression[] = [];
  for (const r of current) {
    for (const c of r.caseResults) {
      for (let ei = 0; ei < c.evals.length; ei++) {
        const key = `${r.testId}:${c.caseIndex}:${ei}`;
        const wasPassing = baselineMap.get(key);
        if (wasPassing === true && !c.evals[ei].passed) {
          regressions.push({ testId: r.testId, input: c.input, evalType: c.evals[ei].type });
        }
      }
    }
  }
  return regressions;
}
