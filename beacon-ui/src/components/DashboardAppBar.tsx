import { useNavigate, useLocation } from "react-router";
import { useState } from "react";
import {
  ArrowLeft,
  PanelLeftOpen,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { useSession } from "../hooks/useSession.tsx";
import { useScrollProgress } from "../hooks/useScrollProgress.ts";
import { useServerStatusQuery } from "../hooks/queries";
import { Button } from "@/components/ui/button";
import AppBarBase from "./AppBarBase";

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  theme: string;
  onToggleTheme: () => void;
}

type ServerState = "connecting" | "online" | "offline";

function StatusDot({ state }: { state: ServerState }) {
  const cls = state === "online" ? "connected" : state === "offline" ? "disconnected" : "unknown";
  return <span className={`status-dot ${cls}`} />;
}

const LESSON_ROUTE_RE = /^\/[^/]+\/lessons\/[^/]+/;

export default function DashboardAppBar({
  sidebarOpen,
  onToggleSidebar,
  theme,
  onToggleTheme,
}: Props) {
  const { lessonTitle } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const progress = useScrollProgress();

  const isOnLesson = LESSON_ROUTE_RE.test(location.pathname);

  // ── server status ──
  const { data, isError, isLoading, isFetched } = useServerStatusQuery();

  const isFirstTry = isLoading && !isError && !isFetched;
  const isOnline = !isError && data?.ok;
  const isOffline = isError || (isFetched && !data?.ok);

  const serverState: ServerState = isFirstTry ? "connecting" : isOnline ? "online" : "offline";
  const [copied, setCopied] = useState(false);
  const offlineCommand = `test -d .agents/skills/beacon && npx tsx .agents/skills/beacon/beacon.ts serve --cors-origin ${window.location.origin} || npx tsx .claude/skills/beacon/beacon.ts serve --cors-origin ${window.location.origin}`;

  function doCopy() {
    navigator.clipboard.writeText(offlineCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusLabel =
    serverState === "online"
      ? "Server online"
      : serverState === "offline"
        ? "Offline"
        : "Connecting…";

  const tooltipBody =
    serverState === "online"
      ? "Beacon server is running — an AI agent can now connect and respond."
      : serverState === "offline"
        ? "Start the beacon server to enable AI features: beacon serve"
        : "Server is starting up…";

  return (
    <>
      <AppBarBase theme={theme} onToggleTheme={onToggleTheme} homePath="/dashboard">
        {!sidebarOpen && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleSidebar}
            title="Show sidebar"
          >
            <PanelLeftOpen size={17} />
          </Button>
        )}
        {isOnLesson && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(-1)}
            title="Back"
          >
            <ArrowLeft size={18} />
          </Button>
        )}
        {isOnLesson && lessonTitle && (
          <>
            <span className="text-sm mx-1" style={{ color: "var(--c-border)" }}>
              /
            </span>
            <span
              className="text-sm font-medium truncate"
              style={{ fontFamily: "var(--font-family-ui)", color: "var(--c-text)" }}
            >
              {lessonTitle}
            </span>
          </>
        )}

        {/* Right-side actions (rendered after flex-1 spacer) */}
        <div className="flex-1" />

        {isOffline && !isFirstTry && (
          <>
            <code
              style={{
                fontFamily: "var(--font-family-mono)",
                fontSize: "0.7rem",
                background: "var(--c-surface-2)",
                padding: "0.15rem 0.4rem",
                borderRadius: 3,
                color: "var(--c-muted)",
                maxWidth: 280,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {offlineCommand}
            </code>
            <Button variant="ghost" size="icon-xs" onClick={doCopy} title="Copy">
              {copied ? <CheckCircle2 size={12} style={{ color: "var(--c-green)" }} /> : <Copy size={12} />}
            </Button>
          </>
        )}

        <div
          className="status-indicator relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-default border border-transparent transition-colors duration-150 select-none hover:border-[var(--c-border)] hover:bg-[var(--c-surface-2)]"
          style={{ color: "var(--c-muted)" }}
        >
          <StatusDot state={serverState} />
          <span className="whitespace-nowrap text-[0.75rem]">{statusLabel}</span>
          <div className="status-tooltip">
            <strong className="block mb-1 font-semibold text-[0.8rem]">
              {statusLabel}
            </strong>
            {tooltipBody}
          </div>
        </div>
      </AppBarBase>

      {isOnLesson && (
        <div className="scroll-progress">
          <div
            className="scroll-progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </>
  );
}
