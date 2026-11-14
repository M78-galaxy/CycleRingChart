export type CycleRecord = {
  id: string;
  startDate: string; // YYYY-MM-DD，月经第一天
  bleedEndDate?: string; // YYYY-MM-DD，经期最后一天
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type DerivedCycle = {
  record: CycleRecord;
  bleedLength?: number; // 经期天数
  cycleLength?: number; // 到下一次开始的天数
  nextStartDate?: string;
};

export type ViewMode = 'month' | 'cycle';

export type Settings = {
  maxDays: number; // 圆盘刻度，默认 40
  ringCount: number; // 显示最近多少圈，默认 12
  viewMode: ViewMode; // 按月，或按自定周期修正
  cycleLength: number; // 周期修正时每一圈的天数
};
