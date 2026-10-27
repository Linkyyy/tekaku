# 手书 Windows 0.8.0

[下载 Windows x64 便携包（约 1.9 MB）](https://github.com/Linkyyy/tekaku/raw/refs/heads/downloads/windows-v0.8.0/Tekaku-0.8.0-windows-x64.zip)

完整解压，保留 Tekaku.exe 和 WebView2Loader.dll 在同一目录。支持 Windows 10 / 11 x64，使用系统 WebView2。

- 大纲改为右侧独立栏，可收起并记住状态。
- 源码切换改为右下角小图标，仍支持 Ctrl+Shift+M。
- 移除侧栏全屏按钮，使用 F11 / Esc。
- 添加程序和任务栏图标、版本信息。
- 首次启动加入当前用户的 Markdown 打开方式，设置中可添加 / 移除；默认应用由 Windows 选择。移动程序后重新运行更新路径。
- 修复全屏隐藏边框的偏移，关闭按钮保留右侧边距。
- 快捷键指南改为分组卡片。
- 插入功能移至右键菜单，支持 Shift+F10 与方向键；源码模式也能插入 Markdown。右键粘贴为纯文本，图片粘贴使用 Ctrl+V。
- 新建 / 打开文档时隔离撤销记录；保留边框拖动缩放与 Markdown 拖入导入。

43 项界面/桥接测试和 10 项 Go 测试通过；重复编译 EXE 一致；ClamAV 对最终 EXE、DLL、ZIP 未检出。Windows 任务栏、注册表关联、多显示器全屏与 DPI 等仍需实机验证。EXE 未签名，下载信誉提示可能继续出现。

[检查记录](RELEASE-CHECK.md) · [原始扫描输出](checks/clamav-release.txt) · [对应源码快照](https://github.com/Linkyyy/tekaku/tree/90ae8c6609298f8ff1c6ffdb190398df2aae6ac0) · [Android 0.1.0 APK（本次未更新）](https://github.com/Linkyyy/tekaku/tree/downloads/android-v0.1.0)

ZIP SHA-256：`d46f9148064e5a4d4318beeb3a99c22fbc3c428291775f0c4501a5221f623d18`
