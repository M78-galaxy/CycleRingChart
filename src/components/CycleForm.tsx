import { useState, type FormEvent } from 'react';
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!isValidISO(startDate)) return setError('开始日期无效');
    if (bleedEndDate) {
      if (!isValidISO(bleedEndDate)) return setError('经期结束日期无效');
      if (daysBetween(startDate, bleedEndDate) < 0) return setError('经期结束日期不能早于开始日期');
    }

    const dup = existing.find((r) => r.startDate === startDate && r.id !== initial?.id);
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
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </label>
      <label className="field">
        经期结束日期（可选）
        <input type="date" value={bleedEndDate} onChange={(e) => setBleedEndDate(e.target.value)} />
      </label>
      <label className="field">
        备注（可选）
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="例如：腹痛、用药…" />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="ghost" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="primary">
          保存
        </button>
      </div>
    </form>
  );
}
