import { NextResponse } from "next/server";
import { redis } from "@/app/lib/redis";
import {
  CAPACITY,
  COUNTER_OFFSET,
  REDIS_COUNTER_KEY,
} from "@/app/lib/config";

export async function GET() {
  const raw = (await redis.get<number>(REDIS_COUNTER_KEY)) ?? COUNTER_OFFSET;
  const total = Math.max(0, raw - COUNTER_OFFSET);
  const available = CAPACITY - COUNTER_OFFSET;
  return NextResponse.json(
    { total, remaining: Math.max(0, available - total), capacity: available },
    { headers: { "Cache-Control": "public, max-age=10, s-maxage=10" } },
  );
}
