# 会议室预定提醒

这是一个用于 iPhone 快捷指令的会议室预定提醒服务。服务部署在 Cloudflare Workers 上，每天由 iPhone 快捷指令调用一次，判断当天是否需要打开名为 `预定会议室` 的闹钟。

## 工作方式

```text
iPhone 快捷指令
  -> 调用 Cloudflare Worker 接口
  -> Worker 查询中国大陆节假日和调休工作日
  -> Worker 返回 shouldRemind
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
  public/
    index.html
    calendar-test.html
  scripts/
    local-server.js
  src/
    reminder.js
    worker.js
  test/
    reminder.test.js
  .env.example
  .gitignore
  package.json
  README.md
  wrangler.jsonc
```

主要文件：

- `src/worker.js`：Cloudflare Worker 入口，处理 `/api/meeting-room/should-remind`
- `src/reminder.js`：日期和提醒规则计算
- `public/index.html`：部署后的说明页
- `public/calendar-test.html`：本地和线上可用的日历测试页
- `test/reminder.test.js`：规则测试
- `wrangler.jsonc`：Cloudflare Workers 部署配置

## Cloudflare 准备

1. 注册或登录 Cloudflare：

```text
https://dash.cloudflare.com/
```

2. 进入：

```text
Workers & Pages
```

3. 如果是第一次使用 Workers，按页面提示设置 `workers.dev` 子域名。

Cloudflare Workers 默认会给每个 Worker 一个公开的 `workers.dev` 地址，格式通常是：

```text
https://book-meeting-room.你的子域名.workers.dev
```

这个地址可以直接给 iPhone 快捷指令使用。Cloudflare 官方也说明，`workers.dev` 子域名用于快速开始，无需先绑定自定义域名。参考：Cloudflare Workers `workers.dev` 文档。

## 本地部署方式

### 1. 登录 Cloudflare

在本项目根目录运行：

```bash
cd /Users/xiaonan/Desktop/hsd/bookMeetingRoom
npx wrangler login
```

命令会打开浏览器，登录并授权 Wrangler。

### 2. 本地测试

运行规则测试：

```bash
npm test
```

本地启动 Worker：

```bash
npm run dev
```

Wrangler 会显示一个本地地址，通常是：

```text
http://localhost:8787
```

测试接口：

```text
http://localhost:8787/api/meeting-room/should-remind?date=2026-05-11
```

打开日历测试页：

```text
http://localhost:8787/calendar-test.html
```

### 3. 部署

```bash
npm run deploy
```

部署成功后，Wrangler 会输出线上地址，类似：

```text
https://book-meeting-room.你的子域名.workers.dev
```

测试：

```text
https://book-meeting-room.你的子域名.workers.dev/api/meeting-room/should-remind?date=2026-05-11
```

如果看到 JSON，说明部署成功。

## GitHub 自动部署

也可以让 Cloudflare 直接连接 GitHub 仓库自动部署。

1. 使用 GitHub Desktop 上传本项目文件夹：

```text
/Users/xiaonan/Desktop/hsd/bookMeetingRoom
```

2. 打开 Cloudflare Dashboard。
3. 进入：

```text
Workers & Pages
```

4. 选择创建应用或导入项目。
5. 选择 GitHub 仓库：

```text
bookMeetingRoom
```

6. 框架预设选择：

```text
None / Worker
```

7. 构建命令可留空，或设置为：

```text
npm test
```

8. 部署命令使用 Wrangler 配置。项目根目录保持：

```text
/
```

当前项目的 Cloudflare 配置在：

```text
wrangler.jsonc
```

## 环境变量

`wrangler.jsonc` 中已经配置：

```json
{
  "vars": {
    "FALLBACK_SHOULD_REMIND": "true"
  }
}
```

含义：

- `FALLBACK_SHOULD_REMIND=true`：节假日接口异常时默认返回 `shouldRemind=true`，避免漏提醒。
- `FALLBACK_SHOULD_REMIND=false`：节假日接口异常时默认返回 `shouldRemind=false`，避免误打扰。

如果需要配置 `JIEJIARI_API_KEY`，建议使用 Secret，不要写进 Git 仓库：

```bash
npx wrangler secret put JIEJIARI_API_KEY
```

Cloudflare 官方建议敏感信息使用 Secrets，而不是明文环境变量。普通配置可以放在 `vars`，敏感 token 应使用 Secret。

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

## 日历测试页

部署成功后访问：

```text
https://book-meeting-room.你的子域名.workers.dev/calendar-test.html
```

测试页会默认使用相对接口：

```text
/api/meeting-room/should-remind
```

