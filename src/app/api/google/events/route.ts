import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createEvent, deleteEvent, listUpcomingEvents } from "@/lib/google/calendar";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const max = Number(searchParams.get("max") ?? 20);
  try {
    const events = await listUpcomingEvents(max);
    return NextResponse.json({ data: events });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

const eventSchema = z.object({
  summary: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startISO: z.string(),
  endISO: z.string(),
});

export async function POST(request: NextRequest) {
  const parsed = eventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  try {
    const event = await createEvent(parsed.data);
    return NextResponse.json({ data: event }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Falta eventId" }, { status: 400 });
  try {
    await deleteEvent(eventId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
