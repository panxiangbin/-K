import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isJokerCardNode } from './src/joker-pair-ui-guard.js';

const node = (label, text = '') => ({
  getAttribute(name) { return name === 'aria-label' ? label : ''; },
  textContent: text,
});
assert.equal(isJokerCardNode(node('第1张牌，小王，未选中')), true);
assert.equal(isJokerCardNode(node('第2张牌，大王，已选中')), true);
assert.equal(isJokerCardNode(node('第3张牌，黑桃A，已选中')), false);

const source = fs.readFileSync(new URL('./src/joker-pair-ui-guard.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
assert.match(source, /selected\.length === 2/);
assert.match(source, /王不能组成普通对子/);
assert.match(source, /event\.stopImmediatePropagation\(\)/);
assert.match(source, /attributeFilter:\s*\['aria-pressed'\]/);
assert.match(main, /installJokerPairUiGuard\(\)/);
console.log('joker pair UI guard tests passed');
