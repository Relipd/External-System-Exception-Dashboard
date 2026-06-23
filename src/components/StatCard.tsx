import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

interface IStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  subtitleTooltip?: string;
  color?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  subtitleTooltip,
  color = 'var(--ccm-chart-B500, #3370ff)',
}: IStatCardProps) {
  const subtitleLines = subtitle?.split('\n').filter(Boolean) || [];
  const tooltipLines = subtitleTooltip?.split('\n').filter(Boolean) || [];

  /* ── 共享浮层 Tooltip（portal 到 body，跟随鼠标，不受父容器 overflow 裁切） ── */
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const showTip = useCallback((e: React.MouseEvent, text: string) => {
    setTip({ text, x: e.clientX, y: e.clientY });
  }, []);
  const hideTip = useCallback(() => setTip(null), []);

  return (
    <div
      className="stat-card"
      style={{ borderLeftColor: color }}
    >
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
      </div>
      <div className="stat-card-value" style={{ color }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {subtitleLines.length > 0 && (
        <div className="stat-card-tags">
          {subtitleLines.map((line, i) => (
            <span
              key={i}
              className="stat-card-tag"
              onMouseEnter={(e) => showTip(e, tooltipLines[i] || line)}
              onMouseMove={(e) => showTip(e, tooltipLines[i] || line)}
              onMouseLeave={hideTip}
            >
              {line}
            </span>
          ))}
        </div>
      )}
      {/* 浮层 portal 到 body，避免被卡片 overflow 裁切；智能定位防溢出 */}
      {tip && createPortal(
        <div
          className="stat-card-tooltip"
          style={{
            left: Math.min(tip.x + 14, window.innerWidth - 320),
            top: Math.max(tip.y - 8, 8),
          }}
        >
          {tip.text}
        </div>,
        document.body,
      )}
    </div>
  );
}
