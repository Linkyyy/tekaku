//go:build windows

package main

import (
	"fmt"
	webview "github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
	"strings"
	"unsafe"
)

var (
	getWindowStyle    = user32.NewProc("GetWindowLongPtrW")
	setWindowStyle    = user32.NewProc("SetWindowLongPtrW")
	setWindowPos      = user32.NewProc("SetWindowPos")
	getWindowRect     = user32.NewProc("GetWindowRect")
	showWindow        = user32.NewProc("ShowWindow")
	isZoomed          = user32.NewProc("IsZoomed")
	monitorFromWindow = user32.NewProc("MonitorFromWindow")
	getMonitorInfo    = user32.NewProc("GetMonitorInfoW")
	releaseCapture    = user32.NewProc("ReleaseCapture")
	postMessage       = user32.NewProc("PostMessageW")
	getCursorPos      = user32.NewProc("GetCursorPos")
	dwmapi            = windows.NewLazySystemDLL("dwmapi.dll")
	dwmSetAttribute   = dwmapi.NewProc("DwmSetWindowAttribute")
	dwmExtendFrame    = dwmapi.NewProc("DwmExtendFrameIntoClientArea")
)

type rect struct{ Left, Top, Right, Bottom int32 }
type point struct{ X, Y int32 }
type monitorInfo struct {
	Size         uint32
	Bounds, Work rect
	Flags        uint32
}
type minMaxInfo struct{ Reserved, MaxSize, MaxPosition, MinTrack, MaxTrack point }
type windowState struct {
	Fullscreen bool `json:"fullscreen"`
	Maximized  bool `json:"maximized"`
}
type frame struct {
	owner              uintptr
	fullscreen         bool
	previousRect       rect
	previousStyle      uintptr
	previousMaximized  bool
	theme              string
	appliedTheme       string
	effectsWindowed    bool
	effectsInitialized bool
}

func (f *frame) monitor() monitorInfo {
	monitor, _, _ := monitorFromWindow.Call(f.owner, 2)
	info := monitorInfo{Size: uint32(unsafe.Sizeof(monitorInfo{}))}
	getMonitorInfo.Call(monitor, uintptr(unsafe.Pointer(&info)))
	return info
}
func (f *frame) state() windowState {
	zoomed, _, _ := isZoomed.Call(f.owner)
	return windowState{f.fullscreen, zoomed != 0}
}
func (f *frame) dpi() uint32 {
	if proc := user32.NewProc("GetDpiForWindow"); proc.Find() == nil {
		value, _, _ := proc.Call(f.owner)
		if value >= 96 {
			return uint32(value)
		}
	}
	return 96
}

