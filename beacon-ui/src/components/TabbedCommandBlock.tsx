import { useState } from "react";
import { Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Harness } from "../types";
import { HARNESS_LABELS } from "../types";

interface Props {
  commands: Partial<Record<Harness, string>>;
  label?: string;
  active?: Harness;
  onChange?: (h: Harness) => void;
}

export default function TabbedCommandBlock({ commands, label, active: controlledActive, onChange }: Props) {
  const harnesses = Object.keys(commands) as Harness[];
  const defaultActive = harnesses.includes("global") ? "global" : harnesses[0] ?? "claude";
  const [localActive, setLocalActive] = useState<Harness>(defaultActive);

  const isControlled = controlledActive !== undefined;
  const active = isControlled ? controlledActive : localActive;
  const setActive = (h: Harness) => {
    if (onChange) onChange(h);
    if (!isControlled) setLocalActive(h);
  };
  const [copied, setCopied] = useState(false);

  const command = commands[active] ?? "";

  function doCopy() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (harnesses.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mt-2 mb-2.5">
        {label && (
          <span
            className="text-xs flex-shrink-0"
            style={{ color: "var(--c-subtle)", fontFamily: "var(--font-family-ui)" }}
          >
            {label}
          </span>
        )}
        {harnesses.map((h) => (
          <button
            key={h}
            onClick={() => setActive(h)}
            className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
            style={{
              background: active === h ? "var(--c-accent)" : "var(--c-surface-2)",
              color: active === h ? "#221E17" : "var(--c-muted)",
            }}
          >
            {HARNESS_LABELS[h]}
          </button>
        ))}
      </div>
      <div
        className="flex items-center gap-2 rounded-lg p-3"
        style={{
          fontFamily: "var(--font-family-mono)",
          fontSize: "0.75rem",
          background: "var(--c-surface-2)",
          border: "1px solid var(--c-border)",
        }}
      >
        <code
          className="flex-1 break-all leading-relaxed"
          style={{ color: "var(--c-text)" }}
        >
          {command}
        </code>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={doCopy}
          title="Copy command"
          className="flex-shrink-0"
        >
          {copied ? (
            <CheckCircle2 size={14} style={{ color: "var(--c-green)" }} />
          ) : (
            <Copy size={14} />
          )}
        </Button>
      </div>
    </div>
  );
}
