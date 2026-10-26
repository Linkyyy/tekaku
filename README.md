# 手书 Tekaku 0.3.0 · Windows 便携版

[下载 Windows x64 便携包（约 1.5 MiB）](https://github.com/Linkyyy/tekaku/raw/refs/heads/downloads/windows-v0.3.0/Tekaku-0.3.0-windows-x64.zip)

解压后运行 Tekaku.exe。支持 Windows 10/11 x64，需要 Microsoft Edge WebView2 Evergreen Runtime。无需安装 Go、Node.js 或 .NET。

## 本次更新

- 自定义无边框标题栏，融入应用皮肤；最小化、最大化/还原、关闭及窗口拖动。
- 默认全屏、收起侧栏、白色皮肤；默认隐藏格式栏和状态栏，首页仅保留必要操作和正文。
- 删除装饰文案，新文档自动提供标题区，显示“请输入标题”，提示文字不写入 Markdown。
- 设置支持白色、纸笺、青苔、深夜；字体、字号、行距、正文宽度、工具栏/状态栏和启动选项。
- 未保存确认及错误弹窗随皮肤变化，支持保存、不保存、取消。文件选择器保留 Windows 原生界面。

F11 切换全屏，Esc 退出全屏；Ctrl+, 打开设置。修改内容请用 Ctrl+S 写入原文件。

12 项界面测试、4 项文件逻辑测试和 Windows 交叉编译通过。自定义窗口的拖动、缩放和全屏仍需 Windows 实机复核；程序未签名。

## 界面预览

![首页](editor.png)

![设置](settings.png)

## 校验

使用 PowerShell：`Get-FileHash .\Tekaku-0.3.0-windows-x64.zip -Algorithm SHA256`，应与 SHA256SUMS.txt 一致。
