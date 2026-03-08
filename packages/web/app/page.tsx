import Nav from "./components/Nav";
import Terminal from "./components/Terminal";
import FadeIn from "./components/FadeIn";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Tag({ children, color = "var(--lime)", bg = "var(--lime-dim)" }: {
  children: React.ReactNode; color?: string; bg?: string;
}) {
  return (
    <span style={{
      display:"inline-block",
      fontFamily:"var(--mono)", fontSize:10, fontWeight:700,
      letterSpacing:".09em", textTransform:"uppercase",
      color, background:bg,
      padding:"4px 11px", borderRadius:20,
      border:`1px solid ${color}30`,
    }}>{children}</span>
  );
}

// ─── Demo visuals for bento cards ─────────────────────────────────────────────

function DemoFlakiness() {
  const runs = [1,1,0,1,1,1,0,1,1,1];
  return (
    <div>
      <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:10 }}>
        {runs.map((v,i) => (
          <div key={i} style={{
            width:24, height:24, borderRadius:5, flexShrink:0,
            background: v ? "var(--lime)" : "var(--b2)",
          }}/>
        ))}
      </div>
      <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text3)" }}>
        runs: 10 · threshold: 0.7 ·{" "}
        <span style={{ color:"var(--lime)", fontWeight:700 }}>8/10 ✓ pass</span>
      </div>
    </div>
  );
}

function DemoCompare() {
  const rows = [
    { model:"gpt-4o",       pct:100, color:"var(--lime)"  },
    { model:"claude-haiku", pct:88,  color:"var(--teal)"  },
    { model:"gemini-flash", pct:62,  color:"var(--amber)" },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {rows.map(r => (
        <div key={r.model} style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text3)", width:100, flexShrink:0 }}>{r.model}</span>
          <div style={{ flex:1, height:5, background:"var(--b2)", borderRadius:3, overflow:"hidden" }}>
            <div style={{ width:`${r.pct}%`, height:"100%", background:r.color, borderRadius:3 }}/>
          </div>
          <span style={{ fontFamily:"var(--mono)", fontSize:11, color:r.color, fontWeight:700, width:36, textAlign:"right" }}>{r.pct}%</span>
        </div>
      ))}
    </div>
  );
}

