import { useNavigate, useLocation } from "react-router";
import {
  ArrowLeft,
  PanelLeftOpen,
} from "lucide-react";
import { useSession } from "../hooks/useSession.tsx";
import { useScrollProgress } from "../hooks/useScrollProgress.ts";
import { Button } from "@/components/ui/button";
import AppBarBase from "./AppBarBase";

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  theme: string;
  onToggleTheme: () => void;
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

        {/* Right-side spacer */}
        <div className="flex-1" />
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
