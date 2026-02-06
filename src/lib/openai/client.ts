import OpenAI from "openai";

import { assertConfigured, serverEnv } from "@/lib/env";

let client: OpenAI | null = null;

export const getOpenAiClient = () => {
  assertConfigured("OPENAI_API_KEY", serverEnv.openAiApiKey);

  if (!client) {
    client = new OpenAI({
      apiKey: serverEnv.openAiApiKey,
    });
  }

  return client;
};
