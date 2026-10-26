# 手书 Tekaku · Windows 便携版

[下载 Windows x64 便携包](https://github.com/Linkyyy/tekaku/raw/refs/heads/downloads/windows-v0.2.0/Tekaku-0.2.0-windows-x64.zip)

解压后双击 Tekaku.exe。支持 Windows 10/11 x64，需要 Microsoft Edge WebView2 Evergreen Runtime（Windows 11 通常已自带）。程序约 3.6 MiB，ZIP 下载约 1.5 MiB。

本版本使用 Go + 系统 WebView2，不再携带 Electron。支持 Markdown 单区域即时编辑、斜杠菜单、本地文件打开/保存、草稿恢复、专注模式和深色模式。

这是独立下载分支，只存放便携包和校验和。程序未签名；Windows 窗口及实际内存尚待实机验证。

下载后可使用 PowerShell 校验：

```powershell
Get-FileHash .\Tekaku-0.2.0-windows-x64.zip -Algorithm SHA256
```

SHA-256 应与 SHA256SUMS.txt 一致。
