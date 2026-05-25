import { createHmac } from "crypto";

export function signCount(count: number): string {
  const hmac = createHmac("sha256", process.env.COOKIE_SECRET!)
    .update(String(count))
    .digest("hex");
  return `${count}.${hmac}`;
}

export function verifyCount(value: string): number | null {
  const dotIndex = value.indexOf(".");
  if (dotIndex === -1) return null;
  const countStr = value.substring(0, dotIndex);
  const signature = value.substring(dotIndex + 1);
  const count = parseInt(countStr, 10);
  if (isNaN(count) || count < 0) return null;
  const expected = createHmac("sha256", process.env.COOKIE_SECRET!)
    .update(countStr)
    .digest("hex");
  if (signature !== expected) return null;
  return count;
}
