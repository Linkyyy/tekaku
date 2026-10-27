//go:build windows

package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
	"unsafe"

	webview "github.com/jchv/go-webview2"
	"github.com/jchv/go-webview2/webviewloader"
	"golang.org/x/sys/windows"
)

//go:embed web/index.html
var assets embed.FS

var (
	user32         = windows.NewLazySystemDLL("user32.dll")
	comdlg32       = windows.NewLazySystemDLL("comdlg32.dll")
	messageBox     = user32.NewProc("MessageBoxW")
	setWindowProc  = user32.NewProc("SetWindowLongPtrW")
	callWindowProc = user32.NewProc("CallWindowProcW")
	getOpenFile    = comdlg32.NewProc("GetOpenFileNameW")
	getSaveFile    = comdlg32.NewProc("GetSaveFileNameW")
	dialogError    = comdlg32.NewProc("CommDlgExtendedError")
)

func text(s string) *uint16 { return windows.StringToUTF16Ptr(s) }

func showMessage(owner uintptr, message string, flags uintptr) uintptr {
	result, _, _ := messageBox.Call(owner, uintptr(unsafe.Pointer(text(message))), uintptr(unsafe.Pointer(text("手书 Tekaku"))), flags)
	return result
}

// OPENFILENAMEW uses Windows SDK field order, including the reserved tail.
type openFileName struct {
	Size                         uint32
	Owner, Instance              uintptr
	Filter, CustomFilter         *uint16
	MaxCustomFilter, FilterIndex uint32
	File                         *uint16
	MaxFile                      uint32
	FileTitle                    *uint16
	MaxFileTitle                 uint32
	InitialDir, Title            *uint16
	Flags                        uint32
	FileOffset, FileExtension    uint16
	DefaultExtension             *uint16
	CustomData, Hook             uintptr
	TemplateName                 *uint16
	Reserved                     uintptr
	ReservedWord, FlagsEx        uint32
}

func chooseFile(owner uintptr, save bool, current string) (string, error) {
	return chooseFileFiltered(owner, save, current, "Markdown (*.md;*.markdown;*.txt)\x00*.md;*.markdown;*.txt\x00所有文件 (*.*)\x00*.*\x00\x00", "md")
}
func chooseFileFiltered(owner uintptr, save bool, current, filterText, extension string) (string, error) {
	buffer := make([]uint16, 32768)
	if save {
		initial := current
		if initial == "" {
			initial = "未命名.md"
		}
		copy(buffer, windows.StringToUTF16(initial))
	}
	filter := utf16.Encode([]rune(filterText))
	options := openFileName{
		Owner: owner, Filter: &filter[0], FilterIndex: 1, File: &buffer[0], MaxFile: uint32(len(buffer)),
		DefaultExtension: text(extension), Flags: 0x00080000 | 0x00000008 | 0x00000800, // EXPLORER | NOCHANGEDIR | PATHMUSTEXIST
	}
	options.Size = uint32(unsafe.Sizeof(options))
	proc := getOpenFile
	if save {
		options.Flags |= 0x2
		proc = getSaveFile
	} else {
		options.Flags |= 0x1000
	}
	result, _, _ := proc.Call(uintptr(unsafe.Pointer(&options)))
	runtime.KeepAlive(buffer)
	runtime.KeepAlive(filter)
	if result == 0 {
		code, _, _ := dialogError.Call()
		if code != 0 {
			return "", fmt.Errorf("无法显示文件选择窗口 (0x%x)", code)
		}
		return "", nil
	}
	return windows.UTF16ToString(buffer), nil
}

