// 莉娅 DSH UI 润色插件 —— Host 半（ESM，函数形式，纯 CSS 注入）
// 功能：webServer.tapIndex 向 index.html 注入圆角润色 CSS——
//   输入框/搜索框 +2px、对话框 +6px、菜单/下拉/提示 = 基础值，统一走 --liya-radius 变量。
// 圆角基础值来源（优先级）：用户配置（profile entry id `dsh-liya-ui` 的 radius，原生设置卡可改、即时生效）
//   > Config 默认值 16。DSH 0.2.0-rc.2 起 settings 服务没有 register()：配置卡 = 插件导出的
//   Config（字段必须 .volatile()）+ profile entry id 当 namespace，由原生设置页自动生成。
// 依赖：@deepseek-ai/schemastery（已写进 package.json dependencies；宿主若按 preserve-symlinks
//   解析，profile 的 node_modules 里也需要装一份，否则插件 import 直接失败）。
import Schema from '@deepseek-ai/schemastery'

export const name = 'dsh-liya-ui'
export const inject = ['webServer']

export const Config = Schema.object({
  radius: Schema.number().min(4).max(48).default(16).description('基础圆角值（px），输入框/对话框/菜单按它派生').volatile(),
})

// volatile 配置值是 cosmokit 引用（.get() 取快照）；Symbol 判定跨 ESM/CJS 副本安全
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write')
function cfgValue(value, fallback) {
  if (value !== null && typeof value === 'object' && VOLATILE_WRITE in value) {
    try {
      const snap = value.get()
      return snap === undefined ? fallback : snap
    } catch {
      return fallback
    }
  }
  return value === undefined ? fallback : value
}

function radiusCss(radius) {
  const base = Number(radius) || 16
  return `<style>:root{--liya-radius:${base}px}
textarea,input[type="text"],input[type="search"],input[type="email"],input[type="url"],input:not([type]){border-radius:calc(var(--liya-radius) + 2px)!important}
[role="dialog"]{border-radius:calc(var(--liya-radius) + 6px)!important}
[role="menu"],[role="listbox"],[role="tooltip"],[role="combobox"]{border-radius:var(--liya-radius)!important}
<\/style>`
}

function injectAfterBody(html, radius) {
  const body = /<body(?:\s[^>]*)?>/i.exec(html)
  const css = radiusCss(radius)
  if (body === null) return `${html}${css}`
  const at = body.index + body[0].length
  return `${html.slice(0, at)}${css}${html.slice(at)}`
}

export function apply(ctx, config) {
  // 每次请求实时取 volatile 快照：用户改配置后刷新页面即用新值（tapIndex 是启动注入，不重建）
  const currentRadius = () => cfgValue(config && config.radius, 16)
  console.log(`[dsh-liya-ui] plugin loaded (host half), radius=${currentRadius()}`)

  ctx.effect(
    () => ctx.webServer.tapIndex((html) => injectAfterBody(html, currentRadius())),
    'dsh-liya-ui: radius polish',
  )
}
