# Windows 下载安全状态

此前“检测到病毒”的拦截报告仍在核查，尚未取得具体威胁名称及涉事版本，不能认定误报。此包为 Windows 0.12.0 阅读模式功能更新，并非已验证的安全修复。EXE 仍没有 Authenticode 签名。

若继续被拦截，请保留防护，不要关闭杀毒或添加白名单。SHA-256 只核对文件一致性，单个引擎未检出也不能排除其他引擎的检测。

[核查记录](https://github.com/Linkyyy/tekaku/blob/main/docs/SECURITY-ALERT-0.10.md) · [本版检查](https://github.com/Linkyyy/tekaku/blob/downloads/windows-v0.12.0/RELEASE-CHECK.md) · [最终文件扫描记录](https://github.com/Linkyyy/tekaku/blob/downloads/windows-v0.12.0/checks/clamav-release.txt)

随包检查记录覆盖界面模拟、Go 逻辑、并发检测、PE 资源和重复构建；Windows Defender、原生文件选择器和实际窗口操作尚待 Windows 真机复核。
