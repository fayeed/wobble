"use client";
import { useEffect, useRef, useState } from "react";

type P = { t: string; c?: string; b?: boolean };
const LINES: { ms: number; row: P[] }[] = [
  { ms:0,    row:[{t:"$ ",c:"var(--text3)"},{t:"wobble run",b:true,c:"var(--lime)"}] },
  { ms:320,  row:[{t:""}] },
  { ms:460,  row:[{t:"  Comparing against baseline…",c:"var(--text3)"}] },
  { ms:660,  row:[{t:""}] },
  { ms:740,  row:[{t:"  summarise",b:true,c:"var(--text)"}] },
  { ms:960,  row:[{t:"  ✓ ",c:"var(--green)"},{t:'"Scientists at CERN…"  ',c:"var(--text3)"},{t:"max_length",c:"var(--teal)"},{t:"  3/3",c:"var(--text4)"}] },
  { ms:1160, row:[{t:"  ✓ ",c:"var(--green)"},{t:'"Scientists at CERN…"  ',c:"var(--text3)"},{t:"contains   ",c:"var(--teal)"},{t:"  3/3",c:"var(--text4)"}] },
  { ms:1360, row:[{t:"  ~ ",c:"var(--amber)"},{t:'"City council voted…"  ',c:"var(--text3)"},{t:"llm_judge  ",c:"var(--purple)"},{t:"  2/3",c:"var(--text2)"}] },
  { ms:1580, row:[{t:""}] },
  { ms:1680, row:[{t:"  json-extractor",b:true,c:"var(--text)"}] },
  { ms:1880, row:[{t:"  ✓ ",c:"var(--green)"},{t:'"Book a table for 4…"  ',c:"var(--text3)"},{t:"json_schema",c:"var(--teal)"}] },
  { ms:2080, row:[{t:"  ✓ ",c:"var(--green)"},{t:'"Send 250 units…"      ',c:"var(--text3)"},{t:"json_schema",c:"var(--teal)"}] },
  { ms:2300, row:[{t:""}] },
  { ms:2380, row:[{t:"  8 passed",c:"var(--lime)",b:true},{t:"  ·  0 failed  ·  ~$0.0031",c:"var(--text3)"}] },
  { ms:2620, row:[{t:""}] },
  { ms:2720, row:[{t:"  ↑ 1 improvement vs baseline",c:"var(--green)"}] },
  { ms:2900, row:[{t:"    summarise",c:"var(--green)"},{t:'  llm_judge  ',c:"var(--text3)"},{t:"67% → 100%",c:"var(--lime)"}] },
];

export default function Terminal() {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ts = LINES.map((l,i) => setTimeout(() => setN(i+1), l.ms + 500));
    return () => ts.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [n]);

  return (
    <div ref={ref} style={{
      padding:"20px 24px",
      fontFamily:"var(--mono)", fontSize:12.5, lineHeight:1.9,
      height:240, overflowY:"auto",
    }}>
      {LINES.slice(0,n).map((line,i) => (
        <div key={i} style={{minHeight:"1.9em"}}>
          {line.row.map((p,j) => (
            <span key={j} style={{color:p.c??"var(--text3)",fontWeight:p.b?700:400}}>{p.t}</span>
          ))}
        </div>
      ))}
      {n >= LINES.length && (
        <div>
          <span style={{color:"var(--text3)"}}>$ </span>
          <span style={{
            display:"inline-block",width:7,height:13,
            background:"var(--lime)",verticalAlign:"middle",
            animation:"blink 1s step-end infinite",
          }}/>
        </div>
      )}
    </div>
  );
}
