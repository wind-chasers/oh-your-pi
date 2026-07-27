# Renderer 架构

## 职责

`src/mainview/` 是 React/Vite Renderer，负责：

- 工作区、会话、认证、文件和设置界面。
- 浏览器侧交互状态与偏好持久化。
- 发起 typed RPC request。
- 订阅 session、authentication 和 tool permission 消息。
- 将主进程 DTO 渲染为界面。

Renderer 不访问 Pi SDK、凭据文件、workspace 文件系统或 Electrobun Bun API。

## 目录结构

```text
src/mainview/
├── main.tsx
├── App.tsx
├── index.css
├── biz/
│   ├── app/
│   │   ├── AppShell.tsx
│   │   ├── use-workspace-session-controller.ts
│   │   ├── preferences/
│   │   └── sidebar/
│   ├── authentication/
│   └── workspace/
│       ├── index.tsx
│       ├── files/
│       └── sessions/
│           ├── SessionList.tsx
│           └── session/
│               ├── index.tsx
│               └── chat/
├── components/
│   ├── ui/
│   └── markdown-content.tsx
├── lib/
│   ├── pi-client.ts
│   ├── theme.ts
│   └── utils.ts
├── atom/
└── states/
```

## 启动与应用壳

`main.tsx`：

1. 应用已保存主题。
2. 创建 React root。
3. 安装 `WithStore`。
4. 渲染 `App`。

`App.tsx` 只提供窗口级视觉壳、拖拽标题栏和 `TooltipProvider`。

`biz/app/AppShell.tsx` 是业务 UI 组合点：

```text
AppShell
├── AppSidebar
├── WorkspacePage
└── ProviderAuthenticationDialog
```

它不直接执行 RPC；工作区和会话级状态由 `useWorkspaceSessionController()` 提供。

## 应用控制状态

`biz/app/use-workspace-session-controller.ts` 持有：

- 当前 workspace path 和 `PiWorkspaceSnapshot`。
- 当前 `PiOpenedSession`。
- provider authentication statuses。
- recent workspaces。
- loading、authenticating 和用户可见错误。
- online/offline 状态。
- dark mode 与 show-thinking 偏好。

主要用例：

- 选择、加载和切换 workspace。
- 创建或继续最近 session。
- 打开已有 session。
- 刷新 transcript 与 workspace snapshot。
- 发起或取消 provider 登录。
- 登录后刷新 resources 和当前 session。

切换到不同 workspace 时清除当前 opened session。创建 session 与刷新 workspace snapshot 并行执行。

## RPC 客户端边界

`lib/pi-client.ts` 是 Renderer 唯一直接使用 `electrobun/view` 的模块：

- 创建 `Electroview.defineRPC<PiRpcSchema>()`。
- 在 Electrobun WebView 中安装 RPC transport。
- 将 request 暴露为有语义的函数。
- 提供 session、authentication、permission message subscriptions。

业务层只导入 `pi-client` 函数，不访问原始 `rpc.request` 或 `rpc.addMessageListener`。

RPC 调用按 feature 就近发起：

- app controller：workspace/session 生命周期和 provider 登录。
- authentication dialog：认证事件与交互响应。
- workspace files：目录读取和文件预览。
- session page：prompt、steer、follow-up、abort、事件与工具授权。
- model/thinking selector：模型和思考级别切换。

## Workspace 页面

`biz/workspace/index.tsx` 只负责当前 workspace 的 pane 组合：

```text
WorkspacePage
├── WorkspaceAlerts
├── SessionList
├── SessionChat | WorkspaceReady
├── WorkspaceFileExplorer
└── FilePreview
```

行为：

- 没有 snapshot 时显示 `WorkspacePlaceholder`。
- SessionList 使用 snapshot 中的 session summaries。
- 文件树打开时可选择文件并显示独立 preview pane。
- workspace path 改变时关闭文件树并清除文件选择。
- 文件域与 session chat 不互相导入。

## 文件域

`workspace/files/` 负责：

- 通过 RPC 列出目录。
- 按相对路径请求文件内容。
- 展示 binary/truncated 状态。
- 取消过期异步选择结果。

`useWorkspaceFiles()` 使用递增 request id，保证 workspace 切换或快速选择时，旧请求不能覆盖新状态。

