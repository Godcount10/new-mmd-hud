import type { CardDefinition } from '../types'

/**
 * This is the file to edit while developing a role card. The host reloads it
 * through Vite HMR and re-runs the card runtime inside the preview iframe.
 */
export const currentCard: CardDefinition = {
  name: '本地测试角色',
  statusbar: '{{hud}}',
  beginning: '欢迎来到本地 MMD Host。请修改 src/card/currentCard.ts 观察热更新。',
  rules: [
    {
      name: '状态栏',
      findRegex: '{{hud}}',
      replaceString: `
        <div class="demo-statusbar">
          <span class="demo-statusbar__label">本地状态</span>
          <span class="demo-statusbar__value">可编辑 · HMR 已连接</span>
        </div>
      `,
    },
    {
      name: '角色卡提示',
      findRegex: '本地 MMD Host',
      replaceString: '<mark class="demo-mark">本地 MMD Host</mark>',
    },
    {
      name: '消息工具脚本',
      findRegex: '一个不会命中的本地脚本标记',
      replaceString: `
        <style>
          .demo-statusbar { display:flex; justify-content:space-between; gap:12px; padding:8px 12px; border:1px solid color-mix(in srgb, var(--chat-accent) 35%, var(--chat-border)); color:var(--chat-text); background:color-mix(in srgb, var(--chat-accent) 10%, var(--chat-surface)); }
          .demo-statusbar__label { font-weight:700; }
          .demo-statusbar__value { color:var(--chat-text-muted); }
          .demo-mark { padding:1px 4px; color:var(--chat-accent); background:transparent; }
        </style>
        <script>
          sdk.on('message:mount', function (msg) {
            sdk.debug.log('消息已挂载', msg && msg.id);
          });
          sdk.on('message:done', function (msg) {
            if (msg && msg.content) sdk.debug.log('AI 回复完成', msg.content.slice(0, 32));
          });
        </script>
      `,
    },
  ],
}

export default currentCard
