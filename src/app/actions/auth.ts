"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { publicEnv } from "@/lib/env";
import { isAuthProviderEnabled } from "@/lib/supabase/auth-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const encode = (value: string) => encodeURIComponent(value);

export const signInWithGoogle = async () => {
  const googleEnabled = await isAuthProviderEnabled("google");

  if (googleEnabled === false) {
    redirect(
      `/login?error=${encode(
        "Google sign-in is disabled in Supabase. Enable Auth > Providers > Google, or use email magic link below.",
      )}`,
    );
  }

  const supabase = createSupabaseServerClient();
  const requestHeaders = headers();
  const origin = requestHeaders.get("origin") ?? publicEnv.siteUrl;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error || !data.url) {
    const message = error?.message ?? "Unable to start Google sign-in.";
    redirect(`/login?error=${encode(message)}`);
  }

  redirect(data.url);
};

export const signInWithEmail = async (formData: FormData) => {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    redirect(`/login?error=${encode("Enter a valid email address.")}`);
  }

  const supabase = createSupabaseServerClient();
  const requestHeaders = headers();
  const origin = requestHeaders.get("origin") ?? publicEnv.siteUrl;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    redirect(`/login?error=${encode(error.message)}`);
  }

  redirect(`/login?message=${encode("Magic link sent. Check your inbox to continue.")}`);
};

export const signOut = async () => {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
};
