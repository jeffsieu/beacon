export interface KnowledgeQuestion {
  id: string;
  title: string;
  type: "mc" | "tf" | "free-text" | "multi-select";
  options?: string[];
  correct?: string;
}

export interface LessonSource {
  title: string;
  url: string;
}

export interface Lesson {
  title: string;
  course: string;
  lessonId: string;
  /** Raw Markdown/MDX body (GFM + mermaid + inline HTML) */
  body: string;
  knowledgeCheck: KnowledgeQuestion[];
  sources?: LessonSource[];
}

export interface LessonMeta {
  course: string;
  slug: string;
  title: string;
  status: "pending" | "completed" | "completed_partial";
}

type MessageBase = { id: number | string };

type UserChatMessage = MessageBase &
  (
    | { role: "user"; type: "chat"; text?: string; pending?: boolean }
    | {
        role: "user";
        type: "lesson:answer-mc";
        questionId: string;
        answer: string;
        correct: boolean;
      }
    | {
        role: "user";
        type: "lesson:answer";
        questionId: string;
        questionTitle: string;
        answer: string;
      }
    | {
        role: "user";
        type: "lesson:suggestion";
        id: string;
      }
    | {
        role: "user";
        type: "lesson:generate";
        courseId?: string;
        suggestionIndex: number;
        mode: string;
        title?: string;
      }
  );

type AssistantChatMessage = MessageBase &
  (
    | { role: "assistant"; type: "chat"; text?: string; pending?: boolean }
    | {
        role: "assistant";
        type: "lesson:answer:success";
        questionId: string;
        questionTitle: string;
        answer: string;
        result: string;
        feedback: string;
        replyTo?: string;
      }
    | {
        role: "assistant";
        type: "lesson:suggestion:success";
        suggestions: LearnSuggestionItem[];
        chips: LearnSuggestionItem[];
        rationale: string;
      }
    | {
        role: "assistant";
        type: "lesson:generate:success";
        lessonId: string;
        title: string;
        course: string;
      }
    | { role: "assistant"; type: "agent:error"; text: string; replyTo?: string }
    | {
        role: "assistant";
        type: "lesson:answer:clarify";
        questionId: string;
        feedback: string;
      }
    | {
        role: "assistant";
        type: "lesson:update-pointer";
        questionId: string;
        result: "LEARNED" | "LEARNED_PARTIAL" | "NOT_LEARNED";
        itemText: string;
        feedback: string;
        replyTo: string;
      }
    | {
        role: "assistant";
        type: "lesson:observation";
        category: "bonus" | "misunderstanding" | "unknown";
        text: string;
        status?: "ACTIVE" | "CLEARED";
      }
    | {
        role: "assistant";
        type: "lesson:committed";
        summary: Array<{ item: string; status: string }>;
      }
  );

export type ChatMessage = UserChatMessage | AssistantChatMessage;

export interface GradeReply {
  type: "grade";
  questionId: string;
  result: "LEARNED" | "LEARNED_PARTIAL" | "NOT_LEARNED";
  feedback: string;
}

export interface CourseSummary {
  course: string;
  title?: string;
  description?: string;
  source?: "local" | "repository";
  totalItems: number;
  learnedCount: number;
  partialCount: number;
  notLearnedCount: number;
}

export interface KnowledgeItem {
  text: string;
  status: "LEARNED" | "LEARNED_PARTIAL" | "NOT_LEARNED";
  date?: string;
}

export interface ChapterProgress {
  chapter: string;
  title: string;
  summary?: string;
  items: KnowledgeItem[];
}

export interface CourseProgress {
  course: string;
  chapters: ChapterProgress[];
  misunderstandings: string[];
  bonuses: string[];
  stats: {
    total: number;
    learned: number;
    partial: number;
    notLearned: number;
  };
}

export interface PlacementQuestion {
  id: string;
  type: "mc" | "free-text" | "multi-select";
  title: string;
  options?: string[];
}

export interface PlacementProposed {
  learned: string[];
  learnedPartial: { item: string; gaps: string[] }[];
  misunderstandings: string[];
  bonuses: string[];
}

export type ServerStatus = "connected" | "disconnected" | "unknown";

export interface SessionState {
  sessionId: string;
  status: "active" | "ended";
}

export interface LearnSuggestionItem {
  title: string;
  description: string;
  chapters: string[];
  itemCount: number;
  courseId?: string;
  courseTitle?: string;
  items?: { text: string; chapter: string; status?: string }[];
}

export interface LearnSuggestion {
  type: "lesson:suggestion:success";
  suggestions: LearnSuggestionItem[];
  rationale?: string;
}
