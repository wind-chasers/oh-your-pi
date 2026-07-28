# Session Application

本目录拥有 Renderer 会话命令到 live `PiSession` 的应用流程，并把 Pi 暴露的 SDK event 单次投影为共享 wire event。Pi SDK runtime 生命周期属于 `src/bun/pi/session`；本目录不重新定义 transcript 或事件领域模型。

## 文件职责

- `index.ts`：打开/创建/继续 session，执行命令，管理 event subscription，并直接转发 Pi 已构造的 transcript/runtime。
- `events.ts`：SDK/Pi event 到共享 `PiSessionEvent` 的唯一投影。
- `permissions.ts`：工具执行前的用户授权状态。
- `recovery.ts`：认证解析失败的一次性恢复状态机。

## Prompt 路径

```mermaid
sequenceDiagram
  participant RPC as RPC handler
  participant App as SessionApplication
  participant Auth as AuthenticationApplication
  participant Session as PiSession
  participant Recovery as SessionRecovery

  RPC->>App: prompt(sessionPath, text, images?)
  App->>Session: get live session
  App->>Auth: withProviderOperation(provider)
  App->>Session: requireResolvedAuthentication
  App->>Recovery: promptStarted
  App->>Session: prompt(text, images)
  Session-->>App: accepted runtime state
  Session-->>App: async events
  App-->>RPC: shared session events
```

只有 `prompt` 在发送前解析 provider 认证并开启恢复窗口。`steer`、`followUp` 和 `abort` 作用于已经打开的 session，保留 Pi 原生语义。模型和 thinking 只能在 session idle 时修改。

原生文件选择由主进程返回规范化路径和受限预览；textarea 粘贴直接由 Web Clipboard API 读取二进制图片，因此不要求图片具有系统路径。发送时两者统一为 `PiImageAttachmentSource`：路径源由主进程重新读取，data 源通过 RPC 传递原始 base64。Pi 边界不能信任 Renderer 提供的 MIME、名称、尺寸或预览，必须重新限制大小、解码、检查像素并编码。

## Session subscription

打开、创建或继续 session 后调用 `attachSession()`。同一个 `sessionPath` 最多安装一个 application subscription；registry 返回已有 `PiSession` 时不能重复转发 event。dispose 解除全部 subscription，然后清空 permission、recovery 和外部 listener。

application event 必须携带所属 `sessionPath`。RPC 和 Renderer 依靠该身份隔离并行会话，不能增加“当前活动会话”的全局状态。

## Event 映射

- assistant `text_delta` / `thinking_delta` 只保留 SDK 的 `type + delta`。
- `tool_execution_start` / `tool_execution_end` 保留 SDK 事件名、tool call ID、名称和最终错误状态，不复制 args、partial result 或 result。
- `agent_start` / `agent_settled` 保留 SDK 生命周期名；Renderer 未消费的中间事件不进入 wire contract。
- 内部 `Error` 和 assistant 最终失败只投影为 `errorMessage`，不能跨进程传递对象。
- `agent_settled` 是一轮运行真正稳定、允许 Renderer 刷新完整 transcript 的信号。

持久 transcript 已由 Pi 边界从 `AgentSession.messages` 构造为共享线性消息列表，Application 直接转发，不再维护 snapshot adapter。工具调用与 tool result 的视觉配对只属于 Renderer `SessionView`。

新增 SDK event 时先判断 Renderer 是否存在可观察需求；需要转发时复用 SDK 名称和字段，并在本文件完成唯一一次裁剪。

## 工具授权

`ToolPermissionApplication` 由 `beforeToolCall` extension hook 进入：

1. 只读工具 `read`、`grep`、`find`、`ls` 直接允许。
2. 其他工具生成唯一 permission ID，并向订阅者广播脱敏、限长后的摘要。
3. 没有订阅者时默认拒绝。
4. response 必须命中仍 pending 的 ID；重复或过期 response 是错误。
5. 用户拒绝后向 Pi 返回明确 reason。
6. application dispose 时所有 pending permission 都以拒绝完成。

危险命令检测只用于提高 UI 警示等级，不能自动允许或自动拒绝，也不能替代真正的 permission decision。

## 认证恢复状态机

```mermaid
stateDiagram-v2
  [*] --> Retryable: promptStarted
  Retryable --> AwaitingSettle: authentication-resolution-failed
  AwaitingSettle --> Recovering: agent-settled
  Recovering --> Retryable: auth resolved, continue
  Recovering --> [*]: recovery failed
  Retryable --> [*]: normal settle / abort / clear
```

恢复只处理 `authentication-resolution-failed`：等待失败轮次 settle，回退到失败 assistant message 的父节点，重新解析凭据，然后调用一次 `continue()`。恢复中的错误作为普通 session error 发给 Renderer。限流、网络、模型、工具以及通用 OAuth 文本匹配都不能进入该状态机。

## 修改与验证

- 改命令语义：覆盖 live session 查找、idle 限制和返回的 runtime state。
- 改 permission：覆盖默认允许、无订阅者拒绝、response、dispose。
- 改 recovery：覆盖错误分类、settle 顺序、单次 continue 和失败清理。
- 改 event/snapshot：同时检查共享 DTO 与 Renderer 消费者。

使用本目录共置测试验证具体状态机，最终运行 `bun run verify`。真实 provider 的认证恢复还需要桌面端到端验证。
