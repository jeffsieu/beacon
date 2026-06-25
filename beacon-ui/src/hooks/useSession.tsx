import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { API } from "../api";
import type { SessionState, ChatMessage, GradeReply } from "../types";

interface SessionContextValue {
  session: SessionState | null;
  sendMessage: (payload: Record<string, unknown>) => Promise<boolean>;
  sendChat: (content: string) => Promise<void>;
  ensureSession: (courseId?: string) => Promise<string | null>;
  resumeSession: (sessionId: string) => void;
  newSession: () => void;
  replies: Record<string, GradeReply>;
  mcAnswers: Record<string, { answer: string; correct: boolean }>;
  submittedAnswers: Record<string, string>
  clarifications: Record<string, string>;
  chatMessages: ChatMessage[];
  ackedMessages: Set<string>;
  sentMessages: Set<string>;
  lessonTitle: string;
  setLessonTitle: (title: string) => void;
  selectedText: string;
  setSelectedText: (text: string) => void;
  subscribe: (type: string, handler: (data: unknown) => void) => () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

let _msgCounter = 0;
function msgId(): string {
  return `m${Date.now()}-${++_msgCounter}`;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const pendingSessionId = useRef(crypto.randomUUID());
  const [replies, setReplies] = useState<Record<string, GradeReply>>({});
  const [mcAnswers, setMcAnswers] = useState<
    Record<string, { answer: string; correct: boolean }>
  >({});
  const [submittedAnswers, setSubmittedAnswers] = useState<
    Record<string, string>
  >({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [clarifications, setClarifications] = useState<Record<string, string>>({});
  const [ackedMessages, setAckedMessages] = useState<Set<string>>(new Set());
  const [sentMessages, setSentMessages] = useState<Set<string>>(new Set());
  const [lessonTitle, setLessonTitle] = useState("Beacon");
  const [selectedText, setSelectedText] = useState("");
  const esRef = useRef<EventSource | null>(null);
  const listenersRef = useRef(new Map<string, Set<(data: unknown) => void>>());

  const subscribe = useCallback(
    (type: string, handler: (data: unknown) => void) => {
      if (!listenersRef.current.has(type)) {
        listenersRef.current.set(type, new Set());
      }
      listenersRef.current.get(type)!.add(handler);
      return () => {
        listenersRef.current.get(type)?.delete(handler);
      };
    },
    [],
  );

  const connectToSession = useCallback((sessionId: string) => {
    // Skip if already connected to this session
    if (session?.sessionId === sessionId && esRef.current?.readyState === EventSource.OPEN) return

    // Prevent duplicate EventSource connections
    if (esRef.current && esRef.current.readyState !== EventSource.CLOSED) {
      esRef.current.close()
    }
    fetch(`${API}/sessions/${sessionId}/messages`)
      .then((r) =>
        r.ok ? (r.json() as Promise<{ messages: ChatMessage[] }>) : null,
      )
      .then((data) => {
        if (data?.messages?.length) {
          setChatMessages(data.messages);
          // Restore message:ack state
          const acked = new Set<string>();
          for (const m of data.messages) {
            if ((m as any).type === "message:ack" && (m as any).replyTo) {
              acked.add((m as any).replyTo);
            }
          }
          if (acked.size > 0) setAckedMessages(acked);
          // Restore sent state: any user message with an id was successfully sent
          const sent = new Set<string>();
          for (const m of data.messages) {
            if (m.role === "user" && m.id) sent.add(String(m.id));
          }
          if (sent.size > 0) setSentMessages(sent);
          const mcMsgs = data.messages.filter(
            (m) => m.role === "user" && m.type === "lesson:answer-mc",
          );
          if (mcMsgs.length > 0) {
            const restoredMc: Record<
              string,
              { answer: string; correct: boolean }
            > = {};
            for (const m of mcMsgs) {
              if (m.role === "user" && m.type === "lesson:answer-mc")
                restoredMc[m.questionId] = {
                  answer: m.answer,
                  correct: m.correct,
                };
            }
            setMcAnswers(restoredMc);
          }
          const answerMsgs = data.messages.filter(
            (m) => m.role === "user" && m.type === "lesson:answer",
          );
          if (answerMsgs.length > 0) {
            const texts: Record<string, string> = {};
            for (const m of answerMsgs) {
              if (m.role === "user" && m.type === "lesson:answer")
                texts[m.questionId] = m.answer;
            }
            setSubmittedAnswers(texts);
          }
        }
      })
      .catch(() => {});

    esRef.current?.close();
    const es = new EventSource(`${API}/sessions/${sessionId}/events`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as Record<string, unknown>;
        const type = data.type as string;
        listenersRef.current.get(type)?.forEach((h) => h(data));
        if (type === "lesson:answer:clarify") {
          const ev = data as Record<string, unknown>
          setClarifications((prev) => ({ ...prev, [ev.questionId as string]: (ev.feedback as string) || "" }))
          setChatMessages((prev) => [
            ...prev.filter((m) => m.id !== "pending"),
            {
              role: "assistant" as const,
              type: "lesson:answer:clarify" as const,
              questionId: (ev.questionId as string) || "",
              feedback: (ev.feedback as string) || "",
              id: (ev.messageId as string) || Date.now(),
            },
          ])
        } else if (type === "lesson:answer:success") {
          const ev = data as Record<string, unknown>;
          const gradeResult = (ev.result as string) || "INCORRECT";
          const mappedResult =
            gradeResult === "CORRECT"
              ? "LEARNED"
              : gradeResult === "PARTIALLY_CORRECT"
                ? "LEARNED_PARTIAL"
                : "NOT_LEARNED";
          setReplies((prev) => ({
            ...prev,
            [ev.questionId as string]: {
              type: "grade" as const,
              questionId: ev.questionId as string,
              result: mappedResult as
                | "LEARNED"
                | "LEARNED_PARTIAL"
                | "NOT_LEARNED",
              feedback: ev.feedback as string,
            },
          }));
          setSubmittedAnswers((prev) => ({
            ...prev,
            [ev.questionId as string]: ev.answer as string,
          }));
          setChatMessages((prev) => [
            ...prev.filter((m) => m.id !== "pending"),
            {
              role: "assistant",
              type: "lesson:answer:success" as const,
              questionId: (ev.questionId as string) || "",
              questionTitle: (ev.questionTitle as string) || "",
              answer: (ev.answer as string) || "",
              result: gradeResult,
              feedback: (ev.feedback as string) || "",
              replyTo: (ev.replyTo as string) || "",
              id: (ev.messageId as string) || Date.now(),
            },
          ]);
        } else if (type === "agent:error") {
          setChatMessages((prev) => [
            ...prev.filter((m) => m.id !== "pending"),
            {
              role: "assistant" as const,
              type: "agent:error" as const,
              text: (data as any).text as string,
              replyTo: (data as any).replyTo as string,
              id: ((data as any).messageId as string) || Date.now(),
            },
          ]);
        } else if (type === "lesson:update-pointer") {
          const ev = data as Record<string, unknown>;
          setChatMessages((prev) => [
            ...prev.filter((m) => m.id !== "pending"),
            {
              role: "assistant" as const,
              type: "lesson:update-pointer" as const,
              questionId: (ev.questionId as string) || "",
              result:
                (ev.result as "LEARNED" | "LEARNED_PARTIAL" | "NOT_LEARNED") ||
                "NOT_LEARNED",
              itemText: (ev.itemText as string) || "",
              feedback: (ev.feedback as string) || "",
              replyTo: (ev.replyTo as string) || "",
              id: (ev.messageId as string) || msgId(),
            },
          ]);
        } else if (type === "lesson:answer-mc") {
          const ev = data as Record<string, unknown>;
          setMcAnswers((prev) => ({
            ...prev,
            [ev.questionId as string]: {
              answer: ev.answer as string,
              correct: ev.correct as boolean,
            },
          }));
        } else if (type === "chat") {
          setChatMessages((prev) => [
            ...prev.filter((m) => m.id !== "pending"),
            {
              role: "assistant",
              type: "chat" as const,
              text: (data.text as string) || "",
              id: Date.now(),
            },
          ]);
        } else if (type === "lesson:committed") {
          setChatMessages((prev) => [
            ...prev.filter((m) => m.id !== "pending"),
            {
              role: "assistant",
              type: "lesson:committed" as const,
              summary: (data.summary as any) || [],
              id: (data.messageId as string) || Date.now(),
            },
          ]);
        } else if (type === "lesson:suggestion:success") {
          setChatMessages((prev) => [
            ...prev.filter((m) => m.id !== "pending"),
            {
              role: "assistant",
              type: "lesson:suggestion:success" as const,
              suggestions: (data.suggestions as any) || [],
              chips: (data.chips as any) || [],
              rationale: (data.rationale as string) || "",
              id: (data.messageId as string) || Date.now(),
            },
          ]);
        } else if (type === "lesson:generate:success") {
          setChatMessages((prev) => [
            ...prev.filter((m) => m.id !== "pending"),
            {
              role: "assistant",
              type: "lesson:generate:success" as const,
              lessonId: data.lessonId as string,
              title: data.title as string,
              course: data.course as string,
              id: (data.messageId as string) || Date.now(),
            },
          ]);
        } else if (type === "message:ack") {
          const replyTo = data.replyTo as string;
          if (replyTo) setAckedMessages((prev) => new Set(prev).add(replyTo));
        }
      } catch {}
    };
    esRef.current = es;
    setSession({ sessionId, status: "active" });
    sessionStorage.setItem("beacon-session", sessionId);
  }, []);

  // Resume session from URL param or sessionStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let sid = params.get("sessionId");
    if (!sid) sid = sessionStorage.getItem("beacon-session");
    if (sid) connectToSession(sid);
  }, [connectToSession]);

