import {
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useState,
  KeyboardEvent,
  ChangeEvent,
  RefObject,
} from "react";
import {
  X,
  Send,
  CheckCircle2,
  Circle,
  XCircle,
  Lightbulb,
  AlertTriangle,
  HelpCircle,
  History,
  Plus,
  Check,
  CheckCheck,
  Sparkles,
  ChevronDown,
  PanelLeftClose,
} from "lucide-react";
import { useSession } from "../hooks/useSession.tsx";
import { fetchSessions, type SessionSummary } from "../api";
import type { ChatMessage } from "../types";
import MarkdownRenderer from "./MarkdownRenderer.tsx";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Textarea } from "@/components/ui/textarea";

interface InputBarProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
}

function InputBar({
  inputRef,
  value,
  onChange,
  onKeyDown,
  onSend,
  disabled,
  placeholder,
}: InputBarProps) {
  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden transition-colors duration-150"
      style={{
        border: `1px solid var(--c-border)`,
        background: "var(--c-bg)",
      }}
    >
      <Textarea
        ref={inputRef}
        className="w-full px-3 py-2.5 text-[0.83rem] resize-none leading-snug bg-transparent border-0 focus-visible:ring-0 focus-visible:border-0 rounded-none min-h-[90px] max-h-[200px]"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        rows={5}
        placeholder={placeholder}
        disabled={disabled}
      />
      <div className="flex justify-end px-2 pb-2">
        <Button
          variant={value.trim() && !disabled ? "default" : "ghost"}
          size="sm"
          className="gap-1"
          onClick={onSend}
          disabled={!value.trim() || disabled}
        >
          <Send size={12} /> Send
        </Button>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onToggle: () => void;
}

function quotedContent(msg: ChatMessage): string | null {
  if (msg.type === "chat") return (msg as any).text;
  if (msg.type === "lesson:answer" || msg.type === "lesson:answer-mc")
    return (msg as any).answer;
  return null;
}

