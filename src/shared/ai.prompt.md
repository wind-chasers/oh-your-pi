# 跨进程契约

本目录是 Bun 主进程与 Renderer 之间的静态线协议。系统边界继承 [`../../ai.prompt/architecture.md`](../../ai.prompt/architecture.md)；本文只约束 DTO 的表达方式和契约演进。

## 文件职责

- `pi-contract.ts` 定义 request、response、snapshot 和 event DTO。
- `pi-rpc.ts` 将这些 DTO 组装为 Electrobun 的 `PiRpcSchema`。

这里不拥有业务行为。认证、会话、文件和权限规则由 Bun 主进程实现；Renderer 只能消费契约暴露的数据。

## 身份约定

- `workspacePath` 是工作区身份。检查工作区、列文件、读文件以及读取或打开持久 session 时必须显式携带它。
- `sessionPath` 是 live session 身份。模型、thinking、prompt、steer、follow-up、abort 和流式 event 都以它路由。
- 读取或打开已有 session 同时携带 `workspacePath` 与 `sessionPath`，由主进程验证归属；已经打开后的命令只携带 `sessionPath`。
- `provider + modelId` 标识模型；不要引入仅供 UI 使用的第二套模型 ID。
- 时间跨进程时使用字符串，不传 `Date` 实例。

## DTO 约定

1. 优先直接复用 Pi SDK 已有类型；需要去除 RPC 不安全字段时，用 `Pick` / `Omit` / `Extract` 派生严格子集，字段名和值类型不得重新发明。
2. 只传普通对象、数组和 JSON 可表达的标量；不传 class 实例、`Error`、函数、`Map`、`Set`、文件句柄或 arbitrary `details`。
3. event 使用按 `type` 区分的联合类型，每个 variant 只携带 Renderer 实际消费的字段；SDK event 到 wire event 只投影一次。
4. 只有应用聚合、身份补充、不可序列化字段转换或必要字段裁剪才定义新 DTO；禁止仅为分层而复制同构类型。
5. 凭据、token、API key 和完整认证文件不得进入契约；已属于 session transcript 的 tool-call arguments 作为消息事实原样保留。
6. 契约由 TypeScript 与 Electrobun schema 提供静态约束，不增加 Zod schema 或 `.parse()` 包装。

`PiSessionMessage` 直接组合 Pi AI 的 `UserMessage`、`AssistantMessage`、`ToolResultMessage` 与 Agent Core 的 bash/custom/summary 精确类型；只用 `Omit` 移除 assistant `diagnostics` 和 tool/custom arbitrary `details`，并过滤隐藏 custom message。Transcript 使用 `messages` 表达可渲染线性列表，不暴露 session tree。`PiSessionEvent` 保留 SDK 已有事件名和字段，只为路由补充 `sessionPath`，并把增量与错误投影为可传输字段。

## 契约流向

```mermaid
flowchart LR
  Contract["pi-contract.ts\nDTO"] --> Schema["pi-rpc.ts\nPiRpcSchema"]
  Schema --> Main["bun/rpc\nhandler 与 message sender"]
  Schema --> Client["mainview/lib/pi-client\nrequest 与 subscribe"]
  Main --> App["bun/app\n命令编排 · 单次 event 投影"]
  Client --> Feature["Renderer feature"]
```

`pi-contract.ts` 不依赖其他项目运行时代码，但可以 type-only 导入 Pi SDK 来复用或派生事实类型；`pi-rpc.ts` 只依赖契约类型和 Electrobun schema 类型。禁止从这里运行时导入 Pi SDK、Bun application、React 或 Renderer feature。

## 修改协议

新增或改变跨进程能力时按以下顺序检查完整链路：

1. 先查 Pi SDK 是否已有可复用类型；仅当应用语义不同或必须裁剪 RPC 不安全字段时，才在 `pi-contract.ts` 定义或派生最小 DTO。
2. 在 `pi-rpc.ts` 声明 request/response 或单向 message。
3. 在 `src/bun/rpc/index.ts` 绑定真正的 application/desktop owner。
4. 在 `src/mainview/lib/pi-client.ts` 暴露业务命名的函数或订阅。
5. 更新消费方，并检查所有旧字段和旧调用是否完成干净切换。

request 用于需要调用方等待接受、结果或错误的操作；message 用于主进程主动产生的流式事件。不要用 message 模拟 request，也不要让 request 等待完整流式生成结束。

## 验证

契约变化至少运行 `bun run typecheck` 和受影响的 RPC/application 测试；最终运行 `bun run verify`。检查的不只是编译，还包括 request 是否由正确 owner 处理、事件是否携带正确身份以及 DTO 是否遗漏敏感数据。
