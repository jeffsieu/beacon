import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { useCourseProgress } from "../hooks/useCourseProgress";
import { useCourses } from "../hooks/useCourses";
import { useLessonsQuery, useCourseSuggestionsQuery } from "../hooks/queries";
import { useSession } from "../hooks/useSession";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import ProgressRing from "./ProgressRing";
import MarkdownRenderer from "./MarkdownRenderer";
import { sendSessionMessage, encodeCourseId, decodeCourseId } from "../api";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Circle,
  XIcon,
  XCircle,
  ArrowLeft,
  Library,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import ContinueLearning from "./ContinueLearning";
import LessonList from "./LessonList";

function courseColor(course: string): string {
  const colors = [
    "#E0900C",
    "#138C8A",
    "#3A9D5D",
    "#9B59B6",
    "#2980B9",
    "#E67E22",
    "#16A085",
    "#8E44AD",
    "#2C3E50",
    "#C0392B",
  ];
  let h = 0;
  for (let i = 0; i < course.length; i++)
    h = (h * 31 + course.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
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

export default function CourseOverview() {
  const { course: encodedCourse } = useParams<{ course: string }>();
const course = decodeCourseId(encodedCourse!);
  const { progress, error } = useCourseProgress(course!);
  const { courses } = useCourses();
  const { data: allLessons } = useLessonsQuery();
  const { session, ensureSession, subscribe } = useSession();
  const courseMeta = courses?.find((c) => c.course === course);
  const lessons = allLessons?.filter((l) => l.course === course) ?? null;
  const [outlineOpen, setOutlineOpen] = useState(false);
  const queryClient = useQueryClient();
  const [waiting, setWaiting] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const { data: suggestionsData, isFetching } = useCourseSuggestionsQuery(
    course!,
  );
  const suggestions = suggestionsData?.suggestions?.length
    ? suggestionsData.suggestions
    : null;
  const chips = suggestionsData?.chips?.length ? suggestionsData.chips : null;
  const rationale = suggestionsData?.rationale || null;

  const learnMutation = useMutation({
    mutationFn: async (content: string) => {
      setWaiting(true);
      const sid = await ensureSession(course);
      if (!sid) throw new Error("no session");
      await sendSessionMessage(sid, {
        type: "lesson:suggestion",
        content,
        courseId: course,
        source: "course",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["courseSuggestions", course],
      });
    },
  });

  // SSE: clear waiting when agent responds
  useEffect(() => {
    return subscribe("lesson:suggestion:success", () => {
      queryClient.invalidateQueries({
        queryKey: ["courseSuggestions", course],
      });
      setWaiting(false);
    });
  }, [subscribe, queryClient, course]);

  // Auto-request suggestions when cache is empty
  useEffect(() => {
    if (!session?.sessionId || !suggestionsData || learnMutation.isPending) return;
    if (!suggestionsData.suggestions?.length) learnMutation.mutate("");
  }, [session?.sessionId, suggestionsData, course, learnMutation.isPending]);

  const { stats, chapters } = progress || {
    stats: { total: 0, learned: 0, partial: 0, notLearned: 0 },
    chapters: [],
  };

  // Auto-select first chapter for the outline modal
  useEffect(() => {
    if (chapters.length > 0 && !selectedChapter) {
      setSelectedChapter(chapters[0].chapter);
    }
  }, [chapters, selectedChapter]);

  if (error)
    return (
      <div className="max-w-2xl mx-auto px-8 py-12">
        <Link
          to="/dashboard"
          className="text-sm no-underline flex items-center gap-1.5 mb-8"
          style={{
            color: "var(--c-muted)",
            fontFamily: "var(--font-family-ui)",
          }}
        >
          ← Back
        </Link>
        <div
          className="rounded-xl px-5 py-4 border-l-4"
          style={{
            background: "var(--c-red-sub)",
            borderLeftColor: "var(--c-red)",
          }}
        >
          <p
            className="text-sm font-semibold mb-1"
            style={{
              color: "var(--c-red)",
              fontFamily: "var(--font-family-ui)",
            }}
          >
            Failed to load progress
          </p>
          <p
            className="text-xs"
            style={{
              color: "var(--c-muted)",
              fontFamily: "var(--font-family-mono)",
            }}
          >
            {error}
          </p>
        </div>
      </div>
    );

  if (!progress)
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: "calc(100vh - var(--chrome-h))" }}
      >
        <div
          className="text-sm"
          style={{
            color: "var(--c-muted)",
            fontFamily: "var(--font-family-ui)",
          }}
        >
          Loading…
        </div>
      </div>
    );

  const pct =
    stats.total > 0
      ? Math.round(((stats.learned + stats.partial * 0.5) / stats.total) * 100)
      : 0;
  const glowColor = courseColor(course!);

  return (
    <div style={{ background: "var(--c-bg)", minHeight: "100vh" }}>
      {/* ── Header band ────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-8 pt-10 pb-8"
        style={{
          background:
            "linear-gradient(180deg, var(--c-surface) 0%, var(--c-bg) 100%)",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-30%",
            right: "-10%",
            width: "500px",
            height: "500px",
            background: `radial-gradient(circle, ${glowColor}18 0%, transparent 70%)`,
          }}
        />

        <div className="max-w-3xl mx-auto relative">
          <Link
            to="/dashboard"
            className="text-sm no-underline flex items-center gap-1.5 mb-8"
            style={{
              color: "var(--c-muted)",
              fontFamily: "var(--font-family-ui)",
            }}
          >
            <ArrowLeft size={14} />
            Back
          </Link>

          <div className="flex items-start gap-8">
            <div className="flex-1 min-w-0">
              <Eyebrow>Course</Eyebrow>
              <h1
                className="mb-3"
                style={{
                  fontFamily: "var(--font-family-display)",
                  fontWeight: 600,
                  fontSize: "42px",
                  letterSpacing: "-0.02em",
                  color: "var(--c-text)",
                  lineHeight: 1.15,
                }}
              >
                {courseMeta?.title ?? course}
              </h1>
              {courseMeta?.description && (
                <p
                  className="text-base mb-5"
                  style={{
                    fontFamily: "var(--font-family-ui)",
                    color: "var(--c-muted)",
                    maxWidth: "520px",
                    lineHeight: 1.5,
                  }}
                >
                  {courseMeta.description}
                </p>
              )}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOutlineOpen(true)}
                  className="text-xs gap-1.5"
                >
                  <Library size={14} />
                  What you'll learn
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() =>
                    (window.location.href = `/${encodeCourseId(course)}/placement`)
                  }
                >
                  <CheckCircle2 size={14} />
                  Take placement test
                </Button>
              </div>
            </div>

            <div className="flex-shrink-0 relative inline-flex items-center justify-center">
              <ProgressRing
                percent={pct}
                size={84}
                strokeWidth={6}
                color="#54B978"
              />
              <span
                className="absolute font-semibold"
                style={{
                  fontFamily: "var(--font-family-ui)",
                  fontSize: "1.05rem",
                  color: "var(--c-text)",
                }}
              >
                {pct}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8">
        <div className="max-w-3xl mx-auto">
        <ContinueLearning
          courseId={course}
          suggestions={suggestions}
          chips={chips}
          rationale={rationale}
          loading={waiting || learnMutation.isPending || isFetching}
          onSend={(content) => learnMutation.mutate(content)}
        />

        {lessons && lessons.length > 0 && (
          <div className="mt-10 pb-12">
            <Eyebrow>Lessons</Eyebrow>
            <LessonList lessons={lessons} />
          </div>
        )}
        </div>
      </div>

      <Dialog open={outlineOpen} onOpenChange={setOutlineOpen}>
        <DialogContent
          className="!max-w-4xl w-full max-h-[85vh] flex flex-col p-0 gap-0"
          showCloseButton={false}
        >
          <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b flex-shrink-0">
            <DialogTitle
              className="text-sm font-semibold"
              style={{ fontFamily: "var(--font-family-ui)" }}
            >
              What you'll learn
            </DialogTitle>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  style={{ color: "var(--c-muted)" }}
                />
              }
            >
              <XIcon />
            </DialogClose>
          </DialogHeader>
          <div className="flex-1 flex min-h-0">
            {/* Left: chapter list */}
            <div
              className="w-56 flex-shrink-0 overflow-y-auto py-2"
              style={{ borderRight: "1px solid var(--c-border)" }}
            >
              {chapters.map((ch: import("../types").ChapterProgress) => {
                const chLearned = ch.items.filter(
                  (i) => i.status === "LEARNED",
                ).length;
                const chTotal = ch.items.length;
                const isActive = selectedChapter === ch.chapter;
                return (
                  <button
                    key={ch.chapter}
                    onClick={() => setSelectedChapter(ch.chapter)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm capitalize transition-colors duration-100"
                    style={{
                      fontFamily: "var(--font-family-ui)",
                      color: isActive ? "var(--c-text)" : "var(--c-muted)",
                      background: isActive
                        ? "var(--c-surface-2)"
                        : "transparent",
                      borderLeft: isActive
                        ? "2px solid var(--c-accent)"
                        : "2px solid transparent",
                    }}
                  >
                    <span className="flex-1 truncate">
                      {ch.title}
                    </span>
                    <span
                      className="text-xs flex-shrink-0"
                      style={{ color: "var(--c-muted)" }}
                    >
                      {chLearned}/{chTotal}
                    </span>
                    {isActive && (
                      <ChevronRight
                        size={14}
                        className="flex-shrink-0"
                        style={{ color: "var(--c-accent)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right: chapter detail */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {(() => {
                const active = chapters.find(
                  (c: import("../types").ChapterProgress) =>
                    c.chapter === selectedChapter,
                );
                if (!active) {
                  return (
                    <div className="flex items-center justify-center h-full">
                      <span
                        className="text-sm"
                        style={{
                          color: "var(--c-muted)",
                          fontFamily: "var(--font-family-ui)",
                        }}
                      >
                        Select a chapter to see its items
                      </span>
                    </div>
                  );
                }
                return (
                  <>
                    <h3
                      className="text-sm font-semibold mb-4"
                      style={{
                        fontFamily: "var(--font-family-ui)",
                        color: "var(--c-text)",
                      }}
                    >
                      {active.title}
                    </h3>
                    <div className="grid gap-1">
                      {active.items.map(
                        (
                          item: import("../types").KnowledgeItem,
                          idx: number,
                        ) => {
                          const StatusIcon =
                            item.status === "LEARNED"
                              ? CheckCircle2
                              : item.status === "LEARNED_PARTIAL"
                                ? Circle
                                : XCircle;
                          const statusColor =
                            item.status === "LEARNED"
                              ? "var(--c-green)"
                              : item.status === "LEARNED_PARTIAL"
                                ? "var(--c-accent)"
                                : "var(--c-border)";
                          return (
                            <div
                              key={idx}
                              className="flex items-start gap-3 py-2 rounded-lg"
                              style={{ background: "var(--c-surface)" }}
                            >
                              <StatusIcon
                                size={14}
                                className="mt-0.5 flex-shrink-0"
                                style={{ color: statusColor }}
                              />
                              <span
                                className="text-sm"
                                style={{
                                  fontFamily: "var(--font-family-ui)",
                                  color: "var(--c-text)",
                                  lineHeight: "1.4",
                                }}
                              >
                                <MarkdownRenderer content={item.text} />
                              </span>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
