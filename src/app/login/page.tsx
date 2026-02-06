import { redirect } from "next/navigation";
import { Chrome, KeyRound, Mail, ShieldCheck } from "lucide-react";

import { signInWithEmail, signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isAuthProviderEnabled } from "@/lib/supabase/auth-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams?: {
    error?: string;
    message?: string;
  };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const googleEnabled = await isAuthProviderEnabled("google");

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-4 px-3 py-5 sm:px-6 sm:py-8 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="glass-panel">
        <CardHeader className="space-y-3">
          <p className="mono-kicker">Sermon Notes</p>
          <CardTitle className="text-3xl">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">Continue with Google or use magic link.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={signInWithGoogle}>
            <Button className="w-full justify-center gap-2" disabled={googleEnabled === false} type="submit">
              <Chrome className="h-4 w-4" />
              Continue with Google
            </Button>
          </form>

          {googleEnabled === false ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Google OAuth is disabled in Supabase. Use magic link below.
            </p>
          ) : null}

          <div className="h-px bg-border" />

          <form action={signInWithEmail} className="space-y-2">
            <label className="mono-kicker flex items-center gap-1.5" htmlFor="email">
              <Mail className="h-3.5 w-3.5" />
              Email Magic Link
            </label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input id="email" name="email" placeholder="you@example.com" type="email" />
              <Button type="submit" variant="secondary">
                <KeyRound className="h-4 w-4" />
                Send Link
              </Button>
            </div>
          </form>

          {searchParams?.message ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {searchParams.message}
            </p>
          ) : null}
          {searchParams?.error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {searchParams.error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-xl">Setup Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="rounded-xl border border-white/10 bg-black/35 p-3">
            <p>1. Enable Google provider in Supabase Auth.</p>
            <p>2. Add Supabase callback URI in Google OAuth credentials.</p>
            <p>3. Add Gamma and OpenAI keys in `.env.local`.</p>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/30 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
            <p>Magic link fallback is active for testing even when Google OAuth is off.</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
