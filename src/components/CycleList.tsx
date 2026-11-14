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
      {[...cycles].reverse().map((c) => (
        <li
          key={c.record.id}
          className={c.record.id === selectedId ? 'selected' : ''}
          onClick={() => onSelect(c.record.id)}
        >
          <div>
            <strong>{c.record.startDate}</strong>
            <span className="muted">
              {' '}
              · 经期 {c.bleedLength ?? '—'} 天 · 周期 {c.cycleLength ?? '进行中'} 天
            </span>
          </div>
          <div className="cycle-actions" onClick={(e) => e.stopPropagation()}>
            <button className="ghost" onClick={() => onEdit(c.record.id)}>
              编辑
            </button>
            <button className="ghost danger" onClick={() => onDelete(c.record.id)}>
              删除
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
