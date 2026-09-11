import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

// Fetch the signed-in user's profile (role, name). Redirects to /login if
// there's no session — use in Server Components / layouts that require auth.
export async function requireProfile(): Promise<{ userId: string; email: string | null; profile: Profile }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return { userId: user.id, email: user.email ?? null, profile: profile as Profile };
}

export async function requireAdmin() {
  const ctx = await requireProfile();
  if (ctx.profile.role !== "admin") {
    redirect("/dashboard?error=solo-admin");
  }
  return ctx;
}
