# Heroku 升级：本地验证记录

验证日期：2026-11-22。分支：`upgrade/heroku-26-staging`。
环境：Windows，Node.js 26.13.1，npm 12.2.3。

## 结果

本地测试、生产构建及服务冒烟检查通过，但 lint 与依赖审计尚未全部通过。
本记录不代表 Heroku 测试环境验收或生产上线批准。

| 检查 | 结果 |
| --- | --- |
| 根目录、admin-web、backend/client 锁文件干净安装 | 三处 `npm ci --include=dev --no-fund` 成功 |
| 后端自动化测试 | 130/130 通过，包含 `.test.js` 和 `.test.mjs` |
| 旧控制台交互测试 | 4/4 通过；覆盖登录状态、模块导航及员工弹窗 |
| admin-web 生产构建 | TypeScript 检查及 Vite 构建通过 |
| backend/client 生产构建 | Vite 构建通过 |
| 实际服务启动及 HTTP 冒烟检查 | 健康状态、未登录拦截、两个前端、深链接、JS/CSS 资源通过 |
| 工资报表上传和下载 | 合成 Excel 文件上传、金额差异核对、XLSX/HTML 下载通过 |
| 隔离策略 | 禁止正式数据库名、关闭启动修复和定时任务、通知禁用、邮件白名单及 AI 禁用测试通过 |
| Git 空白检查 | `git diff --check` 通过 |

验证使用合成数据、模拟管理员会话和不可用的本地数据库地址，没有连接生产 MongoDB，也没有发送真实通知或邮件。

## 重复执行

安装 Node.js 26.13.1 / npm 12.2.3，在仓库根目录执行：

```sh
npm ci --include=dev --no-fund
npm --prefix admin-web ci --include=dev --no-fund
npm --prefix backend/client ci --include=dev --no-fund
npm run validate:local
```

统一脚本依次运行后端测试、旧控制台测试、两个前端构建和实际服务冒烟检查，任一步失败即停止。
它不包含以下尚未通过的 lint 和审计检查；需要单独运行：

```sh
npm --prefix admin-web run lint
npm audit --omit=dev
npm --prefix admin-web audit
npm --prefix backend/client audit
```

## 尚未通过或尚未覆盖

- admin-web lint：107 条错误、3 条警告，位于本次未修改的页面源码，在升级后的规则下报告。主要涉及显式 any、React Hooks 和热更新导出规则；没有为消除报错而关闭规则。
- 后端生产依赖审计：3 条中等级项目，涉及 `uuid`、`@novu/node`、`exceljs`；无高等级或严重等级项目。两个前端审计为 0。没有使用强制降级修复。
- 两个前端均有大于 500 kB 的构建分块警告，构建成功，后续可单独优化拆包。
- 本地 Windows 验证未覆盖 Heroku Linux 构建、真实 MongoDB 连接与 CRUD、真实 Google 登录、真实邮件/Novu/外部 AI 集成、定时任务实际执行以及持续运行观察。

## 测试部署前后的下一步

1. 处理或明确评估 lint、依赖审计遗留项；重点复核 Hooks 相关错误。
2. 创建独立 Heroku 测试应用，使用已授权的 Basic dyno。MongoDB 可复用现有集群，但使用 `rtut_staging_<suffix>` 临时数据库和合成记录。
3. 明确设置隔离环境，保持启动数据修复、定时任务、通知和外部 AI 关闭；邮件仅允许测试白名单。
4. 在目标 Heroku stack 上重新构建，验证真实登录、数据库读写、上传下载及资源使用情况，观察运行日志。
5. 测试环境验收后再安排 main 上线，并记录原生产 release、配置和回退步骤。

本次仅完成本地验证，未创建 Heroku 测试应用、未合并 main、未修改生产部署。
