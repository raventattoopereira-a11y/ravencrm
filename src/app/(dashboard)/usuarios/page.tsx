import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UsuariosClient } from "./usuarios-client";
import type { Profile } from "@/lib/types/database";

export default async function UsuariosPage() {
  const { userId } = await requireAdmin();
  const supabase = await createClient();
  const { data } = (await supabase.from("profiles").select("*").order("created_at")) as unknown as {
    data: Profile[] | null;
  };

  return <UsuariosClient initialUsers={data ?? []} currentUserId={userId} />;
}
