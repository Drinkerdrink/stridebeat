import assert from 'node:assert/strict';
import {suggestedTempo,adjustedTempo} from '../dist/tempo-choice.js';
// A slow grid must not force double-speed vocals for ordinary running tempos.
for(const bpm of [84,90,100,105]){
 const source=suggestedTempo(bpm),rate=180/source;
 assert.ok(rate>=.8&&rate<=1.1);
}
assert.equal(suggestedTempo(125),125);
assert.equal(suggestedTempo(168),168);
const target=180,source=125;
assert.ok(target/adjustedTempo(source,'slower')<target/source);
assert.ok(target/adjustedTempo(source,'faster')>target/source);
assert.equal(adjustedTempo(180,'slower'),null);
assert.equal(adjustedTempo(60,'faster'),null);
console.log('Automatic running tempo and plain-language speed correction passed.');
