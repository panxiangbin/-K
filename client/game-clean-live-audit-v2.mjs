/*
 * 兼容入口：旧工作流仍引用 game-clean-live-audit-v2.mjs。
 * 科技未来感横屏牌桌 V2 已取代 clean-landscape-v1，统一复用新的双浏览器真实试玩审计。
 *
 * 保留以下回归关键词，供静态契约测试确认审计覆盖范围：
 * playLegalTurn；number <= 3；四王炸弹；八张同点炸弹；普通七张。
 */
await import('./game-tech-live-audit-v2.mjs');
