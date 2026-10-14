export const validCadence = n => Number.isInteger(n) && n >= 160 && n <= 210;
export function gapFrames(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 60) throw new Error('过渡时间请输入 0–60 秒。');
  return Math.round(seconds * 44100);
}
export function playlistSegments(items, gaps) {
  let time = 0;
  return items.map((item, index) => {
    const start = time, end = start + item.duration;
    const gap = index < items.length - 1 ? (gaps.get(item.id) || 0) : 0;
    time = end + gapFrames(gap) / 44100;
    return {item, start, end, gap, next: time};
  });
}
export function reorderSelected(items, id, to) {
  const selected = items.filter(o => o.selected), from = selected.findIndex(o => o.id === id);
  if (from < 0 || to < 0 || to >= selected.length) return items;
  selected.splice(to, 0, selected.splice(from, 1)[0]);
  let i = 0;
  return items.map(o => o.selected ? selected[i++] : o);
}
