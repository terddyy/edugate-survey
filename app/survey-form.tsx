"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CONSENT_CONTENT,
  getSectionsForParticipant,
  LIKERT_OPTIONS,
  LikertValue,
  PARTICIPANT_TYPE_LABELS,
  ParticipantType,
  RESPONDENT_ROLE_LABELS,
  RespondentRole,
} from "@/lib/survey/question-bank";

type ConsentChoice = "agree" | "disagree" | null;
type SubmitState = "idle" | "submitting" | "success" | "error";

type FlatAnswers = Record<string, LikertValue | undefined>;

type QuestionMeta = {
  answerKey: string;
  sectionCode: string;
  sectionTitle: string;
  questionId: string;
  questionText: string;
  sectionQuestionNumber: number;
  anchorId: string;
};

function getMissingResponsesMessage(missingCount: number) {
  return `Please review the incomplete items below. ${missingCount} response(s) still missing.`;
}

function getAnswerKey(sectionCode: string, questionId: string) {
  return `${sectionCode}.${questionId}`;
}

function buildNestedAnswers(answers: FlatAnswers, sections: ReturnType<typeof getSectionsForParticipant>) {
  const nestedAnswers: Record<string, Record<string, LikertValue>> = {};

  for (const section of sections) {
    const sectionAnswers: Record<string, LikertValue> = {};

    for (const question of section.questions) {
      const key = getAnswerKey(section.code, question.id);
      const value = answers[key];

      if (value) {
        sectionAnswers[question.id] = value;
      }
    }

    nestedAnswers[section.code] = sectionAnswers;
  }

  return nestedAnswers;
}

