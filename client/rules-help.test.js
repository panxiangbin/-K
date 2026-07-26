import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FORBIDDEN_RULE_TERMS, RULES_HELP_SECTIONS, flattenRulesText } from './src/rules-help-data.js';

const rulesText = flattenRulesText();
const dialogSource = fs.readFileSync(new URL('./src/components/RulesHelp.jsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/rules-help.css', import.meta.url), 'utf8');

assert.equal(RULES_HELP_SECTIONS.length, 4, '规则帮助应按普通牌型、点数、炸弹、压牌计分分组');
for (const term of FORBIDDEN_RULE_TERMS) assert.equal(rulesText.includes(term), false, `规则帮助不得出现未确认牌型：${term}`);

for (const required of [
  '单张、对子、三张、四至七张同点牌',
  '小王和大王不能组成普通对子',
  '3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2 < 小王 < 大王',
  '黑桃 > 红桃 > 梅花 > 方块',
  '同点时黑四大于红四',
  '同花五十K < 红四／黑四 < 八张同点 < 四王',
  '有合法更大牌时必须压牌',
  '最后一手出完后，其他玩家仍可继续压牌',
]) assert.ok(rulesText.includes(required), `缺少固定规则：${required}`);

assert.match(dialogSource, /role="dialog"/);
assert.match(dialogSource, /aria-modal="true"/);
assert.match(dialogSource, /event\.key === 'Escape'/);
assert.match(dialogSource, /event\.key !== 'Tab'/);
assert.match(dialogSource, /openerRef\.current\?\.focus/);
assert.match(dialogSource, /document\.body\.style\.overflow = 'hidden'/);
assert.match(dialogSource, /tabIndex="0"/);

assert.match(css, /overflow-y:\s*auto/);
assert.match(css, /overscroll-behavior:\s*contain/);
assert.match(css, /safe-area-inset-top/);
assert.match(css, /safe-area-inset-bottom/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /focus-visible/);

console.log('rules help tests passed');
