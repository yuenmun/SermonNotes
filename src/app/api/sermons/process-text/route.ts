import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { processSermonTranscript } from "@/lib/sermon/process";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const payloadSchema = z.object({
  transcript: z.string().min(40).max(120000),
});

const SERMON_SELECT =
  "id,title,gamma_url,created_at,status,pastor_name,tags,hero_verse,scripture_references";

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof payloadSchema>;

  try {
    payload = payloadSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid payload. Provide transcript text of at least 40 characters." },
      { status: 400 },
    );
  }

  const transcript = payload.transcript.trim();
  const hash = createHash("sha256").update(transcript).digest("hex");
  const idempotencyKey = `text_sha256:${hash}`;

  const { data: existing, error: existingError } = await supabase
    .from("sermons")
    .select(SERMON_SELECT)
    .eq("user_id", user.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (!existingError && existing) {
    return NextResponse.json({ sermon: existing, reused: true }, { status: 200 });
  }

  try {
    const processed = await processSermonTranscript(transcript);

    const { data: inserted, error: insertError } = await supabase
      .from("sermons")
      .insert({
        user_id: user.id,
        title: processed.title,
        gamma_url: processed.gammaUrl,
        status: "ready",
        hero_verse: processed.heroVerse,
        scripture_references: processed.verseReferences,
        key_points: processed.keyPoints,
        transcript_excerpt: processed.transcriptExcerpt,
        idempotency_key: idempotencyKey,
        gamma_request_id: processed.gammaRequestId ?? null,
      })
      .select(SERMON_SELECT)
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "Unable to archive sermon row");
    }

    return NextResponse.json({ sermon: inserted }, { status: 200 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
