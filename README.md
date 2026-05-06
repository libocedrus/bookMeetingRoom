# 会议室预定提醒

这是一个用于 iPhone 快捷指令的会议室预定提醒服务。服务部署在腾讯 EdgeOne Pages Edge Functions 上，每天由 iPhone 快捷指令调用一次，判断当天是否需要打开名为 `预定会议室` 的闹钟。

## 工作方式

```text
iPhone 快捷指令
  -> 调用 EdgeOne Pages 接口
  -> 接口查询中国大陆节假日和调休工作日
  -> 接口返回 shouldRemind
  -> 快捷指令打开或关闭“预定会议室”闹钟
```

工作日数据来自 jiejiariapi 年度工作日接口：

```text
https://api.jiejiariapi.com/v1/workdays/{year}
```

该接口返回全年工作日列表，包含中国大陆通用节假日和调休补班安排。

## 提醒规则

1. 如果今天不是工作日，不提醒。
2. 如果今天是工作日，从明天开始数第 3 个工作日。
3. 如果第 3 个工作日是周四，则提醒。
4. 提醒文案为：`预约3个工作日后的会议室`。

## 项目结构

```text
bookMeetingRoom/
  edge-functions/
    _lib/
      reminder.js
    api/
      meeting-room/
        should-remind.js
  scripts/
    local-server.js
  test/
    reminder.test.js
  .env.example
  .gitignore
  edgeone.json
  package.json
  README.md
```

主要文件：

- `edge-functions/api/meeting-room/should-remind.js`：EdgeOne Pages 接口入口
- `edge-functions/_lib/reminder.js`：日期和提醒规则计算
- `test/reminder.test.js`：规则测试
- `scripts/local-server.js`：本地调试服务

## 上传到 GitHub

只把当前项目文件夹作为一个独立仓库上传：

```text
/Users/xiaonan/Desktop/hsd/bookMeetingRoom
```

使用 GitHub Desktop：

1. 打开 GitHub Desktop 并登录 GitHub 账号。
2. 选择 `File` -> `Add Local Repository...`。
3. 选择本项目文件夹。
4. 如果 GitHub Desktop 提示该文件夹还不是 Git 仓库，选择创建仓库。
5. 在左下角填写提交信息，例如：

```text
Initial meeting room reminder service
```

6. 点击 `Commit to main`。
7. 点击 `Publish repository`。
8. 仓库名建议使用：

```text
book-meeting-room
```

9. 选择公开或私有仓库。公开仓库配置最简单；私有仓库需要在 EdgeOne Pages 授权访问该仓库。

## 部署到 EdgeOne Pages

1. 打开腾讯 EdgeOne Pages。
2. 使用腾讯云账号登录。
3. 新建 Pages 项目。
4. 选择从 GitHub 导入项目，并授权 EdgeOne Pages 访问 GitHub 仓库。
5. 选择仓库：

```text
book-meeting-room
```

6. 设置项目根目录：

```text
/
```

7. 设置构建参数：

```text
Install command: 留空
Build command: 留空
Output directory: .
```

8. 设置环境变量：

```text
FALLBACK_SHOULD_REMIND=true
JIEJIARI_API_KEY=
```

环境变量说明：

- `FALLBACK_SHOULD_REMIND=true`：节假日接口异常时默认返回 `shouldRemind=true`，避免漏提醒。
- `FALLBACK_SHOULD_REMIND=false`：节假日接口异常时默认返回 `shouldRemind=false`，避免误打扰。
- `JIEJIARI_API_KEY`：可选。留空时使用匿名接口；如果已申请 API Key，可以填入。

9. 部署完成后，访问接口确认结果：

```text
https://你的域名/api/meeting-room/should-remind?date=2026-05-11
```

EdgeOne Pages 会根据目录结构生成接口路由：

```text
/api/meeting-room/should-remind
```

## 接口

```http
GET /api/meeting-room/should-remind
```

可选参数：

```text
date=YYYY-MM-DD
```

不传 `date` 时，接口按 `Asia/Shanghai` 时区取当天日期。

成功返回示例：

```json
{
  "success": true,
  "date": "2026-05-11",
  "todayIsWorkday": true,
  "targetDate": "2026-05-14",
  "targetIsWorkday": true,
  "targetWeekday": 3,
  "shouldRemind": true,
  "isFallback": false,
  "userNotice": null,
  "message": "预约3个工作日后的会议室"
}
```

字段说明：

- `success`：是否成功完成节假日查询和提醒判断。
- `shouldRemind`：快捷指令应使用这个字段决定打开或关闭闹钟。
- `targetDate`：从今天之后数到的第 3 个工作日。
- `targetWeekday`：周一为 `0`，周四为 `3`，周日为 `6`。
- `isFallback`：是否使用了异常兜底结果。
- `userNotice`：需要展示给用户的异常提示。
- `message`：本次判断的人类可读说明。

异常兜底返回示例：

```json
{
  "success": false,
  "date": "2026-05-11",
  "todayIsWorkday": null,
  "targetDate": null,
  "targetIsWorkday": null,
  "targetWeekday": null,
  "shouldRemind": true,
  "isFallback": true,
  "userNotice": "会议室提醒判断失败，已默认打开闹钟",
  "message": "工作日判断失败，已按不漏提醒策略打开闹钟",
  "error": "jiejiariapi request failed: 500"
}
```

## iPhone 快捷指令

### 创建闹钟

在“时钟”App 中创建一个每天固定时间的闹钟，命名为：

```text
预定会议室
```

建议闹钟时间：

```text
09:00
```

### 创建快捷指令

在“快捷指令”App 中创建快捷指令：

```text
检查会议室预定提醒
```

动作配置：

```text
1. 获取 URL 内容
   URL: https://你的域名/api/meeting-room/should-remind
   方法: GET

2. 获取字典值 shouldRemind

3. 如果 shouldRemind 是 true：
     打开闹钟“预定会议室”
   否则：
     关闭闹钟“预定会议室”

4. 获取字典值 success

5. 如果 success 是 false：
     获取字典值 userNotice
     显示通知 userNotice
```

### 创建自动化

在“快捷指令”App 中创建个人自动化：

```text
触发条件：每天固定时间
时间：比“预定会议室”闹钟早 5 到 10 分钟
动作：运行快捷指令“检查会议室预定提醒”
运行前询问：关闭
```

推荐配置：

```text
08:50 自动判断
09:00 预定会议室闹钟
```

## 本地验证

运行规则测试：

```bash
cd /Users/xiaonan/Desktop/hsd/bookMeetingRoom
npm test
```

启动本地调试服务：

```bash
npm run dev
```

访问：

```text
http://localhost:8787/api/meeting-room/should-remind?date=2026-05-11
```

腾讯 EdgeOne CLI 也可用于本地调试：

```bash
edgeone pages dev
```

## 可靠性说明

jiejiariapi 匿名接口适合个人低频使用。当前方案每天通常只调用一次，调用量很低。若后续多人使用或需要更高稳定性，应配置 `JIEJIARI_API_KEY`，或替换为更高 SLA 的节假日接口。
