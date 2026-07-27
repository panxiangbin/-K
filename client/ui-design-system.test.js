import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('./src/ui-design-system.css', import.meta.url), 'utf8');
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
assert(main.includes("import './ui-design-system.css';"), 'design system stylesheet must load after component styles');
assert(packageJson.scripts.test.includes('ui-design-system.test.js'), 'client test suite must include design system regression');

console.log('ui design system baseline passed');