export function SurveyForm() {
  const [respondentRole, setRespondentRole] = useState<RespondentRole | null>(null);
  const [participantType, setParticipantType] = useState<ParticipantType | null>(null);
  const [consentChoice, setConsentChoice] = useState<ConsentChoice>(null);
  const [isConsentCollapsed, setIsConsentCollapsed] = useState(false);
  const [respondentName, setRespondentName] = useState("");
  const [answers, setAnswers] = useState<FlatAnswers>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [missingAnswerKeys, setMissingAnswerKeys] = useState<string[]>([]);
  const [startedAtClient] = useState(() => new Date().toISOString());

  const activeSurveySections = useMemo(
    () => (participantType ? getSectionsForParticipant(participantType) : []),
    [participantType],
  );

  const questionMeta = useMemo<QuestionMeta[]>(() => {
    const allQuestions: QuestionMeta[] = [];

    for (const section of activeSurveySections) {
      section.questions.forEach((question, index) => {
        const answerKey = getAnswerKey(section.code, question.id);

        allQuestions.push({
          answerKey,
          sectionCode: section.code,
          sectionTitle: section.title,
          questionId: question.id,
          questionText: question.text,
          sectionQuestionNumber: index + 1,
          anchorId: `question-${section.code}-${question.id}`,
        });
      });
    }

    return allQuestions;
  }, [activeSurveySections]);

  const questionMetaByKey = useMemo(
    () => new Map(questionMeta.map((item) => [item.answerKey, item])),
    [questionMeta],
  );

  const totalQuestions = questionMeta.length;

  const answeredCount = useMemo(
    () =>
      Object.values(answers).filter(
        (value): value is LikertValue => typeof value === "number",
      ).length,
    [answers],
  );

  const sectionProgress = useMemo(
    () =>
      activeSurveySections.map((section) => {
        const answered = section.questions.reduce((count, question) => {
          const key = getAnswerKey(section.code, question.id);
          return answers[key] ? count + 1 : count;
        }, 0);

        return {
          sectionCode: section.code,
          answered,
          total: section.questions.length,
        };
      }),
    [activeSurveySections, answers],
  );

  const computedMissingKeys = useMemo(
    () => questionMeta.filter((item) => !answers[item.answerKey]).map((item) => item.answerKey),
    [answers, questionMeta],
  );

  const missingKeysToDisplay = validationError ? missingAnswerKeys : computedMissingKeys;
  const missingQuestionMeta = missingKeysToDisplay
    .map((key) => questionMetaByKey.get(key))
    .filter((value): value is QuestionMeta => Boolean(value));
  const firstMissingQuestion = missingQuestionMeta[0] ?? null;

  const isSurveyReady =
    consentChoice === "agree" && participantType !== null && respondentRole !== null;
  const hasSubmitValidationError = validationError !== null && missingAnswerKeys.length > 0;
  const hasMissingResponses = computedMissingKeys.length > 0;

  const scrollToQuestion = (anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setValidationError(null);
    setSubmitError(null);

    if (!isSurveyReady) {
      setValidationError(
        respondentRole === null
          ? "Please select your respondent role before submitting."
          : participantType === null
          ? "Please select your participant type before submitting."
          : "You must agree to the consent form before submitting.",
      );
      return;
    }

    const missingKeys = questionMeta
      .filter((item) => !answers[item.answerKey])
      .map((item) => item.answerKey);

    setMissingAnswerKeys(missingKeys);

    if (missingKeys.length > 0) {
      setValidationError(getMissingResponsesMessage(missingKeys.length));

      const firstMissing = questionMetaByKey.get(missingKeys[0]);
      if (firstMissing) {
        scrollToQuestion(firstMissing.anchorId);
      }

      return;
    }

    setSubmitState("submitting");

    try {
      const nestedAnswers = buildNestedAnswers(answers, activeSurveySections);
      const normalizedName = respondentName.trim();
      const submittedAtClient = new Date().toISOString();

      const { supabase } = await import("@/lib/supabase/client");
      const { error } = await supabase.from("survey_responses").insert({
        respondent_name: normalizedName.length > 0 ? normalizedName : null,
        respondent_role: respondentRole,
        participant_type: participantType,
        consent_agreed: true,
        answers: nestedAnswers,
        metadata: {
          surveyVersion: "v1",
          respondentRole,
          questionnaireVariant: participantType,
          activeSectionCodes: activeSurveySections.map((section) => section.code),
          scale: LIKERT_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
          submittedAtClient,
          completionStats: {
            startedAtClient,
            submittedAtClient,
            totalQuestions,
            answeredCount,
            completionRatio: totalQuestions > 0 ? answeredCount / totalQuestions : 0,
          },
        },
      });

      if (error) {
        throw error;
      }

      setSubmitState("success");
    } catch (error) {
      setSubmitState("error");
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to submit your response at this time. Please try again.",
      );
    }
  };

  if (submitState === "success") {
    return (
      <section className="w-full max-w-3xl rounded-3xl border border-[var(--color-success-border)] bg-[var(--color-success-surface)] p-6 text-[var(--color-success-text)] shadow-sm sm:p-8">
        <h2 className="text-2xl font-semibold">Thank you for your response.</h2>
        <p className="mt-3 text-base leading-7">
          Your survey has been submitted successfully.
        </p>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full min-w-0 max-w-5xl space-y-5 overflow-x-hidden rounded-3xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 pb-28 shadow-sm sm:space-y-6 sm:p-6 sm:pb-28 md:p-8 md:pb-8"
    >
      <header className="space-y-2 border-b border-[var(--color-border)] pb-5 sm:pb-6">
        <h1 className="break-words text-2xl font-semibold tracking-tight text-[var(--color-text)] [overflow-wrap:anywhere] sm:text-3xl">
          EduGate Survey Questionnaire
        </h1>
        <p className="text-sm leading-6 text-[var(--color-text-muted)]">
          Please answer all items honestly. Name is optional.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">Part A · Respondent Role</h2>
        <p className="text-sm leading-6 text-[var(--color-text-muted)]">
          Select the option that best describes your role in the school.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.entries(RESPONDENT_ROLE_LABELS) as [RespondentRole, string][]).map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setRespondentRole(value);
                  setValidationError(null);
                }}
                className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${
                  respondentRole === value
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">Part B · Participant Type</h2>
        <p className="text-sm leading-6 text-[var(--color-text-muted)]">
          Select your questionnaire type before answering the survey items.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.entries(PARTICIPANT_TYPE_LABELS) as [ParticipantType, string][]).map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  const shouldReset = participantType !== value;
                  setParticipantType(value);
                  if (shouldReset) {
                    setAnswers({});
                    setMissingAnswerKeys([]);
                  }
                  setValidationError(null);
                }}
                className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${
                  participantType === value
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="min-w-0 break-words text-lg font-semibold text-[var(--color-text)] [overflow-wrap:anywhere] sm:text-xl">
            {CONSENT_CONTENT.title}
          </h2>
          {consentChoice === "agree" ? (
            <button
              type="button"
              onClick={() => setIsConsentCollapsed((current) => !current)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-text)] transition hover:border-[var(--color-border-strong)]"
            >
              {isConsentCollapsed ? "Review consent" : "Collapse"}
            </button>
          ) : null}
        </div>

        {!isConsentCollapsed ? (
          <div className="space-y-3 text-sm leading-6 text-[var(--color-text-soft)]">
            <p>{CONSENT_CONTENT.introduction}</p>
            <p>{CONSENT_CONTENT.informedConsent}</p>
            <p>{CONSENT_CONTENT.voluntary}</p>
            <p>{CONSENT_CONTENT.contact}</p>
            <p>{CONSENT_CONTENT.agreement}</p>
          </div>
        ) : (
          <p className="text-sm leading-6 text-[var(--color-text-muted)]">
            Consent information is collapsed. You may expand it anytime.
          </p>
        )}

        <div className="flex flex-col gap-3 pt-1 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setConsentChoice("agree");
              setIsConsentCollapsed(true);
              setValidationError(null);
            }}
            className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${
              consentChoice === "agree"
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            I Agree
          </button>
          <button
            type="button"
            onClick={() => {
              setConsentChoice("disagree");
              setIsConsentCollapsed(false);
              setValidationError(null);
            }}
            className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${
              consentChoice === "disagree"
                ? "border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] text-[var(--color-warning-text)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            I Do Not Agree
          </button>
        </div>

        {consentChoice === "disagree" ? (
          <p className="rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] px-4 py-3 text-sm text-[var(--color-warning-text)]">
            You chose not to provide consent. Survey responses cannot be submitted unless you select I Agree.
          </p>
        ) : null}
      </section>

      {isSurveyReady ? (
        <>
          <section className="sticky top-2 z-20 space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-4 shadow-sm backdrop-blur">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              Progress: {answeredCount}/{totalQuestions} answered
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
                style={{
                  width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-xs leading-5 text-[var(--color-text-muted)]">
              Scale: 1 = Strongly Disagree, 5 = Strongly Agree
            </p>
            <p className="text-xs leading-5 text-[var(--color-text-muted)]">
              Respondent Role: {respondentRole ? RESPONDENT_ROLE_LABELS[respondentRole] : "Not selected"}
            </p>
            <p className="text-xs leading-5 text-[var(--color-text-muted)]">
              Participant Type: {participantType ? PARTICIPANT_TYPE_LABELS[participantType] : "Not selected"}
            </p>
          </section>

          {hasSubmitValidationError ? (
            <section
              role="alert"
              aria-live="assertive"
              className="rounded-2xl border-2 border-[var(--color-error-border)] bg-[var(--color-error-surface)] p-4 shadow-sm"
            >
              <p className="text-sm font-semibold text-[var(--color-error-text)]">
                Submission blocked: some questions are still unanswered.
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-error-text)]">
                Unanswered questions are highlighted in red. Use the Incomplete items list to jump directly to each one.
              </p>
              {firstMissingQuestion ? (
                <button
                  type="button"
                  onClick={() => scrollToQuestion(firstMissingQuestion.anchorId)}
                  className="mt-3 rounded-lg border border-[var(--color-error-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-error-text)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error-text)] focus-visible:ring-offset-2"
                >
                  Go to first missing question
                </button>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-2 rounded-2xl border border-[var(--color-border)] p-4 sm:p-5">
            <label
              htmlFor="respondent-name"
              className="text-sm font-medium text-[var(--color-text)]"
            >
              Name (Optional)
            </label>
            <input
              id="respondent-name"
              type="text"
              value={respondentName}
              onChange={(event) => setRespondentName(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
              placeholder="Enter your name (optional)"
            />
          </section>

          {activeSurveySections.map((section) => {
            const progress = sectionProgress.find((item) => item.sectionCode === section.code);

            return (
              <section
                key={section.code}
                className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:space-y-5 sm:p-5"
              >
                <header className="space-y-2 border-b border-[var(--color-border)] pb-3">
                  <h3 className="break-words text-base font-semibold text-[var(--color-text)] [overflow-wrap:anywhere] sm:text-lg">
                    {section.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    <span>Response Format: {section.responseFormat}</span>
                    <span aria-hidden="true">•</span>
                    <span>
                      Section Progress: {progress?.answered ?? 0}/{progress?.total ?? section.questions.length}
                    </span>
                  </div>
                </header>

                <div className="space-y-4">
                  {section.questions.map((question, index) => {
                    const answerKey = getAnswerKey(section.code, question.id);
                    const meta = questionMetaByKey.get(answerKey);
                    const questionLegend = `Q${index + 1} - ${question.text}`;
                    const questionLabelId = `${answerKey}-label`;
                    const isMissing =
                      hasSubmitValidationError && missingKeysToDisplay.includes(answerKey);

                    return (
                      <fieldset
                        id={meta?.anchorId}
                        key={answerKey}
                        aria-labelledby={questionLabelId}
                        aria-invalid={isMissing}
                        className={`rounded-xl border bg-[var(--color-surface-muted)] p-4 transition ${
                          isMissing
                            ? "border-[var(--color-error-border)] bg-[var(--color-error-surface)]/40 ring-2 ring-[var(--color-error-border)]"
                            : "border-[var(--color-border)]"
                        }`}
                      >
                        <legend className="sr-only">{questionLegend}</legend>
                        <p
                          id={questionLabelId}
                          className="break-words text-sm leading-6 text-[var(--color-text)] [overflow-wrap:anywhere]"
                        >
                          {questionLegend}
                        </p>
                        {isMissing ? (
                          <p className="mt-1 text-xs font-medium text-[var(--color-error-text)]">
                            Required: select one answer before submitting.
                          </p>
                        ) : null}
                        <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                          {LIKERT_OPTIONS.map((option) => {
                            const inputId = `${answerKey}-${option.value}`;

                            return (
                              <label
                                key={option.value}
                                htmlFor={inputId}
                                className={`min-h-12 w-full cursor-pointer rounded-lg border px-2 py-2 text-center text-xs font-medium leading-4 transition focus-within:ring-2 focus-within:ring-[var(--color-accent)] focus-within:ring-offset-2 ${
                                  answers[answerKey] === option.value
                                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
                                }`}
                              >
                                <input
                                  id={inputId}
                                  name={answerKey}
                                  type="radio"
                                  value={option.value}
                                  checked={answers[answerKey] === option.value}
                                  onChange={() => {
                                    setAnswers((current) => ({
                                      ...current,
                                      [answerKey]: option.value,
                                    }));
                                    if (validationError) {
                                      setMissingAnswerKeys((current) => {
                                        const nextMissing = current.filter(
                                          (key) => key !== answerKey,
                                        );

                                        setValidationError(
                                          nextMissing.length > 0
                                            ? getMissingResponsesMessage(nextMissing.length)
                                            : null,
                                        );

                                        return nextMissing;
                                      });
                                    }
                                  }}
                                  className="sr-only"
                                />
                                <span className="block text-[11px] font-semibold">
                                  {option.value}
                                </span>
                                <span className="block break-words text-[10px] leading-4 [overflow-wrap:anywhere]">
                                  {option.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text)]">
                  Incomplete items
                </h4>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                  {computedMissingKeys.length === 0
                    ? "All questions are answered. You are ready to submit."
                    : `${computedMissingKeys.length} response(s) still missing. You can jump directly to each item below.`}
                </p>
              </div>
            </div>

            {missingQuestionMeta.length > 0 ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {missingQuestionMeta.map((item) => (
                  <li key={item.answerKey}>
                    <a
                      href={`#${item.anchorId}`}
                      className={`block break-words rounded-lg border bg-[var(--color-surface)] px-3 py-2 text-xs leading-5 transition [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                        hasSubmitValidationError
                          ? "border-[var(--color-error-border)] text-[var(--color-error-text)] hover:brightness-95 focus-visible:ring-[var(--color-error-text)]"
                          : "border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-border-strong)] focus-visible:ring-[var(--color-accent)]"
                      }`}
                    >
                      {item.sectionTitle} - Q{item.sectionQuestionNumber}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </>
      ) : null}

      {validationError ? (
        <section
          role="alert"
          aria-live="assertive"
          className="space-y-1 rounded-lg border-2 border-[var(--color-error-border)] bg-[var(--color-error-surface)] px-4 py-3 text-sm text-[var(--color-error-text)] shadow-sm"
        >
          <p className="font-semibold">
            {hasSubmitValidationError ? "Submission blocked: incomplete survey" : "Cannot submit yet"}
          </p>
          <p>{validationError}</p>
        </section>
      ) : null}

      {submitError ? (
        <p className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-surface)] px-4 py-3 text-sm text-[var(--color-error-text)]">
          Submission failed: {submitError}
        </p>
      ) : null}

      <div className="hidden items-center justify-between gap-4 border-t border-[var(--color-border)] pt-5 md:flex">
        <p className="text-sm text-[var(--color-text-muted)]">
          {isSurveyReady
            ? hasMissingResponses
              ? `${computedMissingKeys.length} incomplete response(s) - please answer all before submitting`
              : "All questions answered - ready to submit"
            : respondentRole === null
              ? "Select respondent role to unlock survey questions"
              : participantType === null
              ? "Select participant type to unlock survey questions"
              : "Agree to consent form to unlock survey submission"}
        </p>
        <button
          type="submit"
          disabled={submitState === "submitting" || !isSurveyReady}
          className="min-h-11 rounded-lg bg-[var(--color-accent)] px-6 py-2 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitState === "submitting" ? "Submitting..." : "Submit Survey"}
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 overflow-x-hidden border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 py-3 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto w-full min-w-0 max-w-5xl space-y-2">
          <p
            className={`break-words text-xs [overflow-wrap:anywhere] ${
              isSurveyReady && hasMissingResponses
                ? "font-medium text-[var(--color-error-text)]"
                : "text-[var(--color-text-muted)]"
            }`}
          >
            {isSurveyReady
              ? `${answeredCount}/${totalQuestions} answered • ${computedMissingKeys.length} missing`
              : respondentRole === null
                ? "Select respondent role to continue"
                : participantType === null
                ? "Select participant type to continue"
                : "Select I Agree to continue and submit"}
          </p>
          <button
            type="submit"
            disabled={submitState === "submitting" || !isSurveyReady}
            className="min-h-12 w-full rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitState === "submitting" ? "Submitting..." : "Submit Survey"}
          </button>
        </div>
      </div>
    </form>
  );
}
