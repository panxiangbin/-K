/*
 * 兼容入口：工作流仍引用 game-clean-live-audit-v2.mjs。
 * 正式审计已升级为 V3：playLegalTurn；number <= 3；四王炸弹；八张同点炸弹；普通七张。
 * V3 在强制横屏旋转环境使用 client/scroll 逻辑尺寸判断文字溢出，避免 Range 物理坐标轴交换造成误报。
 */
await import('./game-clean-live-audit-v3.mjs');
