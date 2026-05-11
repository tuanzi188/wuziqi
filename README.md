# 🎮 五子棋网页小游戏

一款精美的五子棋网页游戏，支持本地双人对战、人机对战和好友联机对战！

## ✨ 功能特性

- 🎯 **本地双人对战** - 同设备两人对战
- 🤖 **人机对战** - 5种难度级别
- 🌐 **好友联机对战** - WebSocket实时通信
- 📱 **完美移动端适配** - 触控优化，响应式设计
- 🎨 **精美UI设计** - 木纹风格，优雅动画

## 🚀 快速开始

### 方式一：直接玩（本地/AI模式）
直接用浏览器打开 `index.html` 文件即可！

### 方式二：HTTP服务器（推荐）
```bash
# 使用Python
python -m http.server 8000

# 或使用Node.js
npm install
npm start
```

访问：http://localhost:3000/

## 📱 移动端访问

### 局域网访问（同一WiFi）
1. 确保手机和电脑在同一WiFi
2. 查找电脑的IP地址：
   - Windows: 运行 `ipconfig`，查找 IPv4 地址
3. 手机浏览器访问：`http://你的电脑IP:3000/`

### GitHub Pages（公网访问）
见下方部署指南！

## 📦 部署到GitHub Pages

### 1️⃣ 上传代码到GitHub
```bash
# 初始化git仓库
git init
git add .
git commit -m "初始提交：五子棋游戏"

# 创建GitHub仓库后，关联并推送
git remote add origin https://github.com/你的用户名/仓库名.git
git branch -M main
git push -u origin main
```

### 2️⃣ 开启GitHub Pages
1. 进入GitHub仓库的 **Settings**
2. 左侧菜单选择 **Pages**
3. 在 **Build and deployment** 下：
   - Source: 选择 `Deploy from a branch`
   - Branch: 选择 `main` 分支，文件夹选择 `/ (root)`
4. 点击 **Save**
5. 等待约1-2分钟，部署完成！

### 3️⃣ 访问你的游戏
部署完成后，访问：
```
https://你的用户名.github.io/仓库名/
```

## 🎮 游戏说明

### 人机对战难度
- 🟢 **入门** - 随机下棋，适合新手
- 🟢 **初级** - 简单策略
- 🟡 **中级** - 攻防平衡
- 🟠 **高级** - 有挑战性
- 🔴 **大师** - 难以战胜

### 好友联机
1. 房主点击"创建房间"
2. 分享6位房间码给好友
3. 好友输入房间码加入
4. 双方点击"准备"，游戏开始！

## 🛠️ 技术栈

- **前端**：HTML5 + CSS3 + JavaScript + Canvas
- **后端**：Node.js + Express + Socket.io
- **移动端**：响应式设计 + Touch事件优化

## 📄 License

MIT License - 自由使用和修改！

---

💡 提示：联机功能需要后端服务器支持，可以部署到 Vercel、Railway 等平台！