func main() {
	runtime.LockOSThread()
	setApplicationID()
	if dpi := user32.NewProc("SetProcessDpiAwarenessContext"); dpi.Find() == nil {
		dpi.Call(^uintptr(3))
	} // Per-monitor DPI v2
	defer runtime.UnlockOSThread()
	version, loaderErr := webviewloader.GetInstalledVersion()
	if loaderErr != nil {
		showMessage(0, loaderErr.Error(), 0x10)
		return
	}
	if version == "" {
		showMessage(0, "请安装 Microsoft Edge WebView2 Evergreen Runtime 后重试。\n官方下载：https://developer.microsoft.com/microsoft-edge/webview2/", 0x10)
		return
	}
	configDir, err := os.UserConfigDir()
	if err != nil {
		showMessage(0, err.Error(), 0x10)
		return
	}
	dataDir := filepath.Join(configDir, "Tekaku")
	if err := os.MkdirAll(dataDir, 0700); err != nil {
		showMessage(0, err.Error(), 0x10)
		return
	}
	w := webview.NewWithOptions(webview.WebViewOptions{
		DataPath: filepath.Join(dataDir, "WebView2"), AutoFocus: true,
		WindowOptions: webview.WindowOptions{Title: "手书 Tekaku", Width: 1100, Height: 780, Center: true, IconId: 1},
	})
	if w == nil {
		showMessage(0, "无法启动编辑器。请安装或修复 Microsoft Edge WebView2 Evergreen Runtime 后重试。\n官方下载：https://developer.microsoft.com/microsoft-edge/webview2/", 0x10)
		return
	}
	defer w.Destroy()
	w.SetSize(720, 500, webview.HintMin)
	owner := uintptr(w.Window())
	dirty := false
	currentPath := ""
	importedName := ""
	prefsPath := filepath.Join(dataDir, "preferences.json")
	prefs := loadPreferences(prefsPath)
	executable, executableErr := executablePath()
	if executableErr == nil && prefs["tekaku-association-disabled"] != "1" && !associationRegistered(executable) {
		// Portable, per-user Open With registration. The settings panel can
		// remove it and persist an opt-out; no elevation or default hijacking.
		_ = registerAssociation(executable)
	}
	var recovered struct {
		Path string `json:"path"`
	}
	if json.Unmarshal([]byte(prefs["tekaku-draft"]), &recovered) == nil && filepath.IsAbs(recovered.Path) {
		if info, err := os.Stat(recovered.Path); err == nil && !info.IsDir() {
			currentPath = recovered.Path
		}
	}
	frame := &frame{owner: owner}
	var windowPrefs struct {
		StartupFullscreen *bool  `json:"startupFullscreen"`
		Theme             string `json:"theme"`
	}
	_ = json.Unmarshal([]byte(prefs["tekaku-settings"]), &windowPrefs)
	frame.theme = windowPrefs.Theme
	// Keep resize and minimize/maximize behavior, while removing Windows non-client chrome.
	var previous uintptr
	hook := windows.NewCallback(func(hwnd, message, wp, lp uintptr) uintptr {
		switch message {
		case 0x0005: // WM_SIZE
			frame.updateEffects()
		case 0x031E: // WM_DWMCOMPOSITIONCHANGED
			frame.effectsInitialized = false
			frame.updateEffects()
		case 0x0083: // WM_NCCALCSIZE: use all of the window as web content.
			return 0
		case 0x0084: // WM_NCHITTEST: retain border resizing in windowed mode.
			return frame.hitTest(lp)
		case 0x0024: // WM_GETMINMAXINFO: maximize to work area, not behind the taskbar.
			if !frame.fullscreen {
				info := frame.monitor()
				bounds := (*minMaxInfo)(unsafe.Pointer(lp))
				bounds.MaxPosition = point{info.Work.Left - info.Bounds.Left, info.Work.Top - info.Bounds.Top}
				bounds.MaxSize = point{info.Work.Right - info.Work.Left, info.Work.Bottom - info.Work.Top}
			}
		case 0x0010, 0x0011: // WM_CLOSE / WM_QUERYENDSESSION
			if dirty {
				requestClose(w)
				return 0
			}
		}
		result, _, _ := callWindowProc.Call(previous, hwnd, message, wp, lp)
		return result
	})
	previous, _, _ = setWindowProc.Call(owner, ^uintptr(3), hook)
	if previous == 0 {
		showMessage(owner, "无法设置自定义窗口。", 0x10)
		return
	}
	frame.stripCaption()
	if windowPrefs.StartupFullscreen == nil || *windowPrefs.StartupFullscreen {
		frame.setFullscreen(true)
	}

	frame.updateEffects()

	bind := func(name string, handler any) {
		if err := w.Bind(name, handler); err != nil {
			panic(err)
		}
	}
	bind("tekakuWindow", func(action string) (windowState, error) { return frame.action(action, &dirty) })
	bind("tekakuDirty", func(value bool) { dirty = value })
	bind("tekakuClipboardRead", func() (string, error) { return clipboardRead(owner) })
	bind("tekakuClipboardWrite", func(value string) error { return clipboardWrite(owner, value) })
	bind("tekakuIntegration", func(action string) (integrationState, error) {
		if executableErr != nil {
			return integrationState{}, executableErr
		}
		if action == "register" || action == "remove" {
			var err error
			if action == "register" {
				err = registerAssociation(executable)
			} else {
				err = removeAssociation(executable)
			}
			if err != nil {
				return integrationState{}, err
			}
			next := make(map[string]string, len(prefs)+1)
			for key, value := range prefs {
				next[key] = value
			}
			if action == "remove" {
				next["tekaku-association-disabled"] = "1"
			} else {
				delete(next, "tekaku-association-disabled")
			}
			if err := savePreferences(prefsPath, next); err != nil {
				return integrationState{}, err
			}
			prefs = next
		} else if action != "status" {
			return integrationState{}, fmt.Errorf("不支持的文件关联操作")
		}
		registered := associationRegistered(executable)
		message := "尚未加入打开方式。可在此添加，无需管理员权限。"
		if registered {
			message = "已加入 .md / .markdown 的打开方式。右键文件 → 打开方式 → 手书 Tekaku。"
		}
		return integrationState{Registered: registered, Message: message}, nil
	})
	bind("tekakuNew", func() bool {
		currentPath = ""
		importedName = ""
		dirty = false
		return true
	})
	bind("tekakuImportFile", func(request struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}) (*document, error) {
		name := filepath.Base(request.Name)
		ext := strings.ToLower(filepath.Ext(name))
		if name != request.Name || strings.ContainsAny(name, "\x00\r\n<>:\"/\\|?*") || !(ext == ".md" || ext == ".markdown" || ext == ".txt") {
			return nil, fmt.Errorf("不支持此文件名或文件类型")
		}
		if len(request.Content) > maxDocumentBytes || !utf8.ValidString(request.Content) {
			return nil, fmt.Errorf("请使用不超过 8 MiB 的 UTF-8 Markdown 文件")
		}
		currentPath, importedName, dirty = "", name, false
		return &document{Name: name, Content: request.Content}, nil
	})
	bind("tekakuOpen", func() (*document, error) {
		path, err := chooseFile(owner, false, currentPath)
		if err != nil || path == "" {
			return nil, err
		}
		doc, err := readDocument(path)
		if err != nil {
			return nil, err
		}
		currentPath = path
		dirty = false
		return doc, nil
	})
	bind("tekakuSave", func(request struct {
		Content string `json:"content"`
		SaveAs  bool   `json:"saveAs"`
	}) (map[string]string, error) {
		if len(request.Content) > maxEditorPayload {
			return nil, fmt.Errorf("待保存内容过大，请减少图片数量")
		}
		path := currentPath
		if request.SaveAs || path == "" {
			var err error
			seed := currentPath
			if seed == "" {
				seed = importedName
			}
			path, err = chooseFile(owner, true, seed)
			if err != nil || path == "" {
				return nil, err
			}
		}
		content, err := saveDocumentImages(request.Content, currentPath, path)
		if err != nil {
			return nil, err
		}
		currentPath = path
		dirty = false
		return map[string]string{"name": filepath.Base(path), "path": path, "content": content}, nil
	})
	bind("tekakuResolveImages", func(refs []string) map[string]string { return resolveImages(currentPath, refs) })
	bind("tekakuOpenURL", func(raw string) error {
		u, err := url.Parse(raw)
		if err != nil || !(u.Scheme == "https" || u.Scheme == "http" || u.Scheme == "mailto") {
			return fmt.Errorf("仅支持网页和邮件链接")
		}
		if (u.Scheme == "https" || u.Scheme == "http") && u.Host == "" {
			return fmt.Errorf("链接地址不完整")
		}
		result, _, _ := windows.NewLazySystemDLL("shell32.dll").NewProc("ShellExecuteW").Call(owner, uintptr(unsafe.Pointer(text("open"))), uintptr(unsafe.Pointer(text(raw))), 0, 0, 1)
		if result <= 32 {
			return fmt.Errorf("无法打开链接")
		}
		return nil
	})
	bind("tekakuExportHTML", func(request struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}) (bool, error) {
		if len(request.Content) > 64*1024*1024 {
			return false, fmt.Errorf("导出内容过大")
		}
		name := strings.TrimSuffix(filepath.Base(request.Name), filepath.Ext(request.Name)) + ".html"
		path, err := chooseFileFiltered(owner, true, name, "HTML (*.html)\x00*.html\x00\x00", "html")
		if err != nil || path == "" {
			return false, err
		}
		return true, replaceFile(path, []byte(request.Content))
	})
	bind("tekakuReadState", func() map[string]string { return prefs })
	bind("tekakuWriteState", func(key string, value *string) error {
		if key != "tekaku-draft" && key != "tekaku-dark" && key != "tekaku-settings" {
			return fmt.Errorf("不支持的设置")
		}
		next := make(map[string]string, len(prefs)+1)
		for k, v := range prefs {
			next[k] = v
		}
		if value == nil {
			delete(next, key)
		} else {
			if len(*value) > maxDocumentBytes*2 {
				return fmt.Errorf("本地草稿过大，请保存到文件")
			}
			next[key] = *value
		}
		if err := savePreferences(prefsPath, next); err != nil {
			return err
		}
		prefs = next
		return nil
	})
	bind("tekakuInitialFile", func(accept bool) (*document, error) {
		if len(os.Args) < 2 {
			return nil, nil
		}
		path, err := filepath.Abs(os.Args[1])
		if err != nil {
			return nil, err
		}
		doc, err := readDocument(path)
		if err == nil && accept {
			currentPath = path
		}
		return doc, err
	})
	w.Init(`window.desktop = Object.freeze({
  open: () => window.tekakuOpen(), save: data => window.tekakuSave(data),
  new: () => window.tekakuNew(), dirty: value => window.tekakuDirty(value),
  importFile: data => window.tekakuImportFile(data),
  integration: action => window.tekakuIntegration(action),
  clipboardRead: () => window.tekakuClipboardRead(), clipboardWrite: value => window.tekakuClipboardWrite(value),
  readState: () => window.tekakuReadState(), writeState: (key, value) => window.tekakuWriteState(key, value),
  resolveImages: refs => window.tekakuResolveImages(refs), openURL: url => window.tekakuOpenURL(url), exportHTML: data => window.tekakuExportHTML(data),
  initialFile: accept => window.tekakuInitialFile(Boolean(accept)), window: action => window.tekakuWindow(action)
 });
 document.addEventListener('click', e => { if (e.target.closest('a')) e.preventDefault(); }, true);
 document.addEventListener('auxclick', e => { if (e.target.closest('a')) e.preventDefault(); }, true);
 document.addEventListener('dragover', e => e.preventDefault());
 document.addEventListener('drop', e => e.preventDefault());`)
	html, err := assets.ReadFile("web/index.html")
	if err != nil {
		showMessage(owner, err.Error(), 0x10)
		return
	}
	if !strings.Contains(string(html), "手书") {
		showMessage(owner, "编辑器资源缺失，请重新构建。", 0x10)
		return
	}
	w.SetHtml(string(html))
	w.Run()
	runtime.KeepAlive(hook)
}
