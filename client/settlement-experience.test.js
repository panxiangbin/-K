import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync(new URL('./src/settlement-experience.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/settlement-experience.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

for (const [name, pattern] of [
  ['settlement selector', /\.settlement-page/],
  ['result classification', /dataset\.result\s*=\s*won\s*\?\s*'win'\s*:\s*'loss'/],
  ['score card ranking', /card\.dataset\.rank/],
  ['self marker', /dataset\.self\s*=\s*'true'/],
  ['qualified marker', /dataset\.outcome/],
  ['next round accessible label', /aria-label.*开始下一局/],
  ['idempotent enhancement', /dataset\.settlementExperience\s*===\s*'ready'/],
  ['no interval polling', /MutationObserver/],
]) assert.match(js, pattern, `missing settlement experience contract: ${name}`);

assert.doesNotMatch(js, /setInterval\s*\(/, 'settlement enhancer must not poll continuously');

for (const [name, pattern] of [
  ['modern table background', /linear-gradient\(145deg, #071b15, #0b2a20/],
  ['desktop two-column layout', /grid-template-columns:\s*minmax\(260px, 34%\)/],
  ['44px top actions', /\.settlement-experience-action[\s\S]*min-height:\s*44px/],
  ['50px primary action', /\.settlement-experience-primary[\s\S]*min-height:\s*50px/],
  ['warm focus ring', /outline:\s*3px solid #f3d98f/],
  ['safe area top', /env\(safe-area-inset-top\)/],
  ['safe area left', /env\(safe-area-inset-left\)/],
  ['safe area right', /env\(safe-area-inset-right\)/],
  ['safe area bottom', /env\(safe-area-inset-bottom\)/],
  ['phone reflow', /@media \(max-width: 430px\)/],
  ['short landscape layout', /@media \(orientation: landscape\) and \(max-height: 430px\)/],
  ['wide desktop containment', /@media \(min-width: 1366px\)[\s\S]*max-width:\s*980px/],
  ['high contrast support', /@media \(prefers-contrast: more\)/],
  ['reduced motion support', /@media \(prefers-reduced-motion: reduce\)/],
  ['readable score detail', /\.settlement-experience-detail[\s\S]*font-size:\s*12px/],
  ['no glass blur', /backdrop-filter:\s*none/],
]) assert.match(css, pattern, `missing settlement visual contract: ${name}`);

assert.doesNotMatch(css, /#9333ea|#6366f1|#312e81|#1e1b4b/i, 'settlement experience must not reintroduce purple theme colors');
assert.doesNotMatch(css, /glow-pulse|infinite/i, 'settlement experience must not use looping celebration animation');
assert.match(main, /installSettlementExperience/);
assert.match(main, /settlement-experience\.css/);
assert.ok(pkg.scripts.test.includes('settlement-experience.test.js'), 'settlement experience test must be in npm test');

console.log('settlement experience tests passed');
