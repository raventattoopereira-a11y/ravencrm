import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, saveConnection } from "@/lib/google/calendar";

// GET /api/google/oauth/callback — Google redirects here with ?code=&state=
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // the admin's user id, set in /api/google/oauth
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(`${origin}/calendario?error=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/calendario?error=missing_code`);
  }

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      // Google only returns a refresh_token the first time it grants consent for
      // this app+account; if it's missing, the studio must revoke and reconnect.
      return NextResponse.redirect(
        `${origin}/calendario?error=no_refresh_token`
      );
    }
    await saveConnection({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      connectedBy: state,
    });
    return NextResponse.redirect(`${origin}/calendario?connected=1`);
  } catch {
    return NextResponse.redirect(`${origin}/calendario?error=exchange_failed`);
  }
}