文件路径验证、symlink 边界和读取上限全部由主进程执行；Renderer 不把前端校验当作安全边界。

## Session UI

`workspace/sessions/session/index.tsx` 持有当前 session 的交互状态：

- draft。
- pending user message。
- streamed assistant text 和 thinking。
- tool execution statuses。
- permission request queue。
- sending/streaming/error 状态。

### 事件处理

页面按 `openedSession.runtime.sessionPath` 过滤主进程消息：

- `agent_start`：清理上一轮临时状态并进入 streaming。
- `assistant_text_delta`：追加文本。
- `assistant_thinking_delta`：追加 thinking。
- `tool_start` / `tool_end`：更新工具状态。
- `error`：展示错误并结束本地 streaming。
- `agent_settled`：清理临时状态并刷新 transcript。

工具授权消息也按 session path 过滤，按到达顺序展示；响应通过 `respondToolPermission` RPC 返回主进程。

### 命令语义

- 非 streaming 提交：`promptSession`。
- streaming 提交：`steerSession`。
- 后续队列：`followUpSession`。
- 中止：`abortSession`。

`promptSession` 返回只表示主进程已接受 prompt；完整 assistant 输出由 session event 驱动。

### Chat 子组件

- `ChatHeader`：会话标题、文件树入口、中止。
- `ChatTranscript`：历史消息、流式文本、thinking 和工具状态。
- `ChatComposer`：输入、发送、follow-up、认证和模型可用性提示。
- `ModelThinkingSelector`：模型与 thinking level 切换。
- `ToolPermissionPrompt`：允许或拒绝当前 pending 请求。
- `messages/`：按 user、assistant、tool、system 类型渲染。

## Authentication UI

`biz/authentication/` 负责 provider 状态和登录交互：

- `ProviderList` 展示 provider 与可用登录方式。
- `ProviderAuthenticationDialog` 订阅 authentication events。
- `AuthenticationStep` 展示 browser URL、device code、进度和输入 prompt。
- prompt 响应通过 typed RPC 返回。
- dialog 关闭或用户取消时调用 provider cancel。

认证 URL 由主进程打开；Renderer 只展示受控状态和输入界面。

## 侧栏与偏好

`biz/app/sidebar/` 组合：

- workspace 选择与最近 workspace。
- 网络状态。
- authentication 入口。
- app settings。

`biz/app/preferences/` 与 `lib/theme.ts` 管理 localStorage：

- recent workspaces。
- dark mode。
- show thinking。

偏好读写失败时回退内存值，不阻断主流程。

## 组件边界

- `components/ui/`：Button、Dialog、Select、Switch、Tooltip 等无业务 UI 基元。
- `components/markdown-content.tsx`：跨消息类型的 Markdown 渲染。
- `biz/**`：业务组件和 feature-local hook。
- `lib/**`：RPC、主题和通用无状态工具。

依赖规则：

1. `AppShell` 可组合 authentication 和 workspace。
2. workspace 可组合 files 和 sessions；files 与 sessions 互不依赖。
3. feature 内部类型和 helper 默认就近放置。
4. 只有真实跨 feature 的 UI 或工具才能提升至 `components/`、`lib/`。
5. 不创建 `biz/shared`、`biz/components` 或无所有权的公共目录。

## 状态策略

当前业务工作流状态以 React `useState`、`useRef`、`useEffect` 和 feature hooks 为主：

- 服务端事实以 RPC snapshot/transcript 为准。
- 流式 delta、draft、pane 开关和 pending permission 是 Renderer 临时状态。
- settled 后重新读取 transcript，替换临时流式状态。
- localStorage 只保存界面偏好和最近 workspace，不保存凭据或 session 内容。

`atom/` 提供根级 store 基础设施；API 与使用方式见 [`src/mainview/atom/ai.prompt.md`](../src/mainview/atom/ai.prompt.md)。业务组件不得因为方便而把 feature-local 状态提升为全局 atom。

## 测试

测试与组件或纯函数共置，当前覆盖：

- session chat 事件和交互。
- assistant message 渲染。
- Markdown 输出。
- theme 和 recent workspace 偏好。

涉及主进程权限、真实 provider 或文件系统边界的行为由 Bun 主进程测试和桌面端到端路径验证。
