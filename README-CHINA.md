# Afterlife 中国大陆适配包 · 测试版

## 已改造部分

**Android Flutter 应用（完整原项目修改版）**
- DeepSeek API `https://api.deepseek.com/chat/completions`，保留用户自行配置密钥的测试方式，不在项目中保存任何 API Key。
- 模型选项更新为 `deepseek-flash` / `deepseek-v4-pro`；迁移旧模型显示，云端对话转 DeepSeek。
- 新增简体中文语言选项，首次安装时默认为简体中文。已翻译 415 项界面字段（其余 31 项长篇人物传记暂保留原文），复杂页面中仍可能存在英语硬编码。
- 引导页面/密钥页面改用 DeepSeek 开放平台链接。
- 保留原版角色创建、访谈、聊天和本地数据结构。未接入账号同步和后台平台 Key 管理。

**网页版（独立 Node + HTML/CSS/JS 轻量版）**
- 无 Flutter 构建依赖；核心功能包括创建数字人物、设定性格、选择 DeepSeek、对话历史、JSON 备份/导入。
- 同源 Node 后端代理 DeepSeek，API Key 放在服务端环境变量中，不在浏览器或 ZIP 内；使用管理员设置的长访问口令与基础速率限制控制测试访问。
- 支持移动浏览器，在 **HTTPS 上部署后** 支持 PWA“添加到主屏幕”。
- **网页版不是原版 Flutter 应用的逐功能复刻**，暂无照片、群聊、原版访谈和跨设备同步。服务器尚未部署，ZIP 本身不是公网网址。

## Android APK 构建

此环境没有 Flutter SDK 和 Android SDK，并且无法连接外部 Flutter 发行服务器，**所以本 ZIP 不包含新版本已编译 APK，也不能在此处确认 Dart 编译通过**。

可用 GitHub Actions 云端编译：

1. 将修改后的项目源码提交到 `afterlife-ai` 仓库 `deepseek-test` 分支（原 `main` 分支保持不变）。注意：GitHub 的“上传文件”操作不能直接上传 ZIP 并自动展开；应在电脑上解压后使用 `git add/commit/push` 等方式上传。
2. 打开 GitHub `Actions` → `Build Afterlife China Android + Web`，等待工作流。
3. 如果 Android 为绿色对勾，在 `Artifacts` 下载 `afterlife-china-android-debug-apk`，解压为 `app-debug.apk`，在安卓设备上安装。
4. 如果编译失败，从 `Build Android debug APK` 日志定位问题并修复后重试。原版项目存在一定依赖兼容风险，不能保证单次构建通过。

本 APK 是 Debug 测试签名，不适合直接正式发布。若设备已安装同包名、但不同签名的 APK，可能需要先卸载原版，**先备份 App 数据**，否则可能丢失聊天记录。

## 国内网络与费用

- Android 模式直接访问官方 DeepSeek API，避免 OpenRouter 中转；但某些功能（尤其本地模型下载）仍可能引用 Hugging Face 等海外服务。正常云端聊天不需要先下载本地模型。
- 不能承诺所有地区和运营商的无 VPN 使用。上线前须用至少两家国内运营商测试 DNS、HTTPS、DeepSeek API、静态资源及可用性。
- 国内网页部署需要用户拥有服务器/云托管、合法域名、HTTPS；部分场景需 ICP 备案。有关个人资料需取得相应授权，遵守数据安全和隐私规则。
- DeepSeek API 按用量计费，免费使用配额是否存在取决于账号状态。
- Web 端服务端必须设置自己的密钥和访问口令；不要把 API Key 发布到 GitHub 或前端代码。

详细部署：`china_web/README.md`。

## 文件说明

- `lib/`：Android Flutter 代码、简体中文资源与 DeepSeek 配置
- `china_web/`：独立中国大陆部署 Web 入口（Node.js）
- `.github/workflows/build-apk.yml`：安卓编译 + 网页部署包自动打包
- `android/`：原生 Android 项目

## 将补丁应用到 GitHub（建议在电脑操作，一次性上传所有修改）

你可以使用随交付提供的 `Afterlife_China_Changes.patch`，不需要手工修改几十个文件。需要安装 Git 并对仓库有推送权限。

```bash
git clone --branch deepseek-test https://github.com/yuguanli96-ctrl/afterlife-ai.git
cd afterlife-ai
git apply --check /path/to/Afterlife_China_Changes.patch
git apply /path/to/Afterlife_China_Changes.patch
git add -A
git commit -m "Build Afterlife China edition with DeepSeek"
git push origin deepseek-test
```

替换 `/path/to/Afterlife_China_Changes.patch` 为你实际保存补丁的位置。如果 `git apply --check` 报错，请停止，不要强制覆盖远端最新修改。

推送成功后 GitHub Actions 会自动构建 APK，且会生成网页端部署包。两种产物都从同一次运行的 `Artifacts` 下载。
