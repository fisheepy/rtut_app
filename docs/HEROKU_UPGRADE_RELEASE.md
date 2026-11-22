# Heroku 升级合并与发布

## 本次代码范围

固定 Node.js 26.13.1 / npm 12.2.3，更新依赖，将旧控制台从 CRA 迁移到 Vite，并适配 Express 5、MUI 和通知 SDK。增加测试环境隔离策略和本地验证入口。

验证结果和未完成项见 [本地验证记录](UPGRADE_LOCAL_VALIDATION.md)。当前尚未完成 Heroku 测试部署与真实数据库、登录及外部服务验收；lint 和中等级依赖审计遗留项仍存在。

## 合并前核对

- 目标仓库 `fisheepy/rtut_app`，目标分支 `main`。main 推送会触发生产应用 `rtut-app-admin-server` 的 GitHub 自动部署。
- 本次起点为 `271596c5a0a09a66818db8cd9600aa5bdf70bcdb`。发布前在 Dashboard 再确认当前成功 release、对应提交及 stack，并记录为回退目标；不要依赖旧 release 编号。
- 上次观察的生产 stack 为 Heroku-22。代码合并本身不会升级已有应用的 stack，必须在 Dashboard 的应用 Settings 中设置目标 Heroku-26，再由新构建生效。不要把分支名当作 stack 已升级的证据。
- 生产 `APP_ENV` 应为 `production` 或不设置（默认 production）。保留现有 MongoDB、管理员登录、SMTP、Novu 和外部服务配置；不要复制测试数据库、测试白名单或禁用任务的配置到生产。
- 生产环境默认仍执行原有启动修复和定时任务；该版本不是只读发布。测试环境的关闭策略不适用于默认生产环境。

## 发布验收

1. 在 Heroku Activity 确认部署来自合并后的 main，构建日志包含两个前端成功构建，以及预期 Node/npm 和 stack。
2. 检查 dyno 持续运行及日志无启动异常，访问 `/api/health` 核对 production、Node 版本和时间；提交标识是否显示取决于 Heroku 是否提供相应环境变量。
3. 用真实管理员账户验证登录、员工页面、HR Tools、旧控制台及报表上传下载。数据库写入验收使用可识别的测试记录，并按业务流程清理。
4. 观察请求错误、内存、重启及下一次定时任务；真实通知与邮件应在明确指定的收件人范围内验证。

## 回退

若新 release 出现关键故障，在 Heroku Dashboard 的 Activity 中选择发布前记录的成功 release 执行回退，并再次检查健康状态与登录。Heroku release 回退不会撤销数据库写入。

随后在 Git 中 revert 本次合并对应的提交，避免 main 下一次自动部署再次引入问题。若还需在旧 stack 上构建，核对并恢复应用的构建目标 stack；回退旧 slug 不等同于设置后续构建的 stack。

官方说明：[Upgrading to the Latest Stack](https://devcenter.heroku.com/articles/upgrading-to-the-latest-stack)。
