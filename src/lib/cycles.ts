import { CycleRecord, DerivedCycle } from '../types';
import { addDays, daysBetween } from './date';

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

export function bleedByDate(cycles: DerivedCycle[]) {
  const map = new Map<string, string>();
  for (const cycle of cycles) {
    const end = cycle.record.bleedEndDate ?? cycle.record.startDate;
    const span = Math.max(0, daysBetween(cycle.record.startDate, end));
    for (let i = 0; i <= span; i++) map.set(addDays(cycle.record.startDate, i), cycle.record.id);
  }
  return map;
}

export function cycleOnDate(cycles: DerivedCycle[], iso: string) {
  let id: string | undefined;
  for (const cycle of cycles) {
    const start = cycle.record.startDate;
    const next = cycle.nextStartDate;
    if (start <= iso && (!next || iso < next)) id = cycle.record.id;
  }
  return id;
}
