import React from 'react';
import './StatCard.scss';

interface Props {
  title: string;
  value: number;
  color: string;
  icon: string;
}

const iconMap: Record<string, string> = {
  Warning: '⚠',
  Clock: '⏰',
  ChatDotSquare: '\u{1F4AC}',
  CircleCheck: '✅',
  WarningFilled: '\u{1F534}',
  Timer: '⏱',
};

export default function StatCard({ title, value, color, icon }: Props) {
  return (
    <div className="stat-card" style={{ '--accent': color } as React.CSSProperties}>
      <div className="stat-card-icon">{iconMap[icon] || icon}</div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-title">{title}</div>
      <div className="stat-card-bar" />
    </div>
  );
}
