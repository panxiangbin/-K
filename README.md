# 河南五十K 🃏

多人联网卡牌游戏，3~4人实时对战，支持手机浏览器直接玩。

## 本地运行

### 前置要求
- Node.js 18+

### 步骤

```bash
# 1. 安装依赖
cd server && npm install
cd ../client && npm install

# 2. 构建前端
cd client && npm run build

# 3. 启动服务器（会同时提供前端静态文件）
cd server && node index.js
```

打开浏览器访问 `http://localhost:3001`，局域网内其他设备用你电脑的 IP 访问（如 `http://192.168.1.x:3001`）。

---

## 部署到 Railway（推荐，免费支持 WebSocket）

### 步骤

1. 注册 [Railway](https://railway.app) 账号（GitHub 登录）

2. 新建项目 → "Deploy from GitHub repo"

3. 把这个项目文件夹推送到 GitHub：
   ```bash
   git init
   git add .
   git commit -m "河南五十K 初始版本"
   git remote add origin https://github.com/你的用户名/henan-50k.git
   git push -u origin main
   ```

4. Railway 里选择这个 repo，它会自动检测 `railway.json` 配置并部署

5. 部署完成后，Railway 会给你一个域名，如 `henan-50k.up.railway.app`

### 朋友如何访问
把 Railway 给你的网址发给朋友，手机浏览器直接打开就能玩。

---

## 部署到 Render（备选，也免费）

1. 注册 [Render](https://render.com)

2. 新建 → "Web Service" → 连接 GitHub 仓库

3. Render 会自动检测 `render.yaml` 配置

4. 注意：Render 免费版约 15 分钟无请求会休眠，第一次访问需等待约 30 秒唤醒

---

## 游戏规则快速说明

| 牌型 | 说明 |
|------|------|
| 单张 | 一张牌 |
| 对子 | 两张相同点数 |
| 三张 | 三张相同点数 |
| 顺子 | 5张以上连续（不含2和王） |
| 连对 | 3对以上连续对子 |
| 炸弹 | 4张相同 或 大王+小王（最大） |

**得分牌**：5（5分）、10（10分）、K（10分），共200分

---

## 技术栈

- 前端：React + Vite
- 后端：Node.js + Express + ws
- 通信：WebSocket 实时双向
- 部署：Railway / Render
