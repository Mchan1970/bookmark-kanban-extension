# 访问频次辅助清理实施计划

## 目标
在不新增敏感权限的前提下，于本地统计每个书签的访问频次与最后访问时间，供 Cleanup 功能识别“长期未访问”或“低频书签”并提示用户清理。

## 核心思路
1. **数据来源**：使用现有权限 `tabs` + `bookmarks`。
   - 监听 `chrome.tabs.onUpdated`（status 变为 `complete`）事件。
   - 获取当前 tab 的 URL，使用 `chrome.bookmarks.search({ url })` 或本地索引比对，确认此 URL 是否对应用户书签。
   - 如果匹配到书签 ID，则在 `chrome.storage.local` 中维护结构：
     ```json
     accessStats: {
       <bookmarkId>: { lastVisitedAt: timestamp, visitCount: number }
     }
     ```
2. **本地存储**：所有统计信息存放于 `chrome.storage.local`，首屏加载时一次性读取，刷新或清理时同步更新，无任何网络上传。
3. **Cleanup 集成**：
   - `CleanupState` 读取 `accessStats`，根据“超过 N 天未访问”或“访问次数低于阈值”等规则构建新分组（例如 `stale`）。
   - Cleanup UI 展示“长期未访问”区块，支持批量忽略/归档/删除。
4. **可配置阈值**（可选）
   - 设置项允许用户定义“多少天未访问算陈旧”，默认如 180 天。

## 实施步骤
1. **数据收集层**
   - 新建 `accessTracker` 模块，注册 `chrome.tabs.onUpdated` 监听。
   - 实现 URL→书签 ID 的映射：建议预先构建 `urlToBookmarkId` Map（启动时遍历书签树，后续监听书签增删来更新）。
   - 每次匹配成功即更新 `accessStats[bookmarkId]`（`lastVisitedAt=Date.now()`、`visitCount+1`）。
2. **存储与索引**
   - `chrome.storage.local` 中维护 `kanbanAccessStats`。
   - 提供 `AccessStatsRepository` 负责读写，并暴露“批量合并/清理过旧记录”的方法。
3. **Cleanup 数据管线**
   - `CleanupState` 在 `initialize()` 时加载 `accessStats`，生成 `stale` 列表（根据阈值过滤）。
   - `CleanupView` 新增 `stale` 区块，渲染“最后访问时间”信息。
4. **UI/交互**
   - Settings 中增加阈值设置（可选）；默认 180 天。
   - Cleanup 中提示“自 X 日未访问”，操作按钮沿用现有归档/删除/忽略流程。
5. **测试与回退**
   - 验证在长时间运行后 `accessStats` 不会无限增长（定期清理已删除书签的记录）。
   - 若用户关闭该功能，可在设置中提供“清除访问统计”按钮。

## 权限与隐私说明
- 不新增任何权限；使用 `tabs`/`bookmarks` 是扩展已有声明。
- 数据全部留在本地 `chrome.storage.local`，仅用于用户本人 Cleanup 功能展示。
- 不会读取 `chrome.history`，也不会上传访问记录。
