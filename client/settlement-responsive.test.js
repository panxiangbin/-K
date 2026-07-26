import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('./src/pages/Settlement.css', import.meta.url), 'utf8');

const requiredPatterns = [
  ['portrait scrolling', /@media \(max-width: 760px\), \(orientation: portrait\)[\s\S]*overflow-y:\s*auto\s*!important/],
  ['safe top action placement', /\.settlement-page > button[\s\S]*min-height:\s*44px\s*!important/],
  ['visible keyboard focus', /\.settlement-page > button:focus-visible[\s\S]*outline:\s*3px solid #fde047/],
  ['narrow phone layout', /@media \(max-width: 430px\)[\s\S]*max-width:\s*calc\(50vw - 16px\)/],
  ['low-height landscape layout', /@media \(orientation: landscape\) and \(max-height: 430px\)[\s\S]*padding-top:\s*max\(48px, env\(safe-area-inset-top\)\)/],
  ['landscape history containment', /@media \(orientation: landscape\) and \(max-height: 430px\)[\s\S]*\.settlement-history[\s\S]*max-height:\s*58px/],
  ['wide desktop containment', /@media \(min-width: 1366px\)[\s\S]*max-width:\s*980px/],
  ['reduced motion disables transforms', /@media \(prefers-reduced-motion: reduce\)[\s\S]*transform:\s*none\s*!important/],
  ['safe area left', /env\(safe-area-inset-left\)/],
  ['safe area right', /env\(safe-area-inset-right\)/],
  ['safe area bottom', /env\(safe-area-inset-bottom\)/],
];

for (const [name, pattern] of requiredPatterns) {
  assert.match(css, pattern, `missing settlement responsive contract: ${name}`);
}

assert.doesNotMatch(css, /\.card\s*\{[\s\S]*?(width|height)\s*:/, 'settlement CSS must not resize playing cards');
assert.doesNotMatch(css, /overflow:\s*hidden\s*!important[\s\S]*@media \(orientation: landscape\) and \(max-height: 430px\)/, 'short landscape must remain scrollable');

console.log('settlement responsive tests passed');
