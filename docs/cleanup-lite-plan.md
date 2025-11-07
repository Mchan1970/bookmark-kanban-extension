# Cleanup 精简方案（移除站点检测 / 死链检测）

## 背景
- 旧版 Cleanup 依赖 `siteChecker` 对书签发起网络请求来判断“死链 / HTTP-only”状态。
- 在 MV3 Service Worker 环境下，该实现因 CORS 与缺少 DOM API 无法可靠运行，并迫使我们申请 `<all_urls>`、`alarms` 等高风险权限。
- 为确保扩展顺利上架，决定砍掉所有主动网络探测功能，仅保留“静态”整理能力（重复、归档、手动标记等）。

## 目标
1. 从 Cleanup 界面中移除“Dead Links / HTTP Link”分类及相关操作。
2. 删除书签操作菜单中的“检测 / Re-check”选项，以及相关消息管线。
3. 删除所有调用 `siteChecker` 的逻辑，避免无效的异步操作。
4. 收紧 manifest 权限：取消 `<all_urls>` / `alarms`。
5. 保留其它整理能力（重复项、归档、回收站）并提供说明。

## 执行步骤
1. **UI 调整**
   - 更新 `cleanupView` 模块：移除“Dead Links”区块与相关统计。
   - 更新任何提示文案，说明当前版本不再自动检测死链。
2. **逻辑与依赖**
   - 删除 `siteChecker` 模块及其引用（`background.js`、`cleanupManager`、`BookmarkActionMenu` 等）。
   - 移除书签菜单的“Re-check”事件、消息类型、相关 UI 提示。
   - 清理 `siteChecker` 缓存/状态使用，确保不残留调用。
3. **权限回收**
   - 修改 `manifest.json`：移除 `host_permissions: ["<all_urls>"]` 和 `alarms` 权限，如果不再需要。
4. **文档与用户沟通**
   - 更新 README / Settings 中的相关说明，解释“死链检测”暂不可用。

## 提交策略
- 以“Cleanup Lite”模式提交：强调当前版本专注于组织与归档，后续若找到合规实现再恢复站点检测。
