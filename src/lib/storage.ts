import { CycleRecord, Settings } from '../types';

const RECORDS_KEY = 'period-rings:records:v1';
const SETTINGS_KEY = 'period-rings:settings:v1';

export const defaultSettings: Settings = {
  maxDays: 40,
  ringCount: 12,
  viewMode: 'month',
  cycleLength: 28,
};

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
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const cycleLength = Number(parsed.cycleLength);
    return {
      ...defaultSettings,
      ...parsed,
      viewMode: parsed.viewMode === 'cycle' ? 'cycle' : 'month',
      cycleLength: Number.isFinite(cycleLength)
        ? Math.min(90, Math.max(15, Math.round(cycleLength)))
        : defaultSettings.cycleLength,
    };
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
