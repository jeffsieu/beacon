import { Link } from "react-router";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface Props {
  theme: string;
  onToggleTheme: () => void;
  homePath?: string;
  children?: ReactNode;
}

export default function AppBarBase({
  theme,
  onToggleTheme,
  homePath = "/",
  children,
}: Props) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-[100] flex items-center gap-2 px-4"
      style={{
        height: "var(--appbar-h)",
        background: "color-mix(in srgb, var(--c-bg) 88%, transparent)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 1px 0 var(--c-border)",
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Link
          to={homePath}
          className="flex items-center gap-2 no-underline"
          title="Dashboard"
        >
          <img
            src={
              theme === "dark"
                ? "/assets/beacon-mark-inverse.svg"
                : "/assets/beacon-mark.svg"
            }
            alt="Beacon"
            className="h-5 flex-shrink-0"
          />
          <span
            style={{
              fontFamily: "var(--font-family-display)",
              fontWeight: 600,
              fontSize: "1.25rem",
              letterSpacing: "-0.02em",
              color: "var(--c-accent)",
            }}
          >
            Beacon
          </span>
        </Link>
        {children}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
      </div>
    </header>
  );
}
