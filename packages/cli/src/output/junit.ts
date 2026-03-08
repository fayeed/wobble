import type { RunResult } from "../types.js";

interface JUnitOptions {
  results: RunResult[];
  regressions: Array<{ testId: string; input: string; evalType: string }>;
  passed: number;
  failed: number;
  totalCost: number;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildJUnit(opts: JUnitOptions): string {
  const { results, regressions } = opts;

  const regressionKeys = new Set(
    regressions.map((r) => `${r.testId}::${r.input}::${r.evalType}`)
  );

  const suites: string[] = [];
  let totalTests = 0;
  let totalFailures = 0;

  for (const runResult of results) {
    const cases: string[] = [];
    let suiteTests = 0;
    let suiteFailures = 0;

    for (const caseResult of runResult.caseResults) {
      for (const evalResult of caseResult.evals) {
        suiteTests++;
        totalTests++;

        const name = escapeXml(`${caseResult.input} [${evalResult.type}]`);
        const classname = escapeXml(runResult.testId);
        const isRegression = regressionKeys.has(
          `${runResult.testId}::${caseResult.input}::${evalResult.type}`
        );

        if (!evalResult.passed) {
          suiteFailures++;
          totalFailures++;
          const detail = evalResult.detail ? escapeXml(evalResult.detail) : "";
          const regressNote = isRegression ? " (regression vs baseline)" : "";
          cases.push(
            `    <testcase name="${name}" classname="${classname}">` +
            `\n      <failure message="${escapeXml(evalResult.type + " check failed" + regressNote)}">${detail}</failure>` +
            `\n    </testcase>`
          );
        } else {
          cases.push(
            `    <testcase name="${name}" classname="${classname}"/>`
          );
        }
      }
    }

    // Surface test-level errors (e.g. prompt file not found)
    if (runResult.error) {
      suiteTests++;
      suiteFailures++;
      totalTests++;
      totalFailures++;
      cases.push(
        `    <testcase name="(setup)" classname="${escapeXml(runResult.testId)}">` +
        `\n      <error message="${escapeXml(runResult.error)}"/>` +
        `\n    </testcase>`
      );
    }

    suites.push(
      `  <testsuite name="${escapeXml(runResult.testId)}" tests="${suiteTests}" failures="${suiteFailures}">` +
      (cases.length ? "\n" + cases.join("\n") + "\n  " : "") +
      `</testsuite>`
    );
  }

  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<testsuites tests="${totalTests}" failures="${totalFailures}">`,
    ...suites,
    `</testsuites>`,
  ];

  return lines.join("\n") + "\n";
}
