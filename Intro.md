# 周期环（Period Rings）项目说明

## 1. 项目目标

做一个纯本地、无广告、无账号的经期记录 App。核心视图是**同心周期环**：

- 每一层 = 一次月经周期（本次第一天 → 下次第一天前一天）；
- 第 1 天固定在 0°（12 点方向）；
- 红色弧段 = 经期天数；
- 蓝色圆点 = 周期结束位置；
- 所有层共用同一个最大天数刻度（默认 40 天），避免 28/30/31 天不等分导致变形；
- 周期稳定 → 蓝点沿同一径向对齐；不规律 → 蓝点散开。

**不做医疗判断**，只展示记录和统计。数据只存本地，必须支持 JSON 导出。

---

## 2. 技术栈(待定）

```text
React 18 + TypeScript + Vite
原生 SVG 绘图
localStorage 持久化
普通 CSS（不引入 UI 库）
```

初始化：

```bash
npm create vite@latest period-rings -- --template react-ts
cd period-rings
npm install
npm run dev
```

---

## 3. 目录结构

```text
src/
  types.ts
  lib/
    date.ts
    cycles.ts
    storage.ts
  components/
    CycleRingChart.tsx
    CycleForm.tsx
    CycleList.tsx
    StatsPanel.tsx
  App.tsx
  main.tsx
  styles.css
```

---



## 4. 数据模型与算法



### 4.1 类型

```ts
// src/types.ts
export type CycleRecord = {
  id: string;
  startDate: string;       // YYYY-MM-DD，月经第一天
  bleedEndDate?: string;   // YYYY-MM-DD，经期最后一天
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type DerivedCycle = {
  record: CycleRecord;
  bleedLength?: number;    // 经期天数
  cycleLength?: number;    // 到下一次开始的天数
  nextStartDate?: string;
};

export type Settings = {
  maxDays: number;         // 圆盘刻度，默认 40
  ringCount: number;       // 显示最近多少个周期，默认 12
};
```



### 4.2 日期工具（UTC 零点法，避免时区/夏令时问题）

```ts
// src/lib/date.ts
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  const now = new Date();
  return formatDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

export function isValidISO(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime());
}
```



### 4.3 周期派生

```ts
// src/lib/cycles.ts
import { CycleRecord, DerivedCycle } from '../types';
import { daysBetween } from './date';

export function deriveCycles(records: CycleRecord[]): DerivedCycle[] {
  const sorted = [...records].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return sorted.map((record, i) => {
    const next = sorted[i + 1];

    let bleedLength: number | undefined;
    if (record.bleedEndDate) {
      const len = daysBetween(record.startDate, record.bleedEndDate) + 1;
      bleedLength = len > 0 ? len : undefined;
    }

    let cycleLength: number | undefined;
    if (next) {
      const len = daysBetween(record.startDate, next.startDate);
      cycleLength = len > 0 ? len : undefined;
    }

    return { record, bleedLength, cycleLength, nextStartDate: next?.startDate };
  });
}
```



### 4.4 存储与导出

```ts
// src/lib/storage.ts
import { CycleRecord, Settings } from '../types';

const RECORDS_KEY = 'period-rings:records:v1';
const SETTINGS_KEY = 'period-rings:settings:v1';

export const defaultSettings: Settings = { maxDays: 40, ringCount: 12 };

export function loadRecords(): CycleRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecords(records: CycleRecord[]) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function exportJSON(records: CycleRecord[], settings: Settings) {
  const payload = { version: 1, exportedAt: new Date().toISOString(), settings, records };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `period-rings-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---



## 5. 核心组件：同心圆

绘图约定：**中心是旧周期，向外是新周期**。用 `circle + strokeDasharray` 画弧，比手写 SVG path 更稳。

