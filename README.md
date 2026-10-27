# 手书 Tekaku 0.6.0 · Windows x64

[下载便携 ZIP（约 1.8 MB）](https://github.com/Linkyyy/tekaku/raw/refs/heads/downloads/windows-v0.6.0/Tekaku-0.6.0-windows-x64.zip)

完整解压，保留 Tekaku.exe 和 WebView2Loader.dll 在同一目录，再运行 EXE。支持 Windows 10/11 x64，需要系统 WebView2 Runtime。

## Markdown 与代码编辑

- 快捷输入、斜杠菜单、侧栏插入、源码编辑；支持 1–6 级标题、常用文本格式、代码、列表、待办、引用、图片和 GFM 表格。
- 26 项代码语言选项（含纯文本），支持 C/C++/C#、Java、Python、Go、Rust、JS/TS、YAML、SQL、Shell 等。保留未知语言内容。
- Tab / Shift+Tab 缩进与列表层级、整行多选缩进、撤销、代码复制、自动换行。内部代码围栏安全往返保存。
- [编辑指南](MARKDOWN.md)。仍不提供公式排版、Mermaid 渲染、脚注或 YAML front matter 专用编辑。

![代码编辑界面](code.png)

## 下载提示与检查

用户确认的提示是“下载不常见”，属于下载信誉提示，不等同于已经检出病毒。当前 EXE 仍未签名，提示可能继续出现。

ClamAV 1.5.4、病毒库 28164（2026-10-25）扫描旧版 0.5.0、最终新版 EXE / SDK DLL 和最终发布 ZIP，均未检出。29 项界面测试、8 项 Go 测试通过；重复编译 EXE 的 SHA-256 一致。单一引擎未检出不是绝对安全保证，未执行 Windows Defender / SmartScreen 或 Windows 原生界面实机测试。

- [安全检查记录和局限](SECURITY-CHECK.md)
- [最终 ZIP 扫描原始输出](checks/clamav-v0.6.0-archive.txt)
- [全部原始检查输出](checks/)
- [对应应用源码快照](https://github.com/Linkyyy/tekaku/tree/e6b6985f047f943a8a7271756c36039f76fd05a3)
- [官网源码](https://github.com/Linkyyy/tekaku/tree/gh-pages)

0.6 移除了内存 PE 加载依赖，改用校验固定哈希的 SDK DLL 和 Windows 常规加载机制。这不代表已经修复或消除了下载信誉提示。

## 校验

ZIP SHA-256：`a0941ded55b303620c0b473088b0890a3924db5988a229f01d4121e85a0a6c6b`

根目录 SHA256SUMS.txt 对应 ZIP；包内同名文件对应 EXE 和 SDK DLL。SHA-256 用于核对文件一致性，不证明文件不存在恶意行为。
