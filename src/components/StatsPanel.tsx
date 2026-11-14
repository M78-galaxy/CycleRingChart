import { DerivedCycle } from '../types';

export default function StatsPanel({ cycles }: { cycles: DerivedCycle[] }) {
  const lens = cycles.map((c) => c.cycleLength).filter((n): n is number => typeof n === 'number');

  if (!lens.length) return <p className="muted">至少记录两次周期，才能看到周期长度统计。</p>;

  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  const min = Math.min(...lens);
  const max = Math.max(...lens);
  const recent = lens.slice(-6);
  const peak = Math.max(...recent, max);

  return (
    <div>
      <div className="stats-row">
        <div>
          <span className="muted">次数</span>
          <strong>{lens.length}</strong>
        </div>
        <div>
          <span className="muted">平均</span>
          <strong>{avg.toFixed(1)} 天</strong>
        </div>
        <div>
          <span className="muted">范围</span>
          <strong>
            {min}–{max} 天
          </strong>
        </div>
      </div>

      <div className="spark">
        {recent.map((n, i) => (
          <div key={i} className="spark-bar" style={{ height: `${(n / peak) * 100}%` }} title={`${n} 天`} />
        ))}
      </div>
      <p className="muted small">最近 {recent.length} 次周期长度</p>
    </div>
  );
}
