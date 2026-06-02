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

// GET — load tools and companyName
export async function GET() {
  try {
    const tools       = await redis.get("ai-tools")       ?? [];
    const companyName = await redis.get("ai-company-name") ?? "";
    return cors(NextResponse.json({ tools, companyName }));
  } catch (err) {
    console.error("Redis GET error:", err);
    return cors(NextResponse.json({ tools: [], companyName: "" }, { status: 500 }));
  }
}

// POST — save tools and companyName
export async function POST(req: NextRequest) {
  try {
    const { tools, companyName } = await req.json();
    await redis.set("ai-tools", tools);
    if (companyName !== undefined) {
      await redis.set("ai-company-name", companyName);
    }
    return cors(NextResponse.json({ ok: true }));
  } catch (err) {
    console.error("Redis POST error:", err);
    return cors(NextResponse.json({ error: "Failed to save" }, { status: 500 }));
  }
}
