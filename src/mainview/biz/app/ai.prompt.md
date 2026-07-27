# Renderer 应用状态

本目录只组合窗口顶层区域。Renderer 总体边界见 [`../../../../ai.prompt/arch-render.md`](../../../../ai.prompt/arch-render.md)；长期 workspace/session 运行状态属于 [`../../chat-store/ai.prompt.md`](../../chat-store/ai.prompt.md)，不能再存入 Atom 或页面组件。

## 组合关系

`AppShell` 只组合：

- `AppSidebar`：工作区切换、偏好设置和认证入口。
- `WorkspacePage`：当前导航选择、session 列表、聊天和文件区域。
- `ProviderAuthenticationDialog`：provider 登录交互。

Atom 只保存全局 UI 与导航状态；Chat Store 保存可以在组件卸载后继续演进的 session 数据。

## 全局状态

| Owner | 状态或操作 |
|---|---|
| `chat-store/` | 所有已注册 workspace、session snapshot、流、授权、命令状态和 SessionView 缓存 |
| `states/current.atom.ts` | 当前 `WorkspaceAtom` snapshot 与 `SelectedSessionAtom` 导航身份 |
| `states/activity.atom.ts` | workspace/authentication busy、顶层错误和禁用状态 |
| `states/authentication.atom.ts` | provider 状态、登录流程和认证弹窗 |
| `states/preferences.atom.ts` | 最近工作区、thinking 显示偏好及持久化 |
| `states/network.atom.ts` | 浏览器在线状态 |
| `states/theme.atom.ts` | 主题状态 |
| `states/workspace.ts` | 选择和检查工作区 |
| `states/session.ts` | 通过 Chat Store 选择、创建或继续 session |

`SelectedSessionAtom` 只包含 `workspacePath + sessionId + sessionPath`，表达当前界面导航，不复制 `PiOpenedSession`。完整 session 数据只从 `ChatSessionSnapshot` 读取。

## 关键流程

### 选择工作区

1. picker 返回路径，`LoadWorkspaceMutation` 调用 `inspectPiWorkspace()`。
2. 使用主进程规范路径更新 `WorkspaceAtom` 并注册 `chatStore.workspace(path)`。
3. 更新最近工作区并刷新认证摘要。
4. 真正切换 workspace 时只清除 `SelectedSessionAtom`；旧 workspace/session 仍留在 Chat Store，按闲置策略淘汰。

### 选择、创建和继续 Session

`states/session.ts` 是导航 mutation：

- 选择已有 session 时按 workspace path、session ID 和 session path 从 Chat Store 获取并打开实体，再更新选择身份。
- 创建或继续由 `ChatWorkspace` 执行 RPC、安装返回的 `ChatSession`，然后更新选择身份并重新检查 workspace session 列表。
- 页面通过 `useChatSession()` acquire/subscribe；卸载只 release consumer，不销毁后台 session。

### Provider 登录

登录完成后刷新认证状态和 workspace resources。若当前有选择身份，则从 Chat Store 获取对应 session 并 `reload()`，使重建后的主进程资源进入该 session snapshot；不创建第二份 opened-session Atom。

## 边界

- session event 与 tool permission 全局订阅只允许存在于 `ChatStore`。
- 展示组件不得导入 session RPC；所有命令经过 `ChatSession`。
- `WorkspaceAtom` 是当前工作区列表/资源 snapshot，不是 session 运行状态容器。
- `SelectedSessionAtom` 只表达导航选择，不能加入 transcript、runtime 或流字段。
- 文件选择和预览仍属于 workspace files hook。
- 认证 prompt subscription 属于认证弹窗；provider 摘要属于 `AuthenticationAtom`。
- 浏览器持久化只保存主题、thinking 显示偏好和最近工作区。

## 验证

重点验证：切换 workspace 只改变导航、后台 session 持续接收事件、切回后复用 snapshot/ViewItem、登录后当前 session reload、并行 session 不互相污染，以及闲置 session 的淘汰门槛。最终使用真实 Renderer 路径和 `bun run verify`。
