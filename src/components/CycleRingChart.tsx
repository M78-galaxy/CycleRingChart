import { useMemo } from 'react';
import { DerivedCycle } from '../types';
import { daysInMonth, shiftMonth, todayISO } from '../lib/date';
import { bleedByDate, cycleOnDate } from '../lib/cycles';
import { polar, sector } from '../lib/ringGeometry';

type Props = {
  cycles: DerivedCycle[];
  ringCount: number;
  selectedId?: string;
  onSelect: (id: string) => void;
};

const SLOTS = 31;
const STEP = 360 / SLOTS;
const BAND = 16;
const RING_GAP = 5;
const BASE_R = 46;
const MARGIN = 28;

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CycleRingChart({ cycles, ringCount, selectedId, onSelect }: Props) {
  const today = todayISO();
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);

  const months = useMemo(() => {
    return Array.from({ length: ringCount }, (_, index) => {
      const shifted = shiftMonth(todayYear, todayMonth, index - (ringCount - 1));
      return { ...shifted, length: daysInMonth(shifted.year, shifted.month) };
    });
  }, [ringCount, todayYear, todayMonth]);

  const bleeds = useMemo(() => bleedByDate(cycles), [cycles]);
  const maxR = BASE_R + Math.max(months.length - 1, 0) * (BAND + RING_GAP) + BAND;
  const size = (maxR + MARGIN) * 2;
  const cx = size / 2;
  const cy = size / 2;
  const innerEdge = BASE_R;
  const outerEdge = months.length ? maxR : BASE_R;

  const first = months[0];
  const last = months[months.length - 1];
  const spanLabel =
    first && last ? `${first.year}年${first.month}月 → ${last.year}年${last.month}月` : '';

  return (
    <div className="ring-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="ring-chart" role="img" aria-label="按月对齐的 31 格周期环">
        {Array.from({ length: SLOTS }, (_, slot) => {
          const start = polar(cx, cy, innerEdge, slot * STEP);
          const end = polar(cx, cy, outerEdge, slot * STEP);
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

        {months.map((month, index) => {
          const r0 = BASE_R + index * (BAND + RING_GAP);
          const r1 = r0 + BAND;
          const labelAt = polar(cx, cy, (r0 + r1) / 2, 180);
          return (
            <g key={`${month.year}-${month.month}`}>
              {Array.from({ length: SLOTS }, (_, slot) => {
                const day = slot + 1;
                const exists = day <= month.length;
                const iso = isoDate(month.year, month.month, day);
                const bleedId = exists ? bleeds.get(iso) : undefined;
                const cycleId = exists ? cycleOnDate(cycles, iso) : undefined;
                const a0 = slot * STEP;
                const a1 = (slot + 1) * STEP;
                const isToday = exists && month.year === todayYear && month.month === todayMonth && day === todayDay;
                const selected = Boolean(bleedId && bleedId === selectedId);
                const fill = !exists ? 'none' : bleedId ? (selected ? '#be123c' : '#e11d48') : isToday ? '#cbd5e1' : '#e2e8f0';
                const stroke = !exists ? '#94a3b8' : '#ffffff';
                return (
                  <path
                    key={day}
                    d={sector(cx, cy, r0, r1, a0, a1)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={exists ? 1.4 : 1}
                    strokeDasharray={exists ? undefined : '2 2'}
                    style={{ cursor: cycleId ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (cycleId) onSelect(cycleId);
                    }}
                  >
                    <title>
                      {exists
                        ? `${iso}${bleedId ? '，经期' : ''}`
                        : `${month.year}年${month.month}月没有 ${day} 日`}
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
                {month.month}月
              </text>
            </g>
          );
        })}

        {Array.from({ length: SLOTS }, (_, slot) => {
          const at = polar(cx, cy, outerEdge + 14, slot * STEP + STEP / 2);
          return (
            <text
              key={`day-${slot + 1}`}
              x={at.x}
              y={at.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={slot === 0 ? '#0f172a' : '#64748b'}
              fontSize="11"
              fontWeight={slot === 0 ? 600 : 400}
            >
              {slot + 1}
            </text>
          );
        })}
      </svg>

      <ul className="ring-legend">
        <li>
          <span className="swatch cell" aria-hidden="true" />
          <span>浅格是这个月有的一天。正上方是 1 日，顺时针到 31 日</span>
        </li>
        <li>
          <span className="swatch empty" aria-hidden="true" />
          <span>虚线格是这个月没有的日期，格子仍留在原位，和上下对齐</span>
        </li>
        <li>
          <span className="swatch bleed" aria-hidden="true" />
          <span>红色是经期。内圈更早，外圈更新：{spanLabel}</span>
        </li>
      </ul>
    </div>
  );
}
