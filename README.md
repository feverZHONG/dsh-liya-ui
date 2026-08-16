# dsh-liya-ui-plugin · 莉娅 DSH UI 润色插件

tapIndex 注入 CSS 统一加大圆角，让界面更圆润。v0.3.0 起 radius 可配置：
设置 → 插件 → **插件配置** 里 `dsh-liya-ui-plugin` 卡可编辑基础圆角（4-48），保存**即时生效**（host 持久化）。

> **v0.3.1（2026-08-17）修了两处「配置不生效」的实锤坑：**
> 1. **settingsScope 重复 bind**：`settingsScope.bind()` 每次调用都新建 controller（初始 `status='loading'`、
>    load 异步），旧代码每次读取都 bind → 永远读不到 `ready` → 用户配置永不生效。
>    修法：apply 期 bind 一次、复用同一 controller（官方 ui-theme 同款姿势）。
> 2. **层叠顺序**：host 默认样式（`:root{--liya-radius:16px}`）注入在 `<body>` 开头，晚于 head 里的
>    覆盖样式，同特异性按文档顺序后者赢 → 覆盖被默认值压掉。修法：覆盖声明加 `!important`。
> 改完刷新 WebUI 页面即生效（client bundle no-cache 实时读文件）。

## 改了什么

| 表面 | 圆角 |
|:-----|:-----|
| 输入框 / 搜索框（textarea、text/search/email/url） | 基础值 + 2px |
| 对话框 `[role="dialog"]` | 基础值 + 6px |
| 菜单 / 下拉 / 提示 `[role="menu"/"listbox"/"tooltip"/"combobox"]` | 基础值 |

基础值 = settings 配置 `radius`（默认 16），走 `--liya-radius` 变量。

## 原理

- host 半 `webServer.tapIndex()` 往 index.html 的 `<body>` 后注入 `<style>`（官方 ui-theme bootTheme 同款 seam），
  radius 用 `config.radius`（cordis.patch.yml，默认 16）作为启动兜底
- host 半 `ctx.settings.register('liya-ui', Schema.object({radius}))` 注册配置 namespace
- client 半订阅 `settingsScope`：用户配置存在时注入 `:root{--liya-radius:Xpx}` 覆盖 host 默认（保存即时生效）；
  未配置/重置时移除覆盖，沿用 host 默认
- 选择器全部走语义 `role` / 标签，不碰 DSH 的 hash 类名（升级不失效）；`!important` 才能压过组件内联样式

## 安装 / 打包

```powershell
# 安装（装完重启 WebUI 生效）
dsh plugin --profile web add <插件目录>

# 打包归档（产物输出到你的 dist 目录）
pnpm pack --pack-destination <你的插件分发目录>

# 卸载
dsh plugin --profile web remove dsh-liya-ui-plugin
```

> `dsh` 请替换为阁下 DSH 安装对应的 CLI 调用方式。

装完**重启 WebUI** 生效（改过 manifest/client 后必须重启）。

## 调圆角大小

**推荐**：设置 → 插件 → 插件配置 → dsh-liya-ui-plugin → 改 radius（4-48）→ 保存，即时生效。
兜底默认值在 `cordis.patch.yml` 的 `config.radius`。想细化某个表面，改 `index.js` 的 `radiusCss()` 里对应行的系数。

## 已知边界

- 只覆盖语义 role / 标签选择器能命中的表面；个别组件用了非常规 role 会漏
- `!important` 覆盖组件内联圆角——如果某处原设计就是刻意的小圆角（如小徽章），会被统一拉大
- 想加更多表面（如卡片/面板）：往 `radiusCss()` 里加一行选择器，但别用 `*` 全量（会把圆形元素压扁）
