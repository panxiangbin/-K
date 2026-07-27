import assert from 'node:assert/strict';
import fs from 'node:fs';

const polishCss = fs.readFileSync(new URL('./src/ui-polish.css', import.meta.url), 'utf8');
const designCss = fs.readFileSync(new URL('./src/ui-design-system.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert(polishCss.includes('var(--ui-focus'), 'legacy polish must reuse the shared focus token');
assert(polishCss.includes('var(--ui-accent'), 'legacy polish must reuse the shared accent token');
assert(polishCss.includes('var(--ui-shadow-sm'), 'legacy polish must reuse the shared shadow token');
assert(polishCss.includes('backdrop-filter: none !important'), 'global controls must explicitly disable glass blur');
assert(polishCss.includes('opacity: 0.56 !important'), 'disabled controls must match the shared design-system state');
assert(polishCss.includes('@media (prefers-contrast: more)'), 'global polish must retain high-contrast support');

for (const forbidden of [
  '--ui-glass',
  'blur(12px)',
  'button:not(:disabled)::after',
  'linear-gradient(180deg, rgba(255,255,255',
  '0 8px 22px rgba(245,197,24',
  'radial-gradient(circle at 50% 15%',
]) {
  assert(!polishCss.includes(forbidden), `global polish must not restore legacy effect: ${forbidden}`);
}

assert(designCss.includes('--ui-font-caption: 13px'), 'shared caption text baseline must remain readable');
assert(designCss.includes('--ui-control-min: 44px'), 'shared touch target baseline must remain 44px');
assert(main.indexOf("import './ui-polish.css';") < main.indexOf("import './ui-design-system.css';"), 'design system must load after legacy polish');
assert(packageJson.scripts.test.includes('global-visual-consistency.test.js'), 'client test suite must include global visual consistency regression');

console.log('global visual consistency regression passed');
