import { makeClip } from "@/lib/analyze";
export const maxDuration = 300;
export async function POST(req: Request) {
  const { url, start, end } = await req.json();
  try { return Response.json({ file: await makeClip(url, Number(start), Number(end)) }); }
  catch (e: any) { return Response.json({ error: e.message?.slice(0, 300) || "Failed" }, { status: 500 }); }
}
