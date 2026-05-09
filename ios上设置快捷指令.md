# iPhone 快捷指令设置

快捷指令只读取 GitHub Pages 上的静态 JSON，不执行复杂日期计算。

## 读取地址

部署完成后，将下面地址中的用户名和仓库名替换为你的 GitHub Pages 地址：

```text
https://libocedrus.github.io/book-meeting-room/data/today.json
```

打开后应看到 JSON，类似：

```json
{
  "date": "2026-05-09",
  "status": "ok",
  "shouldRemind": false,
  "actionPolicy": "close_alarm",
  "message": "今天无需提醒"
}
```

## 创建闹钟

在“时钟”App 中创建一个每天固定时间的闹钟，命名为：

```text
预定会议室
```

建议闹钟时间：

```text
09:00
```

## 创建快捷指令

在“快捷指令”App 中创建快捷指令：

```text
检查会议室预定提醒
```

## 动作 1：获取 today.json

添加动作：

```text
获取 URL 内容
```

配置：

```text
URL：https://libocedrus.github.io/bookMeetingRoom/data/today.json
方法：GET
```

## 动作 2：读取 status

添加动作：

```text
获取字典值
```

配置：

```text
在 URL 的内容 中获取 status 的值
```

添加动作：

```text
文本
```

文本内容选择上一步输出的 `status` 或 `字典值`。

## 动作 3：判断 status

添加动作：

```text
如果
```

条件：

```text
如果 文本 是 ok
```

在这个“如果”分支中继续配置正常流程。

在“否则”分支中：

```text
获取字典值
在 URL 的内容 中获取 message 的值
显示通知 message
打开闹钟“预定会议室”
```

说明：非 `ok` 状态表示数据更新异常或使用旧数据。默认打开闹钟，避免漏提醒。

## 动作 4：读取 shouldRemind

在 `status = ok` 分支中添加：

```text
获取字典值
```

配置：

```text
在 URL 的内容 中获取 shouldRemind 的值
```

添加动作：

```text
文本
```

文本内容选择上一步输出的 `shouldRemind` 或 `字典值`。

## 动作 5：开关闹钟

添加动作：

```text
如果
```

条件：

```text
如果 文本 是 true
```

在“如果”分支中：

```text
打开闹钟“预定会议室”
显示通知“预约3个工作日后的会议室”
```

在“否则”分支中：

```text
关闭闹钟“预定会议室”
```

可选：上线初期可以在“否则”分支中增加通知：

```text
显示通知“今日无需提醒，闹钟已关闭”
```

确认稳定后可以删除这条通知。

## 最终结构

```text
获取 URL 内容

获取 status
文本 status

如果 status 是 ok
  获取 shouldRemind
  文本 shouldRemind
  如果 shouldRemind 是 true
    打开闹钟“预定会议室”
    显示通知“预约3个工作日后的会议室”
  否则
    关闭闹钟“预定会议室”
  结束如果
否则
  获取 message
  显示通知 message
  打开闹钟“预定会议室”
结束如果
```

## 创建自动化

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

## 调试

第一次配置后，先手动运行一次快捷指令。

如果出现“获取字典值失败”，说明快捷指令拿到的不是 JSON。请先用 iPhone Safari 打开 `today.json` 地址，确认能看到 JSON。

如果 iPhone Safari 无法访问 GitHub Pages，可以尝试：

```text
https://raw.githubusercontent.com/libocedrus/仓库名/gh-pages/data/today.json
```

但 GitHub Raw 在中国大陆同样不保证稳定。长期稳定直连仍需要可访问的静态托管地址。
