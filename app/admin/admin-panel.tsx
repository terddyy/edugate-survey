
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  getSectionsForParticipant,
  LIKERT_OPTIONS,
  LikertValue,
  PARTICIPANT_TYPE_LABELS,
  ParticipantType,
  RESPONDENT_ROLE_LABELS,
  RespondentRole,
  SURVEY_SECTIONS,
} from "@/lib/survey/question-bank";

type SurveyResponse = {
  id: string;
  created_at: string;
  respondent_name: string | null;
  respondent_role: RespondentRole | null;
  participant_type: ParticipantType | null;
  answers: unknown;
  metadata: Record<string, unknown> | null;
};

type InterpretationBand = {
  label: "Very Low" | "Low" | "Neutral" | "High" | "Very High" | "No Data";
  rangeLabel: string;
};

type LikertDistribution = Record<LikertValue, number>;

type SectionSummary = {
  code: string;
  title: string;
  mean: number | null;
  answeredCount: number;
  itemCount: number;
  interpretation: InterpretationBand;
};

type QuestionSummary = {
  key: string;
  sectionCode: string;
  sectionTitle: string;
  questionId: string;
  questionText: string;
  mean: number | null;
  answeredCount: number;
  distribution: LikertDistribution;
};

type DashboardMetrics = {
  totalSubmissions: number;
  filteredSubmissions: number;
  overallMean: number | null;
  strongestConstruct: SectionSummary | null;
  weakestConstruct: SectionSummary | null;
};

type QuestionCatalogItem = {
  key: string;
  sectionCode: string;
  sectionTitle: string;
  questionId: string;
  questionText: string;
};

const ADMIN_EMAIL = "terddy03@gmail.com";
const LIKERT_VALUES: LikertValue[] = [1, 2, 3, 4, 5];

const QUESTION_CATALOG: QuestionCatalogItem[] = SURVEY_SECTIONS.flatMap((section) =>
  section.questions.map((question) => ({
    key: `${section.code}.${question.id}`,
    sectionCode: section.code,
    sectionTitle: section.title,
    questionId: question.id,
    questionText: question.text,
  })),
);

const SECTION_LOOKUP = new Map(SURVEY_SECTIONS.map((section) => [section.code, section]));
const QUESTION_LOOKUP = new Map(QUESTION_CATALOG.map((question) => [question.key, question]));

function getParticipantType(response: SurveyResponse): ParticipantType {
  if (response.participant_type === "non_tester") {
    return "non_tester";
  }

  return "pilot_tester";
}

function getRespondentRole(response: SurveyResponse): RespondentRole | null {
  if (
    response.respondent_role === "student" ||
    response.respondent_role === "faculty" ||
    response.respondent_role === "staff"
  ) {
    return response.respondent_role;
  }

  return null;
}

function getQuestionCatalogForParticipant(participantType: ParticipantType): QuestionCatalogItem[] {
  return getSectionsForParticipant(participantType).flatMap((section) =>
    section.questions.map((question) => ({
      key: `${section.code}.${question.id}`,
      sectionCode: section.code,
      sectionTitle: section.title,
      questionId: question.id,
      questionText: question.text,
    })),
  );
}

function normalizeLikertValue(value: unknown): LikertValue | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    return null;
  }

  return parsed as LikertValue;
}

