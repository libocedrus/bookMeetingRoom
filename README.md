# 会议室预定提醒

这是一个基于 GitHub Actions 和 GitHub Pages 的会议室预定提醒方案。GitHub Actions 每天定时调用多个工作日 API，预生成当前年和下一年每天的静态 JSON；iPhone 快捷指令按当天日期读取 `/data/daily/YYYY-MM-DD.json`，先检查 `date` 和 `status`，再根据 `actionPolicy` 开关会议室预定闹钟。

## 架构

```text
GitHub Actions 定时运行
  -> 依次调用多个工作日 API
  -> 生成当前年和下一年的工作日数据
  -> 预计算当前年和下一年每天的提醒结果
  -> 发布到 GitHub Pages

iPhone 快捷指令
  -> 先打开“【运行失败】请自查预定会议室”兜底闹钟
  -> 用今天日期拼出 /data/daily/YYYY-MM-DD.json
  -> 获取当天 JSON
  -> 先检查 date 是否等于今天
  -> 先读取 status
  -> date = 今天且 status = ok 时读取 actionPolicy
  -> 打开或关闭“预定会议室”闹钟
  -> 完整执行成功后关闭兜底闹钟
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

## 计算范围

每次运行 GitHub Actions 时，都会计算：

```text
当前年
下一年
```

例如当前日期是 2026 年，则生成：

```text
workdays-2026.json
workdays-2027.json
reminders-2026.json
reminders-2027.json
daily/2026-01-01.json ... daily/2026-12-31.json
daily/2027-01-01.json ... daily/2027-12-31.json
```

这个范围可以覆盖年底跨年的第 3 个工作日判断。历史年份不再主动计算；如果缓存中仍有历史 daily 文件，快捷指令也不会读取。

## 输出文件

GitHub Pages 发布后会包含：

```text
/data/today.json
/data/status.json
/data/sources.json
/data/workdays-YYYY.json
/data/reminders-YYYY.json
/data/daily/YYYY-MM-DD.json
/calendar-test.html
/index.html
```

快捷指令正式读取：

```text
/data/daily/YYYY-MM-DD.json
```

`today.json` 会继续保留，用于调试和兼容。

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

每日 JSON 中的 `status` 用于告诉快捷指令是否可以信任提醒判断结果：

```text
ok：数据更新正常
partial_source_fallback：主数据源失败，已使用备用来源
stale_data：所有数据源失败，使用旧数据
validation_failed：数据校验失败
all_sources_failed：所有数据源失败且没有旧数据
```

推荐快捷指令处理策略：

```text
date = 今天 且 status = ok
  -> 按 actionPolicy 开关闹钟

date != 今天
  -> 停止快捷指令
  -> 保持“【运行失败】请自查预定会议室”兜底闹钟打开

date = 今天 但 status != ok
  -> 停止快捷指令
  -> 保持“【运行失败】请自查预定会议室”兜底闹钟打开
```

iOS 快捷指令会把布尔值 `shouldRemind` 本地化为 `是` 或 `否`，因此快捷指令中使用字符串字段 `actionPolicy` 判断：

```text
open_alarm：打开“预定会议室”
close_alarm：关闭“预定会议室”
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
        daily/
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

workflow 每天运行多次：

```text
北京时间 00:01
北京时间 00:11
北京时间 00:31
北京时间 01:01
```

对应 UTC cron：

```text
1 16 * * *
11 16 * * *
31 16 * * *
1 17 * * *
```

GitHub Actions 的定时任务不是强实时任务，可能延迟或偶发丢跑。这里以北京时间 00:01 作为当天首次更新，并在 00:11、00:31、01:01 安排重试。由于每天会预生成当前年和下一年的每日结果，即使当天凌晨 workflow 延迟，快捷指令通常也能读取已经存在的当天文件。

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
http://localhost:8787/data/daily/2026-05-12.json
http://localhost:8787/calendar-test.html
```

## 快捷指令

详细设置步骤见：

[ios上设置快捷指令.md](ios上设置快捷指令.md)

快捷指令最终按当天日期拼接并读取：

```text
https://你的用户名.github.io/bookMeetingRoom/data/daily/YYYY-MM-DD.json
```

快捷指令需要先打开失败兜底闹钟，再读取 `date` 和 `status`；只有 `date` 等于今天且 `status = ok` 时才读取 `actionPolicy` 并开关正常提醒闹钟。

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

为降低风险，脚本会依次尝试多个数据源，并预生成当前年和下一年的每日结果。快捷指令读取当天文件并检查 `date` 和 `status`，异常时保留失败兜底闹钟。
