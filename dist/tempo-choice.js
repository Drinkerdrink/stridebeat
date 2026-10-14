// Slow beat estimates often describe every other running step. Use the
// equivalent denser grid to avoid unnecessarily doubling the vocal speed.
export function suggestedTempo(detected){
  return Number((detected<=105?detected*2:detected).toFixed(2));
}
export function adjustedTempo(bpm,direction){
  const next=Number((direction==='slower'?bpm*2:bpm/2).toFixed(2));
  return Number.isFinite(next)&&next>=40&&next<=260?next:null;
}
