# Windows 0.12.1 安全核查

此前“检测到病毒”的报告仍缺少威胁名称、命中文件和版本。0.12.1 修复大纲跳转，EXE 尚未签名。若继续被拦截，请保留防护并记录提示。[历史核查](https://github.com/Linkyyy/tekaku/blob/main/docs/SECURITY-ALERT-0.10.md)

本次按固定哈希校验 WebView2 SDK 加载器，并核对便携 ZIP 与包内文件。ClamAV 1.5.4 在断网容器中扫描 EXE、DLL 和 ZIP，使用 2026-10-25 的签名库，未检出。该结果仅覆盖此次扫描的引擎和签名库。Windows Defender 实机复核尚待完成。[本版检查](RELEASE-CHECK.md)
