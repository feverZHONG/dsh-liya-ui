// 莉娅 DSH UI 润色插件 —— Client 半（dsh client bundle）
// 功能：
//   1. radius 即时覆盖：读 settings namespace `liya-ui` 的 radius（用户层），注入
//      :root{--liya-radius:Xpx} 覆盖 host tapIndex 的默认值；订阅变更即时生效；
//      用户未配置时不移除（沿用 host 的 config.radius 默认）。
//   2. 设置 → 插件 → 插件配置 注册原生风格配置卡（id: dsh-liya-ui）：
//      可展开 + radius 输入（4-48）+ 保存/撤销，走 configForms（host 持久化）。
// 样式全部走内联 + dsw alias 变量，不依赖 CSS module；跟随官方卡片的视觉语言。
window.__ModuleLoader__.load({
  id: 'dsh-liya-ui-plugin',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    var react = require('react');

    var CARD_BTN = {
      font: 'inherit', fontSize: 13, borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
      border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-1)',
      color: 'var(--dsw-alias-label-primary)'
    };

    function parseRadius(text) {
      if (text === '') return null; // 空 = 清除（回到默认）
      var n = parseInt(text, 10);
      if (isNaN(n)) return null;
      if (n < 4 || n > 48) return null;
      return n;
    }

    // rc.2 设置接入：客户端服务由 settingsScope 改为 configForms（官方 ui-settings 的 client 半提供），
    // namespace 用 profile entry id（本插件 = dsh-liya-ui）。不写进 inject：服务缺席也不让 boot 卡 pending。
    function liyaConfigForm(ctx, entryId) {
      try {
        var cf = ctx.get('configForms');
        if (cf === undefined || cf === null || typeof cf.get !== 'function') return null;
        return cf.get(entryId);
      } catch (e) { return null; }
    }

    // ── radius 即时覆盖层（订阅 configForms，用户配置存在才注入覆盖）
    // 教训（2026-08-17 实锤）：每次 bind 都新建 controller（初始 status='loading'，load() 异步）
    // ——绝不能每次读取都 bind，否则永远读不到 'ready'，用户配置永不生效。正确姿势（官方
    // ui-theme 同款）：apply 期取一次 controller 复用，订阅它等 'ready'。
    function mountRadiusOverride(ctx, bound) {
      var styleTag = document.createElement('style');
      styleTag.dataset.plugin = 'dsh-liya-ui-plugin';
      styleTag.dataset.pluginCss = 'dsh-liya-ui/radius.css';
      function applyRadius() {
        var should = false;
        var r = 16;
        try {
          if (bound !== null) {
            var snap = bound.getSnapshot();
            if (snap && snap.status === 'ready' && snap.user && typeof snap.user === 'object' && typeof snap.user.radius === 'number') {
              should = true;
              r = snap.user.radius;
            }
          }
        } catch (e) {}
        if (should) {
          // !important：host tapIndex 的默认样式（:root{--liya-radius:16px}）注入在 <body>
          // 开头，文档顺序晚于 head 里的覆盖样式；同特异性按后者赢，必须 !important 才能
          // 压过默认值（2026-08-17 实测层叠顺序）
          styleTag.textContent = ':root{--liya-radius:' + r + 'px !important}';
          if (!styleTag.isConnected) document.head.appendChild(styleTag);
        } else if (styleTag.isConnected) {
          styleTag.remove();
        }
      }
      applyRadius();
      var off = null;
      try {
        if (bound !== null) off = bound.subscribe(applyRadius);
      } catch (e) {}
      return function () {
        if (off) off();
        if (styleTag.isConnected) styleTag.remove();
      };
    }

    // ── 插件配置卡（原生风格：展开 + radius 输入 + 保存/撤销）
    function LiyaUiCard(props) {
      var ctx = props.ctx;
      var bound = props.bound !== undefined ? props.bound : null;
      if (bound === null) {
        bound = liyaConfigForm(ctx, 'dsh-liya-ui');
      }

      var openState = react.useState(false);
      var open = openState[0];
      var setOpen = openState[1];
      var stagedState = react.useState({});
      var staged = stagedState[0];
      var setStaged = stagedState[1];
      var savingState = react.useState(false);
      var saving = savingState[0];
      var setSaving = savingState[1];
      var failedState = react.useState(false);
      var failed = failedState[0];
      var setFailed = failedState[1];

      var snap = null;
      var syncError = null;
      if (bound !== null) {
        // ⚠️ 方法必须包函数绑定 this：React 裸调 subscribe/getSnapshot 时 this 丢失，
        // controller 里 this.store 会抛 "Cannot read properties of undefined (reading 'store')"（2026-08-16 实战）
        try {
          snap = react.useSyncExternalStore(
            function (listener) { return bound.subscribe(listener); },
            function () { return bound.getSnapshot(); }
          );
        } catch (e) { syncError = e && e.message; snap = null; }
      }
      var available = bound !== null && snap !== null && snap.status === 'ready';
      var loading = bound !== null && snap !== null && snap.status === 'loading';
      var writable = bound !== null && snap !== null && !!snap.writable;
      var value = (snap && snap.value && typeof snap.value === 'object') ? snap.value : {};
      var user = (snap && snap.user && typeof snap.user === 'object') ? snap.user : {};
      var diag = {
        hasConfigForms: ctx.get('configForms') !== undefined,
        bound: bound !== null,
        status: snap === null ? 'no-snap' : snap.status,
        syncError: syncError,
      };

      var radiusText = (staged.radius !== undefined) ? staged.radius : String(typeof value.radius === 'number' ? value.radius : 16);
      var radiusStaged = staged.radius !== undefined;
      var radiusInvalid = radiusStaged && parseRadius(staged.radius) === null;
      var dirty = radiusStaged;
      var blocked = !dirty || radiusInvalid || saving;

      function onRadiusEdit(text) {
        var ns = {};
        ns.radius = text;
        setStaged(ns);
        setFailed(false);
      }
      function resetRadius() {
        var ns = {};
        ns.radius = '';
        setStaged(ns);
        setFailed(false);
      }
      function onSave() {
        if (bound === null || !dirty || radiusInvalid) return;
        setSaving(true);
        setFailed(false);
        var op;
        if (staged.radius === '') op = bound.unset('radius');
        else op = bound.set('radius', parseRadius(staged.radius));
        op.then(function () {
          setSaving(false);
          setStaged({});
        }).catch(function () {
          setSaving(false);
          setFailed(true);
        });
      }
      function onDiscard() {
        setStaged({});
        setFailed(false);
      }

      var overridden = Object.prototype.hasOwnProperty.call(user, 'radius');

      var titleRow = react.createElement(
        'button',
        {
          type: 'button',
          'aria-expanded': open,
          onClick: function () { setOpen(!open); },
          style: {
            display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, padding: '10px 12px', border: 0, background: 'transparent',
            color: 'var(--dsw-alias-label-primary)', font: 'inherit', cursor: 'pointer', textAlign: 'left'
          }
        },
        react.createElement(
          'span',
          { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
          react.createElement('strong', { style: { fontSize: 13, fontWeight: 600 } }, 'dsh-liya-ui-plugin'),
          react.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, 'UI 圆角润色，配置基础圆角值')
        ),
        react.createElement(
          'span',
          { style: { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, flex: 'none' } },
          dirty ? react.createElement('span', { style: { color: 'var(--dsw-alias-label-primary)' } }, '未保存') : react.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
            react.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: 'var(--dsw-alias-state-success-primary)', display: 'inline-block' } }),
            '运行中'
          ),
          react.createElement('span', { 'aria-hidden': 'true', style: { transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none', fontSize: 10 } }, '▾')
        )
      );

      var body = null;
      if (open) {
        var content;
        if (loading) {
          content = react.createElement('p', { key: 'loading', style: { margin: 0, fontSize: 13, color: 'var(--dsw-alias-label-tertiary)' } }, '配置加载中…');
        } else if (!available) {
          content = react.createElement(
            'div',
            { key: 'unavailable' },
            react.createElement('p', { style: { margin: '0 0 8px', fontSize: 13, color: 'var(--dsw-alias-label-secondary)', lineHeight: '20px' } },
              '莉娅 DSH UI 润色：host 半经 webServer.tapIndex 注入圆角 CSS（输入框 +2px、对话框 +6px、菜单/下拉 = 基础值），选择器走语义 role 不碰 hash 类名。配置暂不可用。'
            ),
            react.createElement('p', { style: { margin: '0 0 8px', fontSize: 12, color: 'var(--dsw-alias-label-tertiary)', lineHeight: '18px' } },
              '默认基础圆角来自 cordis.patch.yml 的 config.radius（16px）。'
            ),
            react.createElement('p', { style: { margin: 0, fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', lineHeight: '16px', fontFamily: 'monospace' } },
              'debug: ' + JSON.stringify(diag)
            )
          );
        } else {
          var radiusInput = react.createElement(
            'div',
            { key: 'radius', style: { padding: '8px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)' } },
            react.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 10 } },
              react.createElement('label', { htmlFor: 'liya-ui-cfg-radius', style: { fontSize: 13, color: 'var(--dsw-alias-label-primary)', flex: '1 1 auto' } }, '基础圆角 radius（px）'),
              react.createElement('input', {
                id: 'liya-ui-cfg-radius', type: 'number', min: 4, max: 48, step: 1,
                value: radiusText, disabled: !writable,
                onChange: function (e) { onRadiusEdit(e.target.value); },
                style: {
                  width: 76, padding: '4px 8px', borderRadius: 6, font: 'inherit', fontSize: 13,
                  border: '1px solid ' + (radiusInvalid ? 'var(--dsw-alias-state-danger-primary)' : 'var(--dsw-alias-border-l2)'),
                  background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', textAlign: 'right'
                }
              }),
              overridden ? react.createElement('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', flex: 'none' } }, '已覆盖') : null
            ),
            react.createElement(
              'div',
              { style: { display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4, alignItems: 'center' } },
              react.createElement('span', { style: { fontSize: 12, color: radiusInvalid ? 'var(--dsw-alias-state-danger-primary)' : 'var(--dsw-alias-label-tertiary)', lineHeight: '18px' } },
                radiusInvalid ? '请输入 4-48 之间的整数' : '输入框 +2 / 对话框 +6 / 菜单下拉 = 基础值；保存后即时生效，留空保存恢复默认')
              ,
              overridden ? react.createElement('button', {
                type: 'button', onClick: resetRadius, disabled: !writable,
                style: { fontSize: 11, background: 'none', border: 'none', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', padding: 0, flex: 'none' }
              }, '重置') : null
            )
          );
          content = [
            react.createElement('p', { key: 'desc', style: { margin: '0 0 4px', fontSize: 13, color: 'var(--dsw-alias-label-secondary)', lineHeight: '20px' } },
              '统一加大界面圆角，选择器走语义 role / 标签，不碰 hash 类名：'),
            radiusInput,
            react.createElement('div', { key: 'footer', style: { display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 10, alignItems: 'center' } },
              failed ? react.createElement('p', { key: 'failed', role: 'status', style: { margin: '0 auto 0 0', fontSize: 12, color: 'var(--dsw-alias-state-danger-primary)' } }, '保存失败，请重试') : null,
              react.createElement('button', { type: 'button', onClick: onDiscard, disabled: !dirty || saving, style: CARD_BTN }, '撤销'),
              react.createElement('button', { type: 'button', onClick: onSave, disabled: blocked, style: Object.assign({}, CARD_BTN, { background: 'var(--dsw-alias-button-info-fill)', color: '#fff', borderColor: 'transparent' }) }, saving ? '保存中…' : '保存')
            )
          ];
        }
        body = react.createElement('div', { style: { borderTop: '1px solid var(--dsw-alias-border-l2)', padding: '10px 12px' } }, content);
      }

      return react.createElement(
        'li',
        { style: { listStyle: 'none' } },
        react.createElement(
          'div',
          { style: { border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-3)', borderRadius: 10, overflow: 'hidden', minWidth: 0 } },
          titleRow,
          body
        )
      );
    }

    exports.inject = ['slots'];
    exports.apply = function (ctx) {
      // 配置 controller 在 apply 期取一次复用（卡与覆盖共用，不在 React 渲染期取）。
      var uiScopeBound = liyaConfigForm(ctx, 'dsh-liya-ui');

      // radius 即时覆盖（host 默认兜底；用户配置保存后立刻生效）
      ctx.effect(function () {
        return mountRadiusOverride(ctx, uiScopeBound);
      }, 'dsh-liya-ui: radius override');

      // rc.2：`settings.plugin.item` 插槽已被官方移除，注册它会抛错连累 client 条目激活。
      // 配置卡改由官方「设置 → 插件」页从插件导出的 Config（volatile 字段）+ entry id
      // 自动生成。LiyaUiCard 组件保留在文件里（未注册）备用。
    };

    module.exports = exports;
    return module.exports;
  }
});
