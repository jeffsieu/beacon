import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import AppBarBase from "./AppBarBase";

interface Props {
  theme: string;
  onToggleTheme: () => void;
}

export default function LandingAppBar({ theme, onToggleTheme }: Props) {
  return (
    <AppBarBase theme={theme} onToggleTheme={onToggleTheme} homePath="/">
      <div className="flex-1" />
      <Link to="/dashboard">
        <Button
          variant="default"
          size="sm"
          style={{
            background: "var(--c-accent)",
            color: "#221E17",
            fontFamily: "var(--font-family-ui)",
            fontWeight: 500,
          }}
        >
          Go to dashboard
        </Button>
      </Link>
    </AppBarBase>
  );
}
