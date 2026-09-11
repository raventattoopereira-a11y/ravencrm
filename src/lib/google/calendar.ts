import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/server";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(state: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // ensures a refresh_token is returned every time
    scope: SCOPES,
    state,
  });
}

interface StoredConnection {
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
  calendar_id: string;
}

async function getConnection(): Promise<StoredConnection | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("google_calendar_connection")
    .select("access_token, refresh_token, token_expiry, calendar_id")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data || !data.refresh_token) return null;
  return data as StoredConnection;
}

// Returns an authenticated OAuth2 client, refreshing + persisting the access
// token if needed. Returns null if the studio hasn't connected Google Calendar.
async function getAuthedClient() {
  const connection = await getConnection();
  if (!connection) return null;

  const client = getOAuthClient();
  client.setCredentials({
    access_token: connection.access_token ?? undefined,
    refresh_token: connection.refresh_token ?? undefined,
    expiry_date: connection.token_expiry ? new Date(connection.token_expiry).getTime() : undefined,
  });

  client.on("tokens", async (tokens) => {
    const admin = createAdminClient();
    await admin
      .from("google_calendar_connection")
      .update({
        access_token: tokens.access_token ?? connection.access_token,
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
      })
      .eq("id", 1);
  });

  return { client, calendarId: connection.calendar_id || "primary" };
}

export async function isCalendarConnected() {
  const connection = await getConnection();
  return !!connection;
}

export async function saveConnection(params: {
  access_token: string;
  refresh_token: string;
  expiry_date?: number | null;
  connectedBy: string;
}) {
  const admin = createAdminClient();
  await admin.from("google_calendar_connection").upsert({
    id: 1,
    access_token: params.access_token,
    refresh_token: params.refresh_token,
    token_expiry: params.expiry_date ? new Date(params.expiry_date).toISOString() : null,
    calendar_id: "primary",
    connected_by: params.connectedBy,
  });
}

export async function disconnectCalendar() {
  const admin = createAdminClient();
  await admin.from("google_calendar_connection").delete().eq("id", 1);
}

export interface CalendarEventLite {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  location?: string | null;
  htmlLink?: string | null;
}

export async function listUpcomingEvents(maxResults = 10): Promise<CalendarEventLite[] | null> {
  const authed = await getAuthedClient();
  if (!authed) return null;

  const calendar = google.calendar({ version: "v3", auth: authed.client });
  const res = await calendar.events.list({
    calendarId: authed.calendarId,
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (res.data.items ?? []).map((e) => ({
    id: e.id ?? "",
    summary: e.summary ?? "(Sin título)",
    start: e.start?.dateTime ?? e.start?.date ?? null,
    end: e.end?.dateTime ?? e.end?.date ?? null,
    location: e.location,
    htmlLink: e.htmlLink,
  }));
}

export async function createEvent(params: {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  location?: string;
}) {
  const authed = await getAuthedClient();
  if (!authed) throw new Error("Google Calendar no está conectado.");

  const calendar = google.calendar({ version: "v3", auth: authed.client });
  const res = await calendar.events.insert({
    calendarId: authed.calendarId,
    requestBody: {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start: { dateTime: params.startISO },
      end: { dateTime: params.endISO },
    },
  });
  return res.data;
}

export async function deleteEvent(eventId: string) {
  const authed = await getAuthedClient();
  if (!authed) throw new Error("Google Calendar no está conectado.");
  const calendar = google.calendar({ version: "v3", auth: authed.client });
  await calendar.events.delete({ calendarId: authed.calendarId, eventId });
}
