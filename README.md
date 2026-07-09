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
cd ../client && npm run build

# 3. 启动服务器（会同时提供前端静态文件）
cd ../server && node index.js
```

打开浏览器访问 `http://localhost:3002`，局域网内其他设备用你电脑的 IP 访问（如 `http://192.168.1.x:3002`）。

开发模式：

```bash
# 终端1：启动后端
cd server && npm install && node index.js

# 终端2：启动前端
cd client && npm install && npm run dev
```

开发模式打开 Vite 地址即可，前端会自动连接本机 `ws://localhost:3002`。

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
| 同花五十K | 同花色 5 + 10 + K，属于炸弹 |
| 四张同色炸弹 | 同点数 4 张黑牌或 4 张红牌；黑色炸弹大于红色炸弹 |
| 八张炸弹 | 两副牌同点数 8 张 |
| 四王炸弹 | 两张大王 + 两张小王，最大 |

**得分牌**：5（5分）、10（10分）、K（10分），共200分。

**炸弹大小**：同花五十K < 四张同色炸弹 < 八张炸弹 < 四王炸弹；四张同色炸弹内部黑色 > 红色，同色再比点数。

**名次达标线**：

| 人数 | 第一名 | 第二名 | 第三名 | 第四名 |
|------|--------|--------|--------|--------|
| 3人局 | 30分 | 70分 | 100分 | - |
| 4人局 | 20分 | 40分 | 60分 | 80分 |

本局必须打到所有玩家手牌全部出完才结算。名次按出完牌顺序排列，每个名次必须达到对应分数线才算赢；分数不够，即使名次靠前也判负。比如 3 人局里，一个人最后才走第三名，但本局得分达到 100 分或以上，第三名也算赢。

**辅助功能**：

- 提示：自动找出当前能出的牌。
- 理牌：把普通牌放左边，把 5 / 10 / K 得分牌和炸弹集中到右边，方便看分和保炸弹。
- 结算记录：结算页显示本局计分情况，并保留最近 20 局历史记录。

**当前版本规则约束**：不支持顺子、连对、两王炸；前端显示、提示和后端校验已按上述规则保持一致。

---

## 技术栈

- 前端：React + Vite
- 后端：Node.js + Express + ws
- 通信：WebSocket 实时双向
- 部署：Railway / Render
