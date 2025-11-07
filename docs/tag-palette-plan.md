# 标签调色板实施方案（基于主题广播能力）

## 前提
P0：`themeManager` 已具备订阅/广播机制，模块可在主题切换时收到通知。

## 目标
1. 为每个主题提供一组预定义标签调色板，保证可读性。
2. 支持“高级用户 JSON 覆盖”，允许通过设置页输入自定义调色板。
3. 主题切换时，标签颜色即时更新，无需刷新页面。

## 实施步骤
1. **调色板配置**
   - 新增 `js/config/tagPalettes.js`（或同类常量文件），定义如下结构：
     ```js
     export const tagPalettes = {
       default: [{ bg: '#...', text: '#...' }, ...],
       dark: [...],
       // ... 其它主题
     };
     ```
   - 每个主题至少 8-10 种颜色，已通过设计验证对比度。

2. **tagManager 集成**
   - 注入当前主题（`themeManager.getCurrentTheme()`）。
   - 订阅 `themeManager.subscribe`，在主题变化时切换当前 palette。
   - 标签颜色分配逻辑改为：根据标签 hash 在调色板中取 `index = hash % palette.length`。
   - 保留 JSON 覆盖的入口（见步骤 3），若覆盖有效，则使用覆盖 Palette。

3. **设置页高级覆盖**
   - 在 Settings 中新增 textarea：`Custom Tag Palette (JSON)`。
   - 校验 JSON 结构（对象，key 为主题名，值为颜色数组）。
   - 存储在 `storageManager`（或新 key），保存成功后触发 palette 更新。
   - 空值或解析失败时恢复默认预设。

4. **渲染器更新**
   - `tagRenderer` 使用 tagManager 提供的颜色（或直接读取 palette）设置背景/文本色。
   - 主题切换时，触发 UI update：可通过重新渲染标签或提供 `refreshTagColors()`。

5. **验证 & 回退**
   - 测试各主题下标签可读性。
   - JSON 覆盖失败回退默认预设，并提示用户。

## 时序
- Step 1-2：核心功能（P1）
- Step 3：高级覆盖（P1.5）
- Step 4-5：验证及细节

完成后，标签配色即可随主题实时更新，同时高级用户可通过 JSON 完全自定义调色板。