func (f *frame) startSystemDrag(command uintptr) {
	var cursor point
	getCursorPos.Call(uintptr(unsafe.Pointer(&cursor)))
	releaseCapture.Call()
	// Enter the native system move/size loop, rather than synthesizing a
	// non-client click at (0,0) through WebView2's mouse capture handling.
	postMessage.Call(f.owner, 0x0112, command, packScreenPoint(cursor.X, cursor.Y))
}
func (f *frame) setFullscreen(value bool) {
	if value == f.fullscreen {
		return
	}
	if value {
		f.previousMaximized = f.state().Maximized
		if f.previousMaximized {
			showWindow.Call(f.owner, 9)
		}
		getWindowRect.Call(f.owner, uintptr(unsafe.Pointer(&f.previousRect)))
		f.previousStyle, _, _ = getWindowStyle.Call(f.owner, ^uintptr(15))
		f.fullscreen = true
		// A thick resize frame has invisible non-client insets on Windows. Drop
		// it in fullscreen so WebView's right edge is the monitor's right edge.
		setWindowStyle.Call(f.owner, ^uintptr(15), f.previousStyle&^(0x00040000|0x00C00000))
		info := f.monitor()
		r := info.Bounds
		setWindowPos.Call(f.owner, 0, uintptr(r.Left), uintptr(r.Top), uintptr(r.Right-r.Left), uintptr(r.Bottom-r.Top), 0x0020|0x0004)
	} else {
		f.fullscreen = false
		setWindowStyle.Call(f.owner, ^uintptr(15), (f.previousStyle&^0x00C00000)|0x00040000|0x00010000|0x00020000|0x00080000)
		r := f.previousRect
		setWindowPos.Call(f.owner, 0, uintptr(r.Left), uintptr(r.Top), uintptr(r.Right-r.Left), uintptr(r.Bottom-r.Top), 0x0020|0x0004)
		if f.previousMaximized {
			showWindow.Call(f.owner, 3)
		}
	}
	f.updateEffects()
}
func (f *frame) action(action string, dirty *bool) (windowState, error) {
	switch action {
	case "state":
	case "theme-slate", "theme-white", "theme-paper", "theme-sage", "theme-night":
		f.theme = strings.TrimPrefix(action, "theme-")
	case "minimize":
		showWindow.Call(f.owner, 6)
	case "maximize":
		if f.fullscreen {
			f.setFullscreen(false)
		} else if f.state().Maximized {
			showWindow.Call(f.owner, 9)
		} else {
			showWindow.Call(f.owner, 3)
		}
	case "fullscreen":
		f.setFullscreen(!f.fullscreen)
	case "exit-fullscreen":
		f.setFullscreen(false)
	case "close":
		postMessage.Call(f.owner, 0x0010, 0, 0)
	case "close-confirmed":
		*dirty = false
		postMessage.Call(f.owner, 0x0010, 0, 0)
	case "drag":
		if !f.fullscreen {
			f.startSystemDrag(0xF012) // SC_MOVE | HTCAPTION
		}
	case "resize-left", "resize-right", "resize-top", "resize-bottom", "resize-top-left", "resize-top-right", "resize-bottom-left", "resize-bottom-right":
		if !f.fullscreen && !f.state().Maximized {
			command, _ := resizeCommand(action)
			f.startSystemDrag(command)
		}
	default:
		return f.state(), fmt.Errorf("不支持的窗口操作")
	}
	f.updateEffects()
	return f.state(), nil
}
func (f *frame) stripCaption() {
	style, _, _ := getWindowStyle.Call(f.owner, ^uintptr(15)) // GWL_STYLE = -16
	setWindowStyle.Call(f.owner, ^uintptr(15), (style&^0x00C00000)|0x00040000|0x00010000|0x00020000|0x00080000)
	setWindowPos.Call(f.owner, 0, 0, 0, 0, 0, 0x0020|0x0004|0x0001|0x0002)
}
func (f *frame) hitTest(lp uintptr) uintptr {
	if f.fullscreen || f.state().Maximized {
		return 1
	}
	var r rect
	getWindowRect.Call(f.owner, uintptr(unsafe.Pointer(&r)))
	x, y := int32(int16(lp&0xffff)), int32(int16((lp>>16)&0xffff))
	border := int32(7)
	if dpi := user32.NewProc("GetDpiForWindow"); dpi.Find() == nil {
		value, _, _ := dpi.Call(f.owner)
		border = int32(value) * 7 / 96
	}
	left, right := x < r.Left+border, x >= r.Right-border
	top, bottom := y < r.Top+border, y >= r.Bottom-border
	switch {
	case top && left:
		return 13
	case top && right:
		return 14
	case bottom && left:
		return 16
	case bottom && right:
		return 17
	case left:
		return 10
	case right:
		return 11
	case top:
		return 12
	case bottom:
		return 15
	}
	return 1
}
func requestClose(w webview.WebView) {
	w.Dispatch(func() { w.Eval("window.dispatchEvent(new Event('tekaku-close-request'))") })
}

// DWM paints the shadow outside the native window. CSS provides the in-client
// edge and gradient, including systems that do not support newer DWM attributes.
func (f *frame) updateEffects() {
	windowed := !f.fullscreen && !f.state().Maximized
	if f.effectsInitialized && f.effectsWindowed == windowed && f.appliedTheme == f.theme {
		return
	}
	f.effectsInitialized, f.effectsWindowed, f.appliedTheme = true, windowed, f.theme
	if dwmSetAttribute.Find() != nil || dwmExtendFrame.Find() != nil {
		return
	}
	policy := uint32(2) // DWMNCRP_ENABLED, retaining native composition/shadow.
	dwmSetAttribute.Call(f.owner, 2, uintptr(unsafe.Pointer(&policy)), 4)
	corner := uint32(1) // Do not round fullscreen or maximized windows.
	margins := struct{ Left, Right, Top, Bottom int32 }{}
	if windowed {
		corner = 2
		margins.Left = 1
		margins.Right = 1
		margins.Top = 1
		margins.Bottom = 1
	}
	dwmSetAttribute.Call(f.owner, 33, uintptr(unsafe.Pointer(&corner)), 4)
	// DWMWA_COLOR_NONE suppresses the extra native outline on Windows 11.
	// The full client has one CSS edge; DWM composition still casts a shadow.
	border := uint32(0xfffffffe)
	dwmSetAttribute.Call(f.owner, 34, uintptr(unsafe.Pointer(&border)), 4)
	dwmExtendFrame.Call(f.owner, uintptr(unsafe.Pointer(&margins)))
}
