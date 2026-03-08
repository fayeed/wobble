# wobble

Prompt regression testing for LLMs. Run your prompts against real models, catch quality regressions before they reach production, and compare performance across providers.

```
wobble run              # run all tests
wobble watch            # re-run on file save
wobble compare          # side-by-side model comparison
wobble history          # trend across all runs
wobble baseline approve # lock current results as the new baseline
```

---

## Install

```bash
npm install -g wobble-cli
# or
pnpm add -g wobble-cli
```

Requires Node ≥ 18.

---

## Quick start

```bash
wobble init             # interactive setup — creates wobble.yaml + a prompt file
wobble run              # run against the API
wobble baseline approve # save results as baseline
# edit your prompt, then:
wobble run              # see regressions highlighted
```

Set your API key before running:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=...
```

---

## wobble.yaml reference

```yaml
version: 1

# ── Global defaults (all optional) ──────────────────────────────────────────
model: gpt-4o              # default model for all tests
provider: openai           # openai | anthropic | google | path/to/plugin.js
runs: 5                    # how many times to call the model per case (for flakiness)
concurrency: 5             # parallel API calls per case
threshold: 0.8             # fraction of runs that must pass (0.0–1.0); default 1.0

# Environment variables injected before any API calls
env:
  OPENAI_API_KEY: $OPENAI_API_KEY

# ── Guardrails ───────────────────────────────────────────────────────────────
limits:
  max_cost_per_run: 1.00        # abort if estimated cost exceeds this (USD)
  max_tokens_per_case: 512      # cap output tokens per model call
  timeout_per_run: 30000        # ms per model call
  regression_threshold: 0.05    # minimum pass-rate drop that counts as a regression

# ── Tests ────────────────────────────────────────────────────────────────────
tests:
  - id: summarise
    prompt_file: prompts/summarise.txt   # path relative to wobble.yaml
    model: gpt-4o-mini                   # overrides global model
    provider: openai                     # overrides global provider
    runs: 10
    threshold: 0.9
    tags: [smoke, summarisation]

    cases:
      - input: "The cat sat on the mat."
        expect:
          - type: max_length
            value: 20
            unit: words
          - type: contains
            value: cat
            case_sensitive: false

      - input: "{{article}}"             # {{variable}} interpolation
        variables:
          article: "Long article text…"
        expect:
          - type: llm_judge
            criteria: "Is the summary accurate and under 3 sentences?"
```

---

## Evaluator types

### `contains` / `not_contains`

```yaml
- type: contains
  value: "error"
  case_sensitive: false   # default true
```

### `starts_with` / `ends_with`

```yaml
- type: starts_with
  value: "Sure"
  case_sensitive: false
```

### `max_length`

```yaml
- type: max_length
  value: 100
  unit: chars   # chars (default) | words
```

### `regex`

```yaml
- type: regex
  value: '^\d{4}-\d{2}-\d{2}$'   # ISO date
```

### `json_schema`

```yaml
- type: json_schema
  schema:
    type: object
    required: [name, score]
    properties:
      name: { type: string }
      score: { type: number }
```

### `llm_judge` — pass/fail

```yaml
- type: llm_judge
  criteria: "Is the response polite and on-topic?"
  model: gpt-4o-mini     # optional; defaults to test model
  provider: openai
```

### `llm_judge` — rubric scoring

Score multiple dimensions 1–10, fail if weighted average is below threshold.

```yaml
- type: llm_judge
  criteria: "Evaluate this customer support reply."
  threshold: 7            # minimum weighted average to pass (default 7)
  rubric:
    - dimension: tone
      weight: 2
    - dimension: accuracy
      weight: 3
    - dimension: conciseness
      weight: 1
```

### `llm_judge` — few-shot calibration

Provide examples to anchor the judge's scoring to your expectations.

```yaml
- type: llm_judge
  criteria: "Is the answer correct?"
  examples:
    - input: "What is 2+2?"
      output: "4"
      pass: true
      reason: "Correct answer"
    - input: "What is 2+2?"
      output: "5"
      pass: false
      reason: "Wrong answer"
```

### `custom`

Point to a JS/TS module that exports an `evaluate` function.

```yaml
- type: custom
  evaluator: ./evaluators/my-check.js
```

```js
// my-check.js
export function evaluate(output, options) {
  return {
    passed: output.includes("expected phrase"),
    detail: "Custom check failed",
  };
}
```

---

## Multi-turn conversations

Use `turns` instead of `input` for multi-turn tests. Each turn has a `role` (`user`, `assistant`, or `system`) and `content`.

```yaml
cases:
  - turns:
      - role: user
        content: "Hi, I need help with my order."
      - role: assistant
        content: "Of course! What's your order number?"
      - role: user
        content: "It's 12345."
    expect:
      - type: contains
        value: "12345"
