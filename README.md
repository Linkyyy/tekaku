# 手书 Windows 0.7.0

[下载 Windows x64 便携包（约 1.8 MB）](https://github.com/Linkyyy/tekaku/raw/refs/heads/downloads/windows-v0.7.0/Tekaku-0.7.0-windows-x64.zip)

完整解压，保留 Tekaku.exe 与 WebView2Loader.dll 在同一目录。支持 Windows 10/11 x64 和系统 WebView2。

- 退出全屏并还原为窗口后，拖动四边与四角调整大小；F11 或 Esc 退出全屏。
- 把 .md、.markdown 或 .txt 拖进软件界面打开，一次一个；有未保存修改时先提示保存。
- 拖入界面属于导入，首次保存需要选择位置，不会沿用前一个文件的保存路径。
- 修复连续关闭确认的弹窗事件竞态，以及代码中快速 Home/End 光标不同步。

32 项界面/协议测试和 8 项 Go 文件测试通过；重复编译 EXE 哈希一致。最终 EXE / SDK DLL / APK / ZIP 的 ClamAV 扫描均未检出。Windows 原生边框拖动、系统拖放与实际内存仍需实机复核；EXE 未签名，下载信誉提示可能继续出现。

[检查记录](RELEASE-CHECK.md) · [原始扫描输出](checks/clamav-release.txt) · [对应源码快照](https://github.com/Linkyyy/tekaku/tree/bc2af79604ed759e74de02236da7024341b0134f) · [Android APK](https://github.com/Linkyyy/tekaku/tree/downloads/android-v0.1.0)

ZIP SHA-256：`5025d5a50b2093c43a462a59ae2490b214895cfc4cbfaf9e9cfd2072d28360a8`
