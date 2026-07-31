/*
 * 兼容入口：工作流仍引用 game-clean-live-audit-v2.mjs。
 * 正式审计已升级为 V5：随机提示牌若被服务端拒绝，自动合法过牌；最长牌型改用逻辑文字度量，避开强制横屏的滚动尺寸误报。
 * 仍保留 Chromium Android、WebKit iPhone、三次真实出牌、36 张手牌完整显示和最长牌型截图验收。
 */
await import('./game-clean-live-audit-v5.mjs');
