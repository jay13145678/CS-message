# GitHub Actions 部署指南

## 📋 准备工作

### 1. 创建 GitHub 仓库

1. 访问 [GitHub](https://github.com) 并登录你的账号
2. 点击右上角 **"+"** → **"New repository"**
3. 填写仓库名称，例如 `cs2-daily-report`
4. 选择 **Private**（私有仓库，保护你的邮箱授权码）
5. 点击 **Create repository**

### 2. 获取 QQ 邮箱授权码

1. 登录 [QQ 邮箱](https://mail.qq.com)
2. 进入 **设置** → **账户**
3. 找到 **POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务**
4. 开启 **SMTP 服务**
5. 按照提示发送短信获取授权码
6. **保存好这个授权码**，它只会显示一次

> ⚠️ 注意：授权码不是 QQ 密码，是独立的应用专用密码

---

## 🚀 部署步骤

### 步骤 1：将代码上传到 GitHub

**方法 A：使用 Git 命令行**

```bash
cd C:\Users\29314\WorkBuddy\automation-20260414150548

# 初始化 Git 仓库（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: CS2 比赛日报"

# 添加远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/你的用户名/cs2-daily-report.git

# 推送代码
git branch -M main
git push -u origin main
```

**方法 B：使用 GitHub Desktop**

1. 下载 [GitHub Desktop](https://desktop.github.com/)
2. File → Add Local Repository
3. 选择 `C:\Users\29314\WorkBuddy\automation-20260414150548`
4. Publish repository 到 GitHub

### 步骤 2：配置 GitHub Secrets

1. 进入你的 GitHub 仓库
2. 点击 **Settings**（设置）
3. 左侧菜单选择 **Secrets and variables** → **Actions**
4. 点击 **New repository secret**
5. 填写信息：
   - **Name**: `SMTP_AUTH_CODE`
   - **Secret**: 你的 QQ 邮箱授权码
6. 点击 **Add secret**

### 步骤 3：验证 Actions 是否正常工作

1. 进入仓库的 **Actions** 页面
2. 你会看到 "CS2 比赛日报" 工作流
3. 点击 **Run workflow** 手动测试一次
4. 检查邮件是否收到

---

## ⏰ 设置定时任务

GitHub Actions 的 Cron 表达式：
- `0 0 * * *` = 每天 UTC 00:00 = 北京时间 08:00

如果你想修改执行时间，可以编辑 `.github/workflows/cs2-daily.yml`：

```yaml
schedule:
  # 北京时间 8:00
  - cron: '0 0 * * *'
  
  # 北京时间 9:00
  # - cron: '0 1 * * *'
  
  # 北京时间 12:00 和 20:00
  # - cron: '0 4,12 * * *'
```

---

## 🔧 文件说明

| 文件 | 说明 |
|------|------|
| `cs2_daily.py` | 主脚本，获取数据并发送邮件 |
| `.github/workflows/cs2-daily.yml` | GitHub Actions 工作流配置 |

---

## ❓ 常见问题

### Q: 为什么邮件没有收到？

1. 检查 GitHub Actions 运行日志是否有错误
2. 确认 `SMTP_AUTH_CODE` Secret 配置正确
3. 检查邮箱是否把邮件当垃圾邮件了

### Q: 如何修改收件人邮箱？

编辑 `cs2_daily.py` 中的 `TO_EMAIL` 变量，然后重新提交代码。

### Q: 能手动触发吗？

可以！在 GitHub 仓库的 **Actions** 页面，点击 "CS2 比赛日报" 工作流，然后点击 **Run workflow**。

---

## 💡 优势对比

| 对比项 | 本地 WorkBuddy | GitHub Actions |
|--------|---------------|----------------|
| 电脑必须开机 | ❌ 否 | ✅ 否 |
| 免费额度 | N/A | 2000分钟/月 |
| 配置难度 | 简单 | 中等 |
| 数据源更新 | 实时 | 定时 |

---

**完成以上步骤后，你的 CS2 比赛日报就会每天自动发送到你的邮箱了！** 🎉
