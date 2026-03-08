"use client";
import Link from "next/link";

export default function Nav() {
  return (
    <nav style={{
      position:"fixed", top:0, left:0, right:0, zIndex:200,
      height:56, display:"flex", alignItems:"center",
      justifyContent:"space-between", padding:"0 32px",
      background:"rgba(10,10,10,0.85)",
      backdropFilter:"blur(12px)",
      borderBottom:"1px solid var(--b1)",
    }}>
      {/* Logo */}
      <Link href="/" style={{
        display:"flex", alignItems:"center", gap:9,
        fontFamily:"var(--sans)", fontSize:16, fontWeight:800,
        color:"var(--text)", letterSpacing:"-.03em",
      }}>
        <span style={{
          display:"inline-flex", alignItems:"center", justifyContent:"center",
          width:28, height:28, borderRadius:7,
          background:"var(--lime)", color:"#000",
          fontSize:14, fontWeight:900, fontFamily:"var(--mono)",
        }}>w</span>
        wobble
      </Link>

      {/* Center nav */}
      <ul className="nav-desktop" style={{
        display:"flex", alignItems:"center", gap:2, listStyle:"none",
        position:"absolute", left:"50%", transform:"translateX(-50%)",
      }}>
        {[["#features","Features"],["#evaluators","Evaluators"],["#commands","Commands"],["#roadmap","Roadmap"]].map(([h,l])=>(
          <li key={h}>
            <a href={h} className="nav-link" style={{
              fontSize:13, color:"var(--text3)", fontWeight:500,
              padding:"6px 14px", borderRadius:8, display:"block",
            }}>{l}</a>
          </li>
        ))}
      </ul>

      {/* Right */}
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <a href="https://github.com/wobble-cli/wobble" className="nav-link" style={{
          fontSize:13, color:"var(--text3)", fontWeight:500,
          display:"flex", alignItems:"center", gap:5, padding:"6px 12px",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          GitHub
        </a>
        <a href="#install" className="btn-lime" style={{
          background:"var(--lime)", color:"#000",
          padding:"8px 18px", borderRadius:8,
          fontSize:13, fontWeight:700, letterSpacing:"-.01em",
        }}>Get started →</a>
      </div>
    </nav>
  );
}
