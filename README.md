# 会议室预定提醒

这是一个基于 GitHub Actions 和 GitHub Pages 的会议室预定提醒方案。GitHub Actions 每天定时调用多个工作日 API，生成静态 JSON；iPhone 快捷指令只读取 `today.json`，根据 `shouldRemind` 打开或关闭名为 `预定会议室` 的闹钟。

## 架构

```text
GitHub Actions 定时运行
  -> 依次调用多个工作日 API
  -> 生成静态 JSON 数据
  -> 发布到 GitHub Pages

iPhone 快捷指令
  -> 获取 /data/today.json
  -> 读取 status 和 shouldRemind
  -> 打开或关闭“预定会议室”闹钟
```

## 提醒规则

1. 今天不是工作日：不提醒。
2. 今天是工作日：从明天开始数第 3 个工作日。
3. 第 3 个工作日是周四：提醒。
4. 提醒文案为：`预约3个工作日后的会议室`。

## 数据源

生成脚本会按顺序尝试以下来源：

```text
1. jiejiariapi
2. timor.tech
3. nager.date
```

第一个可用且校验通过的数据源会被采用。如果主数据源失败，脚本会继续尝试备用数据源，并在输出 JSON 中标记状态。

GitHub Actions 会缓存上一轮生成的 `data/` 目录。若当天所有数据源都失败，脚本会优先使用上一轮可用数据，并将状态标记为 `stale_data`。

## 输出文件

GitHub Pages 发布后会包含：

```text
/data/today.json
/data/status.json
/data/sources.json
/data/workdays-YYYY.json
/data/reminders-YYYY.json
/calendar-test.html
/index.html
```

快捷指令只需要读取：

```text
/data/today.json
```

示例：

```json
{
  "date": "2026-05-09",
  "status": "ok",
  "shouldRemind": false,
  "actionPolicy": "close_alarm",
  "todayIsWorkday": true,
  "targetDate": "2026-05-13",
  "targetIsWorkday": true,
  "targetWeekdayName": "周三",
  "message": "今天无需提醒",
  "updatedAt": "2026-05-09T08:10:00+08:00"
}
```

## 状态说明

`today.json` 中的 `status` 用于告诉快捷指令是否可以信任 `shouldRemind`：

```text
ok：数据更新正常
partial_source_fallback：主数据源失败，已使用备用来源
stale_data：所有数据源失败，使用旧数据
validation_failed：数据校验失败
all_sources_failed：所有数据源失败且没有旧数据
```

推荐快捷指令处理策略：

```text
status = ok
  -> 按 shouldRemind 开关闹钟

status != ok
  -> 显示 message
  -> 默认打开闹钟，避免漏提醒
```

## 项目结构

```text
bookMeetingRoom/
  .github/
    workflows/
      update-pages-data.yml
  github-pages/
    public/
      index.html
      calendar-test.html
      data/
    scripts/
      generate-data.js
      reminder-test-helpers.js
  scripts/
    local-server.js
  test/
    reminder.test.js
  package.json
  README.md
  ios上设置快捷指令.md
```

## GitHub Pages 配置

1. 打开 GitHub 仓库。
2. 进入：

```text
Settings -> Pages
```

3. 将 Source 设置为：

```text
GitHub Actions
```

4. 推送代码到 `main` 分支。
5. 进入：

```text
Actions -> Update Pages Data
```

6. 手动运行一次 workflow，或等待定时运行。

workflow 每天运行两次：

```text
北京时间 08:10
北京时间 08:40
```

对应 UTC cron：

```text
10 0 * * *
40 0 * * *
```

## 本地验证

生成静态数据：

```bash
npm run generate
```

运行测试：

```bash
npm test
```

启动本地静态服务：

```bash
npm run serve
```

访问：

```text
http://localhost:8787/data/today.json
http://localhost:8787/calendar-test.html
```

## 快捷指令

详细设置步骤见：

[ios上设置快捷指令.md](ios上设置快捷指令.md)

快捷指令最终只需要读取：

```text
https://你的用户名.github.io/bookMeetingRoom/data/today.json
```

然后按 `status` 和 `shouldRemind` 开关闹钟。

## 日历测试页

部署后访问：

```text
https://你的用户名.github.io/bookMeetingRoom/calendar-test.html
```

该页面读取 `data/reminders-YYYY.json`，用于查看任意日期的预计算结果。

## 可行性和风险

这个方案不需要服务器、云函数、备案域名或付费服务。计算发生在 GitHub Actions 中，快捷指令只读取静态 JSON。

主要风险：

```text
GitHub Pages 在中国大陆直连不保证稳定
GitHub Actions 定时任务可能延迟
免费 API 可能不可用或数据结构变化
```

为降低风险，脚本会依次尝试多个数据源，并在失败时输出状态，让 iPhone 快捷指令给出反馈。
