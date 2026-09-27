import React from 'react';

const PALETTE = [
  '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#06b6d4', '#14b8a6', '#6366f1', '#f97316', '#64748b'
];

export function CategoryDonutChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
        No spending data recorded yet.
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.total, 0);
  if (total === 0) {
    return <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>$0.00 spent.</div>;
  }

  // Calculate SVG arc paths
  const size = 180;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {data.map((item, idx) => {
            const ratio = item.total / total;
            const strokeDasharray = `${ratio * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedOffset;
            accumulatedOffset += ratio * circumference;
            const color = PALETTE[idx % PALETTE.length];

            return (
              <circle
                key={item.category}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: '50% 50%',
                  transition: 'stroke-dasharray 0.5s ease',
                }}
              />
            );
          })}
        </svg>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total Spent</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '160px' }}>
        {data.slice(0, 6).map((item, idx) => {
          const color = PALETTE[idx % PALETTE.length];
          return (
            <div key={item.category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: color, display: 'inline-block' }} />
                <span style={{ color: 'var(--text-muted)' }}>{item.category}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                ${item.total.toFixed(2)} ({item.percentage}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProgressBar({ percent = 0, isExceeded = false, isWarning = false }) {
  const clampedPercent = Math.min(Math.max(percent, 0), 100);
  let statusClass = 'progress-safe';
  if (isExceeded || percent >= 100) statusClass = 'progress-danger';
  else if (isWarning || percent >= 80) statusClass = 'progress-warn';

  return (
    <div className="progress-bar-container">
      <div
        className={`progress-bar-fill ${statusClass}`}
        style={{ width: `${clampedPercent}%` }}
      />
    </div>
  );
}