```

> **Google (Gemini) note:** The last turn must be `role: user`. An `assistant` turn last will cause a clear error.

---

## Variable interpolation

Use `{{variable_name}}` in prompt files and `input` strings. Variables are defined per-case.

```yaml
# prompts/reply.txt
You are a support agent for {{company}}. Be concise.
```

```yaml
cases:
  - input: "I need a refund for order {{order_id}}"
    variables:
      company: Acme Corp
      order_id: "99821"
    expect:
      - type: contains
        value: refund
```

---

## Commands

### `wobble run`

Run all tests (or a filtered subset) and print results.

```
wobble run [options]

Options:
  -c, --config <path>     Path to wobble.yaml (default: wobble.yaml)
  -t, --test <id>         Run a single test by id
      --tag <tag>         Run tests matching a tag
  -v, --verbose           Print model output and judge reasoning for each run
  -o, --output <format>   terminal (default) | json | junit
      --baseline <path>   Path to baseline file (default: .wobble/baseline.json)
      --write-baseline    Save current results as the new baseline, then exit 0
```

Exit code is `0` if all checks pass (and no regressions vs baseline), `1` otherwise.

### `wobble watch`

Re-run tests automatically on every save to `wobble.yaml` or any prompt file.

```
wobble watch [options]

Options:
  -c, --config <path>   Path to wobble.yaml (default: wobble.yaml)
  -t, --test <id>       Watch a single test
      --tag <tag>       Watch tests matching a tag
  -v, --verbose         Print model output
      --baseline <path> Path to baseline file (default: .wobble/baseline.json)
```

Press `Ctrl+C` to stop.

### `wobble compare`

Run the same test suite against multiple models in parallel and print a side-by-side table.

```
wobble compare --targets openai:gpt-4o,anthropic:claude-sonnet-4-6

Options:
  -c, --config <path>      Path to wobble.yaml (default: wobble.yaml)
  -m, --targets <list>     Comma-separated provider:model pairs (required)
  -t, --test <id>          Run a single test
      --tag <tag>          Filter by tag
  -o, --output <format>    terminal (default) | json
```

Model shorthand (provider inferred from name prefix):
```
gpt-4o               → openai:gpt-4o
claude-haiku-4-5-20251001  → anthropic:claude-haiku-4-5-20251001
gemini-2.0-flash     → google:gemini-2.0-flash
```

### `wobble baseline`

```
wobble baseline approve   Run tests and save results as baseline (always exits 0)
wobble baseline show      Print current baseline pass rates
wobble baseline show --json   Raw JSON dump
```

### `wobble history`

```
wobble history            Overall pass-rate trend across all recorded runs
wobble history --last 10  Show last 10 runs only
wobble history --json     Raw JSON

wobble history show \
  --test <id> \
  --input <input string> \
  --eval <eval type>      Per-check trend + first-regression detection
```

History is stored in `.wobble/history.jsonl` (append-only, safe to commit).

### `wobble init`

Interactive setup wizard. Asks about provider, model, flakiness settings, and whether you want an `llm_judge`. Generates `wobble.yaml` and a starter prompt file.

```
wobble init
wobble init --yes   # accept all defaults non-interactively
```

---

## Providers

| Provider | Env var | Example model |
|---|---|---|
| `openai` | `OPENAI_API_KEY` | `gpt-4o`, `gpt-4o-mini` |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| `google` | `GOOGLE_API_KEY` | `gemini-2.0-flash`, `gemini-1.5-pro` |
| `./plugin.js` | — | custom |

### Custom provider plugin

```js
// my-provider.js
export async function run({ system, messages, model, maxTokens, timeoutMs }) {
  // call your API here
  return {
    content: "the model response",
    usage: { inputTokens: 100, outputTokens: 50 },
  };
}
```

```yaml
provider: ./my-provider.js
model: my-model-name
```

---

## Baseline workflow

Baselines let you catch regressions between prompt edits.

```bash
# 1. Lock current results
wobble baseline approve

# 2. Edit your prompt
# 3. Run again — regressions are highlighted in red
wobble run

# 4. If the changes are intentional, re-approve
wobble baseline approve
```

Baseline is stored in `.wobble/baseline.json`. Commit it to track intent over time.

Regression detection uses pass rates (not just pass/fail), so a drop from 10/10 to 7/10 is caught. The threshold for what counts as a regression is configurable:

```yaml
limits:
  regression_threshold: 0.10   # flag if pass rate drops by more than 10pp
```

---

## CI integration

```yaml
# .github/workflows/wobble.yml
- name: Run wobble
  run: wobble run --output junit > results.xml
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

- name: Publish test results
  uses: mikepenz/action-junit-report@v4
  with:
    report_paths: results.xml
```

Exit code `1` on any failure or regression, `0` on clean pass — works with any CI system.

---

## `.wobble/` directory

```
.wobble/
  baseline.json    # locked pass rates — commit this
  history.jsonl    # append-only run log — commit this
```

Add to `.gitignore` only if you don't want history tracked. Committing both files gives you a full audit trail of when tests started failing.
