// 莉娅 DSH UI 润色插件 —— Host 半（ESM，函数形式，纯 CSS 注入）
// 功能：webServer.tapIndex 向 index.html 注入圆角润色 CSS——
//   输入框/搜索框 +2px、对话框 +6px、菜单/下拉/提示 = 基础值，统一走 --liya-radius 变量。
// 圆角基础值：cordis.patch.yml 的 config.radius（默认 16）为启动兜底；用户配置（settings
//   namespace `liya-ui` 的 radius）由 client 半覆盖注入，保存后即时生效。
// 注意：不声明 Config schema（cordis 的 config 走 apply(ctx, config) 第二参数注入——不要读
//   ctx.config，未声明 Config schema 时是 Proxy 拦截抛错 "cannot get property config without inject"）。
// schemastery：junction 链接自资源目录 node_modules（workspace/dsh-plugins/node_modules/@deepseek-ai/schemastery），
// 解决 bundle 插件 link 目录向上解析不到依赖的问题（2026-08-16）。
import Schema from '@deepseek-ai/schemastery'

export const name = 'dsh-liya-ui'
export const inject = ['webServer', 'settings']

const liyaUiSchema = Schema.object({
  radius: Schema.number().min(4).max(48).default(16).description('基础圆角值（px），输入框/对话框/菜单按它派生'),
})

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
  const radius = config?.radius
  console.log(`[dsh-liya-ui] plugin loaded (host half), default radius=${radius}`)
  // 圆角配置 namespace。register 内部自带 fiber effect 清理，直接调用 + try/catch 打日志。
  try {
    ctx.settings.register('liya-ui', liyaUiSchema, { applies: 'live' })
    console.log('[dsh-liya-ui] settings namespace registered: liya-ui')
  } catch (e) {
    console.error('[dsh-liya-ui] settings.register failed:', e)
  }
  ctx.effect(
    () => ctx.webServer.tapIndex((html) => injectAfterBody(html, radius)),
    'dsh-liya-ui: radius polish',
  )
}
