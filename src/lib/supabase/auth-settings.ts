import { publicEnv } from "@/lib/env";

interface SupabaseAuthSettings {
  external?: Record<string, boolean>;
}

const fetchAuthSettings = async (): Promise<SupabaseAuthSettings | null> => {
  try {
    const response = await fetch(`${publicEnv.supabaseUrl}/auth/v1/settings`, {
      method: "GET",
      headers: {
        apikey: publicEnv.supabaseAnonKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as SupabaseAuthSettings;
  } catch {
    return null;
  }
};

export const isAuthProviderEnabled = async (provider: string): Promise<boolean | null> => {
  const settings = await fetchAuthSettings();

  if (!settings?.external) {
    return null;
  }

  const enabled = settings.external[provider];

  if (typeof enabled !== "boolean") {
    return null;
  }

  return enabled;
};
