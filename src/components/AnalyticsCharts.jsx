import React from 'react';

/* ─── Donut / Ring Chart ──────────────────────────────────── */
export function DonutChart({ data = [], size = 140, strokeWidth = 18, label, sublabel }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((s, d) => s + d.value, 0);

  let offset = 0;
  const segments = data.map(d => {
    const frac = total > 0 ? d.value / total : 0;
    const dash = frac * circumference;
    const gap  = circumference - dash;
    const seg  = { ...d, dash, gap, offset };
    offset += dash;
    return seg;
  });

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="currentColor"
            className="text-gray-100 dark:text-slate-700"
            strokeWidth={strokeWidth}
          />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={-seg.offset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          ))}
        </svg>
        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{label}</span>
          {sublabel && <span className="text-xs text-gray-500 dark:text-gray-400">{sublabel}</span>}
        </div>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{d.label} ({d.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Vertical Bar Chart ──────────────────────────────────── */
export function BarChart({ data = [], height = 160, color = '#3b82f6', label = '' }) {
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div>
      {label && <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{label}</p>}
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const barH = Math.max((d.value / max) * (height - 28), 4);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{d.value || ''}</span>
              <div
                className="w-full rounded-t-lg transition-all duration-700 ease-out"
                style={{ height: barH, background: color, opacity: d.value === 0 ? 0.2 : 1 }}
                title={`${d.label}: ${d.value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate block">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Mini sparkline ──────────────────────────────────────── */
export function Sparkline({ data = [], width = 80, height = 32, color = '#3b82f6' }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Stat Card with sparkline ────────────────────────────── */
export function AnalyticStatCard({ icon, label, value, sub, sparkData, color = '#3b82f6', trend }) {
  const trendUp = trend > 0;
  const trendDown = trend < 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          {trend !== undefined && (
            <p className={`text-xs font-medium mt-1 ${trendUp ? 'text-green-500' : trendDown ? 'text-red-500' : 'text-gray-400'}`}>
              {trendUp ? '▲' : trendDown ? '▼' : '–'} {Math.abs(trend)}% vs last month
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {icon && (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
              <span style={{ color }}>{icon}</span>
            </div>
          )}
          {sparkData && <Sparkline data={sparkData} color={color} />}
        </div>
      </div>
    </div>
  );
}

/* ─── Horizontal progress bar ─────────────────────────────── */
export function ProgressBar({ label, value, max = 100, color = '#3b82f6' }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{label}</span>
        <span className="font-medium">{value}/{max}</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
