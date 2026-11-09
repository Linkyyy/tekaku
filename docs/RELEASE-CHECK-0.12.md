# Windows 0.12.0 / Android 0.2.0 发布检查

日期：2026-11-10（日本时间）；原始构建、扫描日志使用 UTC。变更说明见 [本版更新](RELEASE-NOTES-0.12.md)。

## 本版行为

- 已有文件和恢复文档默认阅读，明确点击“编辑”才可输入；新建空白文档直接编辑。PC 切换位于右下角，Android 位于顶部；保留 PC 全屏悬浮按钮及同一窗口多 Tab。
- 阅读时可以选择、复制和查看只读源码；PC 保留查找、大纲和导出。待办、输入、修改快捷键、插入、替换和异步剪贴板修改均受模式限制；未修改的已绑定文件点击保存不重写原文。
- 共用占位提示策略：只在编辑时当前空段落出现一次“开始写点什么…”，阅读时隐藏，提示不写入 Markdown。
- Android 文档抽屉提供多标签、新建、系统多选打开和独立关闭。每个标签保留文档、修改状态、原生文件标识、模式、富文本撤销及滚动位置；退出逐个检查未保存文档。
- Android 原生层按文档标识解析 URI，另存为绑定发起标签，重复 URI 复用原标签。草稿原子写入全部标签，兼容 0.1 草稿迁移，恢复时默认阅读；URI 授权失效时保留为未绑定草稿。
- 两端各自仍只使用一个编辑器视图，不为标签增加 WebView；未增加 npm 依赖或广泛文件访问权限。

## 已完成的验证

| 检查 | 结果与范围 |
| --- | --- |
| 桌面界面完整回归 | 75 项通过；增加 7 项阅读/编辑、单提示、标签模式和原生只读保存检查，既有编辑测试先显式进入编辑模式 |
| 最终桌面定向回归 | 异步修改守卫及原生只读保存完成后，16 项阅读模式、图文功能与嵌入页面检查通过 |
| Android 前端及模拟桥接 | 12 项通过，覆盖窄屏、阅读/编辑、源码与键盘、单提示、多标签独立内容/保存、重复打开、草稿恢复、分享队列、取消关闭和退出检查 |
| Go 原生逻辑 | 18 项测试通过，并通过 race detector；Windows IPC 专用测试在 Linux 上未执行 |
| Windows 构建 | Windows x64 交叉编译成功；相同界面、资源、工具链重复构建 EXE 逐字节一致 |
| PE 资源 | 文件/产品版本 0.12.0.0、9 种尺寸蓝色图标及 per-monitor v2 DPI 清单；EXE 证书表为空，仍未签名 |
| Android APK | SDK 35 工具编译成功；应用 ID 不变、versionCode=2、minSdk=26、targetSdk=35；v2/v3 签名有效，与 0.1.0 证书 SHA-256 一致 |
| 官网 | 1440、768、390 宽度无横向溢出、图片失败或 JS 错误；Windows/APK 链接、校验值、五种皮肤、阅读/抽屉预览及安全提示通过本地静态检查 |
| 最终文件扫描 | EXE、SDK DLL、ZIP、APK 共 4 个输入可访问，ClamAV 1.5.4 未检出；仅代表该引擎与该病毒库的结果 |

界面和官网截图来自实际前端的 Chromium 渲染，文件操作使用模拟原生桥接，不是 Windows/Android 真机截图。

[桌面 75 项](checks/v0.12/desktop-tests.txt) · [最终 16 项](checks/v0.12/final-desktop-tests.txt) · [手机 12 项](checks/v0.12/mobile-tests.txt) · [Go 与并发检测](checks/v0.12/go-tests.txt) · [重复构建](checks/v0.12/rebuild-verification.json) · [PE 资源](checks/v0.12/pe-resources.json) · [APK 包信息](checks/v0.12/android-package.txt) · [签名](checks/v0.12/android-signature.txt) · [升级证书连续性](checks/v0.12/android-upgrade.json) · [官网](checks/v0.12/website-check.json)

## 安全状态与验证边界

此前 Windows“检测到病毒”的报告仍缺少具体威胁名称、命中文件和涉事版本，本次是功能更新，不能认定误报或宣称已解除拦截。EXE 仍没有 Authenticode 签名；SDK DLL 本轮仅核对固定哈希，未重做完整信任链校验。

扫描容器断网、发布文件只读挂载，固定镜像 `clamav/clamav@sha256:bda39705e291105049c3936e2803ac90b955172af8030f94f05dce1252df6c6d`。镜像内病毒库为 **28164，2026-10-25**，已有过期告警，本次没有更新。该历史库的单引擎结果不能排除其他产品的检测；没有 Windows Defender 或多引擎复核结论。原始证据：[扫描日志](checks/v0.12/clamav-release.txt)、[库信息](checks/v0.12/clamav-database.txt)、[仍在核查的报告](SECURITY-ALERT-0.10.md)。

尚未完成 Windows 实机启动、窗口/DPI、资源管理器转交、中文输入法或内存测量；没有 Android 真机安装、软键盘、Storage Access Framework 真实文件提供程序、多选授权/重启后授权、0.1 私有草稿迁移及实际内存测试。模拟桥接和编译通过不能替代这些实机验收。已更新 Vercel 关联发布仓库；本环境未核实线上部署是否完成。

## 最终文件 SHA-256

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `Tekaku.exe` | 4,529,664 | `b974c3aa459e9d5cc6633bc17ab5a67f72a84201a6f7d213cc7a244d4456e398` |
| `WebView2Loader.dll` | 137,640 | `c4674acf95f0800793a4a6d61132adf5dfa694c218e482d86093494c4e84100a` |
| `Tekaku-0.12.0-windows-x64.zip` | 1,918,132 | `1e5e7b9392a2e5476ca63580e261598be7dc81d2b88587966ea2eddf1e6bbdf4` |
| `Tekaku-0.2.0-android.apk` | 238,237 | `f4d884c90a5cce7e18994a8679a0d1149c6b231948174d39602f25c2d6e4d52c` |

[机器可读哈希](checks/v0.12/release-hashes.json)。ZIP 完整性已检查；公开下载后的哈希与签名复核单独记录在下载分支。校验值只证明文件一致性，不提供安全保证。
