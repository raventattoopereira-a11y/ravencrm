import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google/calendar";

// GET /api/google/oauth — redirects the admin to Google's consent screen.
export async function GET() {
  const { userId } = await requireAdmin();
  const url = getAuthUrl(userId);
  return NextResponse.redirect(url);
}
