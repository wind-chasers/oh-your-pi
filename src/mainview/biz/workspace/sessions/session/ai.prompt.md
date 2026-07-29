# Session 会话界面

本目录展示并操作一个已选定的 session。会话事实、流式状态、工具授权和命令生命周期属于 [`../../../../chat-store/ai.prompt.md`](../../../../chat-store/ai.prompt.md)；组件只通过 `useChatSession()` 和 `ChatSession` 消费，不直接调用 session RPC 或订阅主进程事件。

## 接入边界

`WorkspacePage` 只把已选中的 `workspacePath + sessionId + sessionPath` 传给 `SessionChat`。`SessionChat` 调用：

```ts
useChatSession(workspacePath, sessionId, sessionPath)
```

获得 `[snapshot, session]`：

- `snapshot.openedSession`：持久 transcript 与 runtime 基线。
- `snapshot.transient.tail`：`empty | optimistic-user | live-agent`，表示紧接 canonical transcript 的互斥临时尾部。
- `snapshot.transient.queuedInputs.steering` / `followUps`：尚未由 Pi 交付的两条独立用户输入队列。
- live-agent tail 内聚文本、thinking、工具和授权请求。
- `snapshot.isSending`、`isRefreshing`、`error`：会话请求状态。
- `session.view.items`：由 `SessionView` 缓存的持久 render items。

`SessionChat` 只保留 transcript 滚动锚点等容器 UI 状态；`ChatComposer` 内聚 draft、待发送附件、预览和 prompt / steer / follow-up 用户意图。切换 session identity 时由父组件 key 触发 Composer 重建；后台 session 继续由 Chat Store 接收事件，不随界面卸载终止。

## 用户意图

- idle 提交：`session.prompt({ text, attachments })`。
- streaming 普通提交：`session.steer({ text, attachments })`。
- streaming follow-up：`session.followUp({ text, attachments })`。
- abort：`session.abort()`。
- 模型与 thinking：`session.setModel()` / `session.setThinking()`。
- 工具授权：`session.respondToPermission()`。

`ChatSession` 负责校验阶段、调用 RPC、发布 loading/error 和合并返回状态；组件捕获 rejected promise 只为避免未处理拒绝，不再复制错误或回滚状态。

## Transcript 与工具渲染

`SessionView` 是持久消息到渲染项的唯一翻译 owner：

- 普通 item 保存原消息的 `messageIndex`，无需 session tree ID。
- assistant toolCall 按 SDK tool call ID 关联独立 toolResult。
- 相邻工具调用合并为一个 `tool-section`。
- render items 按 transcript messages 对象身份缓存，切回会话时直接复用。
- user message 保留 Pi transcript 中的图片内容并以缩略图 + 可切换预览窗展示。

`ChatTranscript` 用独立 memo 历史区分发 `SessionViewItem[]`，再按 `snapshot.transient.tail` 渲染 optimistic user 或 live agent；两者不会同时出现。steer / follow-up 在 Pi 交付前由 Composer 上方的两条队列单独展示，steer 始终在前；Main 返回 `clientId ↔ entryId` 后才原子移除对应项，不伪装成持久 user message。

`chat/tools/` 拥有统一工具外壳：折叠 chip、单项详情与全部展开视图。registry 只能覆盖 chip/input/output 点位，不能替换 section 布局。`AnimatedHeight` 用 ResizeObserver 跟踪自然高度，并在过渡期间维持普通顺序滚动容器的元素锚点或底部距离。

## 组件边界

- `index.tsx`：把 Chat Store snapshot/session 适配给 Header、Transcript、权限提示与 Composer，不持有输入状态或发送操作。
- `chat/ChatTranscript.tsx`：隔离持久历史与互斥临时尾部渲染。
- `chat/messages/`：普通消息展示。
- `chat/tools/`：工具 section、详情骨架、动画、renderer registry。
- `chat/composer/ChatComposer.tsx`：拥有 draft、待发送附件及其 prompt / steer / follow-up 操作，协调输入区、附件区、工具栏和错误展示。
- `chat/composer/ComposerAttachments.tsx`：待发送图片的缩略图、移除操作与预览入口。
- `chat/composer/ComposerToolbar.tsx`：附件选择、模型/thinking、认证、follow-up 与发送操作。
- `chat/composer/QueuedInputs.tsx`：先渲染 steering、再渲染 follow-ups，并展示各项提交状态。
- `chat/composer/use-composer-attachments.ts`：原生选择与粘贴附件的合并、去重、上限、错误和预览索引状态。
- `chat/composer/paste.ts`：从 textarea paste 事件的 `DataTransfer` 读取二进制图片，生成 Renderer 预览和无路径 data source；不依赖系统文件路径或额外 RPC。
- `chat/composer/ModelThinkingSelector.tsx`：通过 `ChatSession` 修改模型和 thinking。
- `chat/ImagePreviewDialog.tsx`：Composer 与历史用户消息共用的全屏图片查看器，支持方向键和前后切换。
- `chat/ToolPermissionPrompt.tsx`：展示队首授权并返回决定。
- `settings/`、`export/`：session 附属界面，不持有第二份 transcript。

## 验证

行为变化至少覆盖：

- `SessionView` 的结果关联、相邻工具合并与缓存复用。
- 切换 session 后旧流仍留在原 `ChatSession`，不会污染当前界面。
- prompt、steer、follow-up、abort 的阶段差异。
- settled refresh 完成前增量内容不闪空，完成后正确清理对应 generation。
- 工具授权队列和拒绝状态。
- 缺少凭据时显示认证入口。
- 图片模型能力、附件上限、文件选择、截图软件二进制粘贴、预览切换和图片内容发送。

优先运行 chat-store 共置测试和 `chat/SessionChat.test.tsx`，最终运行 `bun run verify`；布局和高度动画使用真实 Renderer 路径验证。
