# 手书 Windows 0.11.0

[下载 Windows x64 便携包（约 1.9 MB）](https://github.com/Linkyyy/tekaku/raw/refs/heads/downloads/windows-v0.11.0/Tekaku-0.11.0-windows-x64.zip)

**安全报告仍未解决：** 此前“检测到病毒”的报告尚未取得具体威胁名称及涉事版本。此版为功能更新，不是已验证的安全修复，EXE 仍未签名。若被拦截，请保留防护，不要加白名单。[核查记录](SECURITY-CHECK.md)。

- 多文件标签：原生选择器可多选，支持拖入多个 Markdown。每个标签独立内容、修改状态、保存路径、图片路径、富文本撤销与滚动位置。
- 单层顶部边缘；全屏下保留浮动按钮及侧栏展开。
- 默认灰蓝皮肤，可切换另外四种桌面皮肤；官网使用一致图标。
- Ctrl+N 新建，Ctrl+W 关闭标签，Ctrl+Tab / Ctrl+Shift+Tab 切换；关闭或退出时检查所有未保存标签。

完整解压，保留 Tekaku.exe 与 WebView2Loader.dll 在同一目录。需要 Windows 10/11 x64 与系统 WebView2。Android 仍为 0.1.0。

63 项界面/模拟桥接回归和 13 项 Go 测试通过，重复构建一致。ClamAV 对本版 EXE、DLL、ZIP 未检出；这不构成安全保证，也不能排除其他引擎的检测。Windows 实机的边框、DPI、文件选择器与拖拽仍需复核。

ZIP SHA-256：`61c7e4d556a598aa967e07aa778099cd0cbd8e17e560c8f4aa3a9e0271013c47`

[本版检查](RELEASE-CHECK.md) · [原始扫描](checks/clamav-release.txt) · [对应源码快照](https://github.com/Linkyyy/tekaku/tree/0b32806c00459091957e535e73bb2db029dba92d)