所以部署到任何 Workers 域名或自定义域名后都可以直接使用。

如果你直接双击打开本地 HTML 文件，需要把测试页顶部“接口地址”改成部署后的完整接口地址。

## iPhone 快捷指令

### 前置检查

在配置快捷指令前，先用 iPhone Safari 打开你的 Worker 接口：

```text
https://book-meeting-room.你的子域名.workers.dev/api/meeting-room/should-remind
```

正常情况下应该看到 JSON，类似：

```json
{
  "success": true,
  "shouldRemind": false
}
```

只有 iPhone Safari 能直接看到 JSON，快捷指令才会稳定运行。

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

#### 第 1 步：获取接口内容

```text
搜索操作：获取 URL 内容
URL：https://book-meeting-room.你的子域名.workers.dev/api/meeting-room/should-remind
方法：GET
```

如果动作右侧有展开按钮，可以点开确认：

```text
方法：GET
请求正文：无
```

#### 第 2 步：读取 shouldRemind

继续添加操作：

```text
搜索操作：获取字典值
动作显示：在 URL 的内容 中获取 键 的 值
```

把这个动作里的 `键` 点开，填入：

```text
shouldRemind
```

填好后，这个动作应类似：

```text
在 URL 的内容 中获取 shouldRemind 的值
```

#### 第 3 步：根据 shouldRemind 开关闹钟

为了避免快捷指令把 `shouldRemind` 识别成“文件大小”等通用内容属性，先把它转成文本。

继续添加操作：

```text
搜索操作：文本
文本内容：上一步获取到的 shouldRemind
```

添加时，点输入框上方的变量，选择第 2 步输出的 `shouldRemind` 或 `字典值`。

继续添加操作：

```text
搜索操作：如果
```

设置条件：

```text
如果 文本 是 true
```

在“如果”分支中添加闹钟动作：

```text
搜索操作：闹钟
选择：打开闹钟 / 切换闹钟 / 设置闹钟
闹钟：预定会议室
状态：打开
```

在“否则”分支中添加闹钟动作：

```text
搜索操作：闹钟
选择：关闭闹钟 / 切换闹钟 / 设置闹钟
闹钟：预定会议室
状态：关闭
```

不同 iOS 版本里动作名称可能略有差异。核心目标是：在“如果 shouldRemind 是 true”时打开名为 `预定会议室` 的已有闹钟，在“否则”时关闭这个闹钟。

#### 第 4 步：读取 success

在上面的“如果”动作后面继续添加操作：

```text
搜索操作：获取字典值
动作显示：在 URL 的内容 中获取 键 的 值
```

把 `键` 改成：

```text
success
```

填好后，这个动作应类似：

```text
在 URL 的内容 中获取 success 的值
```

#### 第 5 步：接口失败时显示通知

同样建议先把 `success` 转成文本。

继续添加操作：

```text
搜索操作：文本
文本内容：上一步获取到的 success
```

继续添加操作：

```text
搜索操作：如果
```

设置条件：

```text
如果 文本 是 false
```

在这个“如果”分支中继续添加：

```text
搜索操作：获取字典值
动作显示：在 URL 的内容 中获取 键 的 值
键：userNotice
```

然后添加通知动作：

```text
搜索操作：显示通知
通知内容：上一步获取到的 userNotice
```

如果 `success` 是 true，这个分支不用做任何事。

最终快捷指令结构应是：

```text
获取 URL 内容
在 URL 的内容 中获取 shouldRemind 的值
文本 shouldRemind
如果 文本 是 true
  打开闹钟“预定会议室”
否则
  关闭闹钟“预定会议室”
结束如果
在 URL 的内容 中获取 success 的值
文本 success
如果 文本 是 false
  在 URL 的内容 中获取 userNotice 的值
  显示通知 userNotice
结束如果
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

## 自定义域名

Cloudflare Workers 可以先使用 `workers.dev` 地址，不需要备案或自定义域名。

如果将来要绑定自己的域名：

1. 在 Cloudflare 中添加你的域名为 Zone。
2. 进入 Worker。
3. 打开：

```text
Settings -> Domains & Routes
```

4. 添加 Custom Domain。

Cloudflare 官方说明，Workers 支持三类入口：`workers.dev`、Custom Domains、Routes。`workers.dev` 适合快速开始；正式生产更推荐自定义域名或路由。

## 可靠性说明

jiejiariapi 匿名接口适合个人低频使用。当前方案每天通常只调用一次，调用量很低。若后续多人使用或需要更高稳定性，应配置 `JIEJIARI_API_KEY`，或替换为更高 SLA 的节假日接口。