export default function Sidebar({ open, onToggle }: Props) {
  const {
    session,
    chatMessages,
    ackedMessages,
    sentMessages,
    sendChat,
    selectedText,
    setSelectedText,
    resumeSession,
    newSession,
  } = useSession();
  const [input, setInput] = useState("");
  const [view, setView] = useState<"chat" | "sessions">("chat");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageEls = useRef<Map<string, HTMLDivElement>>(new Map());

  const currentTitle = useMemo(() => {
    if (!session?.sessionId) return null;
    return sessions.find((s) => s.id === session.sessionId)?.title || null;
  }, [sessions, session]);

  const messageById = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of chatMessages) map.set(String(m.id), m);
    return map;
  }, [chatMessages]);

  const scrollToMessage = useCallback((msgId: string) => {
    const el = messageEls.current.get(msgId);
    const container = messagesContainerRef.current;
    if (!el || !container) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const relativeTop = elRect.top - containerRect.top + container.scrollTop;
    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    // Only scroll if the element isn't already fully visible
    if (
      relativeTop < containerTop ||
      relativeTop + elRect.height > containerBottom
    ) {
      container.scrollTo({ top: relativeTop - 16, behavior: "smooth" });
    }
    // Flash highlight — scale pulse
    el.style.transition = "transform 0.15s ease-out, filter 0.15s ease-out";
    el.style.transform = "scale(1.04)";
    el.style.filter = "brightness(1.15)";
    setTimeout(() => {
      el.style.transform = "scale(1)";
      el.style.filter = "brightness(1)";
    }, 400);
    setTimeout(() => {
      el.style.transition = "";
    }, 600);
  }, []);

  useEffect(() => {
    if (open && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [chatMessages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Fetch sessions on mount for the title
  useEffect(() => {
    fetchSessions()
      .then((data) => setSessions(data.sessions))
      .catch(() => {});
  }, []);

  // Re-fetch when switching to sessions view
  useEffect(() => {
    if (view === "sessions") {
      fetchSessions()
        .then((data) => setSessions(data.sessions))
        .catch(() => {});
    }
  }, [view]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setSelectedText("");
    await sendChat(text);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  }

  return (
    <aside
      data-sidebar="true"
      className="flex-shrink-0 flex flex-col sticky overflow-hidden transition-[width] duration-200"
      style={{
        width: open ? "var(--sidebar-w)" : "0px",
        top: "var(--chrome-h)",
        height: "calc(100vh - var(--chrome-h))",
        borderRight: open ? "1px solid var(--c-border)" : "none",
        background: "var(--c-surface)",
        boxShadow: open ? "2px 0 8px rgba(56,42,18,.04)" : "none",
      }}
    >
      <div
        className="flex flex-col h-full overflow-hidden"
        style={{ width: "var(--sidebar-w)" }}
      >
        {/* header */}
        <div
          className="flex items-center gap-1 px-2 py-2 flex-shrink-0 border-b"
          style={{ borderColor: "var(--c-border)" }}
        >
          {view === "sessions" ? (
            <button
              onClick={() => setView("chat")}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: "var(--c-muted)",
                fontFamily: "var(--font-family-ui)",
              }}
            >
              ← Sessions
            </button>
          ) : (
            <span
              className="flex items-center px-2 py-1.5 text-sm font-medium"
              style={{
                color: "var(--c-text)",
                fontFamily: "var(--font-family-ui)",
              }}
            >
              {currentTitle || "New session"}
            </span>
          )}
          <div className="flex-1" />
          <ButtonGroup>
            <Button
              variant="outline"
              size="xs"
              onClick={() =>
                setView((v) => (v === "sessions" ? "chat" : "sessions"))
              }
            >
              <History size={13} />
              Sessions
            </Button>
            <ButtonGroupSeparator />
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                newSession();
                setView("chat");
              }}
            >
              <Plus size={14} />
            </Button>
          </ButtonGroup>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onToggle}
            title="Hide sidebar"
          >
            <PanelLeftClose size={15} />
          </Button>
        </div>

        {/* chat view */}
        {view === "chat" && (
          <>
            {/* messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0"
            >
              {chatMessages.length === 0 && (
                <div
                  className="text-left text-[0.8rem] py-8 px-4 leading-relaxed"
                  style={{ color: "var(--c-muted)" }}
                >
                  <p>Ask me anything.</p>
                  <p>Highlight text to add it as context.</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-3 flex-wrap justify-start">
                    {[
                      "What can you do?",
                      "What should I learn next?",
                      "Summarise this lesson",
                    ].map((chip) => (
                      <button
                        key={chip}
                        onClick={() => {
                          setInput(chip);
                          inputRef.current?.focus();
                        }}
                        className="px-3 py-1.5 rounded-full text-[0.75rem] border transition-colors cursor-pointer"
                        style={{
                          color: "var(--c-muted)",
                          borderColor: "var(--c-border)",
                          background: "var(--c-surface)",
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg) => {
                // lesson:answer-mc messages are metadata — skip rendering
                if (
                  msg.role === "user" &&
                  (msg as any).type === "lesson:answer-mc"
                )
                  return null;

                // message:ack is metadata — skip rendering
                if ((msg as any).type === "message:ack") return null;

                // lesson:committed bubble (assistant — progress summary)
                if ((msg as any).type === "lesson:committed") {
                  const summary: Array<{ item: string; status: string }> =
                    (msg as any).summary || [];
                  return (
                    <div key={msg.id} className="self-start max-w-[90%]">
                      <div
                        className="rounded-xl rounded-bl-sm px-3.5 py-2.5 text-[0.8rem] leading-snug"
                        style={{
                          fontFamily: "var(--font-family-ui)",
                          background: "var(--c-surface-2)",
                          color: "var(--c-text)",
                        }}
                      >
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-medium mb-2"
                          style={{
                            background: "var(--c-accent-sub)",
                            color: "var(--c-accent-h)",
                          }}
                        >
                          <CheckCircle2 size={10} />
                          Lesson complete
                        </div>
                        {summary.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {summary.map((s, i) => {
                              const StatusIcon =
                                s.status === "LEARNED"
                                  ? CheckCircle2
                                  : s.status === "LEARNED_PARTIAL"
                                    ? Circle
                                    : XCircle;
                              const statusColor =
                                s.status === "LEARNED"
                                  ? "var(--c-green)"
                                  : s.status === "LEARNED_PARTIAL"
                                    ? "var(--c-accent)"
                                    : "var(--c-red)";
                              return (
                                <div
                                  key={i}
                                  className="flex items-start gap-1.5"
                                >
                                  <StatusIcon
                                    size={14}
                                    className="mt-0.5 flex-shrink-0"
                                    style={{ color: statusColor }}
                                  />
                                  <span
                                    className="text-[0.72rem]"
                                    style={{ color: "var(--c-muted)" }}
                                  >
                                    {s.item}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // lesson:answer:clarify bubble (assistant side — clarification request)
                if (
                  msg.role === "assistant" &&
                  (msg as any).type === "lesson:answer:clarify"
                ) {
                  const m = msg as any;
                  return (
                    <div
                      key={m.id}
                      ref={(el) => {
                        if (el) messageEls.current.set(String(m.id), el);
                      }}
                      className="self-start px-4 py-3 rounded-xl rounded-bl-sm text-[0.82rem] leading-snug max-w-[85%]"
                      style={{
                        background: "var(--c-surface-2)",
                        border: "1px solid var(--c-border)",
                        fontFamily: "var(--font-family-ui)",
                        color: "var(--c-text)",
                      }}
                    >
                      <div
                        className="font-semibold text-[0.7rem] uppercase tracking-wider mb-1.5"
                        style={{ color: "var(--c-accent)" }}
                      >
                        Clarification
                      </div>
                      {m.feedback}
                    </div>
                  );
                }

                // lesson:answer:success bubble (assistant side — grade + quoted answer)
                if (
                  msg.role === "assistant" &&
                  (msg as any).type === "lesson:answer:success"
                ) {
                  const m = msg as any;
                  const gradeVariants: Record<
                    string,
                    { icon: typeof CheckCircle2; color: string; label: string }
                  > = {
                    CORRECT: {
                      icon: CheckCircle2,
                      color: "#22c55e",
                      label: "Correct",
                    },
                    PARTIALLY_CORRECT: {
                      icon: Circle,
                      color: "#f59e0b",
                      label: "Partially correct",
                    },
                    INCORRECT: {
                      icon: XCircle,
                      color: "#ef4444",
                      label: "Incorrect",
                    },
                  };
                  const v = gradeVariants[m.result] || gradeVariants.INCORRECT;
                  const Icon = v.icon;
                  const replied = messageById.get(m.replyTo || msg.id);
                  const quote = replied
                    ? quotedContent(replied)
                    : m.answer?.length > 120
                      ? m.answer.slice(0, 120) + "…"
                      : m.answer || null;
                  return (
                    <div key={msg.id} className="self-start max-w-[90%]">
                      <div
                        className="rounded-xl rounded-bl-sm px-3.5 py-2.5 text-[0.8rem] leading-snug"
                        style={{
                          fontFamily: "var(--font-family-ui)",
                          background: "var(--c-surface-2)",
                          color: "var(--c-text)",
                        }}
                      >
                        {quote && (
                          <div
                            className="mb-2 pl-2.5 border-l-2 text-[0.72rem] leading-snug cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
                            style={{
                              borderColor: v.color,
                              color: "var(--c-muted)",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                            onClick={() => scrollToMessage(m.replyTo || msg.id)}
                            title="Scroll to your answer"
                          >
                            {quote}
                          </div>
                        )}
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-medium"
                          style={{ background: `${v.color}18`, color: v.color }}
                        >
                          <Icon size={10} />
                          {v.label}
                        </div>
                        {m.feedback && (
                          <p
                            className="text-[0.8rem] mt-1.5"
                            style={{ color: "var(--c-text)" }}
                          >
                            {m.feedback}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }

                // agent:error bubble
                if (
                  msg.role === "assistant" &&
                  (msg as any).type === "agent:error"
                ) {
                  const m = msg as any;
                  const replied = messageById.get(m.replyTo);
                  const quote = replied ? quotedContent(replied) : null;
                  return (
                    <div key={msg.id} className="self-start max-w-[90%]">
                      <div
                        className="rounded-xl rounded-bl-sm px-3.5 py-2.5 text-[0.8rem] leading-snug"
                        style={{
                          fontFamily: "var(--font-family-ui)",
                          background: "var(--c-surface-2)",
                          color: "var(--c-text)",
                        }}
                      >
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-medium mb-1.5"
                          style={{
                            background: "var(--c-red-sub)",
                            color: "var(--c-red)",
                          }}
                        >
                          <XCircle size={10} />
                          Error
                        </div>
                        {quote && (
                          <div
                            className="mb-2 pl-2.5 border-l-2 text-[0.72rem] leading-snug cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
                            style={{
                              borderColor: "var(--c-red)",
                              color: "var(--c-muted)",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                            onClick={() => scrollToMessage(m.replyTo)}
                            title="Scroll to message"
                          >
                            {quote}
                          </div>
                        )}
                        <p
                          className="text-[0.8rem]"
                          style={{ color: "var(--c-text)" }}
                        >
                          {m.text}
                        </p>
                      </div>
                    </div>
                  );
                }

                // observation bubble (bonus, misunderstanding, unknown)
                if (
                  msg.role === "assistant" &&
                  (msg as any).type === "lesson:observation"
                ) {
                  const obsConfig: Record<
                    string,
                    { icon: typeof Lightbulb; color: string; label: string }
                  > = {
                    bonus: {
                      icon: Lightbulb,
                      color: "#a855f7",
                      label: "Bonus",
                    },
                    misunderstanding: {
                      icon: AlertTriangle,
                      color: "#f59e0b",
                      label:
                        (msg as any).status === "CLEARED"
                          ? "Cleared"
                          : "Misunderstanding",
                    },
                    unknown: {
                      icon: HelpCircle,
                      color: "#6b7280",
                      label: "Unknown",
                    },
                  };
                  const c = obsConfig[(msg as any).category] || obsConfig.bonus;
                  const Icon = c.icon;
                  return (
                    <div
                      key={msg.id}
                      ref={(el) => {
                        if (el) messageEls.current.set(String(msg.id), el);
                      }}
                      className="self-start max-w-[90%]"
                    >
                      <div
                        className="rounded-xl rounded-bl-sm px-3.5 py-2.5 text-[0.8rem] leading-snug break-words"
                        style={{
                          fontFamily: "var(--font-family-ui)",
                          background: "var(--c-surface-2)",
                          color: "var(--c-text)",
                        }}
                      >
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-medium mb-1.5"
                          style={{ background: `${c.color}18`, color: c.color }}
                        >
                          <Icon size={10} />
                          {c.label}
                        </div>
                        <p
                          className="text-[0.78rem]"
                          style={{ color: "var(--c-muted)" }}
                        >
                          {(msg as any).text}
                        </p>
                      </div>
                    </div>
                  );
                }

                // lesson:update-pointer bubble (assistant — collapsible)
                if (
                  msg.role === "assistant" &&
                  (msg as any).type === "lesson:update-pointer"
                ) {
                  const PointerInline = () => {
                    const pointerVariants: Record<
                      string,
                      {
                        icon: typeof CheckCircle2;
                        color: string;
                        label: string;
                      }
                    > = {
                      LEARNED: {
                        icon: CheckCircle2,
                        color: "#22c55e",
                        label: "Learned",
                      },
                      LEARNED_PARTIAL: {
                        icon: Circle,
                        color: "#f59e0b",
                        label: "Partially learned",
                      },
                      NOT_LEARNED: {
                        icon: XCircle,
                        color: "#ef4444",
                        label: "Not learned",
                      },
                    };
                    const v =
                      pointerVariants[(msg as any).result] ||
                      pointerVariants.NOT_LEARNED;
                    const Icon = v.icon;
                    const [expanded, setExpanded] = useState(false);
                    return (
                      <div
                        ref={(el) => {
                          if (el) messageEls.current.set(String(msg.id), el);
                        }}
                        className="self-start max-w-[90%]"
                        style={{
                          marginLeft: "1.25rem",
                          marginTop: "-4px",
                          position: "relative",
                          paddingLeft: "14px",
                        }}
                      >
                        <svg
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: 14,
                            height: 28,
                            overflow: "visible",
                          }}
                        >
                          <path
                            d="M 0,0 Q 0,10 10,14"
                            fill="none"
                            stroke={v.color}
                            strokeWidth="2"
                            strokeOpacity="0.3"
                            strokeLinecap="round"
                          />
                        </svg>
                        <div
                          className={
                            expanded
                              ? "rounded-xl rounded-bl-sm px-3 py-2 cursor-pointer"
                              : "px-3 py-1 cursor-pointer hover:bg-[var(--c-surface-2)] rounded-lg transition-colors"
                          }
                          style={
                            expanded
                              ? {
                                  border: `1px solid ${v.color}40`,
                                  background: "var(--c-surface-2)",
                                }
                              : {}
                          }
                          onClick={() => setExpanded((prev) => !prev)}
                        >
                          {expanded ? (
                            <>
                              <div className="flex items-center gap-2">
                                <Icon
                                  size={14}
                                  style={{ color: v.color, flexShrink: 0 }}
                                />
                                <span
                                  className="text-[0.78rem] font-semibold"
                                  style={{
                                    color: v.color,
                                    fontFamily: "var(--font-family-ui)",
                                  }}
                                >
                                  {v.label}
                                </span>
                                <ChevronDown
                                  size={12}
                                  style={{
                                    color: "var(--c-muted)",
                                    flexShrink: 0,
                                    transform: "rotate(180deg)",
                                    transition: "transform 0.15s",
                                  }}
                                />
                              </div>
                              <p
                                className="mt-1 text-[0.75rem] leading-snug"
                                style={{
                                  fontFamily: "var(--font-family-ui)",
                                  color: "var(--c-muted)",
                                }}
                              >
                                {(msg as any).itemText}
                              </p>
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Icon
                                size={14}
                                style={{ color: v.color, flexShrink: 0 }}
                              />
                              <span
                                className="flex-1 min-w-0 text-[0.75rem] overflow-hidden"
                                style={{
                                  fontFamily: "var(--font-family-ui)",
                                  color: "var(--c-muted)",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 1,
                                  WebkitBoxOrient: "vertical",
                                }}
                              >
                                {(msg as any).itemText}
                              </span>
                              <ChevronDown
                                size={12}
                                style={{
                                  color: "var(--c-muted)",
                                  flexShrink: 0,
                                  transition: "transform 0.15s",
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  };
                  return <PointerInline />;
                }

                // lesson:suggestion:success bubble (assistant)
                if (
                  msg.role === "assistant" &&
                  (msg as any).type === "lesson:suggestion:success"
                ) {
                  const suggestions = (msg as any).suggestions || [];
                  const rationale = (msg as any).rationale || "";
                  return (
                    <div key={msg.id} className="self-start max-w-[92%] w-full">
                      <div
                        className="rounded-xl rounded-bl-sm px-3.5 py-3 text-[0.875rem] leading-relaxed"
                        style={{
                          fontFamily: "var(--font-family-ui)",
                          background: "var(--c-surface-2)",
                          color: "var(--c-text)",
                        }}
                      >
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-medium mb-2.5"
                          style={{
                            background: "var(--c-accent-sub)",
                            color: "var(--c-accent-h)",
                          }}
                        >
                          <Sparkles size={10} />
                          Suggestion
                        </div>
                        <div className="flex flex-col gap-2">
                          {suggestions.map((s: any, i: number) => (
                            <div
                              key={i}
                              className="rounded-lg px-3 py-2.5 transition-colors"
                              style={{
                                background: "var(--c-surface)",
                                border: "1px solid var(--c-border)",
                              }}
                            >
                              <span
                                className="block text-[0.82rem] font-semibold"
                                style={{ color: "var(--c-text)" }}
                              >
                                {s.title}
                              </span>
                              <span
                                className="block text-[0.72rem] mt-0.5"
                                style={{ color: "var(--c-muted)" }}
                              >
                                {s.description}
                              </span>
                              <span
                                className="block text-[0.68rem] mt-1 opacity-60"
                                style={{ color: "var(--c-muted)" }}
                              >
                                {s.itemCount} items ·{" "}
                                {Array.isArray(s.chapters)
                                  ? s.chapters.join(", ")
                                  : s.chapters}
                              </span>
                            </div>
                          ))}
                        </div>
                        {rationale && (
                          <p
                            className="text-[0.7rem] mt-2.5 opacity-50"
                            style={{ color: "var(--c-muted)" }}
                          >
                            {rationale}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }

                if (
                  msg.role === "assistant" &&
                  (msg as any).type === "lesson:generate:success"
                ) {
                  const title = (msg as any).title || "lesson";
                  return (
                    <div key={msg.id} className="self-start max-w-[90%]">
                      <div
                        className="rounded-xl rounded-bl-sm px-3.5 py-2.5 text-[0.8rem] leading-snug"
                        style={{
                          fontFamily: "var(--font-family-ui)",
                          background: "var(--c-surface-2)",
                          color: "var(--c-text)",
                        }}
                      >
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-medium mb-1.5"
                          style={{
                            background: "var(--c-green-sub)",
                            color: "var(--c-green)",
                          }}
                        >
                          <CheckCircle2 size={10} />
                          Generated
                        </div>
                        <div className="text-[0.82rem] font-semibold">
                          {title}
                        </div>
                      </div>
                    </div>
                  );
                }

                // lesson:generate bubble (user action)
                if (
                  msg.role === "user" &&
                  (msg as any).type === "lesson:generate"
                ) {
                  const title = (msg as any).title || "lesson";
                  return (
                    <div
                      key={msg.id}
                      className="self-end max-w-[85%] flex items-end gap-1"
                    >
                      {msg.id && sentMessages.has(String(msg.id)) && (
                        <div className="flex-shrink-0 self-end mb-1">
                          {ackedMessages.has(String(msg.id)) ? (
                            <CheckCheck
                              size={15}
                              style={{ color: "#22c55e", opacity: 0.8 }}
                            />
                          ) : (
                            <Check
                              size={15}
                              style={{ color: "var(--c-muted)", opacity: 0.4 }}
                            />
                          )}
                        </div>
                      )}
                      <div
                        className="rounded-xl rounded-br-sm px-3 py-2.5 text-[0.8rem] leading-snug"
                        style={{
                          fontFamily: "var(--font-family-ui)",
                          background: "var(--c-accent)",
                          color: "#221E17",
                        }}
                      >
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-medium mb-1.5"
                          style={{
                            background: "rgba(34,30,23,0.15)",
                            color: "rgba(34,30,23,0.7)",
                          }}
                        >
                          <Sparkles size={10} />
                          Generate lesson
                        </div>
                        <div className="text-[0.85rem] font-semibold">
                          {title}
                        </div>
                      </div>
                    </div>
                  );
                }

                // lesson:answer bubble (user side — shows the submitted answer)
                if (
                  msg.role === "user" &&
                  (msg as any).type === "lesson:answer"
                ) {
                  return (
                    <div
                      key={msg.id}
                      ref={(el) => {
                        if (el) messageEls.current.set(String(msg.id), el);
                      }}
                      className="self-end max-w-[90%] flex items-end gap-1"
                    >
                      {msg.id && sentMessages.has(String(msg.id)) && (
                        <div className="flex-shrink-0 self-end mb-1">
                          {ackedMessages.has(String(msg.id)) ? (
                            <CheckCheck
                              size={15}
                              style={{ color: "#22c55e", opacity: 0.8 }}
                            />
                          ) : (
                            <Check
                              size={15}
                              style={{ color: "var(--c-muted)", opacity: 0.4 }}
                            />
                          )}
                        </div>
                      )}
                      <div
                        className="rounded-xl rounded-br-sm px-3.5 py-2.5 text-[0.875rem] leading-relaxed break-words select-text"
                        style={{
                          fontFamily: "var(--font-family-ui)",
                          background: "var(--c-accent)",
                          color: "#221E17",
                        }}
                      >
                        <div
                          className="mb-1.5 pl-2 border-l-2 text-[0.72rem] leading-snug overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                          style={{
                            borderColor: "rgba(34,30,23,0.3)",
                            color: "rgba(34,30,23,0.55)",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                          onClick={() => {
                            const el = document.getElementById(
                              (msg as any).questionId,
                            );
                            if (!el) return;
                            el.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                            let scrollTimer: ReturnType<typeof setTimeout>;
                            const onScroll = () => {
                              clearTimeout(scrollTimer);
                              scrollTimer = setTimeout(() => {
                                window.removeEventListener("scroll", onScroll);
                                el.style.boxShadow =
                                  "0 0 0 3px var(--c-accent)";
                                setTimeout(() => {
                                  el.style.boxShadow = "";
                                }, 1200);
                              }, 200);
                            };
                            window.addEventListener("scroll", onScroll);
                            onScroll();
                          }}
                        >
                          {(msg as any).questionTitle}
                        </div>
                        <MarkdownRenderer content={(msg as any).answer} />
                      </div>
                    </div>
                  );
                }

                // regular chat (user / assistant)
                const isAssistant =
                  msg.role === "assistant" && (msg as any).type === "chat";
                const isUser =
                  msg.role === "user" && (msg as any).type === "chat";
                return (
                  <div
                    key={msg.id}
                    ref={(el) => {
                      if (el) messageEls.current.set(String(msg.id), el);
                    }}
                    className={[
                      "max-w-[90%]",
                      isUser ? "self-end" : "self-start",
                    ].join(" ")}
                  >
                    {" "}
                    <div
                      className={[
                        "flex items-end gap-1",
                        isUser ? "flex-row-reverse" : "",
                      ].join(" ")}
                    >
                      <div
                        className={[
                          "px-3.5 py-2.5 text-[0.875rem] leading-relaxed break-words",
                          isUser
                            ? "rounded-xl rounded-br-sm whitespace-pre-wrap"
                            : "rounded-xl rounded-bl-sm",
                          (msg as any).pending ? "italic" : "",
                        ].join(" ")}
                        style={{
                          fontFamily: "var(--font-family-ui)",
                          background: isUser
                            ? "var(--c-accent)"
                            : "var(--c-surface-2)",
                          color: isUser
                            ? "#221E17"
                            : (msg as any).pending
                              ? "var(--c-muted)"
                              : "var(--c-text)",
                        }}
                      >
                        {isAssistant && (msg as any).pending ? (
                          <span className="flex items-center gap-1 px-1 py-1">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                          </span>
                        ) : isAssistant && !(msg as any).pending ? (
                          <MarkdownRenderer
                            content={((msg as any).text ?? "").replace(/\\n/g, "\n")}
                            className="sidebar-markdown"
                          />
                        ) : (
                          ((msg as any).text ?? "").replace(/\\n/g, "\n")
                        )}
                      </div>
                      {msg.role === "user" &&
                        msg.id &&
                        sentMessages.has(String(msg.id)) && (
                          <div className="flex-shrink-0 self-end mb-1">
                            {ackedMessages.has(String(msg.id)) ? (
                              <CheckCheck
                                size={15}
                                style={{ color: "#22c55e", opacity: 0.8 }}
                              />
                            ) : (
                              <Check
                                size={15}
                                style={{
                                  color: "var(--c-muted)",
                                  opacity: 0.4,
                                }}
                              />
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* input area */}
            <div
              className="flex-shrink-0 border-t px-3 pt-2.5 pb-3 flex flex-col gap-2"
              style={{ borderColor: "var(--c-border)" }}
            >
              {!session &&
                (sessions.length > 0 ? (
                  <button
                    onClick={() => resumeSession(sessions[0].id)}
                    className="w-full text-left rounded-lg px-3 py-2.5 transition-colors hover:brightness-95 flex items-center gap-3"
                    style={{
                      background: "var(--c-surface-2)",
                      border: "1px solid var(--c-border)",
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <span
                        className="block text-[0.65rem] font-semibold tracking-wide uppercase"
                        style={{
                          color: "var(--c-muted)",
                          fontFamily: "var(--font-family-ui)",
                        }}
                      >
                        Previous session
                      </span>
                      <span
                        className="block text-[0.8rem] truncate"
                        style={{
                          color: "var(--c-text)",
                          fontFamily: "var(--font-family-ui)",
                        }}
                      >
                        {sessions[0].title || "New session"}
                      </span>
                    </div>
                    <span
                      className="text-[0.72rem] font-medium flex-shrink-0"
                      style={{
                        color: "var(--c-accent)",
                        fontFamily: "var(--font-family-ui)",
                      }}
                    >
                      Continue
                    </span>
                  </button>
                ) : null)}
              {selectedText && (
                <div
                  className="flex items-start gap-2 pl-2.5 pr-2 py-1.5 rounded-lg"
                  style={{
                    borderLeft: "2px solid var(--c-accent)",
                    background: "var(--c-accent-sub)",
                  }}
                >
                  <p
                    className="flex-1 min-w-0 text-[0.78rem] italic leading-snug overflow-hidden"
                    style={{
                      color: "var(--c-amber-text)",
                      fontFamily: "var(--font-family-body)",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    &ldquo;{selectedText}&rdquo;
                  </p>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="flex-shrink-0 mt-0.5 text-[var(--c-accent)] opacity-50 hover:opacity-100"
                    onClick={() => setSelectedText("")}
                    title="Remove context"
                  >
                    <X size={11} />
                  </Button>
                </div>
              )}
              <InputBar
                inputRef={inputRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onSend={handleSend}
                disabled={false}
                placeholder="Ask something…"
              />
            </div>
          </>
        )}

        {/* sessions view */}
        {view === "sessions" && (
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
            {sessions.length === 0 ? (
              <div
                className="text-center text-[0.8rem] py-8 px-4 leading-relaxed"
                style={{ color: "var(--c-muted)" }}
              >
                No sessions found.
              </div>
            ) : (
              sessions.map((s) => {
                const date = s.createdAt
                  ? new Date(s.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—";
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      resumeSession(s.id);
                      setView("chat");
                    }}
                    className="w-full text-left rounded-lg px-3 py-2.5 transition-colors hover:brightness-95 cursor-pointer flex-shrink-0"
                    style={{
                      background:
                        session?.sessionId === s.id
                          ? "var(--c-accent-sub)"
                          : "var(--c-surface-2)",
                      border:
                        session?.sessionId === s.id
                          ? "1px solid var(--c-accent)"
                          : "1px solid transparent",
                    }}
                  >
                    <span
                      className="block text-[0.8rem] font-semibold truncate"
                      style={{
                        color: "var(--c-text)",
                        fontFamily: "var(--font-family-ui)",
                      }}
                    >
                      {s.title || "New session"}
                    </span>
                    <span
                      className="block text-[0.68rem] mt-0.5"
                      style={{
                        color: "var(--c-muted)",
                        fontFamily: "var(--font-family-ui)",
                      }}
                    >
                      {date}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
