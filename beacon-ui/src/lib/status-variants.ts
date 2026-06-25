import { CheckCircle2, Circle, XCircle, Lightbulb, AlertTriangle, HelpCircle } from "lucide-react";
import type { ElementType } from "react";

export interface StatusVariant {
  icon: ElementType;
  color: string;
  label: string;
}

export const GRADE_VARIANTS: Record<string, StatusVariant> = {
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

export const POINTER_VARIANTS: Record<string, StatusVariant> = {
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

export const OBSERVATION_VARIANTS: Record<
  string,
  StatusVariant
> = {
  bonus: {
    icon: Lightbulb,
    color: "#a855f7",
    label: "Bonus",
  },
  misunderstanding: {
    icon: AlertTriangle,
    color: "#f59e0b",
    label: "Misunderstanding",
  },
  unknown: {
    icon: HelpCircle,
    color: "#6b7280",
    label: "Unknown",
  },
};