```tsx
// src/components/CycleRingChart.tsx
import { useMemo } from 'react';
import { DerivedCycle } from '../types';
import { todayISO, daysBetween } from '../lib/date';

type Props = {
  cycles: DerivedCycle[];
  maxDays: number;
  ringCount: number;
  selectedId?: string;
  onSelect: (id: string) => void;
};

const BASE_R = 40;
const GAP = 20;
const MARGIN = 56;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function CycleRingChart({ cycles, maxDays, ringCount, selectedId, onSelect }: Props) {
  const visible = cycles.slice(-ringCount);
  const maxR = BASE_R + Math.max(visible.length - 1, 0) * GAP;
  const size = (maxR + MARGIN) * 2;
  const cx = size / 2;
  const cy = size / 2;
  const today = todayISO();

  const rings = useMemo(() => {
    return visible.map((c, i) => {
      const r = BASE_R + i * GAP;
      const circ = 2 * Math.PI * r;
      const bleedAngle = c.bleedLength ? Math.min(c.bleedLength / maxDays, 1) * 360 : 0;
      const bleedLen = (bleedAngle / 360) * circ;
      const endAngle = c.cycleLength ? Math.min(c.cycleLength / maxDays, 1) * 360 : undefined;
      const isOngoing = !c.cycleLength;

      let elapsedPoint: { x: number; y: number } | undefined;
      if (isOngoing) {
        const elapsed = daysBetween(c.record.startDate, today) + 1;
        if (elapsed > 0) {
          const angle = Math.min(elapsed / maxDays, 1) * 360;
          elapsedPoint = polar(cx, cy, r, angle);
        }
      }

      return {
        cycle: c,
        r,
        circ,
        bleedLen,
        endPoint: endAngle !== undefined ? polar(cx, cy, r, endAngle) : undefined,
        elapsedPoint,
        isOngoing,
      };
    });
  }, [visible, maxDays, cx, cy, today]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="ring-chart" role="img" aria-label="经期周期同心圆">
      <line x1={cx} y1={cy} x2={cx} y2={cy - maxR - 12} stroke="#e5e7eb" strokeDasharray="4 4" />

      {rings.map(({ cycle, r, circ, bleedLen, endPoint, elapsedPoint, isOngoing }) => {
        const selected = cycle.record.id === selectedId;
        return (
          <g key={cycle.record.id} onClick={() => onSelect(cycle.record.id)} style={{ cursor: 'pointer' }}>
            <circle
              cx={cx} cy={cy} r={r} fill="none"
              stroke={selected ? '#fecdd3' : '#f1f5f9'}
              strokeWidth={selected ? 12 : 8}
            />

            {bleedLen > 0 && (
              <circle
                cx={cx} cy={cy} r={r} fill="none"
                stroke="#e11d48"
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={bleedLen >= circ - 0.5 ? undefined : `${bleedLen} ${circ - bleedLen}`}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            )}

            {endPoint && <circle cx={endPoint.x} cy={endPoint.y} r={4} fill="#2563eb" />}
            {isOngoing && elapsedPoint && (
              <circle cx={elapsedPoint.x} cy={elapsedPoint.y} r={4} fill="none" stroke="#2563eb" strokeWidth={2} />
            )}

            <title>
              {`开始：${cycle.record.startDate}\n经期：${cycle.bleedLength ?? '—'} 天\n周期：${cycle.cycleLength ?? '进行中'} 天`}
            </title>

            <circle cx={cx} cy={cy} r={r} fill="none" stroke="transparent" strokeWidth={16} />
          </g>
        );
      })}
    </svg>
  );
}
```

---



## 6. 表单 / 列表 / 统计

