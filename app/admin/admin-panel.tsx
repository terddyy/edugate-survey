"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type SurveyResponse = {
  id: string;
  created_at: string;
  respondent_name: string | null;
  answers: Record<string, Record<string, number>>;
  metadata: Record<string, unknown>;
};

const ADMIN_EMAIL = "terddy03@gmail.com";

export function AdminPanel() {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadResponses = useCallback(async () => {
    setIsLoadingResponses(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("survey_responses")
      .select("id, created_at, respondent_name, answers, metadata")
      .order("created_at", { ascending: false });

    setIsLoadingResponses(false);

    if (error) {
      setResponses([]);
      setErrorMessage(error.message);
      return;
    }

    setResponses((data ?? []) as SurveyResponse[]);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.email) {
        setSessionEmail(session.user.email);
        setEmail(session.user.email);
        await loadResponses();
      }

      setIsBootstrapping(false);
    };

    bootstrap();
  }, [loadResponses]);

  const totalResponses = useMemo(() => responses.length, [responses]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSigningIn(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsSigningIn(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    setSessionEmail(session?.user?.email ?? null);
    setPassword("");
    await loadResponses();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSessionEmail(null);
    setResponses([]);
    setErrorMessage(null);
    setPassword("");
    setEmail(ADMIN_EMAIL);
  };

  if (isBootstrapping) {
    return (
      <section className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-zinc-600">Loading admin dashboard...</p>
      </section>
    );
  }

  if (!sessionEmail) {
    return (
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Admin Login</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Sign in with the authorized admin account to view survey results.
        </p>
        <form onSubmit={handleSignIn} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="admin-email" className="text-sm font-medium text-zinc-800">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="admin-password"
              className="text-sm font-medium text-zinc-800"
            >
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          {errorMessage ? (
            <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isSigningIn}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
          >
            {isSigningIn ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="w-full max-w-6xl space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Survey Results Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Signed in as <span className="font-medium">{sessionEmail}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadResponses}
            disabled={isLoadingResponses}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoadingResponses ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-500"
          >
            Sign Out
          </button>
        </div>
      </header>

      {errorMessage ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Unable to load responses: {errorMessage}
        </p>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
        <p className="text-sm font-medium text-zinc-800">
          Total submissions: {totalResponses}
        </p>
      </div>

      {responses.length === 0 ? (
        <p className="text-sm text-zinc-600">No survey responses yet.</p>
      ) : (
        <div className="space-y-4">
          {responses.map((response) => (
            <article
              key={response.id}
              className="rounded-xl border border-zinc-200 p-4 sm:p-5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-zinc-900">
                  {response.respondent_name?.trim()
                    ? response.respondent_name
                    : "Anonymous Respondent"}
                </p>
                <p className="text-xs text-zinc-600">
                  {new Date(response.created_at).toLocaleString()}
                </p>
              </div>

              <pre className="mt-3 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs leading-5 text-zinc-100">
                {JSON.stringify(response.answers, null, 2)}
              </pre>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

