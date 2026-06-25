import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import MarkdownRenderer from "./MarkdownRenderer";
import {
  BrainCircuit,
  MessageSquare,
  Monitor,
  CheckCheck,
  GitBranch,
  Sparkles,
} from "lucide-react";

type AgentTab = "claude" | "agents";

function AgentTabs({ tab, setTab }: { tab: AgentTab; setTab: (t: AgentTab) => void }) {
  return (
    <div className="flex items-center gap-0.5 mt-2 mb-0.5">
      <button
        onClick={() => setTab("claude")}
        className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
        style={{
          background: tab === "claude" ? "var(--c-accent)" : "var(--c-surface-2)",
          color: tab === "claude" ? "#221E17" : "var(--c-muted)",
        }}
      >
        Claude Code
      </button>
      <button
        onClick={() => setTab("agents")}
        className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
        style={{
          background: tab === "agents" ? "var(--c-accent)" : "var(--c-surface-2)",
          color: tab === "agents" ? "#221E17" : "var(--c-muted)",
        }}
      >
        Other agents
      </button>
    </div>
  );
}

const features = [
  {
    icon: BrainCircuit,
    title: "Knowledge tracking",
    description:
      "Every concept you learn is tracked in a structured progress file. Know exactly what you've mastered and what needs work.",
  },
  {
    icon: Sparkles,
    title: "Agent-curated lessons",
    description:
      "Your agent groups unlearned concepts into tailored lessons, drawn from curated resources — never from parametric knowledge alone.",
  },
  {
    icon: CheckCheck,
    title: "Placement tests",
    description:
      "Skip what you already know. Take a placement test and your progress file is seeded so you jump straight to the gaps.",
  },
  {
    icon: Monitor,
    title: "Web or terminal",
    description:
      "Chat live with your agent in the browser viewer, or run fully in the terminal. Same protocol, same tracked progress.",
  },
  {
    icon: MessageSquare,
    title: "Agentic grading",
    description:
      "Your agent grades free-text answers against checklist items. Earn LEARNED, PARTIAL, or NOT_LEARNED — with observaations for bonuses and misunderstandings.",
  },
  {
    icon: GitBranch,
    title: "Version-controllable progress",
    description:
      "Your progress/ folder contains everything you know. Track it in Git alongside your code — your learning history stays yours.",
  },
];

