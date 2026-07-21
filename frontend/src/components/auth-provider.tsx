"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type AuthResult = { error?: string; needsEmailConfirmation?: boolean };

/** Row from public.profiles — consent gates and usage limits live here. */
export type Profile = {
  id: string;
  email: string | null;
  privacy_accepted_at: string | null;
  beta_consent_accepted_at: string | null;
  free_uses_remaining: number;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True until the initial session lookup resolves - prevents a login flash. */
  loading: boolean;
  configured: boolean;
  profile: Profile | null;
  /** True while the profile row is being (re)loaded for a signed-in user. */
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Supabase surfaces raw API strings that mean nothing to a tester. Map the ones
 * we actually hit to something actionable.
 */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("provider is not enabled")) {
    return "Google sign-in isn't switched on for this project yet. Use email and password for now.";
  }
  if (m.includes("email rate limit")) {
    return "Too many sign-up emails were sent in the last hour. Wait a few minutes, or ask for an account to be created for you.";
  }
  if (m.includes("invalid login credentials")) {
    return "That email and password don't match an account.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirm your email address first, then sign in.";
  }
  if (m.includes("user already registered")) {
    return "An account with that email already exists — sign in instead.";
  }
  if (m.includes("password should be")) {
    return "Password must be at least 6 characters.";
  }
  if (m.includes("failed to fetch")) {
    return "Couldn't reach the authentication service. Check your connection and try again.";
  }
  return message;
}

/**
 * Single source of truth for auth state. Reads the real Supabase session and
 * subscribes to auth changes, so the UI always reflects actual state - this is
 * what the earlier "always logged in" bug was missing.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const userId = session?.user?.id ?? null;

  const refreshProfile = useCallback(async () => {
    if (!supabaseConfigured || !userId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    // RLS scopes this to the caller's own row; the trigger creates it at signup.
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile((data as Profile) ?? null);
    setProfileLoading(false);
  }, [userId]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: friendlyAuthError(error.message) } : {};
  }

  async function signUp(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: friendlyAuthError(error.message) };
    // With email confirmation on, Supabase returns a user but no session.
    return { needsEmailConfirmation: !data.session };
  }

  async function signInWithGoogle(): Promise<AuthResult> {
    // Redirects to Google, then back to the app; the session listener above
    // picks up the resulting session. Requires the Google provider to be
    // enabled in the Supabase dashboard.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    return error ? { error: friendlyAuthError(error.message) } : {};
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        configured: supabaseConfigured,
        profile,
        profileLoading,
        refreshProfile,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
