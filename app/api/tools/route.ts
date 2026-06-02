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

export async function GET() {
  try {
    const tools       = await redis.get("ai-tools")        ?? [];
    const companyName = await redis.get("ai-company-name")  ?? "";
    const settings    = await redis.get("ai-settings")      ?? {};
    return cors(NextResponse.json({ tools, companyName, ...(typeof settings === 'object' ? settings : {}) }));
  } catch (err) {
    console.error("Redis GET error:", err);
    return cors(NextResponse.json({ tools: [], companyName: "" }, { status: 500 }));
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tools, companyName, filterCat, filterStatus, groupBy, searchQ, groupOrder } = body;
    await redis.set("ai-tools", tools);
    if (companyName !== undefined) {
      await redis.set("ai-company-name", companyName);
    }
    // Save filter/group settings
    const settings: Record<string, unknown> = {};
    if (filterCat !== undefined)    settings.filterCat = filterCat;
    if (filterStatus !== undefined) settings.filterStatus = filterStatus;
    if (groupBy !== undefined)      settings.groupBy = groupBy;
    if (searchQ !== undefined)      settings.searchQ = searchQ;
    if (groupOrder !== undefined)   settings.groupOrder = groupOrder;
    if (Object.keys(settings).length > 0) {
      await redis.set("ai-settings", settings);
    }
    return cors(NextResponse.json({ ok: true }));
  } catch (err) {
    console.error("Redis POST error:", err);
    return cors(NextResponse.json({ error: "Failed to save" }, { status: 500 }));
  }
}
