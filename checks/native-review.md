# Native review

The Windows build embeds icon group #1 and uses WindowOptions.IconId = 1 for the HWND class icon. The resource manifest declares per-monitor-v2 DPI and asInvoker execution; taskbar grouping uses Linkyyy.Tekaku.

Association entries are exclusively under HKCU\Software\Classes, add named OpenWithProgids values and owned program/application keys, and do not write extension defaults or UserChoice. Commands quote both the executable and %1. Unregistration checks ownership before removal; user opt-out persists.

The standard unsafe-pointer vet analyzer reports three Windows API boundaries: WM_GETMINMAXINFO's LPARAM and two GlobalLock pointers for CF_UNICODETEXT. These conversions are required by the existing Win32 API bindings and were manually reviewed. Clipboard ownership is thread-bound and memory size is checked before reading; successful SetClipboardData transfers memory ownership. The separate vet run disables only this analyzer, leaving all others enabled. These checks do not replace Windows runtime testing.
