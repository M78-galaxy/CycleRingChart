import { useMemo } from 'react';
import { DerivedCycle } from '../types';
import { addDays, daysBetween, todayISO } from '../lib/date';
import { bleedByDate, cycleOnDate } from '../lib/cycles';
import { polar, sector } from '../lib/ringGeometry';

type Props = {
  cycles: DerivedCycle[];
  ringCount: number;
  cycleLength: number;
  selectedId?: string;
  onSelect: (id: string) => void;
};

const BAND = 16;
const RING_GAP = 5;
const BASE_R = 46;
const MARGIN = 28;

function shortDate(iso: string) {
  const [, month, day] = iso.split('-');
  return `${Number(month)}/${Number(day)}`;
}

export default function CorrectedCycleChart({
  cycles,
  ringCount,
  cycleLength,
  selectedId,
  onSelect,
}: Props) {
  const today = todayISO();
  const anchor = cycles[0]?.record.startDate ?? today;
  const step = 360 / cycleLength;

  const rings = useMemo(() => {
    const todayIndex = Math.floor(daysBetween(anchor, today) / cycleLength);
    const lastIndex = Math.max(0, todayIndex);
    const firstIndex = Math.max(0, lastIndex - ringCount + 1);
    return Array.from({ length: lastIndex - firstIndex + 1 }, (_, offset) => {
      const index = firstIndex + offset;
      return { index, start: addDays(anchor, index * cycleLength) };
    });
  }, [anchor, cycleLength, ringCount, today]);

  const bleeds = useMemo(() => bleedByDate(cycles), [cycles]);
  const maxR = BASE_R + Math.max(rings.length - 1, 0) * (BAND + RING_GAP) + BAND;
  const size = (maxR + MARGIN) * 2;
  const cx = size / 2;
  const cy = size / 2;
  const outerEdge = rings.length ? maxR : BASE_R;

  return (
    <div className="ring-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="ring-chart" role="img" aria-label="按固定周期对齐的周期环">
        {Array.from({ length: cycleLength }, (_, slot) => {
          const start = polar(cx, cy, BASE_R, slot * step);
          const end = polar(cx, cy, outerEdge, slot * step);
          return (
            <line
              key={`spoke-${slot}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          );
        })}

        {rings.map((ring, index) => {
          const r0 = BASE_R + index * (BAND + RING_GAP);
          const r1 = r0 + BAND;
          const labelAt = polar(cx, cy, (r0 + r1) / 2, 180);
          return (
            <g key={ring.start}>
              {Array.from({ length: cycleLength }, (_, slot) => {
                const iso = addDays(ring.start, slot);
                const bleedId = bleeds.get(iso);
                const cycleId = cycleOnDate(cycles, iso);
                const selected = Boolean(bleedId && bleedId === selectedId);
                const isToday = iso === today;
                const fill = bleedId ? (selected ? '#be123c' : '#e11d48') : isToday ? '#cbd5e1' : '#e2e8f0';
                return (
                  <path
                    key={slot}
                    d={sector(cx, cy, r0, r1, slot * step, (slot + 1) * step)}
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth="1.4"
                    style={{ cursor: cycleId ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (cycleId) onSelect(cycleId);
                    }}
                  >
                    <title>
                      {`${iso}，周期第 ${slot + 1} 天${bleedId ? '，经期' : ''}`}
                    </title>
                  </path>
                );
              })}
              <text
                x={labelAt.x}
                y={labelAt.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#334155"
                fontSize="11"
                stroke="#ffffff"
                strokeWidth="3"
                paintOrder="stroke"
              >
                {shortDate(ring.start)}
              </text>
            </g>
          );
        })}

        {Array.from({ length: cycleLength }, (_, slot) => {
          const day = slot + 1;
          const visible = cycleLength <= 40 || day === 1 || day === cycleLength || day % 5 === 0;
          if (!visible) return null;
          const at = polar(cx, cy, outerEdge + 14, slot * step + step / 2);
          return (
            <text
              key={`day-${day}`}
              x={at.x}
              y={at.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={day === 1 ? '#0f172a' : '#64748b'}
              fontSize="11"
              fontWeight={day === 1 ? 600 : 400}
            >
              {day}
            </text>
          );
        })}
      </svg>

      <ul className="ring-legend">
        <li>
          <span className="swatch cell" aria-hidden="true" />
          <span>每一圈固定 {cycleLength} 天。正上方是第 1 天，顺时针排到第 {cycleLength} 天</span>
        </li>
        <li>
          <span className="swatch bleed" aria-hidden="true" />
          <span>红色是经期。周期规律时，红色会落在同一列</span>
        </li>
        <li className="note">
          <span>第 1 天从 {anchor} 起算。圈上的日期是这一圈的开始日，内圈更早，外圈更新。</span>
        </li>
      </ul>
    </div>
  );
}
