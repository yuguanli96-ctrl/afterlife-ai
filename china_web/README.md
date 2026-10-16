# Afterlife 中国大陆网页轻量版

独立的中文 Web 前端 + Node.js 22 后端，调用 DeepSeek 官方 API。**并非原版 Flutter 的完整 Web 端**。支持数字人物创建、人物提示词、Flash/Pro 选择、对话、多轮上下文、本地浏览器存储、JSON 备份/恢复；暂不支持原生 Android 的完整访谈、照片、群聊、离线模型或跨设备同步。

## 部署（需你自己在国内服务器运行并配置域名）

1. 在具有访问 `api.deepseek.com` 能力的服务器上安装 Node.js 22 或 Docker。
2. 通过服务器环境变量设置 `DEEPSEEK_API_KEY` （**只在服务器存放**）和 `APP_ACCESS_TOKEN`（至少12字符；作为测试阶段的访问口令，多个用户共用时不等价于完善账号认证）。不要提交 `.env` 或密钥到公开仓库。
3. 在此目录执行 `node server.mjs`。默认监听 `127.0.0.1:3000`。
4. 用 Nginx 或国内云厂商网关配置 HTTPS、合法域名、限流及访问日志策略，将请求反向代理到 Node 端口。公网暴露时必须配置 HTTPS。中国大陆服务器使用大陆域名可能需要ICP备案；应遵守相应资质、隐私和数据处理要求。
5. 打开网站，在右上方“访问口令”中填写 `APP_ACCESS_TOKEN`，即可创建数字人物并发送消息。

开发者本地测试（请不要把真实密钥写入命令历史或截图）：

```bash
export DEEPSEEK_API_KEY='YOUR_PERSONAL_KEY'
export APP_ACCESS_TOKEN='a-long-private-passphrase'
node server.mjs
```

随后访问 http://127.0.0.1:3000。

Docker 构建：`docker build -t afterlife-china-web .`；运行时使用 `--env-file` 指定独立于代码仓库的机密文件（并映射 `-p 127.0.0.1:3000:3000`，按需配置反代）。

## 边界与安全

- 所有 Web 人物资料及聊天记录保存于用户**当前浏览器的 localStorage**，不自动同步。清理浏览器数据会丢失，请定期导出备份；同一网站不同用户共用设备不具有数据隔离。
- AI 消息会被发至服务端和 DeepSeek API；不得上传未经授权的他人敏感数据。角色扮演是模拟，不构成死者或真人的真实意识与承诺。
- 服务器使用自建访问口令与内存级限流，仅适合小规模受控测试。多人公开运营前必须增加真正的用户注册、权限管理、持久化数据存储、审计与滥用防控；不要把共享口令公开。
- 在本地网络验证成功之前，**不能保证大陆各运营商都无需 VPN**，还需要实测 DNS、TLS、接口连接和可用性。
- Web 端 API Key 只能由服务端管理，绝对不要加入 GitHub Actions、HTML 或客户端配置。
