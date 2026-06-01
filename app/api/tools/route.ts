// app/api/tools/route.ts
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

// GET — load all tools
export async function GET() {
  try {
    const tools = await redis.get("ai-tools") ?? [];
    return cors(NextResponse.json({ tools }));
  } catch (err) {
    console.error("Redis GET error:", err);
    return cors(NextResponse.json({ tools: [] }, { status: 500 }));
  }
}

// POST — save all tools
export async function POST(req: NextRequest) {
  try {
    const { tools } = await req.json();
    await redis.set("ai-tools", tools);
    return cors(NextResponse.json({ ok: true }));
  } catch (err) {
    console.error("Redis POST error:", err);
    return cors(NextResponse.json({ error: "Failed to save" }, { status: 500 }));
  }
}