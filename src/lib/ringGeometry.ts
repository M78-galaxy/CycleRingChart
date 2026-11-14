export function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const outerStart = polar(cx, cy, r1, a0);
  const outerEnd = polar(cx, cy, r1, a1);
  const innerEnd = polar(cx, cy, r0, a1);
  const innerStart = polar(cx, cy, r0, a0);
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${r1} ${r1} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${r0} ${r0} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}