function DemoHistory() {
  const vals = [72,78,75,83,80,88,85,92,89,100];
  const max = 100;
  const h = 56;
  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-end", gap:5, height:h }}>
        {vals.map((v,i) => (
          <div key={i} style={{
            flex:1, height:(v/max)*h, borderRadius:"3px 3px 0 0",
            background: i === vals.length-1
              ? "var(--lime)"
              : `rgba(200,255,0,${0.15+(i/vals.length)*0.35})`,
          }}/>
        ))}
      </div>
      <div style={{
        display:"flex", justifyContent:"space-between",
        fontFamily:"var(--mono)", fontSize:10, color:"var(--text4)", marginTop:8,
      }}>
        <span>10 runs ago</span>
        <span style={{ color:"var(--lime)", fontWeight:700 }}>100% now</span>
      </div>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const EVALUATORS = [
  { type:"contains",    alias:"not_contains",  color:"var(--teal)",   colorDim:"var(--teal-dim)",   desc:"Substring present or absent in output. Optional case-insensitive flag.",  yaml:'type: contains\nvalue: "deadline"\ncase_sensitive: false' },
  { type:"starts_with", alias:"ends_with",     color:"var(--lime)",   colorDim:"var(--lime-dim)",   desc:"Prefix or suffix assertion. Useful for structured response formats.",       yaml:'type: ends_with\nvalue: "."' },
  { type:"max_length",  alias:null,            color:"var(--amber)",  colorDim:"var(--amber-dim)",  desc:"Cap output in chars or words. Catches verbosity regressions early.",        yaml:'type: max_length\nvalue: 100\nunit: words' },
  { type:"regex",       alias:null,            color:"var(--purple)", colorDim:"var(--purple-dim)", desc:"Full regex match — ISO dates, IDs, phone numbers, structured patterns.",    yaml:"type: regex\nvalue: '^\\d{4}-\\d{2}-\\d{2}$'" },
  { type:"json_schema", alias:null,            color:"var(--green)",  colorDim:"var(--green-dim)",  desc:"Assert valid JSON conforming to a schema. Catches structural regressions.",  yaml:'type: json_schema\nschema:\n  type: object\n  required: [name, id]' },
  { type:"llm_judge",   alias:"pass/fail",     color:"var(--pink)",   colorDim:"var(--pink-dim)",   desc:"Natural-language criterion evaluated by a model. Supports few-shot examples.", yaml:'type: llm_judge\ncriteria: "Is it polite?"' },
  { type:"llm_judge",   alias:"rubric",        color:"var(--pink)",   colorDim:"var(--pink-dim)",   desc:"Score dimensions 1–10 with weights. Pass if weighted avg ≥ threshold.",     yaml:'type: llm_judge\nthreshold: 7\nrubric:\n  - dimension: tone\n    weight: 2' },
  { type:"custom",      alias:null,            color:"var(--text2)",  colorDim:"rgba(136,136,136,0.07)", desc:"Any JS/TS module exporting evaluate(). Fully extensible — no limits.",   yaml:'type: custom\nevaluator: ./my-check.js' },
];

const COMMANDS = [
  { name:"wobble init",             desc:"Interactive setup. Generates wobble.yaml and a starter prompt file.",       color:"var(--lime)" },
  { name:"wobble run",              desc:"Run tests, compare to baseline. Terminal / JSON / JUnit output.",            color:"var(--lime)" },
  { name:"wobble watch",            desc:"Re-run on every file save. 300ms debounce. Baseline diff after each run.",  color:"var(--teal)" },
  { name:"wobble compare",          desc:"Run suite against N models concurrently. Pass-rates + cost table.",          color:"var(--teal)" },
  { name:"wobble baseline approve", desc:"Lock current pass rates as baseline. Always exits 0.",                       color:"var(--amber)" },
  { name:"wobble baseline show",    desc:"Print stored baseline rates by test. --json for raw output.",                color:"var(--amber)" },
  { name:"wobble history",          desc:"Overall pass-rate trend across all recorded runs. --last N to limit.",       color:"var(--purple)" },
  { name:"wobble history show",     desc:"Per-check trend + first-regression detection. --test --input --eval.",      color:"var(--purple)" },
];

const ROADMAP = [
  { name:"Web dashboard",     desc:"Browser UI for history, trend charts, baseline diffs. Reads .wobble/ locally.", color:"var(--purple)" },
  { name:"Dataset support",   desc:"Load cases from CSV or JSONL. Run against hundreds of production inputs.",       color:"var(--teal)" },
  { name:"Prompt chaining",   desc:"Wire one prompt's output into another's input. Test pipelines end-to-end.",      color:"var(--pink)" },
  { name:"Live watch TUI",    desc:"Full-screen terminal with live spinners per test, real-time rows.",               color:"var(--amber)" },
  { name:"VS Code extension", desc:"Inline pass/fail next to each YAML case. One-click re-run from editor.",         color:"var(--green)" },
  { name:"Auto case gen",     desc:"Generate adversarial test cases from a prompt file. Seed without hand-writing.", color:"var(--lime)" },
];

const COMPARE_ROWS = [
  { label:'"Scientists…"',   eval:"max_length",  cols:["100%","100%","100%"], cc:["var(--lime)","var(--lime)","var(--lime)"] },
  { label:'"Scientists…"',   eval:"llm_judge",   cols:[" 90%"," 100%"," 70%"], cc:["var(--teal)","var(--lime)","var(--amber)"] },
  { label:'"Book table…"',   eval:"json_schema", cols:["100%","100%","  0%"], cc:["var(--lime)","var(--lime)","var(--red)"]   },
  { label:'"My order…"',     eval:"llm_judge",   cols:[" 80%"," 100%"," 60%"], cc:["var(--amber)","var(--lime)","var(--amber)"] },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <>
      <Nav />

      {/* ══════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════ */}
      <section style={{
        minHeight:"100vh", display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:"120px 24px 80px",
        position:"relative", overflow:"hidden",
        textAlign:"center",
      }}>
        {/* Faint radial glow top */}
        <div style={{
          position:"absolute", top:0, left:"50%", transform:"translateX(-50%)",
          width:"70%", height:400, zIndex:0,
          background:"radial-gradient(ellipse at 50% 0%, rgba(200,255,0,0.07) 0%, transparent 70%)",
          pointerEvents:"none",
        }}/>

        <div style={{ position:"relative", zIndex:1, maxWidth:860 }}>
          {/* Eyebrow pill */}
          <div style={{
            display:"inline-flex", alignItems:"center", gap:8,
            background:"var(--s1)", border:"1px solid var(--b2)",
            borderRadius:100, padding:"6px 16px 6px 10px", marginBottom:36,
            animation:"fadeUp .45s ease both",
          }}>
            <span style={{
              width:7, height:7, borderRadius:"50%",
              background:"var(--lime)", display:"inline-block",
              boxShadow:"0 0 10px var(--lime)",
              animation:"pulse 2s ease-in-out infinite",
            }}/>
            <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text2)", letterSpacing:".07em" }}>
              Open beta · v0.1.0
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily:"var(--sans)", fontWeight:800,
            fontSize:"clamp(50px,9.5vw,110px)",
            letterSpacing:"-.055em", lineHeight:.92,
            marginBottom:30,
            animation:"fadeUp .5s .07s ease both",
          }}>
            Prompt tests<br/>
            <span style={{ color:"var(--lime)" }}>that catch</span><br/>
            <span style={{
              fontFamily:"var(--serif)", fontStyle:"italic",
              fontWeight:400, fontSize:"clamp(44px,8vw,96px)",
              letterSpacing:"-.02em",
            }}>regressions.</span>
          </h1>

          <p style={{
            fontSize:"clamp(15px,1.6vw,18px)", color:"var(--text2)",
            lineHeight:1.75, maxWidth:480, margin:"0 auto 48px",
            animation:"fadeUp .5s .14s ease both",
          }}>
            Run your LLM prompts with flakiness-corrected pass rates.
            Catch quality regressions before production. Compare providers side-by-side.
          </p>

          {/* CTAs */}
          <div style={{
            display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap",
            animation:"fadeUp .5s .21s ease both",
          }}>
            <a href="#install" className="btn-lime" style={{
              background:"var(--lime)", color:"#000",
              padding:"13px 30px", borderRadius:9,
              fontSize:14, fontWeight:800, letterSpacing:"-.01em",
            }}>
              Get started →
            </a>
            <a href="/docs" className="btn-ghost" style={{
              border:"1px solid var(--b2)", color:"var(--text2)",
              padding:"13px 26px", borderRadius:9,
              fontSize:14, fontWeight:600,
            }}>
              Read the docs
            </a>
          </div>
        </div>

        {/* Terminal */}
        <div style={{
          position:"relative", zIndex:1,
          width:"100%", maxWidth:620, marginTop:60,
          animation:"fadeUp .55s .3s ease both",
          textAlign:"left",
        }}>
          <div style={{
            background:"#0d0d0d",
            border:"1px solid var(--b2)",
            borderRadius:12,
            overflow:"hidden",
            boxShadow:"0 32px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.03)",
          }}>
            {/* macOS-style window chrome */}
            <div style={{
              height:40, background:"#111111",
              borderBottom:"1px solid #1a1a1a",
              display:"flex", alignItems:"center", padding:"0 16px",
              gap:8,
            }}>
              <div style={{ display:"flex", gap:7 }}>
                <div style={{ width:12, height:12, borderRadius:"50%", background:"#ff5f57" }}/>
                <div style={{ width:12, height:12, borderRadius:"50%", background:"#febc2e" }}/>
                <div style={{ width:12, height:12, borderRadius:"50%", background:"#28c840" }}/>
              </div>
              <span style={{
                flex:1, textAlign:"center", marginRight:52,
                fontFamily:"var(--mono)", fontSize:11, color:"#3a3a3a",
              }}>wobble — ~/my-project</span>
            </div>
            <Terminal />
          </div>
          {/* subtle glow under card */}
          <div style={{
            position:"absolute", bottom:-1, left:"15%", right:"15%", height:1,
            background:"linear-gradient(90deg, transparent, rgba(200,255,0,0.15), transparent)",
          }}/>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FEATURES BENTO
      ══════════════════════════════════════════════════════════ */}
      <section id="features" style={{ maxWidth:1100, margin:"0 auto", padding:"100px 32px" }}>
        <FadeIn>
          <div style={{ marginBottom:60 }}>
            <Tag>Platform</Tag>
            <h2 style={{
              fontFamily:"var(--sans)", fontWeight:800,
              fontSize:"clamp(34px,5vw,60px)",
              letterSpacing:"-.04em", lineHeight:.97,
              marginTop:16, marginBottom:16,
            }}>
              Everything you need<br/>
              to <span style={{ color:"var(--lime)" }}>test LLM prompts.</span>
            </h2>
            <p style={{ fontSize:15, color:"var(--text2)", lineHeight:1.75, maxWidth:460 }}>
              From flakiness correction to multi-model comparison — the full toolkit, zero cloud required.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={50}>
          {/* Row 1 — two big cards */}
          <div className="two-col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>

            {/* Flakiness */}
            <div className="bento-card" style={{
              background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:14,
              padding:"32px 28px",
            }}>
              <Tag color="var(--lime)">Core</Tag>
              <div style={{ fontSize:20, fontWeight:800, letterSpacing:"-.03em", margin:"18px 0 10px" }}>
                Flakiness-corrected<br/>pass rates
              </div>
              <div style={{ fontSize:13.5, color:"var(--text2)", lineHeight:1.75, marginBottom:24 }}>
                Run each case N times. A check passes only when it succeeds ≥ threshold of runs — catching non-deterministic failures that single-shot testing misses entirely.
              </div>
              <div style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:9, padding:"18px 16px" }}>
                <DemoFlakiness/>
              </div>
            </div>

            {/* Model compare */}
            <div className="bento-card" style={{
              background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:14,
              padding:"32px 28px",
            }}>
              <Tag color="var(--teal)" bg="var(--teal-dim)">Compare</Tag>
              <div style={{ fontSize:20, fontWeight:800, letterSpacing:"-.03em", margin:"18px 0 10px" }}>
                Side-by-side<br/>model comparison
              </div>
              <div style={{ fontSize:13.5, color:"var(--text2)", lineHeight:1.75, marginBottom:24 }}>
                Run your full suite against multiple providers concurrently. Flakiness-corrected pass rates and cost estimates per model, in one aligned table.
              </div>
              <div style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:9, padding:"18px 16px" }}>
                <DemoCompare/>
              </div>
            </div>
          </div>

          {/* Row 2 — three medium */}
          <div className="three-col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:8 }}>

            {/* History */}
            <div className="bento-card" style={{
              background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:14,
              padding:"26px 22px",
            }}>
              <Tag color="var(--amber)" bg="var(--amber-dim)">History</Tag>
              <div style={{ fontSize:16, fontWeight:800, letterSpacing:"-.02em", margin:"14px 0 8px" }}>
                Trend tracking
              </div>
              <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.7, marginBottom:20 }}>
                Every run appended to <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text3)" }}>.wobble/history.jsonl</span>. First-regression detection tells you exactly when quality dropped.
              </div>
              <div style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:9, padding:"16px" }}>
                <DemoHistory/>
              </div>
            </div>

            {/* 8 evaluators */}
            <div className="bento-card" style={{
              background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:14,
              padding:"26px 22px",
            }}>
              <Tag color="var(--purple)" bg="var(--purple-dim)">Evaluators</Tag>
              <div style={{ fontSize:16, fontWeight:800, letterSpacing:"-.02em", margin:"14px 0 8px" }}>
                8 built-in evaluators
              </div>
              <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.7, marginBottom:20 }}>
                Contains, regex, JSON schema, LLM-as-judge, rubric scoring, custom JS. Mix and match freely within one test case.
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {["contains","max_length","regex","json_schema","llm_judge","rubric","starts_with","custom"].map((e,i) => {
                  const cs = ["var(--teal)","var(--lime)","var(--purple)","var(--green)","var(--pink)","var(--pink)","var(--amber)","var(--text2)"];
                  return (
                    <span key={e} style={{
                      fontFamily:"var(--mono)", fontSize:10, fontWeight:700,
                      color:cs[i], background:`${cs[i]}14`,
                      border:`1px solid ${cs[i]}30`,
                      padding:"3px 8px", borderRadius:4,
                    }}>{e}</span>
                  );
                })}
              </div>
            </div>

            {/* CI */}
            <div className="bento-card" style={{
              background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:14,
              padding:"26px 22px",
            }}>
              <Tag color="var(--green)" bg="var(--green-dim)">CI/CD</Tag>
              <div style={{ fontSize:16, fontWeight:800, letterSpacing:"-.02em", margin:"14px 0 8px" }}>
                Ships to CI on day one
              </div>
              <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.7, marginBottom:20 }}>
                JUnit + JSON output. Non-zero exit on regression. Plug into GitHub Actions, GitLab, or any runner.
              </div>
              <div style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:9, padding:"16px 14px", fontFamily:"var(--mono)", fontSize:11.5, lineHeight:2 }}>
                <div style={{ color:"var(--text4)" }}># .github/workflows/ci.yml</div>
                <div><span style={{ color:"var(--teal)" }}>- run: </span><span style={{ color:"var(--lime)", fontWeight:700 }}>wobble run --output junit</span></div>
                <div style={{ marginTop:8, display:"flex", gap:8 }}>
                  <span style={{ background:"var(--lime)", color:"#000", padding:"2px 10px", borderRadius:4, fontSize:10, fontWeight:700 }}>✓ 8 passed</span>
                  <span style={{ color:"var(--text4)", fontSize:10, alignSelf:"center" }}>exit 0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3 — four small */}
          <div className="four-col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8 }}>
            {[
              { tag:"wobble watch",    color:"var(--lime)",   name:"Watch mode",         desc:"Re-run on every file save. 300ms debounce." },
              { tag:"max_cost_per_run",color:"var(--pink)",   name:"Cost guardrails",    desc:"Abort if projected spend exceeds your limit." },
              { tag:"turns: […]",      color:"var(--teal)",   name:"Multi-turn chats",   desc:"Test full dialogues with the turns: key." },
              { tag:"{{variable}}",    color:"var(--purple)", name:"Variable injection",  desc:"{{name}} placeholders in prompts and inputs." },
            ].map((f,i) => (
              <div key={i} className="bento-card" style={{
                background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:12, padding:"20px 18px",
              }}>
                <span style={{
                  fontFamily:"var(--mono)", fontSize:10, fontWeight:700, color:f.color,
                  background:`${f.color}12`, border:`1px solid ${f.color}28`,
                  padding:"2px 8px", borderRadius:4, letterSpacing:".03em",
                }}>{f.tag}</span>
                <div style={{ fontSize:13.5, fontWeight:800, letterSpacing:"-.02em", margin:"10px 0 6px" }}>{f.name}</div>
                <div style={{ fontSize:12.5, color:"var(--text3)", lineHeight:1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ══════════════════════════════════════════════════════════
          EVALUATORS
      ══════════════════════════════════════════════════════════ */}
      <div style={{ borderTop:"1px solid var(--b1)" }}>
        <section id="evaluators" style={{ maxWidth:1100, margin:"0 auto", padding:"100px 32px" }}>
          <FadeIn>
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:40, marginBottom:52, flexWrap:"wrap" }}>
              <div>
                <Tag color="var(--purple)" bg="var(--purple-dim)">Evaluators</Tag>
                <h2 style={{
                  fontFamily:"var(--sans)", fontWeight:800,
                  fontSize:"clamp(34px,5vw,60px)", letterSpacing:"-.04em", lineHeight:.97,
                  marginTop:16,
                }}>
                  Eight ways to assert<br/>
                  <span style={{ color:"var(--purple)" }}>model output.</span>
                </h2>
              </div>
              <p style={{ maxWidth:320, fontSize:14, color:"var(--text2)", lineHeight:1.8, paddingBottom:6 }}>
                Compose freely — every evaluator works with N-run flakiness correction. Mix and match inside a single test case.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={40}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:8 }}>
              {EVALUATORS.map((ev,i) => (
                <div key={i} className="eval-card" style={{
                  background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:12,
                  padding:"20px 18px", display:"flex", flexDirection:"column", gap:12,
                }}>
                  <div>
                    <span style={{
                      fontFamily:"var(--mono)", fontSize:11, fontWeight:700,
                      color:ev.color, display:"inline-block", marginBottom:4,
                    }}>{ev.type}</span>
                    {ev.alias && (
                      <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text4)", marginLeft:8 }}>
                        / {ev.alias}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:12.5, color:"var(--text2)", lineHeight:1.65, flex:1 }}>{ev.desc}</div>
                  <pre style={{
                    background:"var(--bg)", border:"1px solid var(--b1)", borderRadius:6,
                    padding:"10px 12px", fontSize:10.5, lineHeight:1.8,
                    color:"var(--text3)", fontFamily:"var(--mono)",
                    whiteSpace:"pre-wrap", margin:0,
                  }}>{ev.yaml}</pre>
                </div>
              ))}
            </div>
          </FadeIn>
        </section>
      </div>

      {/* ══════════════════════════════════════════════════════════
          COMPARE
      ══════════════════════════════════════════════════════════ */}
      <div style={{ background:"var(--s1)", borderTop:"1px solid var(--b1)", borderBottom:"1px solid var(--b1)" }}>
        <section style={{ maxWidth:1100, margin:"0 auto", padding:"100px 32px" }}>
          <FadeIn>
            <div className="two-col" style={{ display:"grid", gridTemplateColumns:"1fr 1.1fr", gap:72, alignItems:"start" }}>
              <div>
                <Tag color="var(--teal)" bg="var(--teal-dim)">wobble compare</Tag>
                <h2 style={{
                  fontFamily:"var(--sans)", fontWeight:800,
                  fontSize:"clamp(32px,4.5vw,54px)", letterSpacing:"-.04em", lineHeight:.97,
                  marginTop:18, marginBottom:18,
                }}>
                  One command.<br/>
                  <span style={{ color:"var(--teal)" }}>Every model,<br/>compared.</span>
                </h2>
                <p style={{ fontSize:14, color:"var(--text2)", lineHeight:1.8, marginBottom:28 }}>
                  Run your full suite against multiple providers concurrently. Flakiness-corrected pass rates, per-check breakdowns, and estimated cost — all in one table.
                </p>
                <div style={{
                  background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8,
                  padding:"12px 16px", fontFamily:"var(--mono)", fontSize:12.5,
                }}>
                  <span style={{ color:"var(--text3)" }}>$ </span>
                  <span style={{ color:"var(--lime)", fontWeight:700 }}>wobble compare</span>
                  <span style={{ color:"var(--text3)" }}>{" --targets gpt-4o,claude-haiku,gemini-flash"}</span>
                </div>
              </div>

              <div style={{
                background:"var(--bg)", border:"1px solid var(--b2)", borderRadius:12,
                overflow:"hidden",
                boxShadow:"0 20px 60px rgba(0,0,0,.5)",
              }}>
                <div style={{
                  display:"grid", gridTemplateColumns:"1.5fr 80px 80px 80px",
                  padding:"10px 18px", background:"var(--s2)", borderBottom:"1px solid var(--b1)",
                  fontFamily:"var(--mono)", fontSize:9.5, color:"var(--text4)",
                  letterSpacing:".09em", textTransform:"uppercase",
                }}>
                  <span>Input · Eval</span><span>gpt-4o</span><span>claude</span><span>gemini</span>
                </div>
                {COMPARE_ROWS.map((row,i) => (
                  <div key={i} className="tr" style={{
                    display:"grid", gridTemplateColumns:"1.5fr 80px 80px 80px",
                    padding:"11px 18px",
                    borderBottom: i < COMPARE_ROWS.length-1 ? "1px solid var(--b1)" : "none",
                    fontFamily:"var(--mono)", fontSize:12, alignItems:"center",
                    background: i%2===0 ? "rgba(255,255,255,.01)" : "transparent",
                  }}>
                    <div>
                      <span style={{ color:"var(--text3)", fontSize:11 }}>{row.label}</span>
                      <span style={{ color:"var(--text4)", fontSize:10, marginLeft:8, fontFamily:"var(--mono)" }}>{row.eval}</span>
                    </div>
                    {row.cols.map((c,j) => (
                      <span key={j} style={{ color:row.cc[j], fontWeight:700, fontSize:12 }}>{c}</span>
                    ))}
                  </div>
                ))}
                <div style={{
                  display:"grid", gridTemplateColumns:"1.5fr 80px 80px 80px",
                  padding:"10px 18px", background:"var(--s2)", borderTop:"1px solid var(--b1)",
                  fontFamily:"var(--mono)", fontSize:10,
                }}>
                  <span style={{ color:"var(--text4)", textTransform:"uppercase", letterSpacing:".08em", fontSize:9 }}>est. cost</span>
                  {["$0.0021","$0.0018","$0.0009"].map((c,i) => (
                    <span key={i} style={{ color:"var(--text3)" }}>{c}</span>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        </section>
      </div>

      {/* ══════════════════════════════════════════════════════════
          CLI COMMANDS
      ══════════════════════════════════════════════════════════ */}
      <section id="commands" style={{ maxWidth:1100, margin:"0 auto", padding:"100px 32px" }}>
        <FadeIn>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:40, marginBottom:52, flexWrap:"wrap" }}>
            <div>
              <Tag color="var(--green)" bg="var(--green-dim)">CLI</Tag>
              <h2 style={{
                fontFamily:"var(--sans)", fontWeight:800,
                fontSize:"clamp(34px,5vw,60px)", letterSpacing:"-.04em", lineHeight:.97,
                marginTop:16,
              }}>
                Complete CLI.<br/>
                <span style={{ color:"var(--green)" }}>All stable.</span>
              </h2>
            </div>
            <p style={{ maxWidth:300, fontSize:14, color:"var(--text2)", lineHeight:1.8, paddingBottom:6 }}>
              Eight commands, all stable. From init to history — everything you need without the extras.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={40}>
          <div style={{ borderRadius:12, overflow:"hidden", border:"1px solid var(--b1)" }}>
            {COMMANDS.map((cmd,i) => (
              <div key={cmd.name} className="cmd-row" style={{
                display:"grid", gridTemplateColumns:"240px 1fr 64px",
                gap:20, padding:"16px 22px",
                background: i%2===0 ? "var(--s1)" : "transparent",
                borderBottom: i<COMMANDS.length-1 ? "1px solid var(--b1)" : "none",
                alignItems:"center",
              }}>
                <code style={{
                  fontFamily:"var(--mono)", fontSize:13, fontWeight:700,
                  color:cmd.color, letterSpacing:"-.01em",
                }}>{cmd.name}</code>
                <span style={{ fontSize:13.5, color:"var(--text2)", lineHeight:1.55 }}>{cmd.desc}</span>
                <span style={{
                  fontFamily:"var(--mono)", fontSize:9, padding:"3px 8px", borderRadius:20,
                  background:"var(--green-dim)", color:"var(--green)",
                  fontWeight:700, letterSpacing:".07em", textTransform:"uppercase",
                  textAlign:"center",
                }}>stable</span>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ══════════════════════════════════════════════════════════
          ROADMAP
      ══════════════════════════════════════════════════════════ */}
      <div style={{ background:"var(--s1)", borderTop:"1px solid var(--b1)", borderBottom:"1px solid var(--b1)" }}>
        <section id="roadmap" style={{ maxWidth:1100, margin:"0 auto", padding:"100px 32px" }}>
          <FadeIn>
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:40, marginBottom:52, flexWrap:"wrap" }}>
              <div>
                <Tag color="var(--amber)" bg="var(--amber-dim)">Roadmap</Tag>
                <h2 style={{
                  fontFamily:"var(--sans)", fontWeight:800,
                  fontSize:"clamp(34px,5vw,60px)", letterSpacing:"-.04em", lineHeight:.97,
                  marginTop:16,
                }}>
                  Open beta.<br/>
                  <span style={{ color:"var(--amber)" }}>Shipping fast.</span>
                </h2>
              </div>
              <p style={{ maxWidth:280, fontSize:14, color:"var(--text3)", lineHeight:1.8, paddingBottom:6 }}>
                Features ship in order of demand. Star on GitHub to vote with your ⭐
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={40}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:8 }}>
              {ROADMAP.map((item) => (
                <div key={item.name} className="bento-card" style={{
                  background:"var(--bg)", border:"1px dashed var(--b2)", borderRadius:12,
                  padding:"24px 20px", position:"relative",
                }}>
                  <div style={{
                    position:"absolute", top:14, right:14,
                    fontFamily:"var(--mono)", fontSize:9, color:"var(--text4)",
                    letterSpacing:".1em", textTransform:"uppercase",
                    background:"var(--s1)", border:"1px solid var(--b1)",
                    padding:"2px 7px", borderRadius:20,
                  }}>soon</div>
                  <div style={{
                    width:30, height:30, borderRadius:7, marginBottom:14,
                    background:`${item.color}12`, border:`1px solid ${item.color}28`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13, color:item.color,
                  }}>◆</div>
                  <div style={{ fontSize:14, fontWeight:800, letterSpacing:"-.02em", marginBottom:6 }}>{item.name}</div>
                  <div style={{ fontSize:12.5, color:"var(--text3)", lineHeight:1.65 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </section>
      </div>

      {/* ══════════════════════════════════════════════════════════
          CTA + INSTALL
      ══════════════════════════════════════════════════════════ */}
      <section id="install" style={{ maxWidth:1100, margin:"0 auto", padding:"100px 32px" }}>
        <FadeIn>
          <div className="two-col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:72, alignItems:"start" }}>
            <div>
              <Tag color="var(--lime)">Get started</Tag>
              <h2 style={{
                fontFamily:"var(--sans)", fontWeight:800,
                fontSize:"clamp(34px,5vw,60px)", letterSpacing:"-.04em", lineHeight:.97,
                marginTop:16, marginBottom:16,
              }}>
                Up and running<br/>
                <span style={{ color:"var(--lime)" }}>in 60 seconds.</span>
              </h2>
              <p style={{ fontSize:14, color:"var(--text2)", lineHeight:1.8, marginBottom:28 }}>
                No account. No cloud. No telemetry.<br/>Node ≥ 18 and an API key is all you need.
              </p>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
                {[["npm","npm install -g wobble-cli"],["pnpm","pnpm add -g wobble-cli"]].map(([m,c]) => (
                  <div key={m} style={{ background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:8, padding:"14px 14px" }}>
                    <div style={{ fontFamily:"var(--mono)", fontSize:9.5, color:"var(--text4)", letterSpacing:".09em", marginBottom:8, textTransform:"uppercase" }}>{m}</div>
                    <div style={{ fontFamily:"var(--mono)", fontSize:12 }}>
                      <span style={{ color:"var(--text4)" }}>$ </span>
                      <span style={{ color:"var(--text2)" }}>{c}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:10, overflow:"hidden", marginBottom:28 }}>
                <div style={{ padding:"9px 14px", background:"var(--s2)", borderBottom:"1px solid var(--b1)", fontFamily:"var(--mono)", fontSize:9.5, color:"var(--text4)", letterSpacing:".09em", textTransform:"uppercase" }}>
                  Supported providers
                </div>
                {[
                  { name:"OpenAI",    env:"OPENAI_API_KEY",    models:"gpt-4o, gpt-4o-mini" },
                  { name:"Anthropic", env:"ANTHROPIC_API_KEY", models:"claude-sonnet-4-6" },
                  { name:"Google",    env:"GOOGLE_API_KEY",    models:"gemini-2.0-flash" },
                ].map((p,i) => (
                  <div key={p.name} style={{
                    display:"grid", gridTemplateColumns:"80px 1fr auto",
                    padding:"10px 14px", borderBottom: i<2 ? "1px solid var(--b1)" : "none",
                    fontSize:12, alignItems:"center", gap:12,
                  }}>
                    <span style={{ fontWeight:700, color:"var(--text)" }}>{p.name}</span>
                    <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text3)" }}>{p.env}</span>
                    <span style={{ fontSize:11, color:"var(--text3)" }}>{p.models}</span>
                  </div>
                ))}
              </div>

              <div style={{ display:"flex", gap:10 }}>
                <a href="#install" className="btn-lime" style={{
                  background:"var(--lime)", color:"#000",
                  padding:"13px 28px", borderRadius:9,
                  fontSize:14, fontWeight:800, letterSpacing:"-.01em",
                }}>
                  Get started →
                </a>
                <a href="https://github.com/wobble-cli/wobble" className="btn-ghost" style={{
                  border:"1px solid var(--b2)", color:"var(--text2)",
                  padding:"13px 24px", borderRadius:9,
                  fontSize:14, fontWeight:600, display:"inline-flex", alignItems:"center", gap:7,
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                  </svg>
                  GitHub
                </a>
              </div>
            </div>

            {/* Quickstart shell */}
            <div style={{
              background:"#0d0d0d", border:"1px solid var(--b2)", borderRadius:12,
              overflow:"hidden",
              boxShadow:"0 20px 60px rgba(0,0,0,.5)",
            }}>
              <div style={{
                height:38, background:"#111",
                borderBottom:"1px solid #1a1a1a",
                display:"flex", alignItems:"center", padding:"0 14px", gap:7,
              }}>
                <div style={{ display:"flex", gap:6 }}>
                  {["#ff5f57","#febc2e","#28c840"].map(c=>(
                    <div key={c} style={{ width:11,height:11,borderRadius:"50%",background:c }}/>
                  ))}
                </div>
                <span style={{ flex:1, textAlign:"center", marginRight:52, fontFamily:"var(--mono)", fontSize:11, color:"#333" }}>
                  quickstart.sh
                </span>
              </div>
              <div style={{ padding:"22px 24px", fontFamily:"var(--mono)", fontSize:12.5, lineHeight:2 }}>
                {[
                  ["var(--text4)", "# 1. Interactive config"],
                  ["var(--lime)",  "$ wobble init"],
                  [null, ""],
                  ["var(--text4)", "# 2. Set API key"],
                  ["var(--lime)",  "$ export OPENAI_API_KEY=sk-..."],
                  [null, ""],
                  ["var(--text4)", "# 3. Run tests"],
                  ["var(--lime)",  "$ wobble run"],
                  [null, ""],
                  ["var(--text4)", "# 4. Lock baseline"],
                  ["var(--lime)",  "$ wobble baseline approve"],
                  [null, ""],
                  ["var(--text4)", "# 5. Edit prompt → catch regressions"],
                  ["var(--lime)",  "$ wobble run"],
                  [null, ""],
                  ["var(--text2)", "  summarise"],
                  ["var(--green)", "  ✓ max_length  3/3"],
                  ["var(--red)",   "  ✗ llm_judge   1/3"],
                  [null, ""],
                  ["var(--red)",   "  1 regression: 100% → 33%"],
                ].map(([color,text],i) => (
                  <div key={i} style={{ color: color ?? "var(--text4)", minHeight:"2em" }}>
                    {text || "\u00a0"}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════ */}
      <footer style={{ borderTop:"1px solid var(--b1)", padding:"24px 40px" }}>
        <div className="page-footer" style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          flexWrap:"wrap", gap:20, maxWidth:1100, margin:"0 auto",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{
              display:"inline-flex", alignItems:"center", justifyContent:"center",
              width:22, height:22, borderRadius:5,
              background:"var(--lime)", color:"#000",
              fontSize:11, fontWeight:900, fontFamily:"var(--mono)",
            }}>w</span>
            <span style={{ fontFamily:"var(--sans)", fontSize:14, fontWeight:800, color:"var(--text3)", letterSpacing:"-.02em" }}>wobble</span>
            <span style={{ color:"var(--text4)", fontSize:12 }}>v0.1.0 · MIT</span>
          </div>
          <ul style={{ display:"flex", gap:24, listStyle:"none" }}>
            {[["#features","Platform"],["#evaluators","Evaluators"],["#commands","Commands"],["#roadmap","Roadmap"],["/docs","Docs"],["https://github.com/wobble-cli/wobble","GitHub"]].map(([h,l]) => (
              <li key={l}><a href={h} className="footer-link" style={{ color:"var(--text4)", fontSize:13 }}>{l}</a></li>
            ))}
          </ul>
        </div>
      </footer>
    </>
  );
}
