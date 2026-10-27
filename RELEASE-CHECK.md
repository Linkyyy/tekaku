# Windows 0.7.0 / Android 0.1.0 发布检查

日期：2026-10-27。本记录仅对应下面列出的文件哈希。

## 检查结果

- Windows：32 项界面/原生桥接协议测试和 8 项 Go 文件测试通过；重新编译的 EXE 与发布 EXE 哈希相同。
- Android：SDK 35 编译、清单校验、APK v2/v3 签名校验通过。6 项触屏尺寸下的界面/模拟原生桥接测试通过；从 APK 核对网页资源与生产构建逐字节一致，生产页面的 CSP 启动、保存回调和小高度布局检查通过。
- ClamAV 1.5.4、病毒库 28164（2026-10-25）扫描 Windows EXE、Android APK 与 SDK DLL，均显示 OK，Infected files: 0，无扫描访问错误。容器固定摘要与 0.6 的检查相同，扫描时断网并只读挂载文件。
- Android 安装包只声明 INTERNET 权限，用于用户插入的 HTTPS 网络图片；不申请广泛存储或所有文件管理权限，使用系统文件授权。

## 哈希

```text
Windows 0.7.0 Tekaku.exe
4ff30e9ed455164070b4d3685592f96ea54a4a10b0193e303e669f10668cc1d0

Android 0.1.0 APK
1f56340461b7805f57674636a32e10d6b049633de7ada106368367c18ddcacdc

WebView2Loader.dll
c4674acf95f0800793a4a6d61132adf5dfa694c218e482d86093494c4e84100a

Android 发布证书 SHA-256
6515f68158791ac3ff8bbe181174e817facf4eb41a22d96b8832fc8985489ba3
```

Windows ZIP 的哈希和最终 ZIP 复扫输出位于下载分支，不写入 ZIP 自身。公开源码不含 Android 签名私钥、密码或构建工具缓存。

## 功能与验证边界

Windows 的界面边框提供八个方向的原生缩放入口，原有 WM_NCHITTEST 仍保留；全屏或最大化时隐藏。文件拖入支持 UTF-8、单文件 8 MiB 上限和未保存确认。拖入界面属于导入，首次保存需选择位置，不会沿用上一个文件路径。

Android 支持 Android 8.0+ 与较新的系统 WebView，使用系统文件选择器和用户授权访问原文件；只读文件另存为。覆盖前保留一个本机私有副本，草稿停顿后合并写入。手机端文档上限 2 MiB，图片上限 1 MiB；暂不自动解析相对路径附件。详见 ANDROID.md。

云环境为 Linux：未执行 Windows 或 Android 真机测试。原生边框缩放、系统拖放、软键盘、外部文件管理器的“打开方式”、不同文件提供程序的保存行为和真实运行内存仍需实机复核。浏览器桥接测试使用模拟接口，不能代替这些验证。

Windows EXE 仍未进行 Authenticode 签名，“下载不常见”或未知发布者提示可能继续出现。Android APK 已使用项目发布密钥签名，但这不等于 Google Play 或第三方安全认证。单一引擎未检出不是绝对安全保证，尚无 Defender 真机或多引擎扫描结论。
