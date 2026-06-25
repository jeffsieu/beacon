export default function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="block text-[0.68rem] font-semibold tracking-[0.15em] uppercase mb-3"
      style={{ color: "var(--c-muted)", fontFamily: "var(--font-family-ui)" }}
    >
      {children}
    </span>
  );
}
