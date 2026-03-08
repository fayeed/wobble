export default function NotFound() {
  return (
    <div style={{ fontFamily: "var(--mono)", padding: 80, textAlign: "center" }}>
      <div style={{ color: "var(--amber)", fontSize: 48, marginBottom: 16 }}>404</div>
      <div style={{ color: "var(--text2)" }}>Page not found</div>
      <a href="/" style={{ color: "var(--amber)", marginTop: 16, display: "block" }}>← Home</a>
    </div>
  );
}
