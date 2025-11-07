# Chrome Web Store Submission Checklist (Cleanup Lite)

1. Scope：仅验证 MV3 核心能力（书签管理 + Cleanup Lite），不再包含站点检测。
2. Manifest：保持最小权限（`bookmarks`、`storage`、`tabs`），不申领 `host_permissions` 或 `alarms`。
3. 消除遗留：确保代码中不再引用 `siteChecker` / `CHECK_*` 消息或 “Re-check” 菜单项。
4. UI：删除 “Check Sites” 按钮与相关进度样式，Cleanup 中不再显示 “Dead Links”。
5. 文档：在发布说明中标注 “站点检测暂不可用”，以免用户困惑。
