import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('./src/ui-design-system.css', import.meta.url), 'utf8');
const responsiveCss = fs.readFileSync(new URL('./src/ui-responsive.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

for (const token of [
  '--ui-table-900',
  '--ui-surface',
  '--ui-text',
  '--ui-accent',
  '--ui-danger',
  '--ui-success',
  '--ui-control-min: 44px',
  '--ui-control-primary: 50px',
]) {
  assert(css.includes(token), `design system must define ${token}`);
}

assert(css.includes('outline: 3px solid var(--ui-focus)'), 'focus indicator must remain clearly visible');
assert(css.includes("@media (max-height: 430px) and (orientation: landscape)"), 'low-height landscape must have a dedicated control layout');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'motion reduction support must remain available');
assert(css.includes('backdrop-filter: none !important'), 'core controls must avoid glass-style blur');
assert(css.includes('.btn-play:not(:disabled)'), 'primary action state must be explicit');
assert(css.includes('animation: none !important'), 'primary action must not pulse continuously');

assert(responsiveCss.includes('min-height: 44px !important'), 'portrait secondary controls must retain a 44px touch target');
assert(responsiveCss.includes('min-height: 50px !important'), 'portrait primary action must retain a 50px touch target');
assert(responsiveCss.includes('min-height: 48px !important'), 'narrow portrait primary action must remain comfortably tappable');
assert(responsiveCss.includes('min-height: 40px !important'), 'low-height landscape must keep the compact control baseline');
assert(responsiveCss.includes('min-height: 44px !important'), 'low-height landscape primary action must remain tappable');
assert(!responsiveCss.includes('readyPlayPulse'), 'responsive layer must not restore continuous primary-button pulsing');
assert(!responsiveCss.includes('rgba(125, 211, 252'), 'responsive layer must not override the unified focus color');
assert(!responsiveCss.includes('min-height: 30px'), 'portrait top controls must not shrink below the touch baseline');
assert(!responsiveCss.includes('font-size: 10px'), 'essential responsive controls must not use illegibly small text');

assert(main.includes("import './ui-design-system.css';"), 'design system stylesheet must load after component styles');
assert(packageJson.scripts.test.includes('ui-design-system.test.js'), 'client test suite must include design system regression');

console.log('ui design system baseline passed');
