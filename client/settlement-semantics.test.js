import assert from 'node:assert/strict';
import fs from 'node:fs';

const jsx = fs.readFileSync(new URL('./src/pages/Settlement.jsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/pages/Settlement.css', import.meta.url), 'utf8');

const requiredJsxPatterns = [
  ['main landmark', /<main[\s\S]*className="settlement-page"/],
  ['page result heading relationship', /aria-labelledby="settlement-result-title"/],
  ['result summary relationship', /aria-describedby="settlement-result-summary"/],
  ['top navigation label', /<nav className="settlement-top-actions" aria-label="结算页操作">/],
  ['explicit start action class', /settlement-top-action--start/],
  ['explicit end action class', /settlement-top-action--end/],
  ['result announcement', /resultAnnouncement[\s\S]*role="status"/],
  ['semantic result heading', /<h1 id="settlement-result-title"/],
  ['score section heading', /<h2 id="settlement-score-heading"/],
  ['score list', /className="settlement-score-list" role="list"/],
  ['score list items', /className="settlement-score-card" role="listitem"/],
  ['history section heading', /<section className="settlement-history" aria-labelledby="settlement-history-heading"/],
  ['history list', /className="settlement-history-list" role="list"/],
  ['history list items', /className="settlement-history-row" role="listitem"/],
  ['next round section', /<section className="settlement-next-round" aria-labelledby="settlement-next-heading">/],
  ['copy button full room label', /aria-label={`复制房间号 \${roomId}`}/],
  ['safe missing history result', /\(round\.result \|\| \[\]\)/],
];

for (const [name, pattern] of requiredJsxPatterns) {
  assert.match(jsx, pattern, `Settlement.jsx must include ${name}`);
}

assert.doesNotMatch(css, /\.settlement-page\s*>\s*button/, 'CSS must not depend on settlement direct-child buttons');
assert.doesNotMatch(css, /first-of-type|nth-of-type/, 'CSS must not depend on button order');

const requiredCssPatterns = [
  ['screen reader utility', /\.settlement-sr-only\s*\{/],
  ['top action base class', /\.settlement-top-action\s*\{/],
  ['start action modifier', /\.settlement-top-action--start\s*\{/],
  ['end action modifier', /\.settlement-top-action--end\s*\{/],
  ['room copy class', /\.settlement-room-copy-button\s*\{/],
  ['score list class', /\.settlement-score-list\s*\{/],
  ['history row class', /\.settlement-history-row\s*\{/],
  ['visible keyboard focus', /\.settlement-top-action:focus-visible[\s\S]*outline:\s*3px solid/],
  ['portrait safe area', /env\(safe-area-inset-left\)[\s\S]*env\(safe-area-inset-right\)/],
  ['reduced motion support', /@media \(prefers-reduced-motion: reduce\)/],
];

for (const [name, pattern] of requiredCssPatterns) {
  assert.match(css, pattern, `Settlement.css must include ${name}`);
}

console.log('settlement semantic structure tests passed');
