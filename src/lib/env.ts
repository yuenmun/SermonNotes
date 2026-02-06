export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "public-anon-placeholder",
};

export const serverEnv = {
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  gammaApiKey: process.env.GAMMA_API_KEY ?? "",
  gammaApiBaseUrl: process.env.GAMMA_API_BASE_URL ?? "https://public-api.gamma.app",
  gammaTemplateId: process.env.GAMMA_TEMPLATE_ID ?? "",
  gammaThemeId: process.env.GAMMA_THEME_ID,
  gammaFolderId: process.env.GAMMA_FOLDER_ID,
};

export const assertConfigured = (name: string, value: string) => {
  if (!value || value.includes("placeholder")) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
};
