import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { isCalendarConnected, listUpcomingEvents } from "@/lib/google/calendar";
import { CalendarioClient } from "./calendario-client";

export default async function CalendarioPage() {
  const { profile } = await requireProfile();
  const connected = await isCalendarConnected();
  const events = connected ? await listUpcomingEvents(30).catch(() => []) : [];

  return (
    <Suspense>
      <CalendarioClient isAdmin={profile.role === "admin"} connected={connected} initialEvents={events ?? []} />
    </Suspense>
  );
}