  const ensureSession = useCallback(
    async (courseId?: string): Promise<string | null> => {
      // Use existing session
      if (session?.sessionId) return session.sessionId;
      // Create with the pre-generated UUID
      const sid = pendingSessionId.current;
      try {
        const r = await fetch(`${API}/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId: courseId || null, sessionId: sid }),
        });
        if (!r.ok) return null;
        sessionStorage.setItem("beacon-session", sid);
        connectToSession(sid);
        return sid;
      } catch {
        return null;
      }
    },
    [session, connectToSession],
  );

  const resumeSession = useCallback(
    (sessionId: string) => {
      sessionStorage.setItem("beacon-session", sessionId);
      connectToSession(sessionId);
    },
    [connectToSession],
  );

  const sendMessage = useCallback(
    async (payload: Record<string, unknown>): Promise<boolean> => {
      let sid: string | undefined = session?.sessionId;
      if (!sid) {
        sid = (await ensureSession()) ?? undefined;
        if (!sid) return false;
      }
      try {
        if (!payload.messageId) payload.messageId = msgId();

        // Show user action as a bubble immediately
        if (payload.type === "lesson:answer") {
          setChatMessages((prev) => [
            ...prev,
            {
              role: "user" as const,
              type: "lesson:answer" as const,
              questionId: payload.questionId as string,
              questionTitle: payload.questionTitle as string,
              answer: payload.answer as string,
              id: payload.messageId as string,
            },
          ]);
        } else if (payload.type === "lesson:generate") {
          setChatMessages((prev) => [
            ...prev,
            {
              role: "user" as const,
              type: "lesson:generate" as const,
              title: (payload.title as string) || "Generating lesson…",
              suggestionIndex: (payload.suggestionIndex as number) ?? 0,
              mode: (payload.mode as string) || "browser",
              id: payload.messageId as string,
            },
          ]);
        } else if (payload.type === "lesson:suggestion") {
          setChatMessages((prev) => [
            ...prev,
            {
              role: "user" as const,
              type: "lesson:suggestion" as const,
              id: payload.messageId as string,
            },
          ]);
        }

        const res = await fetch(`${API}/sessions/${sid}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page: window.location.pathname, ...payload }),
        });
        if (res.ok && payload.messageId) {
          setSentMessages((prev) =>
            new Set(prev).add(payload.messageId as string),
          );
        }
        return res.ok;
      } catch {
        return false;
      }
    },
    [session, ensureSession],
  );

  const sendChat = useCallback(
    async (content: string) => {
      const id = msgId();
      setChatMessages((prev) => [
        ...prev,
        { role: "user", type: "chat" as const, text: content, id },
        {
          role: "assistant",
          type: "chat" as const,
          text: "…",
          id: "pending",
          pending: true,
        },
      ]);
      await sendMessage({ type: "chat", messageId: id, content });
    },
    [sendMessage],
  );

  const newSession = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    pendingSessionId.current = crypto.randomUUID();
    sessionStorage.removeItem("beacon-session");
    setSession(null);
    setChatMessages([]);
    setAckedMessages(new Set());
    setSentMessages(new Set());
    setReplies({});
    setMcAnswers({});
    setSubmittedAnswers({});
    setLessonTitle("Beacon");
  }, []);

  return (
    <SessionContext.Provider
      value={{
        session,
        sendMessage,
        sendChat,
        ensureSession,
        resumeSession,
        newSession,
        replies,
        mcAnswers,
        submittedAnswers,
        clarifications,
        chatMessages,
        ackedMessages,
        sentMessages,
        lessonTitle,
        setLessonTitle,
        selectedText,
        setSelectedText,
        subscribe,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
