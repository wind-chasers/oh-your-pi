# Oh Your Pi 进度

最后更新：2026-07-23

## 目标

用 Electrobun + React 为本机 Pi Coding Agent 提供图形客户端，同时直接复用 Pi TUI 的本地数据：`~/.pi/agent` 设置、认证、扩展、技能、提示模板、工作区上下文和 session JSONL。

> 原则：Pi 是唯一事实来源。GUI 不复制 Pi 配置或会话，不维护第二份历史记录。

## 当前可用能力

- 通过原生目录选择器或绝对路径打开 Pi 工作区；GUI 仅在 Renderer `localStorage` 保存最近工作区。
- 读取该工作区的 Pi 配置、资源计数与全部 Pi 会话。
- 打开、新建或继续 Pi 原生 session，并在完整 session tree 中选择历史分支。
- 发送、steer、follow-up 或中止消息；写入直接落在 Pi 原生 JSONL。
- 流式显示 assistant 文本与脱敏 tool call 生命周期状态。
- 所有 Pi SDK、认证、文件与工具权限仅驻留在 Bun 主进程。
- 读取并展示 Pi 发现的扩展、技能、提示模板、加载诊断、扩展命令与自定义工具。
- 刷新资源会重建活动工作区 runtime、重新绑定 extension，并保留可持久化的会话分支。
- 对写入、命令执行与扩展自定义工具提供单次授权；高风险 shell 命令额外标为危险，并显示工具执行时间线。
- 仅将认证提供商、可用性和认证类型发送至 Renderer；GUI 设置只写本地 `localStorage`。

启动：

```bash
bun run dev:hmr
```

或使用始终先构建前端的方式：

```bash
bun run start
```

`bun run dev` 不启动 Vite，不适合当前 React UI 开发。

---

## 已完成

### 工程基础

- [x] 初始化 Electrobun、React、Vite、TypeScript 7 项目。
- [x] 接入 React Router、Tailwind CSS 4、shadcn、Lucide、Immer、Zod。
- [x] 使用 Tailwind v4 CSS-first 配置；移除 `tailwind.config.js` 与 v3 指令。
- [x] 配置 `@/*` Renderer 别名与 `@tailwindcss/vite`。
- [x] 增加 `typecheck`、`build`、`dev:hmr` 脚本。

### Pi SDK 与数据互通

- [x] 确认本机 Pi CLI `0.81.1` 可用，项目 SDK 与 CLI 版本一致。
- [x] 主进程通过 `getAgentDir()` 使用现有 Pi agent 目录。
- [x] 通过 `createAgentSessionServices({ cwd, agentDir })` 使用 SDK 默认资源发现。
- [x] 读取全局与项目 extensions、skills、prompt templates、context files。
- [x] 使用 `SessionManager.list(workspacePath)` 读取 Pi 原生 session JSONL。
- [x] 使用 `SessionManager.open(sessionPath).getBranch()` 读取 session 当前叶子分支。
- [x] 拒绝不属于所选工作区的 session 路径。
- [x] 读写均直接使用 Pi SDK 与 Pi 原生 JSONL；不复制、迁移或维护第二份 session。

### 进程与 UI 架构

- [x] 建立 Zod DTO：`src/shared/pi-contract.ts`。
- [x] 建立 Electrobun typed RPC schema：`src/shared/pi-rpc.ts`。
- [x] 建立 Bun Pi 服务层：`src/bun/pi/workspace-service.ts`。
- [x] 建立 Bun RPC 适配层：`src/bun/rpc/pi-rpc.ts`。
- [x] 建立 Renderer Pi RPC client：`src/mainview/lib/pi-client.ts`。
- [x] 建立工作区选择、最近工作区偏好与资源概览界面。
- [x] 建立可写会话、完整树形分支导航与实时聊天界面。
- [x] 编写架构约束：`CLAUDE.md`。

### 已验证

- [x] `bun run typecheck`。
- [x] `bunx vite build`。
- [x] `bun run build`。
- [x] 启动 Electrobun 客户端并观察到 `Oh Your Pi started!`。
- [x] 用当前项目路径实测 Pi 资源读取：3 个扩展、6 个技能、7 个 prompt templates、1 个上下文文件、0 个 session。
- [x] 临时工作区端到端验证：创建持久 Pi session、发送 `Reply with exactly OK.`，收到 `agent_start`、文本 delta、`agent_settled`，并从同一 JSONL 读回 user/assistant 历史；测试 session 已清理。
- [x] 临时工作区工具调用验证：Pi 使用 `read` 读取测试文件，Renderer DTO 收到 `tool_start` / `tool_end`，并读回 assistant 回复；测试 session 已清理。
- [x] P1 静态校验：`bun run typecheck` 与 `bun run build`。
- [x] P2 服务验证：当前工作区读取到 3 个扩展、6 个技能、7 个提示模板；认证 DTO 仅包含 `provider`、`name`、`status`、`type`。
- [x] P2 工具授权验证：临时 session 的真实 `bash` 调用收到授权请求，允许后收到 `tool_start`、`tool_update`、`tool_end` 与 `agent_settled`；测试工作区已清理。
- [x] P2 刷新验证：临时 session 刷新后以原 session JSONL 重新打开，资源 DTO 不暴露内部安全扩展。

---

## 进行中

P3 体验与发布已完成；后续仅按发布环境配置签名身份、notarization 凭据和更新源地址。

