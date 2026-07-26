'use strict';

const ERROR_MESSAGES = Object.freeze({
  ROOM_NOT_FOUND: '房间不存在或已经关闭，请检查房间号后重新加入。',
  ROOM_ALREADY_STARTED: '游戏已经开始，不能作为新玩家加入；原玩家请使用原设备恢复房间。',
  NICKNAME_REQUIRED: '请输入昵称后再加入房间。',
  NICKNAME_IN_USE: '这个昵称已经有人使用，请换一个昵称。',
  ROOM_FULL: '房间人数已满，请加入其他房间。',
  HOST_ONLY_START: '只有房主可以开始游戏。',
  CANNOT_START_NOW: '当前房间不能重复开始游戏，请等待状态更新。',
  NEED_MORE_PLAYERS: '至少需要3名未退出的玩家才能开始游戏。',
  GAME_NOT_ACTIVE: '当前对局尚未开始或已经结束，不能继续出牌。',
  NOT_YOUR_TURN: '还没轮到你，请等待当前玩家完成操作。',
  CARD_STATE_CHANGED: '手牌状态已经变化，已为你同步最新手牌，请重新选择。',
  INVALID_PATTERN: '所选牌型不合法。只能出单张、对子、三张、四至七张同点牌或合法炸弹。',
  CANNOT_BEAT: '所选牌压不过上一手。请换同类型、同张数的更大牌，或使用合法炸弹。',
  LEAD_CANNOT_PASS: '你是本轮先手，必须出牌，不能过牌。',
  MUST_BEAT: '你有合法更大牌，必须压牌，不能直接过牌。',
  SETTLEMENT_NOT_READY: '当前还没有进入结算，不能开始下一局。',
  HOST_ONLY_NEXT_ROUND: '只有房主可以开始下一局。',
});

function getErrorMessage(code) {
  return ERROR_MESSAGES[code] || '操作没有成功，请等待状态更新后重试。';
}

module.exports = { ERROR_MESSAGES, getErrorMessage };
