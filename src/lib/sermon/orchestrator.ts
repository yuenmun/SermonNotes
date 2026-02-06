import { z } from "zod";

import { getOpenAiClient } from "@/lib/openai/client";
import { sermonOutlineSchema, type SermonOutline } from "@/lib/sermon/types";

const toolResponseSchema = z.object({
  title: z.string(),
  heroVerse: z.string().nullable(),
  verseReferences: z.array(z.string()),
  keyPoints: z.array(z.string()),
  summary: z.string(),
});

const toolDefinition = {
  type: "function" as const,
  function: {
    name: "create_gamma_site",
    description:
      "Extract a sermon summary with a title, one hero verse if explicitly cited, all scripture references explicitly mentioned, exactly 3 key points, and a concise summary.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["title", "heroVerse", "verseReferences", "keyPoints", "summary"],
      properties: {
        title: { type: "string" },
        heroVerse: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        verseReferences: {
          type: "array",
          items: { type: "string" },
        },
        keyPoints: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "string" },
        },
        summary: { type: "string" },
      },
    },
  },
};

const dedupeReferences = (references: string[]) => {
  const map = new Map<string, string>();

  for (const item of references) {
    const normalized = item.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (!map.has(key)) {
      map.set(key, normalized);
    }
  }

  return Array.from(map.values());
};

export const extractSermonOutline = async (transcript: string): Promise<SermonOutline> => {
  const openai = getOpenAiClient();
  const sourceText = transcript.toLowerCase();

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content:
          "You are Pneuma, a theological editor. Extract sermon structure from transcript text. Important: only include scripture references that are explicitly present in the transcript. Do not infer, guess, or hallucinate verses. If no verse is explicitly mentioned, set heroVerse to null and verseReferences to an empty array.",
      },
      {
        role: "user",
        content: transcript,
      },
    ],
    tools: [toolDefinition],
    tool_choice: {
      type: "function",
      function: { name: "create_gamma_site" },
    },
  });

  const toolCall = completion.choices[0]?.message?.tool_calls?.find(
    (call) => call.type === "function" && call.function.name === "create_gamma_site",
  );

  if (!toolCall || toolCall.type !== "function" || !toolCall.function.arguments) {
    throw new Error("Model did not return create_gamma_site arguments.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new Error("Model returned invalid JSON arguments for create_gamma_site.");
  }

  const structured = toolResponseSchema.parse(parsed);

  const explicitReferences = dedupeReferences(structured.verseReferences)
    .filter((reference) => sourceText.includes(reference.toLowerCase()))
    .slice(0, 20);

  const explicitHeroVerse =
    structured.heroVerse && sourceText.includes(structured.heroVerse.toLowerCase())
      ? structured.heroVerse.trim()
      : explicitReferences[0] ?? null;

  const normalized = {
    ...structured,
    heroVerse: explicitHeroVerse,
    verseReferences: explicitReferences,
    keyPoints: structured.keyPoints.slice(0, 3),
  };

  return sermonOutlineSchema.parse(normalized);
};
