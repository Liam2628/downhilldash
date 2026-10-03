export function WheelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="oklch(0.22 0.01 260)" />
      <circle cx="16" cy="16" r="15" fill="none" stroke="oklch(0.35 0.01 260)" strokeWidth="2" strokeDasharray="3 2.5" />
      <circle cx="16" cy="16" r="9" fill="var(--gold)" />
      <circle cx="16" cy="16" r="3" fill="oklch(0.55 0.12 70)" />
      {[0, 72, 144, 216, 288].map((a) => (
        <rect key={a} x="15" y="8" width="2" height="5" rx="1" fill="oklch(0.55 0.12 70)" transform={`rotate(${a} 16 16)`} />
      ))}
    </svg>
  );
}
