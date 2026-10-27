# 手书 0.6.0 下载与安全检查记录

检查日期：2026-10-27。本文只对应下列哈希及原始记录，不为之后修改的文件作保证。

## 用户提示的性质

用户提供的原文是 **“下载不常见”**，没有提供病毒或木马检测名称。这类提示通常涉及浏览器的下载信誉、发布者签名和下载量，不能直接视为已经检出病毒，也不能据此认定文件安全。

Tekaku.exe 目前**没有 Authenticode 代码签名**。本次没有签名证书，不能承诺下载信誉提示消失。发布者认证需要可信代码签名与后续信誉积累。

## 已执行的检查

| 检查 | 结果与范围 |
| --- | --- |
| 从公开 GitHub 下载 0.5.0 ZIP | SHA-256 与本地原始发布包一致，没有发现远程文件被替换的迹象 |
| ClamAV 扫描 0.5.0 EXE、ZIP 和 SDK DLL | 3 个输入均显示 OK；Infected files: 0，扫描无文件访问错误 |
| ClamAV 扫描最终 0.6.0 EXE 和 SDK DLL | 2 个输入均显示 OK；Infected files: 0，扫描无文件访问错误 |
| npm audit --omit=dev | 运行依赖的已知漏洞记录为 0；这不是恶意软件扫描 |
| Go 模块校验 | go mod verify 通过；本地适配的宿主中 37 个未修改的源文件和许可证与锁定上游逐字节一致，另附清单 |
| 重复编译最终 EXE | 相同源码、嵌入界面与 Go 工具链重新编译，SHA-256 一致 |
| 界面与文件测试 | 29 项 Playwright 界面测试、8 项 Go 文件测试通过 |
| 源码静态复核 | 应用及适配宿主中未发现 os/exec、net/http、WriteProcessMemory、CreateRemoteThread、LoadFromMemory 调用；不能将字符串检查等同于全面安全审计 |

ClamAV：**1.5.4**；病毒库 **28164，2026-10-25 06:24:12 UTC**。扫描使用官方 `clamav/clamav` 镜像，固定内容摘要：

```text
sha256:bda39705e291105049c3936e2803ac90b955172af8030f94f05dce1252df6c6d
```

扫描容器断网、根文件系统只读、仅以只读方式挂载待检文件。检测结果为**一家引擎未检出**，不是“绝对无病毒”或 Microsoft Defender 检测结论。

## 0.6.0 的加载方式调整

0.5.0 的 WebView2 宿主依赖 go-winloader 内存 PE 加载器。0.6.0 移除此依赖及内存回退，改用 Windows LoadLibraryEx 加载 EXE 旁的 WebView2Loader.dll。加载前校验固定 SHA-256，加载时只允许系统目录解析依赖；校验至加载期间禁止对 DLL 写入和删除。

这项调整用于简化加载链和依赖，不证明 0.5.0 有病毒，也不证明此次信誉提示由内存加载引起。

SDK DLL 为锁定上游 SDK 的原始 x64 文件。osslsigncode 检测到 Microsoft Corporation 签名，PE 内容摘要与签名中的摘要一致；**Linux 信任库缺少微软代码签名和时间戳信任链，完整签名校验未通过**。没有将此结果记为完整的签名信任校验成功。该 DLL 的签名也不等于 Tekaku.exe 已签名。

## 文件 SHA-256

```text
0.5.0 ZIP
98779fa139182a2ac1f149687ebe516d12aeea789e63a98b774c999ceb41d003

0.5.0 Tekaku.exe
3a4040653732ae57460289eb780783e15e695aea4f2cce426c7e050c0680229f

0.6.0 Tekaku.exe
e31f9adc00be39d099c8236ffbc57f1dcae77be385f81c48614170cfc0521709

WebView2Loader.dll
c4674acf95f0800793a4a6d61132adf5dfa694c218e482d86093494c4e84100a
```

最终 0.6.0 ZIP 的哈希及压缩包复扫记录位于 [GitHub 下载分支](https://github.com/Linkyyy/tekaku/tree/downloads/windows-v0.6.0)，避免将 ZIP 自身的哈希写进 ZIP 造成循环。包内 SHA256SUMS.txt 用于核对 EXE 和 DLL。

Windows PowerShell 可用 `Get-FileHash .\Tekaku.exe -Algorithm SHA256` 或对下载 ZIP 使用同样命令，将结果与公开记录比较。哈希只能核对文件一致性，不能证明文件没有恶意行为。

## 仍未验证

此云环境是 Linux，没有执行 Windows Defender、SmartScreen 或 Windows 原生界面测试；新版常规 DLL 加载、原生文件/打印对话框、中文输入法、实际运行内存和 Windows 签名信任均需 Windows 实机复核。尚未取得多引擎在线扫描报告。

随包“检查记录”提供实际扫描、依赖检查、签名检查及测试输出。[应用源码](https://github.com/Linkyyy/tekaku/tree/main)提供构建脚本、锁定依赖和 SDK 文件来源说明，便于复核。
