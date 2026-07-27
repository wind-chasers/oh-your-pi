# Oh Your Pi Project Guide

## 项目定位

Oh Your Pi 是 Pi Coding Agent 的本机桌面客户端，不实现第二套 Agent。Pi 的配置、认证、模型、资源和原生 session 是应用的数据与运行事实来源。

本文件是 coding agent 的文档入口，只提供文档导航、全局公约和工作方式，不展开具体技术架构。

## 渐进式文档发现

按任务范围读取必要文档，不要一次加载全部文档。

| 任务范围 | 必读文档 | 职责 |
|---|---|---|
| 跨进程边界、共享契约、状态与持久化 | [`ai.prompt/architecture.md`](./ai.prompt/architecture.md) | 系统架构综述与全局依赖方向 |
| Bun 主进程、Pi SDK、RPC、桌面生命周期 | [`ai.prompt/arch-main.md`](./ai.prompt/arch-main.md) | 主进程内部结构、所有权、调用链和安全边界 |
| React Renderer、UI 状态、组件和事件 | [`ai.prompt/arch-render.md`](./ai.prompt/arch-render.md) | Renderer 内部结构、页面组合和状态策略 |
| Atom 基础设施 | [`src/mainview/atom/ai.prompt.md`](./src/mainview/atom/ai.prompt.md) | Atom API 与局部使用方式，仅在任务涉及该模块时读取 |
| Pi SDK API 或行为 | [`node_modules/@earendil-works/pi-coding-agent/docs/sdk.md`](./node_modules/@earendil-works/pi-coding-agent/docs/sdk.md) | 当前安装版本的 SDK 文档；同时核对本地类型声明和实现 |
| 用户能力、安装与命令 | [`readme.md`](./readme.md) | 面向使用者，不作为内部架构规范 |

阅读顺序：

1. 始终先遵守本文件。
2. 涉及系统边界时读取 `architecture.md`。
3. 只进入任务对应的进程文档。
4. 只有修改局部基础设施时再读取其就近文档。
5. 文档与代码不一致时，检查当前代码和依赖版本，并在同一改动中修正文档。

## 文档职责

- `CLAUDE.md`：文档入口、全局公约、工作流和验证规则。
- `architecture.md`：系统综述，不复制进程内部细节。
- `arch-main.md`：只描述 Bun 主进程。
- `arch-render.md`：只描述 Renderer。
- 局部 `ai.prompt.md`：只描述所在模块的专用 API 和约束。
- `readme.md`：只承担用户文档职责。

文档必须保持单一职责。下级文档引用上级规则，不重复维护同一段内容。

## 全局公约

1. **Pi 是唯一事实来源。** 不复制 Pi 配置、凭据、资源或 session，不建立平行实现。
2. **遵守进程边界。** 具体依赖规则以架构文档为准，不从调用方便出发绕过 owner。
3. **所有权优先。** 状态、生命周期、I/O 和错误处理必须归属明确模块。
4. **直接表达能力。** 有行为的能力优先使用具体 class，不增加同形接口、空转 factory 或无价值 wrapper。
5. **类型就近定义。** 不建立无所有权的 `types.ts`、`common.ts`、`helpers.ts`、`models.ts`。
6. **干净切换。** 删除被替代实现，不保留旧别名、兼容 shim、deprecated re-export 或双轨调用。
7. **修复真实问题。** 修改真正 owner，不在 UI、RPC 或 mapper 层增加补丁式 special case。
8. **目录入口简洁。** import 使用目录名，不写 `/index` 后缀。
9. **默认局部。** feature-local 状态、类型和 helper 不因“可能复用”提前提升为全局能力。
10. **安全数据最小化。** 凭据和敏感错误不得进入不需要它们的进程或界面。

## 文档维护规则

架构与模块文档只描述当前状态，使用现在时：

- 不保留迁移记录、旧路径、替代方案、决策过程或未来路线图。
- 结构被替换时直接更新正文，不追加“旧方案”或“历史说明”。
- 改动影响系统边界、目录职责、状态所有权或调用链时，同步更新对应架构文档。
- 局部实现变化只更新所属文档，不把细节堆回 `CLAUDE.md` 或 `architecture.md`。
- 被淘汰的文档直接删除，避免 coding agent 读取到冲突信息。

## 工作方式

1. 先确定任务 owner 和受影响边界。
2. 阅读对应架构文档与局部文档。
3. 检查当前代码、类型、调用方和测试，不从旧文档猜实现。
4. 修改 exported symbol 前使用语言服务查找 references。
5. 优先复用现有模式，不并行创造第二套约定。
6. 完成后检查调用方、文档和废弃文件是否全部切换。

代码风格：

- 顶层函数使用 `function` 和显式返回类型。
- React 组件使用明确 Props 类型。
- 优先清晰、直接、可维护的实现，拒绝为了测试方便或形式上的“分层”增加抽象。

## 验证与运行策略

按改动范围先运行最窄的检查；永久功能或修复最终运行：

```bash
bun run verify
```

涉及真实 provider、系统对话框、窗口生命周期或桌面 WebView 的行为需要人工桌面验证。

除非用户明确要求，不主动启动桌面应用或开发服务器。完成静态检查、测试和构建后，将人工验证步骤明确交给用户。