function emptyDistribution(): LikertDistribution {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

function getInterpretationBand(mean: number | null): InterpretationBand {
  if (mean === null) {
    return { label: "No Data", rangeLabel: "No responses" };
  }

  if (mean <= 1.8) {
    return { label: "Very Low", rangeLabel: "1.00-1.80" };
  }

  if (mean <= 2.6) {
    return { label: "Low", rangeLabel: "1.81-2.60" };
  }

  if (mean <= 3.4) {
    return { label: "Neutral", rangeLabel: "2.61-3.40" };
  }

  if (mean <= 4.2) {
    return { label: "High", rangeLabel: "3.41-4.20" };
  }

  return { label: "Very High", rangeLabel: "4.21-5.00" };
}

function formatMean(value: number | null) {
  return value === null ? "N/A" : value.toFixed(2);
}

function getBandClasses(label: InterpretationBand["label"]) {
  if (label === "Very High") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  if (label === "High") {
    return "border-teal-300 bg-teal-50 text-teal-800";
  }

  if (label === "Neutral") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  if (label === "Low") {
    return "border-orange-300 bg-orange-50 text-orange-800";
  }

  if (label === "Very Low") {
    return "border-rose-300 bg-rose-50 text-rose-800";
  }

  return "border-zinc-300 bg-zinc-100 text-zinc-700";
}

function getLikertBarClasses(value: LikertValue) {
  if (value === 1) {
    return "bg-rose-400";
  }

  if (value === 2) {
    return "bg-orange-400";
  }

  if (value === 3) {
    return "bg-amber-400";
  }

  if (value === 4) {
    return "bg-teal-400";
  }

  return "bg-emerald-500";
}

function getDisplayName(response: SurveyResponse) {
  return response.respondent_name?.trim() ? response.respondent_name.trim() : "Anonymous Respondent";
}

function extractAnswerValue(response: SurveyResponse, sectionCode: string, questionId: string) {
  if (!response.answers || typeof response.answers !== "object") {
    return null;
  }

  const sectionAnswers = (response.answers as Record<string, unknown>)[sectionCode];
  if (!sectionAnswers || typeof sectionAnswers !== "object") {
    return null;
  }

  const rawValue = (sectionAnswers as Record<string, unknown>)[questionId];
  return normalizeLikertValue(rawValue);
}
function getResponseAnsweredCount(response: SurveyResponse) {
  const participantCatalog = getQuestionCatalogForParticipant(getParticipantType(response));
  let answered = 0;

  for (const item of participantCatalog) {
    if (extractAnswerValue(response, item.sectionCode, item.questionId) !== null) {
      answered += 1;
    }
  }

  return answered;
}

function getResponseMean(response: SurveyResponse) {
  const participantCatalog = getQuestionCatalogForParticipant(getParticipantType(response));
  let sum = 0;
  let count = 0;

  for (const item of participantCatalog) {
    const value = extractAnswerValue(response, item.sectionCode, item.questionId);
    if (value !== null) {
      sum += value;
      count += 1;
    }
  }

  return count > 0 ? sum / count : null;
}

export function AdminPanel() {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [participantFilter, setParticipantFilter] = useState<"all" | ParticipantType>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | RespondentRole>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [questionFilter, setQuestionFilter] = useState<string>("all");

  const loadResponses = useCallback(async () => {
    setIsLoadingResponses(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("survey_responses")
      .select("id, created_at, respondent_name, respondent_role, participant_type, answers, metadata")
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

  const availableQuestionOptions = useMemo(() => {
    if (sectionFilter === "all") {
      return QUESTION_CATALOG;
    }

    return QUESTION_CATALOG.filter((item) => item.sectionCode === sectionFilter);
  }, [sectionFilter]);

  const resolvedQuestionFilter = useMemo(() => {
    if (questionFilter === "all") {
      return questionFilter;
    }

    const stillValid = availableQuestionOptions.some((item) => item.key === questionFilter);
    return stillValid ? questionFilter : "all";
  }, [availableQuestionOptions, questionFilter]);

  const filteredResponses = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return responses.filter((response) => {
      if (participantFilter !== "all" && getParticipantType(response) !== participantFilter) {
        return false;
      }

      if (roleFilter !== "all" && getRespondentRole(response) !== roleFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const displayName = getDisplayName(response).toLowerCase();
      return displayName.includes(keyword);
    });
  }, [participantFilter, responses, roleFilter, searchTerm]);

  const effectiveSectionCode = useMemo(() => {
    if (resolvedQuestionFilter !== "all") {
      const questionMeta = QUESTION_LOOKUP.get(resolvedQuestionFilter);
      return questionMeta?.sectionCode ?? null;
    }

    if (sectionFilter !== "all") {
      return sectionFilter;
    }

    return null;
  }, [resolvedQuestionFilter, sectionFilter]);

  const activeSections = useMemo(() => {
    if (effectiveSectionCode) {
      const section = SECTION_LOOKUP.get(effectiveSectionCode);
      return section ? [section] : [];
    }

    return SURVEY_SECTIONS;
  }, [effectiveSectionCode]);

  const sectionSummaries = useMemo<SectionSummary[]>(() => {
    return activeSections.map((section) => {
      const activeQuestions =
        resolvedQuestionFilter === "all"
          ? section.questions
          : section.questions.filter(
              (question) => `${section.code}.${question.id}` === resolvedQuestionFilter,
            );

      let sum = 0;
      let answeredCount = 0;

      for (const response of filteredResponses) {
        for (const question of activeQuestions) {
          const value = extractAnswerValue(response, section.code, question.id);
          if (value !== null) {
            sum += value;
            answeredCount += 1;
          }
        }
      }

      const mean = answeredCount > 0 ? sum / answeredCount : null;

      return {
        code: section.code,
        title: section.title,
        mean,
        answeredCount,
        itemCount: activeQuestions.length,
        interpretation: getInterpretationBand(mean),
      };
    });
  }, [activeSections, filteredResponses, resolvedQuestionFilter]);

  const questionSummaries = useMemo<QuestionSummary[]>(() => {
    const sourceQuestions = QUESTION_CATALOG.filter((item) => {
      if (resolvedQuestionFilter !== "all") {
        return item.key === resolvedQuestionFilter;
      }

      if (sectionFilter !== "all") {
        return item.sectionCode === sectionFilter;
      }

      return true;
    });

    return sourceQuestions.map((question) => {
      const distribution = emptyDistribution();
      let sum = 0;
      let answeredCount = 0;

      for (const response of filteredResponses) {
        const value = extractAnswerValue(response, question.sectionCode, question.questionId);
        if (value !== null) {
          distribution[value] += 1;
          sum += value;
          answeredCount += 1;
        }
      }

      return {
        ...question,
        mean: answeredCount > 0 ? sum / answeredCount : null,
        answeredCount,
        distribution,
      };
    });
  }, [filteredResponses, resolvedQuestionFilter, sectionFilter]);

  const dashboardMetrics = useMemo<DashboardMetrics>(() => {
    const validSectionSummaries = sectionSummaries.filter((summary) => summary.mean !== null);

    let overallSum = 0;
    let overallCount = 0;

    for (const summary of sectionSummaries) {
      if (summary.mean !== null) {
        overallSum += summary.mean * summary.answeredCount;
        overallCount += summary.answeredCount;
      }
    }

    const sortedByMean = [...validSectionSummaries].sort((a, b) => {
      const aMean = a.mean ?? -1;
      const bMean = b.mean ?? -1;
      return bMean - aMean;
    });

    return {
      totalSubmissions: responses.length,
      filteredSubmissions: filteredResponses.length,
      overallMean: overallCount > 0 ? overallSum / overallCount : null,
      strongestConstruct: sortedByMean[0] ?? null,
      weakestConstruct: sortedByMean[sortedByMean.length - 1] ?? null,
    };
  }, [filteredResponses.length, responses.length, sectionSummaries]);

  const clearFilters = () => {
    setSearchTerm("");
    setParticipantFilter("all");
    setRoleFilter("all");
    setSectionFilter("all");
    setQuestionFilter("all");
  };

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
    clearFilters();
  };

  if (isBootstrapping) {
    return (
      <section className="w-full max-w-6xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm">
        <p className="text-sm text-[var(--color-text-muted)]">Loading admin dashboard...</p>
      </section>
    );
  }

  if (!sessionEmail) {
    return (
      <section className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Admin Login</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
          Sign in with the authorized admin account to view survey analytics.
        </p>
        <form onSubmit={handleSignIn} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="admin-email" className="text-sm font-medium text-[var(--color-text)]">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="admin-password" className="text-sm font-medium text-[var(--color-text)]">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            />
          </div>
          {errorMessage ? (
            <p className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-surface)] px-3 py-2 text-sm text-[var(--color-error-text)]">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isSigningIn}
            className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningIn ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="w-full max-w-7xl space-y-6 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-6 lg:p-8">
      <header className="space-y-4 border-b border-[var(--color-border)] pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
              EduGate Thesis Analytics Dashboard
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Signed in as <span className="font-medium text-[var(--color-text)]">{sessionEmail}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadResponses}
              disabled={isLoadingResponses}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-border-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoadingResponses ? "Refreshing..." : "Refresh Data"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-border-strong)]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {errorMessage ? (
        <section className="rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-surface)] px-4 py-3 text-sm text-[var(--color-error-text)]">
          Unable to load responses: {errorMessage}
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Total submissions</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{dashboardMetrics.totalSubmissions}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Filtered view: {dashboardMetrics.filteredSubmissions}</p>
        </article>
        <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Overall mean</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{formatMean(dashboardMetrics.overallMean)}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Across currently filtered responses</p>
        </article>
        <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Strongest construct</p>
          <p className="mt-2 text-base font-semibold text-[var(--color-text)]">
            {dashboardMetrics.strongestConstruct
              ? `${dashboardMetrics.strongestConstruct.code} (${formatMean(dashboardMetrics.strongestConstruct.mean)})`
              : "N/A"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {dashboardMetrics.strongestConstruct?.interpretation.label ?? "No responses"}
          </p>
        </article>
        <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Weakest construct</p>
          <p className="mt-2 text-base font-semibold text-[var(--color-text)]">
            {dashboardMetrics.weakestConstruct
              ? `${dashboardMetrics.weakestConstruct.code} (${formatMean(dashboardMetrics.weakestConstruct.mean)})`
              : "N/A"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {dashboardMetrics.weakestConstruct?.interpretation.label ?? "No responses"}
          </p>
        </article>
      </section>
      <section className="sticky top-2 z-30 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-4 shadow-sm backdrop-blur">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <label htmlFor="search-respondent" className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
              Search respondent
            </label>
            <input
              id="search-respondent"
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search responses"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            />
          </div>
          <div>
            <label htmlFor="participant-filter" className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
              Participant Type
            </label>
            <select
              id="participant-filter"
              value={participantFilter}
              onChange={(event) => setParticipantFilter(event.target.value as "all" | ParticipantType)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            >
              <option value="all">All Participants</option>
              <option value="pilot_tester">{PARTICIPANT_TYPE_LABELS.pilot_tester}</option>
              <option value="non_tester">{PARTICIPANT_TYPE_LABELS.non_tester}</option>
            </select>
          </div>
          <div>
            <label htmlFor="role-filter" className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
              Respondent Role
            </label>
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as "all" | RespondentRole)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            >
              <option value="all">All Roles</option>
              <option value="student">{RESPONDENT_ROLE_LABELS.student}</option>
              <option value="faculty">{RESPONDENT_ROLE_LABELS.faculty}</option>
              <option value="staff">{RESPONDENT_ROLE_LABELS.staff}</option>
            </select>
          </div>
          <div>
            <label htmlFor="section-filter" className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
              Section
            </label>
            <select
              id="section-filter"
              value={sectionFilter}
              onChange={(event) => {
                setSectionFilter(event.target.value);
                setQuestionFilter("all");
              }}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            >
              <option value="all">All Sections</option>
              {SURVEY_SECTIONS.map((section) => (
                <option key={section.code} value={section.code}>
                  {section.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="question-filter" className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
              Question
            </label>
            <select
              id="question-filter"
              value={resolvedQuestionFilter}
              onChange={(event) => setQuestionFilter(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            >
              <option value="all">All Questions</option>
              {availableQuestionOptions.map((question) => (
                <option key={question.key} value={question.key}>
                  {question.sectionCode}.{question.questionId}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-border-strong)]"
          >
            Clear filters
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">Section Means &amp; Interpretation</h2>
          <p className="text-xs text-[var(--color-text-muted)]">Scale bands: 1.00-1.80 Very Low ... 4.21-5.00 Very High</p>
        </div>

        {sectionSummaries.length === 0 ? (
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
            No matching sections for the current filter.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sectionSummaries.map((summary) => (
              <article key={summary.code} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{summary.code}</p>
                    <h3 className="mt-1 text-sm font-semibold text-[var(--color-text)]">{summary.title}</h3>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getBandClasses(summary.interpretation.label)}`}
                  >
                    {summary.interpretation.label}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-2">
                  <p className="text-3xl font-semibold text-[var(--color-text)]">{formatMean(summary.mean)}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{summary.interpretation.rangeLabel}</p>
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  Answered points: {summary.answeredCount} · Items: {summary.itemCount}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">Question Insights</h2>

        {questionSummaries.length === 0 ? (
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
            No question-level data available for the current filter.
          </p>
        ) : (
          <div className="space-y-3">
            {questionSummaries.map((summary) => (
              <article key={summary.key} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      {summary.sectionCode}.{summary.questionId}
                    </p>
                    <h3 className="mt-1 text-sm leading-6 text-[var(--color-text)]">{summary.questionText}</h3>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-right sm:min-w-28">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Mean</p>
                    <p className="text-xl font-semibold text-[var(--color-text)]">{formatMean(summary.mean)}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">n={summary.answeredCount}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {LIKERT_VALUES.map((value) => {
                    const count = summary.distribution[value];
                    const percentage = summary.answeredCount > 0 ? (count / summary.answeredCount) * 100 : 0;

                    return (
                      <div key={`${summary.key}-${value}`} className="grid grid-cols-[110px_1fr_56px] items-center gap-2">
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {value} - {LIKERT_OPTIONS[value - 1].label}
                        </p>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                          <div
                            className={`h-full rounded-full ${getLikertBarClasses(value)}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-right text-xs font-medium text-[var(--color-text)]">{count}</p>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">Response Explorer</h2>

        {filteredResponses.length === 0 ? (
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
            No responses match the current filters.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredResponses.map((response) => {
              const answeredCount = getResponseAnsweredCount(response);
              const responseMean = getResponseMean(response);
              const participantType = getParticipantType(response);
              const respondentRole = getRespondentRole(response);
              const expectedCount = getQuestionCatalogForParticipant(participantType).length;

              return (
                <article key={response.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-text)]">{getDisplayName(response)}</h3>
                      <p className="text-xs text-[var(--color-text-muted)]">{new Date(response.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1 text-[var(--color-text)]">
                        Role: {respondentRole ? RESPONDENT_ROLE_LABELS[respondentRole] : "Unspecified"}
                      </span>
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1 text-[var(--color-text)]">
                        Type: {PARTICIPANT_TYPE_LABELS[participantType]}
                      </span>
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1 text-[var(--color-text)]">
                        Mean: {formatMean(responseMean)}
                      </span>
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1 text-[var(--color-text)]">
                        Answered: {answeredCount}/{expectedCount}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {getSectionsForParticipant(participantType).map((section) => {
                      let sectionAnswered = 0;
                      for (const question of section.questions) {
                        if (extractAnswerValue(response, section.code, question.id) !== null) {
                          sectionAnswered += 1;
                        }
                      }

                      return (
                        <div key={`${response.id}-${section.code}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{section.code}</p>
                          <p className="text-sm font-medium text-[var(--color-text)]">
                            {sectionAnswered}/{section.questions.length}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <details className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium text-[var(--color-text)]">Show raw response JSON</summary>
                    <pre className="mt-2 overflow-auto rounded bg-zinc-950 p-3 text-[11px] leading-5 text-zinc-100">
                      {JSON.stringify(response.answers, null, 2)}
                    </pre>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