---

## 下一阶段：可用聊天客户端

### P0：会话运行时与实时对话

- [x] 增加工作区选择器，避免手输绝对路径。
- [x] 保存 GUI 自己的最近工作区偏好；不得保存 Pi 配置副本。
- [x] 读取完整 session tree，而非只读取当前叶子分支。
- [x] 支持选择历史分支。
- [x] 用 `AgentSessionRuntime` 打开、创建、继续、切换 session。
- [x] session 替换后正确 dispose 旧 runtime、重新绑定 extension 与事件订阅。
- [x] 增加 `session.prompt()` RPC。
- [x] 增加 `session.steer()` 与 `session.followUp()` RPC。
- [x] 增加 `session.abort()` RPC。
- [x] 用 `session.subscribe()` 将 Pi 事件转为安全 DTO，并经 RPC message 实时推到 Renderer。
- [x] 实现输入框、发送按钮、停止按钮、流式 assistant 文本显示。
- [x] 展示 tool call 开始、更新、结束状态。

**验收：** 已在临时工作区用真实 Pi runtime 验证持久 JSONL 写入、流式文本和工具生命周期事件；同一文件可由 Pi TUI 直接打开。[INFERENCE：未在本轮实际启动 TUI。]

### P1：模型、思考与会话操作

- [x] 显示当前模型和 thinking level。
- [x] 实现模型切换、thinking level 修改。
- [x] 实现继续、fork、import session。
- [x] 实现 session 名称、标签与 checkpoint。
- [x] 实现当前工作区 session 搜索、工作区切换筛选与按最近修改排序。
- [x] 实现 session metadata 和树形导航 UI。

**验收：** 服务层直接调用 Pi SDK 对应 API；模型、thinking、名称、标签、fork 与 import 均通过 DTO/RPC 连通。按用户约定，E2E 运行验证由用户执行。

### P2：扩展、设置与安全交互

- [x] 展示已发现的扩展、技能、prompt templates 及加载诊断。
- [x] 提供“刷新 Pi 资源”操作，重建 cwd-bound services 并重新绑定 session extensions。
- [x] 展示扩展命令与自定义工具状态。
- [x] 实现工具权限确认、危险操作提示与执行时间线。
- [x] 显示模型认证状态，但绝不传输或显示 token / API key。
- [x] 增加设置界面；GUI 偏好与 Pi 设置严格分离。

**验收：** 资源详情与认证 DTO 已由真实 Pi services 读取并验证；刷新会重建活动 runtime 且保留原 session JSONL。认证 DTO 的字段固定为提供商元数据，未包含凭据值。[INFERENCE：本轮未通过 Pi TUI 实际安装/移除 extension。]

### P3：体验与发布

- [x] 最近项目、文件选择器和工作区切换体验。
- [x] 会话导出、复制、Markdown / HTML 渲染。
- [x] 错误状态、离线状态、模型不可用状态。
- [x] UI 自动化与 Pi SDK 集成测试。
- [x] 应用图标、签名、打包与更新策略。
- [x] macOS、Windows、Linux 验证。

**验收：** 最近工作区继续只保存于 Renderer `localStorage`；工作区切换会在空闲时释放旧 runtime，并在运行中明确阻止切换。当前分支可复制或导出为安全转义的 Markdown / HTML，界面安全渲染基础 Markdown 并以 sandboxed iframe 预览 HTML。浏览器自动化验证了工作区表单和离线提示；`bun test` 覆盖导出转义与真实 Pi SDK 的只读 DTO 通路；`bun run verify` 通过类型检查、测试、Vite 构建和 macOS Electrobun 打包。图标覆盖 macOS/Windows/Linux，macOS 签名/notarization 与更新 URL 由显式环境变量启用；GitHub Actions matrix 在 macOS、Windows、Ubuntu 上执行同一验证流程。[INFERENCE：本轮仅在 macOS 本机运行，Windows/Linux runner 将在推送 CI 后执行。]

---

## 架构约束

- Renderer 不直接导入 Pi SDK，不访问文件系统、认证信息或工具执行权限。
- Bun 主进程是 Pi SDK 的唯一宿主。
- RPC 仅传递 `src/shared/pi-contract.ts` 定义的纯 DTO；不传 SDK class、函数、Error 或原始 event。
- 默认使用 SDK 的资源发现；不得自行扫描或复制 `~/.pi/agent`。
- 同一个 session 只能有一个写者。GUI 在写入前要求用户确认 TUI 或其他客户端未写入该 session；GUI 内部始终只保留一个活动 runtime。
- 修改 Pi API 前先核对已安装版本的 `node_modules/@earendil-works/pi-coding-agent/docs/sdk.md`。

## 关键文件

```text
src/
├── shared/
│   ├── pi-contract.ts              # Zod 跨进程 DTO
│   └── pi-rpc.ts                   # Electrobun RPC schema
├── bun/
│   ├── pi/workspace-service.ts     # Pi SDK、资源和 session 适配
│   └── rpc/pi-rpc.ts               # Bun RPC handlers
└── mainview/
    ├── lib/pi-client.ts            # Renderer RPC client
    └── features/workspace/
        ├── WorkspaceBootstrap.tsx  # 工作区、会话列表与 GUI 偏好
        ├── SessionChat.tsx         # 树形分支、实时聊天与工具状态
        └── SessionControls.tsx     # 模型、thinking 与会话操作
```
