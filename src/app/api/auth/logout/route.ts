export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { COOKIE_NAME, getCurrentUser } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (me) {
    await logAudit({
      actor: me,
      action: "logout",
      ipAddress: getClientIp(req),
    });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return res;
}
