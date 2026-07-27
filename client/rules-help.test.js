import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FORBIDDEN_RULE_TERMS, RULES_HELP_SECTIONS, flattenRulesText } from './src/rules-help-data.js';

const rulesText = flattenRulesText();
const dialogSource = fs.readFileSync(new URL('./src/components/RulesHelp.jsx', import.meta.url), 'utf8');
const launcherSource = fs.readFileSync(new URL('./src/components/RulesHelpLauncher.jsx', import.meta.url), 'utf8');
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
assert.match(dialogSource, /规则章节快捷导航/, '规则帮助应提供章节快捷导航');
assert.match(dialogSource, /rules-help-section-heading/, '规则章节应具有稳定视觉层级');
assert.match(dialogSource, /返回游戏/, '规则关闭操作应使用面向对局的文字');

assert.match(launcherSource, /game-table-shell/, '牌桌内必须可以打开规则');
assert.match(launcherSource, /waiting-room-card/, '等待房内必须可以打开规则');
assert.match(launcherSource, /settlement-screen/, '结算页必须可以打开规则');
assert.match(launcherSource, /data-surface=\{surface\}/, '规则入口应根据页面调整位置');
assert.match(launcherSource, /aria-label=\{SURFACE_LABELS\[surface\]\}/, '规则入口必须有上下文标签');

assert.match(css, /overflow-y:\s*auto/);
assert.match(css, /overscroll-behavior:\s*contain/);
assert.match(css, /safe-area-inset-top/);
assert.match(css, /safe-area-inset-bottom/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /prefers-contrast:\s*more/);
assert.match(css, /focus-visible/);
assert.match(css, /data-surface="game"/, '牌桌规则入口必须避开底部手牌区');
assert.match(css, /rules-help-nav a[\s\S]*min-height:\s*38px/, '章节快捷入口需要清楚可点');
assert.doesNotMatch(css, /backdrop-filter:\s*blur/, '规则帮助不得恢复玻璃模糊');
assert.doesNotMatch(css, /#60a5fa|#2563eb/, '规则帮助不得恢复旧蓝色焦点');

console.log('rules help tests passed');
