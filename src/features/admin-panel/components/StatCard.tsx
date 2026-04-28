import type { ReactNode } from "react";

interface StatCardProps {
  value: string;
  label: string;
  sub: string;
  gradient: string;
  icon: ReactNode;
}

export function StatCard({ value, label, sub, gradient, icon }: StatCardProps) {
  return (
    <div className="sc" style={{ background: gradient }}>
      <div className="sc-top">
        <div className="sc-icon">{icon}</div>
        <span className="sc-badge">{sub}</span>
      </div>
      <div className="sc-value">{value}</div>
      <div className="sc-label">{label}</div>
      <div className="sc-glow" />
    </div>
  );
}
