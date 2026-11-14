import { useEffect, useMemo, useState } from 'react';
import CycleRingChart from './components/CycleRingChart';
import CorrectedCycleChart from './components/CorrectedCycleChart';
import CycleForm from './components/CycleForm';
import CycleList from './components/CycleList';
import StatsPanel from './components/StatsPanel';
import { CycleRecord, Settings } from './types';
import { deriveCycles } from './lib/cycles';
import { loadRecords, saveRecords, loadSettings, saveSettings, exportJSON } from './lib/storage';

function sampleRecords(): CycleRecord[] {
  const now = new Date().toISOString();
  const rows: Array<[string, string, string?]> = [
    ['2026-01-05', '2026-01-09'],
    ['2026-02-02', '2026-02-07'],
    ['2026-03-04', '2026-03-08'],
    ['2026-04-01', '2026-04-06'],
    ['2026-05-03', '2026-05-07'],
    ['2026-05-31', '2026-06-05'],
    ['2026-06-28', '2026-07-02'],
    ['2026-07-26', '2026-07-31', '这一圈偏长'],
    ['2026-08-30', '2026-09-04'],
    ['2026-09-27', '2026-10-01'],
    ['2026-10-25', '2026-10-30', '进行中'],
  ];

  return rows.map(([startDate, bleedEndDate, notes], i) => ({
    id: `sample-${i + 1}`,
    startDate,
    bleedEndDate,
    notes,
    createdAt: now,
    updatedAt: now,
  }));
}

export default function App() {
  const [records, setRecords] = useState<CycleRecord[]>(() => loadRecords());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [editing, setEditing] = useState<CycleRecord | 'new' | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => saveRecords(records), [records]);
  useEffect(() => saveSettings(settings), [settings]);

  const cycles = useMemo(() => deriveCycles(records), [records]);
  const selected = cycles.find((c) => c.record.id === selectedId);
  const averageCycle = useMemo(() => {
    const lengths = cycles.map((c) => c.cycleLength).filter((n): n is number => typeof n === 'number');
    if (!lengths.length) return undefined;
    return lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
  }, [cycles]);
  const cycleMode = settings.viewMode === 'cycle';
  const cycleLength = Number.isFinite(settings.cycleLength) ? settings.cycleLength : 28;

  function handleSave(r: CycleRecord) {
    setRecords((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id);
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
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (selectedId === id) setSelectedId(undefined);
  }

  return (
    <div className="app">
      <header className="header">
        <h1>周期环</h1>
        <p className="muted">
          {cycleMode
            ? `每一圈固定 ${cycleLength} 天。第 1 天上下对齐，规律的经期会排成一列。数据只存在本机。`
            : '每一圈是一个月，固定 31 格。没有的日期留空，上下对齐。数据只存在本机。'}
        </p>
      </header>

      <main className="layout">
        <section className="card chart-card">
          <div className="chart-toolbar">
            <div className="segment" role="group" aria-label="环的排列方式">
              <button
                type="button"
                className={!cycleMode ? 'primary' : 'ghost'}
                aria-pressed={!cycleMode}
                onClick={() => setSettings((s) => ({ ...s, viewMode: 'month' }))}
              >
                按月
              </button>
              <button
                type="button"
                className={cycleMode ? 'primary' : 'ghost'}
                aria-pressed={cycleMode}
                onClick={() => setSettings((s) => ({ ...s, viewMode: 'cycle' }))}
              >
                周期修正
              </button>
            </div>
            {cycleMode && (
              <label className="cycle-length">
                周期天数
                <input
                  type="number"
                  min={15}
                  max={90}
                  value={cycleLength}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      cycleLength: Math.min(90, Math.max(15, Number(e.target.value) || 28)),
                    }))
                  }
                />
                {averageCycle !== undefined && <span className="muted">记录平均 {averageCycle.toFixed(1)} 天</span>}
              </label>
            )}
          </div>
          {cycleMode ? (
            <CorrectedCycleChart
              cycles={cycles}
              ringCount={settings.ringCount}
              cycleLength={cycleLength}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <CycleRingChart
              cycles={cycles}
              ringCount={settings.ringCount}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}

          {selected && (
            <div className="detail">
              <div>
                <span className="muted">开始</span> {selected.record.startDate}
              </div>
              <div>
                <span className="muted">经期结束</span> {selected.record.bleedEndDate ?? '未记录'}
              </div>
              <div>
                <span className="muted">经期长度</span> {selected.bleedLength ?? '—'} 天
              </div>
              <div>
                <span className="muted">周期长度</span> {selected.cycleLength ?? '进行中'} 天
              </div>
              {selected.record.notes && (
                <div>
                  <span className="muted">备注</span> {selected.record.notes}
                </div>
              )}
              <div className="detail-actions">
                <button className="ghost" onClick={() => setEditing(selected.record)}>
                  编辑
                </button>
                <button className="ghost danger" onClick={() => handleDelete(selected.record.id)}>
                  删除
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="side">
          <section className="card">
            <div className="card-head">
              <h2>统计</h2>
            </div>
            <StatsPanel cycles={cycles} />
          </section>

          <section className="card">
            <div className="card-head">
              <h2>设置</h2>
            </div>
            <label className="field">
              {cycleMode ? '显示最近几个周期' : '显示最近几个月'}
              <input
                type="number"
                min={3}
                max={24}
                value={settings.ringCount}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, ringCount: Math.max(3, Number(e.target.value) || 12) }))
                }
              />
            </label>
            <button className="ghost" onClick={() => exportJSON(records, settings)}>
              导出 JSON
            </button>
          </section>
        </aside>
      </main>

      <section className="card">
        <div className="card-head">
          <h2>记录</h2>
          <div className="card-actions">
            {records.length === 0 && (
              <button className="ghost" onClick={() => setRecords(sampleRecords())}>
                加载示例
              </button>
            )}
            <button className="primary" onClick={() => setEditing('new')}>
              添加记录
            </button>
          </div>
        </div>
        <CycleList
          cycles={cycles}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEdit={(id) => {
            const r = records.find((x) => x.id === id);
            if (r) setEditing(r);
          }}
          onDelete={handleDelete}
        />
      </section>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
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
