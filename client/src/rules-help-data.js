export const RULES_HELP_TITLE = '河南五十K规则';

export const RULES_HELP_SECTIONS = [
  {
    id: 'normal-patterns',
    title: '普通牌型',
    items: [
      '普通牌型只有单张、对子、三张、四至七张同点牌。',
      '对子必须是两张同点普通牌；任何王都不能组成普通对子，包括两个小王、两个大王或大小王。',
      '普通牌型只能用相同牌型、相同张数的更大牌压制。',
    ],
  },
  {
    id: 'rank-order',
    title: '点数大小',
    items: ['3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2 < 小王 < 大王。'],
  },
  {
    id: 'bombs',
    title: '炸弹',
    items: [
      '同花五十K：同一花色的5、10、K；花色大小为黑桃 > 红桃 > 梅花 > 方块。',
      '红四／黑四：四张同点且全部为红色或全部为黑色；先比点数，同点时黑四大于红四。',
      '八张同点：八张相同点数的牌。',
      '四王：2张小王加2张大王，并且是最大炸弹。',
      '炸弹级别：同花五十K < 红四／黑四 < 八张同点 < 四王。',
    ],
  },
  {
    id: 'pressure',
    title: '压牌与得分',
    items: [
      '有合法更大牌时必须压牌，不能随意过牌。',
      '最后一手出完后，其他玩家仍可继续压牌。',
      '当前牌堆由最后成功出牌的玩家得分。',
      '5计5分，10和K各计10分。',
    ],
  },
];

export const FORBIDDEN_RULE_TERMS = ['顺子', '连对', '飞机', '三带一'];

export function flattenRulesText() {
  return RULES_HELP_SECTIONS.flatMap(section => [section.title, ...section.items]).join('\n');
}
