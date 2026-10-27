# Tekaku's WebView2 host adaptation

Source: github.com/jchv/go-webview2 at v0.0.0-20260205173254-56598839c808.
The original MIT license is preserved in LICENSE. Host, COM and window code are
unchanged. The upstream memory PE loader and its embedded DLL copies are omitted.

`webviewloader/module_windows.go` calls the normal Windows LoadLibraryEx API on
an absolute path beside the application, restricts dependency search to System32,
and verifies the fixed SHA-256 before loading. It keeps the file open without
write/delete sharing until Windows has mapped the DLL. There is no memory-loader
fallback, DLL download, executable unpacking or automatic installation.

`../../runtime/WebView2Loader.dll` is the unchanged x64 SDK DLL shipped with the
above upstream module. Its redistribution license is beside it. SHA-256:

c4674acf95f0800793a4a6d61132adf5dfa694c218e482d86093494c4e84100a

This change reduces dependency and loader complexity. It does not establish that
any antivirus detection was a false positive and does not replace code signing,
antivirus scanning or Windows runtime verification.
