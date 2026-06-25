import { useRef, useState } from "react";
import { Link } from "react-router";
import { useSession } from "../hooks/useSession";
import { sendSessionMessage, encodeCourseId } from "../api";
import type { LearnSuggestionItem, LessonMeta } from "../types";
import {
  Sparkles,
  BookOpen,
  Send,
  ChevronDown,
  CheckCircle2,
  Circle,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkdownRenderer from "./MarkdownRenderer";

interface Props {
  courseId?: string;
  suggestions: LearnSuggestionItem[] | null;
  chips: LearnSuggestionItem[] | null;
  rationale: string | null;
  loading: boolean;
  recentLesson?: LessonMeta | null;
  onSend: (content: string) => void;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="block text-[0.68rem] font-semibold tracking-[0.15em] uppercase mb-3"
      style={{ color: "var(--c-muted)", fontFamily: "var(--font-family-ui)" }}
    >
      {children}
    </span>
  );
}

function WhatYoullLearn({
  items,
}: {
  items: Array<{ text: string; chapter: string; status?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const grouped: Record<string, typeof items> = {};
  for (const item of items) {
    (grouped[item.chapter] ||= []).push(item);
  }
  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        className="text-[0.68rem] gap-1.5"
        onClick={() => setOpen(!open)}
      >
        What you'll learn
        <ChevronDown
          size={10}
          style={{
            transform: open ? "rotate(180deg)" : "",
            transition: "transform 0.15s",
          }}
        />
      </Button>
      {open && (
        <div className="mt-2 grid gap-3 w-full max-w-2xl">
          {Object.entries(grouped).map(([ch, chItems]) => (
            <div
              key={ch}
              className="rounded-lg px-3 py-2 w-full"
              style={{
                background: "var(--c-surface)",
                border: "1px solid var(--c-border)",
              }}
            >
              <div
                className="text-[0.62rem] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "var(--c-muted)" }}
              >
                {ch.replace(/-/g, " ")}
              </div>
              {chItems.map((item, k) => {
                const isLearned = item.status === "LEARNED";
                const isPartial = item.status === "LEARNED_PARTIAL";
                return (
                  <div
                    key={k}
                    className="flex items-start gap-2 text-xs py-1.5"
                    style={{
                      fontFamily: "var(--font-family-ui)",
                      color: "var(--c-muted)",
                      lineHeight: 1.3,
                    }}
                  >
                    {isLearned ? (
                      <CheckCircle2
                        size={12}
                        className="flex-shrink-0 mt-0.5"
                        style={{ color: "var(--c-green)" }}
                      />
                    ) : isPartial ? (
                      <Circle
                        size={12}
                        className="flex-shrink-0 mt-0.5"
                        style={{ color: "var(--c-accent)" }}
                      />
                    ) : (
                      <XCircle
                        size={12}
                        className="flex-shrink-0 mt-0.5"
                        style={{ color: "var(--c-border)" }}
                      />
                    )}
                    <span
                      style={{
                        opacity: isLearned ? 0.6 : 1,
                        textDecoration: isLearned ? "line-through" : "none",
                      }}
                    >
                      <MarkdownRenderer content={item.text} />
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContinueLearning({
  courseId,
  suggestions,
  chips,
  rationale,
  loading,
  recentLesson,
  onSend,
}: Props) {
  const { ensureSession } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);

  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);

  const primarySuggestion = suggestions?.[0];
  const remainingSuggestions = suggestions?.slice(1) || [];
  const showContinueCard = primarySuggestion || recentLesson;

  function handleSend() {
    const value = inputRef.current?.value;
    if (value) {
      onSend(value);
      inputRef.current!.value = "";
    }
  }

  const isEmpty = !primarySuggestion && (!chips || chips.length === 0);

  return (
    <>
      {/* ── Continue where you left off ───────────────────────────────── */}
      {showContinueCard && (
        <div className="mt-8">
          <Eyebrow>Continue where you left off</Eyebrow>

          {/* Agent-suggested card */}
          {primarySuggestion && (
            <div
              className="rounded-[18px] overflow-hidden"
              style={{
                background: "var(--c-surface)",
                border: "1px solid var(--c-border)",
                boxShadow:
                  "0 0 24px -4px var(--c-accent-glow, rgba(224,144,12,0.25)), 0 4px 16px -8px rgba(0,0,0,0.15)",
              }}
            >
              <div className="flex items-start gap-6 p-5">
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold text-sm mb-1"
                    style={{
                      fontFamily: "var(--font-family-ui)",
                      color: "var(--c-text)",
                    }}
                  >
                    {primarySuggestion.title}
                  </h3>
                  <p
                    className="text-xs leading-relaxed"
                    style={{
                      fontFamily: "var(--font-family-ui)",
                      color: "var(--c-muted)",
                    }}
                  >
                    {primarySuggestion.description}
                  </p>
                </div>
                <button
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "var(--c-accent)", color: "#231B08" }}
                  disabled={generatingIndex !== null}
                  onClick={async () => {
                    setGeneratingIndex(0);
                    const sessionId = await ensureSession(courseId);
                    if (!sessionId) {
                      setGeneratingIndex(null);
                      return;
                    }
                    await sendSessionMessage(sessionId, {
                      type: "lesson:generate",
                      suggestionIndex: 0,
                      mode: "browser",
                      courseId,
                      title: primarySuggestion.title,
                    });
                  }}
                  onMouseEnter={(e) => {
                    if (generatingIndex === null)
                      (e.currentTarget as HTMLElement).style.filter =
                        "brightness(0.9)";
                  }}
                  onMouseLeave={(e) => {
                    if (generatingIndex === null)
                      (e.currentTarget as HTMLElement).style.filter = "";
                  }}
                >
                  {generatingIndex === 0 ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  {generatingIndex === 0 ? "Generating…" : "Generate"}
                </button>
              </div>

              {/* What you'll learn — above divider */}
              <div className="px-5 pt-0.5 pb-2">
                <WhatYoullLearn items={primarySuggestion.items || []} />
              </div>

              {/* Divider + agent message */}
              {rationale && (
                <>
                  <div
                    className="border-t"
                    style={{ borderColor: "var(--c-border)" }}
                  />
                  <div
                    className="px-5 py-3 flex items-center gap-1.5"
                    style={{
                      fontFamily: "var(--font-family-ui)",
                      fontSize: "0.72rem",
                      color: "var(--c-muted)",
                    }}
                  >
                    <Sparkles size={12} style={{ color: "var(--c-accent)" }} />
                    <span>{rationale}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Fallback: recent lesson (dashboard) */}
          {!primarySuggestion && recentLesson && (
            <div
              className="rounded-[18px] overflow-hidden"
              style={{
                background: "var(--c-surface)",
                border: "1px solid var(--c-border)",
                borderLeft: "3px solid var(--c-accent)",
              }}
            >
              <div className="flex items-center gap-6 p-5">
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold text-sm"
                    style={{
                      fontFamily: "var(--font-family-ui)",
                      color: "var(--c-text)",
                    }}
                  >
                    {recentLesson.title || recentLesson.slug}
                  </h3>
                  <p
                    className="text-xs mt-0.5 capitalize"
                    style={{
                      fontFamily: "var(--font-family-ui)",
                      color: "var(--c-muted)",
                    }}
                  >
                    {recentLesson.course}
                  </p>
                </div>
                <Link
                  to={`/${encodeCourseId(recentLesson.course)}/lessons/${recentLesson.slug}`}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-xs font-medium no-underline transition-colors"
                  style={{ background: "var(--c-accent)", color: "#231B08" }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.filter =
                      "brightness(0.9)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.filter = "")
                  }
                >
                  <BookOpen size={12} />
                  Resume
                </Link>
              </div>
            </div>
          )}

          {/* Remaining suggestions */}
          {remainingSuggestions.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {remainingSuggestions.map((sug, i) => (
                <div
                  key={i}
                  className="rounded-[14px] overflow-hidden"
                  style={{
                    background: "var(--c-surface)",
                    border: "1px solid var(--c-border)",
                  }}
                >
                  <div className="flex items-start gap-4 p-4 pb-2">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-semibold text-sm mb-0.5"
                        style={{
                          fontFamily: "var(--font-family-ui)",
                          color: "var(--c-text)",
                        }}
                      >
                        {sug.title}
                      </h3>
                      <p
                        className="text-xs leading-relaxed"
                        style={{
                          fontFamily: "var(--font-family-ui)",
                          color: "var(--c-muted)",
                        }}
                      >
                        {sug.description}
                      </p>
                    </div>
                    <button
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border"
                      style={{
                        background: "transparent",
                        color: "var(--c-accent)",
                        borderColor: "var(--c-accent-border, var(--c-accent))",
                      }}
                      disabled={generatingIndex !== null}
                      onClick={async () => {
                        setGeneratingIndex(i + 1);
                        const sessionId = await ensureSession(courseId);
                        if (!sessionId) {
                          setGeneratingIndex(null);
                          return;
                        }
                        await sendSessionMessage(sessionId, {
                          type: "lesson:generate",
                          suggestionIndex: i + 1,
                          mode: "browser",
                          courseId,
                          title: sug.title,
                        });
                      }}
                      onMouseEnter={(e) => {
                        if (generatingIndex === null)
                          (e.currentTarget as HTMLElement).style.background =
                            "var(--c-accent-sub)";
                      }}
                      onMouseLeave={(e) => {
                        if (generatingIndex === null)
                          (e.currentTarget as HTMLElement).style.background =
                            "transparent";
                      }}
                    >
                      {generatingIndex === i + 1 ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      {generatingIndex === i + 1 ? "Generating…" : "Generate"}
                    </button>
                  </div>
                  {sug.items && sug.items.length > 0 && (
                    <div className="px-4 pb-3">
                      <WhatYoullLearn items={sug.items || []} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Explore something else ────────────────────────────────────── */}
      <div className="mt-10">
        <Eyebrow>Explore something else</Eyebrow>

        <div className="relative mb-4">
          <input
            ref={inputRef}
            type="text"
            placeholder="Tweak these suggestions or ask for something new…"
            className="w-full h-11 pl-4 pr-12 rounded-[12px] text-sm border outline-none transition-colors"
            style={{
              background: "var(--c-surface)",
              borderColor: "var(--c-border)",
              color: "var(--c-text)",
              fontFamily: "var(--font-family-ui)",
            }}
            disabled={loading}
            onFocus={(e) =>
              ((e.currentTarget as HTMLElement).style.borderColor =
                "var(--c-accent)")
            }
            onBlur={(e) =>
              ((e.currentTarget as HTMLElement).style.borderColor =
                "var(--c-border)")
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
          />
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-[10px] transition-colors"
            style={{ color: "var(--c-muted)" }}
            onClick={handleSend}
            disabled={loading}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--c-surface-2)";
                (e.currentTarget as HTMLElement).style.color = "var(--c-text)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--c-muted)";
            }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && isEmpty && (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full animate-pulse"
                style={{
                  background: "var(--c-surface-2)",
                  border: "1px solid var(--c-border)",
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: "var(--c-border)" }}
                />
                <div
                  className="h-3 rounded"
                  style={{
                    width: `${[90, 110, 75][i - 1]}px`,
                    background: "var(--c-border)",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Tweak chips */}
        {chips && chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((c, i) => (
              <button
                key={i}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-colors duration-150"
                style={{
                  background: "var(--c-surface)",
                  border: "1px solid var(--c-border)",
                  color: "var(--c-text)",
                  fontFamily: "var(--font-family-ui)",
                }}
                onClick={() => {
                  if (inputRef.current)
                    inputRef.current.value = `Teach me about ${c.title.toLowerCase()}`;
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--c-accent-border)";
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--c-accent-sub)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--c-border)";
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--c-surface)";
                }}
              >
                <Sparkles size={10} style={{ color: "var(--c-muted)" }} />
                {c.title}
                {c.courseTitle && (
                  <span className="ml-1 opacity-60">({c.courseTitle})</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