```tsx
// src/components/CycleForm.tsx
import { useState } from 'react';
import { CycleRecord } from '../types';
import { isValidISO, todayISO, daysBetween } from '../lib/date';

type Props = {
  initial?: CycleRecord;
  existing: CycleRecord[];
  onSave: (r: CycleRecord) => void;
  onCancel: () => void;
};

export default function CycleForm({ initial, existing, onSave, onCancel }: Props) {
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO());
  const [bleedEndDate, setBleedEndDate] = useState(initial?.bleedEndDate ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!isValidISO(startDate)) return setError('开始日期无效');
    if (bleedEndDate) {
      if (!isValidISO(bleedEndDate)) return setError('经期结束日期无效');
      if (daysBetween(startDate, bleedEndDate) < 0) return setError('经期结束日期不能早于开始日期');
    }

    const dup = existing.find(r => r.startDate === startDate && r.id !== initial?.id);
    if (dup) return setError('这一天已有一条周期记录');

    const now = new Date().toISOString();
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      startDate,
      bleedEndDate: bleedEndDate || undefined,
      notes: notes.trim() || undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label className="field">
        开始日期
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
      </label>
      <label className="field">
        经期结束日期（可选）
        <input type="date" value={bleedEndDate} onChange={e => setBleedEndDate(e.target.value)} />
      </label>
      <label className="field">
        备注（可选）
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="例如：腹痛、用药…" />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="ghost" onClick={onCancel}>取消</button>
        <button type="submit" className="primary">保存</button>
      </div>
    </form>
  );
}
```

```tsx
// src/components/CycleList.tsx
import { DerivedCycle } from '../types';

type Props = {
  cycles: DerivedCycle[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function CycleList({ cycles, selectedId, onSelect, onEdit, onDelete }: Props) {
  if (!cycles.length) return <p className="muted">还没有记录。点击「添加记录」开始。</p>;

  return (
    <ul className="cycle-list">
      {[...cycles].reverse().map(c => (
        <li
          key={c.record.id}
          className={c.record.id === selectedId ? 'selected' : ''}
          onClick={() => onSelect(c.record.id)}
        >
          <div>
            <strong>{c.record.startDate}</strong>
            <span className="muted">
              {' '}· 经期 {c.bleedLength ?? '—'} 天 · 周期 {c.cycleLength ?? '进行中'} 天
            </span>
          </div>
          <div className="cycle-actions" onClick={e => e.stopPropagation()}>
            <button className="ghost" onClick={() => onEdit(c.record.id)}>编辑</button>
            <button className="ghost danger" onClick={() => onDelete(c.record.id)}>删除</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// src/components/StatsPanel.tsx
import { DerivedCycle } from '../types';

export default function StatsPanel({ cycles }: { cycles: DerivedCycle[] }) {
  const lens = cycles.map(c => c.cycleLength).filter((n): n is number => typeof n === 'number');

  if (!lens.length) return <p className="muted">至少记录两次周期，才能看到周期长度统计。</p>;

  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  const min = Math.min(...lens);
  const max = Math.max(...lens);
  const recent = lens.slice(-6);
  const peak = Math.max(...recent, max);

  return (
    <div>
      <div className="stats-row">
        <div><span className="muted">次数</span><strong>{lens.length}</strong></div>
        <div><span className="muted">平均</span><strong>{avg.toFixed(1)} 天</strong></div>
        <div><span className="muted">范围</span><strong>{min}–{max} 天</strong></div>
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
```

---



## 7. App 装配