export default function LandingPage() {
  const [tab, setTab] = useState<AgentTab>("claude");
  const origin = window.location.origin;

  const claude = tab === "claude";
  return (
    <div style={{ fontFamily: "var(--font-family-ui)" }}>
      {/* Hero */}
      <section
        className="text-center py-32 px-4"
        style={{ background: "var(--c-bg)" }}
      >
        <div className="max-w-lg mx-auto">
          <h1
            className="text-5xl font-bold mb-6 tracking-tight"
            style={{
              fontFamily: "var(--font-family-display)",
              color: "var(--c-text)",
              lineHeight: 1.1,
            }}
          >
            Learn with your agent.
            <br />
            Track what sticks.
          </h1>
          <p
            className="text-lg mb-10 leading-relaxed"
            style={{ color: "var(--c-muted)" }}
          >
            Beacon is an AI-guided learning companion. Your agent teaches, grades,
            and tracks your knowledge — creating tailored lessons from what you
            still need to learn.
          </p>
          <Link to="/dashboard">
            <Button
              size="lg"
              style={{
                background: "var(--c-accent)",
                color: "#221E17",
                fontWeight: 600,
                fontSize: "1rem",
                padding: "0.75rem 2.5rem",
                cursor: "pointer",
              }}
            >
              Go to dashboard
            </Button>
          </Link>
        </div>
      </section>

      {/* Get Started */}
      <section
        className="py-24 px-4"
        style={{ background: "var(--c-surface)" }}
      >
        <div className="max-w-lg mx-auto">
          <h2
            className="text-2xl font-bold mb-10"
            style={{
              fontFamily: "var(--font-family-display)",
              color: "var(--c-text)",
            }}
          >
            Get started
          </h2>
          <ol className="flex flex-col gap-8">
            <Step
              num={1}
              title="Create a learning folder"
              desc={
                <>
                  Make a folder for your learning journey:
                  <MarkdownRenderer content={"```bash\nmkdir my-learning && cd my-learning\n```"} />
                </>
              }
            />
            <Step
              num={2}
              title="Install the Beacon skill"
              desc={
                <>
                  Install the skill into your learning folder so your agent can
                  use it:
                  <MarkdownRenderer content={"```bash\nnpx skills add jeffsieu/beacon beacon\n```"} />
                  <span
                    className="text-xs mt-1 block"
                    style={{ color: "var(--c-muted)" }}
                  >
                    This installs Beacon into <code>.agents/skills/beacon/</code>.
                  </span>
                  <span
                    className="text-xs mt-1 block"
                    style={{ color: "var(--c-muted)" }}
                  >
                    Then install CLI dependencies:{" "}
                  <AgentTabs tab={tab} setTab={setTab} />
                  {claude ? (
                    <MarkdownRenderer content={"```bash\n(cd .claude/skills/beacon && npm install)\n```"} />
                  ) : (
                    <MarkdownRenderer content={"```bash\n(cd .agents/skills/beacon && npm install)\n```"} />
                  )}
                  </span>
                </>
              }
            />
            <Step
              num={3}
              title="Add a course"
              desc={
                <>
                  Either create your own curriculum with your agent:
                  <MarkdownRenderer content={"```bash\n/beacon create-course\n```"} />
                  Or pull a published course from GitHub:
                  <AgentTabs tab={tab} setTab={setTab} />
                  {claude ? (
                    <MarkdownRenderer content={"```bash\nnpx tsx .claude/skills/beacon/beacon.ts courses add username/repo course-name\n```"} />
                  ) : (
                    <MarkdownRenderer content={"```bash\nnpx tsx .agents/skills/beacon/beacon.ts courses add username/repo course-name\n```"} />
                  )}
                </>
              }
            />
            <Step
              num={4}
              title="Start the Beacon server"
              desc={
                <>
                  Start the relay server so the viewer can connect:
                  <AgentTabs tab={tab} setTab={setTab} />
                  {claude ? (
                    <MarkdownRenderer content={`\`\`\`bash\nnpx tsx .claude/skills/beacon/beacon.ts serve --cors-origin ${origin}\n\`\`\``} />
                  ) : (
                    <MarkdownRenderer content={`\`\`\`bash\nnpx tsx .agents/skills/beacon/beacon.ts serve --cors-origin ${origin}\n\`\`\``} />
                  )}
                  <span
                    className="text-xs mt-1 block"
                    style={{ color: "var(--c-muted)" }}
                  >
                    If you&apos;re using the web viewer, also run{" "}
                    <code>cd beacon-ui &amp;&amp; npm run dev</code>.
                  </span>
                </>
              }
            />
            <Step
              num={5}
              title="Run /beacon with your agent"
              desc={
                <>
                  From your learning folder, tell your agent:
                  <MarkdownRenderer content={"```bash\n/beacon start\n```"} />
                  Pick web or terminal mode. Your agent monitors the inbox,
                  generates lessons, and grades your answers.
                </>
              }
            />
            <Step
              num={6}
              title="Go to dashboard"
              desc={
                <>
                  If you chose <strong>web mode</strong>, open the dashboard to
                  browse courses, see suggestions, and chat with your agent.
                  <div className="mt-3">
                    <Link to="/dashboard">
                      <Button
                        size="sm"
                        style={{
                          background: "var(--c-accent)",
                          color: "#221E17",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Go to dashboard
                      </Button>
                    </Link>
                  </div>
                  <p className="mt-3 text-xs" style={{ color: "var(--c-muted)" }}>
                    Or, run the dashboard UI locally:
                  </p>
                  <MarkdownRenderer content={"```bash\ngit clone https://github.com/jeffsieu/beacon.git\ncd beacon/beacon-ui && npm install && npm run dev\n```"} />
                  <p className="mt-2 text-xs" style={{ color: "var(--c-muted)" }}>
                    Otherwise, continue in your terminal — your agent has
                    everything it needs.
                  </p>
                </>
              }
            />
          </ol>
        </div>
      </section>

      {/* Features */}
      <section
        className="py-24 px-4"
        style={{ background: "var(--c-bg)" }}
      >
        <div className="max-w-lg mx-auto">
          <h2
            className="text-2xl font-bold mb-12"
            style={{
              fontFamily: "var(--font-family-display)",
              color: "var(--c-text)",
            }}
          >
            Features
          </h2>
          <div className="flex flex-col">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="flex items-start gap-5 py-6"
                style={{
                  borderTop: i > 0 ? "1px solid var(--c-border)" : "none",
                }}
              >
                <f.icon
                  size={20}
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: "var(--c-accent)" }}
                />
                <div>
                  <h3
                    className="text-base font-semibold mb-1"
                    style={{ color: "var(--c-text)" }}
                  >
                    {f.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--c-muted)" }}
                  >
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Step({
  num,
  title,
  desc,
}: {
  num: number;
  title: string;
  desc: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ background: "var(--c-accent-sub)", color: "var(--c-accent)" }}
      >
        {num}
      </div>
      <div>
        <h3
          className="text-base font-semibold mb-1"
          style={{ color: "var(--c-text)" }}
        >
          {title}
        </h3>
        <div className="text-sm leading-relaxed min-w-0" style={{ color: "var(--c-muted)" }}>
          {desc}
        </div>
      </div>
    </li>
  );
}
