import { assertConfigured, serverEnv } from "@/lib/env";

export interface GammaGenerationInput {
  gammaId?: string;
  prompt: string;
  themeId?: string;
  folderId?: string;
}

export interface GammaGenerationResult {
  gammaUrl: string;
  requestId?: string;
  generationId?: string;
  raw: unknown;
}

const POLL_MAX_ATTEMPTS = 24;
const POLL_INTERVAL_MS = 2500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const maybeUrl = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return null;
  }

  return value;
};

const extractGammaUrl = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const directCandidates = [
    source.gammaUrl,
    source.url,
    source.shareUrl,
    source.viewUrl,
    source.publicUrl,
    source.resultUrl,
  ];

  for (const candidate of directCandidates) {
    const valid = maybeUrl(candidate);
    if (valid) {
      return valid;
    }
  }

  for (const value of Object.values(source)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const nested = extractGammaUrl(value);
    if (nested) {
      return nested;
    }
  }

  return null;
};

const extractGenerationId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const source = payload as Record<string, unknown>;

  if (typeof source.generationId === "string") {
    return source.generationId;
  }

  if (typeof source.id === "string") {
    return source.id;
  }

  return null;
};

const extractStatus = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const source = payload as Record<string, unknown>;

  if (typeof source.status === "string") {
    return source.status.toLowerCase();
  }

  if (typeof source.state === "string") {
    return source.state.toLowerCase();
  }

  return null;
};

const gammaRequest = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${serverEnv.gammaApiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": serverEnv.gammaApiKey,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const requestId = response.headers.get("x-request-id") ?? undefined;
  const raw = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    throw new Error(
      `Gamma API error (${response.status}). request_id=${requestId ?? "n/a"} body=${JSON.stringify(raw)}`,
    );
  }

  return { raw, requestId };
};

const waitForGammaUrl = async (generationId: string): Promise<GammaGenerationResult> => {
  let latestRequestId: string | undefined;
  let lastPayload: unknown;

  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt += 1) {
    const { raw, requestId } = await gammaRequest(`/v1.0/generations/${generationId}`, {
      method: "GET",
    });

    latestRequestId = requestId ?? latestRequestId;
    lastPayload = raw;

    const gammaUrl = extractGammaUrl(raw);
    if (gammaUrl) {
      return {
        gammaUrl,
        requestId: latestRequestId,
        generationId,
        raw,
      };
    }

    const status = extractStatus(raw);

    if (status === "failed" || status === "error" || status === "cancelled") {
      throw new Error(
        `Gamma generation failed. generation_id=${generationId} request_id=${latestRequestId ?? "n/a"} payload=${JSON.stringify(raw)}`,
      );
    }

    if (attempt < POLL_MAX_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  throw new Error(
    `Gamma generation timed out. generation_id=${generationId} request_id=${latestRequestId ?? "n/a"} payload=${JSON.stringify(lastPayload ?? {})}`,
  );
};

export const generateGammaWebpage = async (
  input: GammaGenerationInput,
): Promise<GammaGenerationResult> => {
  assertConfigured("GAMMA_API_KEY", serverEnv.gammaApiKey);

  const folderIds = input.folderId ? [input.folderId] : undefined;

  const useTemplate = Boolean(input.gammaId);

  const { raw, requestId } = await gammaRequest(
    useTemplate ? "/v1.0/generations/from-template" : "/v1.0/generations",
    {
      method: "POST",
      body: JSON.stringify(
        useTemplate
          ? {
              gammaId: input.gammaId,
              prompt: input.prompt,
              ...(input.themeId ? { themeId: input.themeId } : {}),
              ...(folderIds ? { folderIds } : {}),
            }
          : {
              inputText: input.prompt,
              textMode: "generate",
              format: "webpage",
              ...(input.themeId ? { themeId: input.themeId } : {}),
              ...(folderIds ? { folderIds } : {}),
            },
      ),
    },
  );

  const immediateUrl = extractGammaUrl(raw);
  if (immediateUrl) {
    return {
      gammaUrl: immediateUrl,
      requestId,
      generationId: extractGenerationId(raw) ?? undefined,
      raw,
    };
  }

  const generationId = extractGenerationId(raw);

  if (!generationId) {
    throw new Error(
      `Gamma API succeeded but no generationId returned. request_id=${requestId ?? "n/a"} payload=${JSON.stringify(raw)}`,
    );
  }

  const completed = await waitForGammaUrl(generationId);

  return {
    ...completed,
    requestId: completed.requestId ?? requestId,
  };
};
