import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { disconnectCalendar } from "@/lib/google/calendar";

export async function POST() {
  await requireAdmin();
  await disconnectCalendar();
  return NextResponse.json({ ok: true });
}
