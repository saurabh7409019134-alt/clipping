"use client";
import { useState } from "react";
const fmt = (s: number) => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ":" : ""}${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const card = { background: "#16161f", border: "1px solid #262633", borderRadius: 14, padding: 16 } as const;
const btn = { background: "#7c5cff", color: "#fff", border: 0, borderRadius: 10, padding: "10px 16px", fontWeight: 600, cursor: "pointer" } as const;

export default function Home() {
  const [url, setUrl] = useState(""); const [len, setLen] = useState(45); const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [data, setData] = useState<any>(null);
  const [files, setFiles] = useState<Record<number, string>>({}); const [making, setMaking] = useState<number | null>(null);

  async function go() {
    setBusy(true); setErr(""); setData(null); setFiles({});
    const r = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, count, clipLen: len }) });
    const j = await r.json(); r.ok ? setData(j) : setErr(j.error); setBusy(false);
  }
  async function make(i: number, c: any) {
    setMaking(i);
    const r = await fetch("/api/clip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, start: c.start, end: c.end }) });
    const j = await r.json(); r.ok ? setFiles(f => ({ ...f, [i]: j.file })) : setErr(j.error); setMaking(null);
  }
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
      <h1 style={{ marginBottom: 4 }}>Stream Clipper</h1>
      <p style={{ color: "#9a9ab0", marginTop: 0 }}>Paste a YouTube live stream link, get the best moments as 9:16 clips.</p>
      <div style={{ ...card, display: "grid", gap: 10 }}>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/live/..." style={{ padding: 12, borderRadius: 10, border: "1px solid #333", background: "#0f0f16", color: "#fff" }} />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", color: "#9a9ab0" }}>
          <label>Clip length <select value={len} onChange={e => setLen(+e.target.value)}>{[30, 45, 60].map(v => <option key={v} value={v}>{v}s</option>)}</select></label>
          <label>Clips <select value={count} onChange={e => setCount(+e.target.value)}>{[5, 8, 12].map(v => <option key={v}>{v}</option>)}</select></label>
          <button onClick={go} disabled={busy || !url} style={{ ...btn, marginLeft: "auto", opacity: busy || !url ? 0.5 : 1 }}>{busy ? "Analyzing… (a few min)" : "Find best clips"}</button>
        </div>
      </div>
      {err && <p style={{ color: "#ff7a7a" }}>{err}</p>}
      {data && <p style={{ color: "#9a9ab0", fontSize: 13 }}>Signals used: audio{data.hasChat ? " + chat" : " (no chat replay found)"}{data.hasTranscript ? " + transcript" : " (no captions found)"}</p>}
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {data?.clips.map((c: any, i: number) => (
          <div key={i} style={{ ...card, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700 }}>#{i + 1} {c.title || "Hype moment"}</div>
              <div style={{ color: "#9a9ab0", fontSize: 13, margin: "4px 0" }}>{fmt(c.start)} – {fmt(c.end)} · score {c.score.toFixed(2)} · {c.chat} chat msgs</div>
              {c.reason && <div style={{ fontSize: 14 }}>{c.reason}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <a href={`${url}${url.includes("?") ? "&" : "?"}t=${c.start}s`} target="_blank" style={{ ...btn, background: "#262633", textDecoration: "none" }}>Open in YouTube</a>
                {!files[i] && <button onClick={() => make(i, c)} disabled={making !== null} style={btn}>{making === i ? "Rendering…" : "Make 9:16 clip"}</button>}
                {files[i] && <a href={files[i]} download style={{ ...btn, background: "#1f9d6a", textDecoration: "none" }}>Download</a>}
              </div>
            </div>
            {files[i] && <video src={files[i]} controls style={{ width: 120, borderRadius: 10 }} />}
          </div>
        ))}
      </div>
    </main>
  );
}
