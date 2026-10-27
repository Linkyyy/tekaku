# 手书 Windows 0.9.0

[下载 Windows x64 便携包（约 1.9 MB）](https://github.com/Linkyyy/tekaku/raw/refs/heads/downloads/windows-v0.9.0/Tekaku-0.9.0-windows-x64.zip)

完整解压，保留 Tekaku.exe 和 WebView2Loader.dll 在同一目录。支持 Windows 10/11 x64 与系统 WebView2。

1. Markdown 输入指南分为两个页签，用写法、操作提示与显示效果对照说明常用语法。
2. 预览滚动条位于编辑区右侧，大纲独立滚动。
3. 应用、指南、设置与其他弹窗的标题固定；仅内容区域滚动。
4. 源码/预览图标统一尺寸、居中对齐，切换时显示相应图标。
5. 侧栏开关移至左下角悬浮；侧栏与大纲有展开、收起动画，支持系统减少动态效果设置。
6. 源码填满与预览相同的编辑视口，去掉缩放柄，分别记住滚动位置。

保留右键插入、图片表格、代码编辑、四种皮肤、任务栏图标、Markdown 打开方式、文件拖入与边框缩放。Android 仍为 0.1.0。

49 项界面/协议回归、最终页面 2 项定向复查和 10 项 Go 测试通过；重复构建 EXE 一致；ClamAV 对最终 EXE、DLL 与 ZIP 未检出。Windows 原生运行仍需实机复核，EXE 未签名，下载信誉提示可能继续出现。

[检查记录](RELEASE-CHECK.md) · [原始扫描输出](checks/clamav-release.txt) · [对应源码快照](https://github.com/Linkyyy/tekaku/tree/63cc1ab9a055fba3e7fe0d2f33f9651059239064) · [Android APK](https://github.com/Linkyyy/tekaku/tree/downloads/android-v0.1.0)

ZIP SHA-256：`d15f50d53cb18590767824ec01f5ab2d205d70e9b1ec60d52f298f64268ab7a8`
