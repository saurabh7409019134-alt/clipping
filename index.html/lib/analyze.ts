import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
const run = promisify(execFile);
const BUCKET = 10; // seconds
export type Clip = { start: number; end: number; score: number; chat: number; audio: number; title?: string; reason?: string; text?: string };

const z = (a: number[]) => { const m = a.reduce((s, v) => s + v, 0) / (a.length || 1); const sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1)) || 1; return a.map(v => (v - m) / sd); };

async function audioEnergy(url: string, dir: string): Promise<number[]> {
  await run("yt-dlp", ["-f", "worstaudio/worst", "-x", "--audio-format", "wav", "-o", path.join(dir, "a.%(ext)s"), url], { maxBuffer: 1 << 28 });
  const { stdout } = (await run("ffmpeg", ["-i", path.join(dir, "a.wav"), "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { encoding: "buffer", maxBuffer: 1 << 30 } as any)) as any;
  const buf: Buffer = stdout; const per = 8000 * BUCKET; const out: number[] = [];
  for (let i = 0; i + per * 2 <= buf.length; i += per * 2) { let s = 0; for (let j = 0; j < per; j++) { const v = buf.readInt16LE(i + j * 2); s += v * v; } out.push(Math.sqrt(s / per)); }
  return out;
}

async function chatActivity(dir: string, len: number): Promise<number[]> {
  const bins = new Array(len).fill(0);
  try {
    const f = (await fs.readdir(dir)).find(n => n.endsWith(".live_chat.json"));
    if (!f) return bins;
    for (const line of (await fs.readFile(path.join(dir, f), "utf8")).split("\n")) {
      if (!line.trim()) continue;
      try { const ms = Number(JSON.parse(line).replayChatItemAction?.videoOffsetTimeMsec); if (ms >= 0) { const i = Math.floor(ms / 1000 / BUCKET); if (i < len) bins[i]++; } } catch {}
    }
  } catch {}
  return bins;
}

type Cue = { t: number; text: string };
async function transcript(dir: string): Promise<Cue[]> {
  const f = (await fs.readdir(dir)).find(n => n.endsWith(".vtt"));
  if (!f) return [];
  const cues: Cue[] = [];
  for (const blk of (await fs.readFile(path.join(dir, f), "utf8")).split("\n\n")) {
    const m = blk.match(/(\d+):(\d+):(\d+)\.\d+ -->/); if (!m) continue;
    const text = blk.split("\n").slice(1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (text) cues.push({ t: +m[1] * 3600 + +m[2] * 60 + +m[3], text });
  }
  return cues;
}

async function aiRank(clips: Clip[]): Promise<Clip[]> {
  const key = process.env.ANTHROPIC_API_KEY; if (!key) return clips;
  try {
    const prompt = `You pick viral short-form clips from a live stream. For each candidate, give a punchy title (max 8 words), a one-line reason, and an interest score 0-10 (hook, emotion, humor, self-contained). Reply ONLY with JSON array [{"i":0,"title":"","reason":"","score":0}].\n\n` + clips.map((c, i) => `#${i} [${c.start}-${c.end}s] ${c.text?.slice(0, 700)}`).join("\n\n");
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }) });
    const j = await r.json(); const arr = JSON.parse(j.content[0].text.replace(/```json|```/g, "").trim());
    for (const a of arr) if (clips[a.i]) { clips[a.i].title = a.title; clips[a.i].reason = a.reason; clips[a.i].score = clips[a.i].score * 0.5 + (a.score / 10) * 1.5; }
  } catch {}
  return clips;
}

export async function analyze(url: string, count = 8, clipLen = 45): Promise<{ clips: Clip[]; hasChat: boolean; hasTranscript: boolean }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "clip-"));
  try {
    await run("yt-dlp", ["--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "live_chat,en.*,hi.*", "--sub-format", "vtt", "-o", path.join(dir, "s.%(ext)s"), url], { maxBuffer: 1 << 28 }).catch(() => {});
    const audio = await audioEnergy(url, dir);
    const chat = await chatActivity(dir, audio.length);
    const cues = await transcript(dir);
    const hasChat = chat.some(v => v > 0);
    const za = z(audio), zc = hasChat ? z(chat) : chat.map(() => 0);
    const span = Math.round(clipLen / BUCKET);
    const wins = [];
    for (let i = 0; i + span <= audio.length; i++) {
      let s = 0, c = 0, a = 0;
      for (let k = i; k < i + span; k++) { s += hasChat ? 0.6 * zc[k] + 0.4 * za[k] : za[k]; c += chat[k]; a += za[k]; }
      wins.push({ i, score: s / span, chat: c, audio: a / span });
    }
    wins.sort((x, y) => y.score - x.score);
    const picked: Clip[] = [];
    for (const w of wins) {
      const start = w.i * BUCKET, end = start + span * BUCKET;
      if (picked.some(p => start < p.end + 20 && end > p.start - 20)) continue;
      picked.push({ start, end, score: w.score, chat: w.chat, audio: +w.audio.toFixed(2), text: cues.filter(q => q.t >= start && q.t < end).map(q => q.text).join(" ") });
      if (picked.length >= count + 4) break;
    }
    const ranked = (await aiRank(picked)).sort((a, b) => b.score - a.score).slice(0, count);
    return { clips: ranked.map(({ text, ...c }) => c), hasChat, hasTranscript: cues.length > 0 };
  } finally { fs.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

export async function makeClip(url: string, start: number, end: number): Promise<string> {
  const id = Date.now().toString(36), dir = path.join(process.cwd(), "public", "clips");
  const raw = path.join(dir, `${id}_raw.mp4`), out = path.join(dir, `${id}.mp4`);
  await run("yt-dlp", ["-f", "bv*[height<=1080]+ba/b", "--download-sections", `*${start}-${end}`, "--force-keyframes-at-cuts", "--merge-output-format", "mp4", "-o", raw, url], { maxBuffer: 1 << 28 });
  await run("ffmpeg", ["-y", "-i", raw, "-vf", "crop=ih*9/16:ih,scale=1080:1920", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "aac", out]);
  await fs.rm(raw, { force: true });
  return `/clips/${id}.mp4`;
}
