# Windows 0.12.1 发布检查

2026-11-27（日本时间）

| 检查 | 结果 |
| --- | --- |
| 界面回归 | Chromium 中运行 78 项，76 项通过。列表缩进和代码复制两项失败，均在大纲修复前的源码中复现。大纲相关测试通过。 |
| 包内界面 | 从 ZIP 中的 EXE 核对内嵌 HTML，用模拟 Windows 文件桥接验证同名标题在阅读模式中正确跳转，设置页显示 0.12.1。 |
| Go | 18 项 Linux 测试通过并启用 race detector，Windows x64 测试二进制成功交叉编译。 |
| Windows x64 构建 | Go 1.27.3，两次构建的 EXE 字节一致。PE 文件版本和产品版本均为 0.12.1.0，SDK 加载器与源码固定哈希一致。 |
| 便携 ZIP | 1,908,141 字节。ZIP 完整性和包内 EXE、DLL 的 SHA-256 均通过。 |
| 官网 | 390、768、1440 像素宽度下验证 Windows 版本、两个 Windows 链接、Android 链接、大纲说明、校验值复制及可见图片。 |
| 扫描 | ClamAV 1.5.4 扫描 EXE、DLL 和 ZIP，共 3 个输入，未检出。使用 2026-10-25 的病毒库，已有过期提示。 |

Windows 实机启动、原生窗口和 Windows Defender 复核尚待完成。

[桌面测试](checks/desktop-tests.txt) · [Go 测试](checks/go-tests.txt) · [扫描日志](checks/clamav-release.txt) · [病毒库信息](checks/clamav-database.txt) · [SHA-256](SHA256SUMS.txt)