```tsx
// src/App.tsx
import { useEffect, useMemo, useState } from 'react';
import CycleRingChart from './components/CycleRingChart';
import CycleForm from './components/CycleForm';
import CycleList from './components/CycleList';
import StatsPanel from './components/StatsPanel';
import { CycleRecord, Settings } from './types';
import { deriveCycles } from './lib/cycles';
import { loadRecords, saveRecords, loadSettings, saveSettings, exportJSON } from './lib/storage';

export default function App() {
  const [records, setRecords] = useState<CycleRecord[]>(() => loadRecords());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [editing, setEditing] = useState<CycleRecord | 'new' | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => saveRecords(records), [records]);
  useEffect(() => saveSettings(settings), [settings]);

  const cycles = useMemo(() => deriveCycles(records), [records]);
  const selected = cycles.find(c => c.record.id === selectedId);

  function handleSave(r: CycleRecord) {
    setRecords(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      if (idx === -1) return [...prev, r];
      const next = [...prev];
      next[idx] = r;
      return next;
    });
    setEditing(null);
    setSelectedId(r.id);
  }

  function handleDelete(id: string) {
    if (!confirm('确定删除这条记录？')) return;
    setRecords(prev => prev.filter(r => r.id !== id));
    if (selectedId === id) setSelectedId(undefined);
  }

  return (
    <div className="app">
      <header className="header">
        <h1>周期环</h1>
        <p className="muted">每次月经一圈，0° 为第一天。数据只存在本机。</p>
      </header>

      <main className="layout">
        <section className="card chart-card">
          <CycleRingChart
            cycles={cycles}
            maxDays={settings.maxDays}
            ringCount={settings.ringCount}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          {selected && (
            <div className="detail">
              <div><span className="muted">开始</span> {selected.record.startDate}</div>
              <div><span className="muted">经期结束</span> {selected.record.bleedEndDate ?? '未记录'}</div>
              <div><span className="muted">经期长度</span> {selected.bleedLength ?? '—'} 天</div>
              <div><span className="muted">周期长度</span> {selected.cycleLength ?? '进行中'} 天</div>
              {selected.record.notes && <div><span className="muted">备注</span> {selected.record.notes}</div>}
              <div className="detail-actions">
                <button className="ghost" onClick={() => setEditing(selected.record)}>编辑</button>
                <button className="ghost danger" onClick={() => handleDelete(selected.record.id)}>删除</button>
              </div>
            </div>
          )}
        </section>

        <aside className="side">
          <section className="card">
            <div className="card-head"><h2>统计</h2></div>
            <StatsPanel cycles={cycles} />
          </section>

          <section className="card">
            <div className="card-head"><h2>设置</h2></div>
            <label className="field">
              圆盘最大天数
              <input
                type="number" min={28} max={90}
                value={settings.maxDays}
                onChange={e => setSettings(s => ({ ...s, maxDays: Math.max(28, Number(e.target.value) || 40) }))}
              />
            </label>
            <label className="field">
              显示最近几个周期
              <input
                type="number" min={3} max={24}
                value={settings.ringCount}
                onChange={e => setSettings(s => ({ ...s, ringCount: Math.max(3, Number(e.target.value) || 12) }))}
              />
            </label>
            <button className="ghost" onClick={() => exportJSON(records, settings)}>导出 JSON</button>
          </section>
        </aside>
      </main>

      <section className="card">
        <div className="card-head">
          <h2>记录</h2>
          <button className="primary" onClick={() => setEditing('new')}>添加记录</button>
        </div>
        <CycleList
          cycles={cycles}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEdit={id => {
            const r = records.find(x => x.id === id);
            if (r) setEditing(r);
          }}
          onDelete={handleDelete}
        />
      </section>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing === 'new' ? '添加记录' : '编辑记录'}</h2>
            <CycleForm
              initial={editing === 'new' ? undefined : editing}
              existing={records}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

---



## 8. 样式

```css
/* src/styles.css */
* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f8fafc;
  color: #0f172a;
}

.app { max-width: 1100px; margin: 0 auto; padding: 24px 16px 64px; }

.header h1 { margin: 0 0 4px; font-size: 26px; }
.muted { color: #64748b; font-size: 14px; }
.small { font-size: 12px; }
.error { color: #dc2626; font-size: 14px; margin: 0; }

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 20px;
}

@media (max-width: 820px) {
  .layout { grid-template-columns: 1fr; }
}

.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 16px;
  margin-top: 16px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-head h2 { margin: 0; font-size: 16px; }

.chart-card { display: flex; flex-direction: column; align-items: center; }

.ring-chart { width: 100%; max-width: 520px; height: auto; display: block; }

.detail {
  width: 100%;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e2e8f0;
  font-size: 14px;
  line-height: 1.9;
}

.detail-actions { display: flex; gap: 8px; margin-top: 8px; }

.side { display: flex; flex-direction: column; }

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  text-align: center;
}

