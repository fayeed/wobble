# wobble examples

Four self-contained tests demonstrating core wobble features.

## Setup

```bash
cd example
export OPENAI_API_KEY=sk-...
```

## Run all examples

```bash
wobble run
```

## Run a single test

```bash
wobble run --test summarise
wobble run --test json-extractor
wobble run --test support-agent
wobble run --test multi-turn-support
```

## Run by tag

```bash
wobble run --tag smoke       # summarise + json-extractor
wobble run --tag llm-judge   # support-agent
wobble run --tag multi-turn  # multi-turn-support
```

## What each test covers

| Test | Feature |
|---|---|
| `summarise` | `max_length`, `contains`, `not_contains`, `llm_judge` pass/fail |
| `json-extractor` | `json_schema`, single run, strict threshold |
| `support-agent` | `{{variable}}` interpolation, `llm_judge` rubric scoring |
| `multi-turn-support` | `turns:` multi-turn conversation |

## Compare models

```bash
wobble compare --targets openai:gpt-4o-mini,openai:gpt-4o
```

## Save a baseline, then check for regressions

```bash
wobble baseline approve
# edit a prompt, then:
wobble run
```
