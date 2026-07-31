/*
 * 兼容入口：工作流仍引用 game-clean-live-audit-v2.mjs。
 * 正式审计已升级为 V4：随机提示牌若被服务端拒绝，自动清空并合法过牌，继续等待下一次可出牌回合。
 * 仍保留 Chromium Android、WebKit iPhone、三次真实出牌、36 张手牌完整显示和最长牌型逻辑溢出检查。
 */
await import('./game-clean-live-audit-v4.mjs');