.stats-row > div { display: flex; flex-direction: column; gap: 2px; }
.stats-row strong { font-size: 18px; }

.spark {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 72px;
  margin-top: 16px;
  padding: 0 4px;
}

.spark-bar {
  flex: 1;
  min-height: 4px;
  background: #bfdbfe;
  border-radius: 4px 4px 0 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #334155;
  margin-bottom: 12px;
}

.field input {
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
}

button {
  font: inherit;
  cursor: pointer;
  border-radius: 8px;
  padding: 8px 14px;
  border: 1px solid transparent;
}

.primary { background: #e11d48; color: #fff; }
.primary:hover { background: #be123c; }

.ghost { background: #fff; border-color: #cbd5e1; color: #334155; }
.ghost:hover { background: #f1f5f9; }
.ghost.danger { color: #dc2626; border-color: #fecaca; }

.cycle-list { list-style: none; margin: 0; padding: 0; }

.cycle-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
}

.cycle-list li:hover { background: #f8fafc; }
.cycle-list li.selected { background: #fff1f2; }

.cycle-actions { display: flex; gap: 6px; }

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 10;
}

.modal {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  width: 100%;
  max-width: 420px;
}

.modal h2 { margin: 0 0 16px; font-size: 18px; }

.form-actions { display: flex; justify-content: flex-end; gap: 8px; }
```

---



## 9. Cursor 使用建议



### 9.1 先放这两个文件

`.cursorrules`：

```text
你是这个项目的开发助手。项目是纯本地经期记录 PWA。

硬性规则：
- 不添加任何网络请求、账号系统、广告、分析/埋点脚本、第三方字体。
- 数据只存 localStorage，键名以 period-rings: 开头。
- 日期一律用 YYYY-MM-DD 字符串；内部用 UTC 零点计算天数差。
- 不做医疗判断，不显示「正常/异常」结论，只展示统计数字。
- 组件用函数组件 + TypeScript；样式用普通 CSS，不引入 UI 库。
- 所有涉及数据结构的改动，必须保证「导出 JSON」仍然可用。
- 改动前先读 PROJECT_SPEC.md。
```



### 9.2 分步提示词（按顺序喂给 Cursor）

1. `按 PROJECT_SPEC.md 创建项目骨架，先只做类型、lib、storage，跑通编译。`
2. `实现 CycleRingChart，用 SVG circle + strokeDasharray 画弧，先硬编码 3 条假数据验证视觉。`
3. `接入 App 状态和 localStorage，实现新增/编辑/删除。`
4. `实现 StatsPanel 和导出 JSON。`
5. `按 spec 里的边界情况逐条补：未结束周期、超 maxDays、同日重复、bleedEnd < start、时区。`
6. `把样式打磨成移动端优先，并加 PWA manifest。`

---



## 10. 验收清单

- [ ] 0° 在 12 点方向，经期弧从 0° 顺时针展开；
- [ ] 每层半径递增，中心最旧、最外最新；
- [ ] 周期稳定时蓝点沿同一条径向线对齐；
- [ ] 未结束周期不画蓝点，画空心进度点；
- [ ] 周期长度 > maxDays 时弧被截断且 title 显示真实天数；
- [ ] 同日重复开始日被拦截；
- [ ] `bleedEndDate < startDate` 被拦截；
- [ ] 刷新页面数据不丢；
- [ ] 导出 JSON 能还原全部记录和设置；
- [ ] 无任何网络请求（DevTools Network 面板确认）。

---



## 11. 后续可加（不在 MVP）

- 经期长度趋势图（而不只是周期长度）；
- 疼痛/流量/用药标签；
- PWA 离线安装；
- 数据导入 JSON；
- 可选的本地加密（口令派生密钥）。

先按这份骨架跑起来，再让 Cursor 在 `CycleRingChart` 上做视觉打磨，是最省事的路径。