# ThemeManager P0 计划：事件广播能力

## 背景
当前 `themeManager` 仅通过设置 `document.documentElement` 的 `data-theme` 来切换主题，但缺少对外广播能力，导致其它模块（如标签配色、显示模式、后续需要响应主题的组件）无法在不刷新页面的情况下得知主题变化。这直接阻塞了“预定义标签调色板随主题切换”的 P1 方案。

## 目标
为 `ThemeManager` 提供一个简单可靠的事件发布/订阅机制，使任何模块都可以订阅主题变化并即时执行联动逻辑。

## 实施方案
1. **监听集合**：在 ThemeManager 内部维护 `listeners = new Set()`。
2. **订阅接口**：新增 `subscribe(callback)` 方法（或 `onThemeChange`），接收函数并返回一个 `unsubscribe` 函数，方便模块在销毁时移除监听。
3. **广播时机**：在 `applyTheme` 成功设置主题、更新 `currentTheme` 之后调用 `notifyThemeChange(theme)`，把最终生效的主题名传给每个监听者。
   - 若传入非法主题导致回退到默认主题，也必须广播最终主题。
   - 可选：若 `theme === this.currentTheme`，直接返回，避免重复广播。
4. **系统偏好监听 / 初始化**：保持现有逻辑，但确保它们最终也通过 `applyTheme`，从而复用同一通知路径。
5. **订阅者异常保护**：在广播循环中 try/catch，防止单个监听器异常导致其它监听失效。

## 验收标准
- 主题切换（设置中选择、系统 `prefers-color-scheme` 变化、初始化默认值）后，订阅者都能立即收到一次 `newTheme` 回调。
- 支持多个订阅者互不干扰，`unsubscribe()` 之后不再收到通知。
- 重复设置同一主题不会触发多余广播（可选）。

## 风险 & 缓解
- **重复通知**：在 `applyTheme` 开头检查 `if (this.currentTheme === theme) return;`。
- **订阅者异常**：广播时局部捕获异常并打印日志，保证其它监听继续执行。

## 后续
完成 P0 后即可推进“预定义调色板 + JSON 覆盖”的 P1 方案；届时 `tagManager` 等模块可通过 `themeManager.subscribe` 即刻切换调色板，无需刷新页面。
