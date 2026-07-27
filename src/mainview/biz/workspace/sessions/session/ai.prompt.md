# Session 会话界面

本目录展示并操作一个已选定的 session。会话事实、流式状态、工具授权和命令生命周期属于 [`../../../../chat-store/ai.prompt.md`](../../../../chat-store/ai.prompt.md)；组件只通过 `useChatSession()` 和 `ChatSession` 消费，不直接调用 session RPC 或订阅主进程事件。

## 接入边界

`WorkspacePage` 只把已选中的 `workspacePath + sessionId + sessionPath` 传给 `SessionChat`。`SessionChat` 调用：

```ts
useChatSession(workspacePath, sessionId, sessionPath)
```

获得 `[snapshot, session]`：

- `snapshot.openedSession`：持久 transcript 与 runtime 基线。
- `snapshot.streamedText`、`thinkingText`、`tools`：当前轮尚未写回 transcript 的增量。
- `snapshot.pendingUserMessage`：乐观提交的用户消息。
- `snapshot.permissionRequests`：当前会话待处理授权队列。
- `snapshot.isSending`、`isRefreshing`、`error`：会话请求状态。
- `session.view.items`：由 `SessionView` 缓存的持久 render items。

组件内部只保留输入框 `draft`、文件树开关等纯 UI 状态。切换 session identity 时由父组件 key 触发重建；后台 session 继续由 Chat Store 接收事件，不随界面卸载终止。

## 用户意图

- idle 提交：`session.prompt(text)`。
- streaming 普通提交：`session.steer(text)`。
- streaming follow-up：`session.followUp(text)`。
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

`ChatTranscript` 只分发 `SessionViewItem[]`，再把当前轮临时文本与 `snapshot.tools` 接到末尾，不扫描线性 transcript，也不实现第二份合并规则。

`chat/tools/` 拥有统一工具外壳：折叠 chip、单项详情与全部展开视图。registry 只能覆盖 chip/input/output 点位，不能替换 section 布局。`AnimatedHeight` 用 ResizeObserver 跟踪自然高度，并在过渡期间维持普通顺序滚动容器的元素锚点或底部距离。

## 组件边界

- `index.tsx`：把 Chat Store snapshot/session 适配给展示组件并转发用户意图。
- `chat/ChatTranscript.tsx`：分发 `SessionViewItem[]`，组合当前轮临时输出。
- `chat/messages/`：普通消息展示。
- `chat/tools/`：工具 section、详情骨架、动画、renderer registry。
- `chat/ChatComposer.tsx`：draft、发送动作和模型可用性展示。
- `chat/ModelThinkingSelector.tsx`：通过 `ChatSession` 修改模型和 thinking。
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

优先运行 chat-store 共置测试和 `chat/SessionChat.test.tsx`，最终运行 `bun run verify`；布局和高度动画使用真实 Renderer 路径验证。
