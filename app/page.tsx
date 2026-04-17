import { SurveyForm } from "./survey-form";

const isSurveyEnabled = process.env.NEXT_PUBLIC_SURVEY_ENABLED === "true";

export default function Home() {
  if (!isSurveyEnabled) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-12 text-[var(--color-text)] sm:px-6 sm:py-20">
        <section className="w-full max-w-2xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight">EduGate Survey</h1>
          <p className="mt-4 text-base leading-7 text-[var(--color-text-muted)]">
            The survey is currently unavailable. Please check back later.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--background)] px-3 py-4 text-[var(--color-text)] sm:px-4 sm:py-6 md:px-6 md:py-10">
      <div className="mx-auto w-full min-w-0 max-w-5xl">
        <SurveyForm />
      </div>
    </main>
  );
}
