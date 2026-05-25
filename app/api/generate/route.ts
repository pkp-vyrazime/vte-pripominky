import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redis } from "@/app/lib/redis";
import { signCount, verifyCount } from "@/app/lib/cookies";
import {
  CAPACITY,
  COUNTER_OFFSET,
  AVAILABLE_DOCS,
  BROWSER_LIMIT,
  COOKIE_NAME,
  COOKIE_MAX_AGE_S,
  REDIS_COUNTER_KEY,
} from "@/app/lib/config";

const INCR_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current == false then
  redis.call('SET', KEYS[1], ARGV[2])
  current = tonumber(ARGV[2])
else
  current = tonumber(current)
end
if current >= tonumber(ARGV[1]) then return -1 end
return redis.call('INCR', KEYS[1])
`;

export async function POST() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(COOKIE_NAME)?.value;
  const browserCount = cookieValue ? (verifyCount(cookieValue) ?? 0) : 0;

  if (browserCount >= BROWSER_LIMIT) {
    return NextResponse.json(
      {
        success: false,
        code: "BROWSER_LIMIT",
        message: `Z tohoto prohlížeče již bylo staženo ${BROWSER_LIMIT} dokumentů. Sdílejte stránku s dalšími lidmi.`,
        browserCount,
      },
      { status: 429 },
    );
  }

  let result: number;
  try {
    result = (await redis.eval(
      INCR_SCRIPT,
      [REDIS_COUNTER_KEY],
      [CAPACITY, COUNTER_OFFSET],
    )) as number;
  } catch (e) {
    console.error("generate error:", e);
    return NextResponse.json(
      { success: false, code: "SERVER_ERROR", message: "Něco se pokazilo. Zkuste to za chvíli znovu." },
      { status: 500 },
    );
  }

  if (result === -1) {
    return NextResponse.json(
      {
        success: false,
        code: "EXHAUSTED",
        message: `Všech ${AVAILABLE_DOCS} předpřipravených připomínek bylo rozebráno. Brzy doplníme další.`,
        totalDownloads: AVAILABLE_DOCS,
      },
      { status: 410 },
    );
  }

  const docNumber = result;
  const newBrowserCount = browserCount + 1;
  const totalDownloads = docNumber - COUNTER_OFFSET;

  const response = NextResponse.json({
    success: true,
    docNumber,
    url: `/pripominky/pripominka_${String(docNumber).padStart(3, "0")}.pdf`,
    totalDownloads,
    remaining: CAPACITY - docNumber,
    browserCount: newBrowserCount,
  });

  response.cookies.set(COOKIE_NAME, signCount(newBrowserCount), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_S,
  });

  return response;
}
