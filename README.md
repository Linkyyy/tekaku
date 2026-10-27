# 手书 Windows 0.10.0

[下载 Windows x64 便携包（约 1.9 MB）](https://github.com/Linkyyy/tekaku/raw/refs/heads/downloads/windows-v0.10.0/Tekaku-0.10.0-windows-x64.zip)

完整解压，保留 Tekaku.exe 与 WebView2Loader.dll 在同一目录。支持 Windows 10/11 x64 和系统 WebView2。

- 仅文档内容保留可见滚动条，大纲、侧栏、指南、设置和菜单隐藏滚动条但仍能滚动。
- 文档滚动条位于工作区最右侧，大纲出现时在大纲右侧；控制预览与源码滚动。
- 窗口保留真实原生缩放边缘；客户端边缘与顶栏改用系统缩放/移动消息及真实鼠标坐标。最小尺寸按 DPI 调整并限制在显示器工作区内，全屏不受最小跟踪尺寸撑大。
- 全屏、最大化和普通窗口均保留内容区悬浮按钮；侧栏展开时按钮随内容区移动。
- 侧栏和大纲采用宽度滑入、滑出动画，默认开启，可在设置中关闭。
- 所有应用内操作图标统一为蓝色 SVG，程序和任务栏图标也改为蓝色。
- 大纲取消关闭按钮，再次点击大纲悬浮按钮即可收起。

Android 保持 0.1.0。本次只更新 PC。


55 项界面/协议回归、7 项最终定向检查和 12 项 Go 测试通过；重复构建一致；最终 EXE / DLL / ZIP 的 ClamAV 扫描未检出。窗口缩放改为真实原生边缘和 SC_SIZE/SC_MOVE 系统消息；Windows 实机拖动效果尚未验证。EXE 未签名，下载信誉提示可能继续出现。

[检查记录](RELEASE-CHECK.md) · [原始扫描](checks/clamav-release.txt) · [对应源码快照](https://github.com/Linkyyy/tekaku/tree/ce7edf807a091e5a6e5b3aea38699e31f7228b91) · [动画演示](https://github.com/Linkyyy/tekaku/blob/main/docs/panels-motion.gif) · [Android APK（未更新）](https://github.com/Linkyyy/tekaku/tree/downloads/android-v0.1.0)

ZIP SHA-256：`66320d641b0d9b42e4488136563465f35ee56f115d237f09b6c2ba4e52073008`
