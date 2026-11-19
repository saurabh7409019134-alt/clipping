import { analyze } from "@/lib/analyze";
export const maxDuration = 600;
export async function POST(req: Request) {
  const { url, count, clipLen } = await req.json();
  if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url || "")) return Response.json({ error: "Enter a valid YouTube link" }, { status: 400 });
  try { return Response.json(await analyze(url, count, clipLen)); }
  catch (e: any) { return Response.json({ error: e.message?.slice(0, 300) || "Failed" }, { status: 500 }); }
}
