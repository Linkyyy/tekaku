//go:build windows

package main

import (
	"fmt"
	"path/filepath"
	"runtime"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	instanceRegisterClass   = user32.NewProc("RegisterClassExW")
	instanceCreateWindow    = user32.NewProc("CreateWindowExW")
	instanceDestroyWindow   = user32.NewProc("DestroyWindow")
	instanceDefWindowProc   = user32.NewProc("DefWindowProcW")
	instanceFindWindow      = user32.NewProc("FindWindowExW")
	instanceSendMessage     = user32.NewProc("SendMessageTimeoutW")
	instanceWindowProcess   = user32.NewProc("GetWindowThreadProcessId")
	instanceAllowForeground = user32.NewProc("AllowSetForegroundWindow")
	instanceSetForeground   = user32.NewProc("SetForegroundWindow")
	instanceIsIconic        = user32.NewProc("IsIconic")
	instanceGetPopup        = user32.NewProc("GetLastActivePopup")
	instanceIsVisible       = user32.NewProc("IsWindowVisible")
)

const openRequestMessageKind = 0x544b4f31 // TKO1, WM_COPYDATA payload version.

type instanceWindowClass struct {
	Size, Style                        uint32
	Procedure                          uintptr
	ClassExtra, WindowExtra            int32
	Instance, Icon, Cursor, Background uintptr
	Menu, Name                         *uint16
	SmallIcon                          uintptr
}
type instanceCopyData struct {
	Kind uintptr
	Size uint32
	Data uintptr
}
type appInstance struct {
	mutex    windows.Handle
	relay    uintptr
	callback uintptr
	queue    openRequestQueue
}

// Called on the locked main OS thread before WebView2 or any visible window is
// created. The named mutex is scoped to this interactive session and user.
func acquireAppInstance(args []string) (*appInstance, error) {
	paths := make([]string, 0, len(args))
	for _, arg := range args {
		path, err := filepath.Abs(arg)
		if err != nil {
			return nil, err
		}
		paths = append(paths, path)
	}
	packet, err := encodeOpenRequest(paths)
	if err != nil {
		return nil, err
	}
	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		return nil, err
	}
	scope := "Linkyyy.Tekaku.OpenFiles.v1." + user.User.Sid.String()
	mutex, err := windows.CreateMutex(nil, false, text(`Local\`+scope))
	if err != nil {
		return nil, err
	}
	keep := false
	defer func() {
		if !keep {
			windows.CloseHandle(mutex)
		}
	}()
	deadline := time.Now().Add(15 * time.Second)
	for {
		// A closed/crashed primary releases ownership automatically. Take over only
		// after acquiring it; never open another editor on a relay timeout alone.
		state, err := windows.WaitForSingleObject(mutex, 0)
		if err != nil {
			return nil, err
		}
		if state == windows.WAIT_OBJECT_0 || state == windows.WAIT_ABANDONED {
			instance := &appInstance{mutex: mutex}
			if err := instance.createRelay(scope); err != nil {
				windows.ReleaseMutex(mutex)
				return nil, err
			}
			instance.queue.add(paths)
			keep = true
			return instance, nil
		}
		if state != uint32(windows.WAIT_TIMEOUT) {
			return nil, fmt.Errorf("无法确认现有窗口状态")
		}
		relay, _, _ := instanceFindWindow.Call(^uintptr(2), 0, uintptr(unsafe.Pointer(text(scope))), 0) // HWND_MESSAGE = -3
		if relay != 0 {
			var pid uint32
			instanceWindowProcess.Call(relay, uintptr(unsafe.Pointer(&pid)))
			if pid != 0 {
				instanceAllowForeground.Call(uintptr(pid))
			}
			data := instanceCopyData{Kind: openRequestMessageKind, Size: uint32(len(packet)), Data: uintptr(unsafe.Pointer(&packet[0]))}
			var accepted uintptr
			ok, _, _ := instanceSendMessage.Call(relay, 0x004a, 0, uintptr(unsafe.Pointer(&data)), 0x0001|0x0002, 3000, uintptr(unsafe.Pointer(&accepted)))
			runtime.KeepAlive(packet)
			if ok != 0 {
				if accepted == 1 {
					return nil, nil
				}
				return nil, fmt.Errorf("现有窗口未接受文件请求，请稍后重试")
			}
		}
		if time.Now().After(deadline) {
			return nil, fmt.Errorf("现有手书窗口正在启动或无响应，请稍后重新打开文件")
		}
		time.Sleep(75 * time.Millisecond)
	}
}

func (instance *appInstance) createRelay(name string) error {
	var module windows.Handle
	if err := windows.GetModuleHandleEx(0, nil, &module); err != nil {
		return err
	}
	instance.callback = windows.NewCallback(func(hwnd, msg, wp, lp uintptr) uintptr {
		if msg == 0x004a {
			if lp == 0 {
				return 0
			}
			data := (*instanceCopyData)(unsafe.Pointer(lp))
			if data.Kind != openRequestMessageKind || data.Size == 0 || data.Size > maxOpenRequestBytes || data.Data == 0 {
				return 0
			}
			// COPYDATA memory is valid only inside this callback. JSON decoding copies
			// the paths before returning; the queue never stores foreign pointers.
			paths, err := decodeOpenRequest(unsafe.Slice((*byte)(unsafe.Pointer(data.Data)), int(data.Size)))
			if err == nil && instance.queue.add(paths) {
				return 1
			}
			return 0
		}
		result, _, _ := instanceDefWindowProc.Call(hwnd, msg, wp, lp)
		return result
	})
	class := instanceWindowClass{Size: uint32(unsafe.Sizeof(instanceWindowClass{})), Procedure: instance.callback, Instance: uintptr(module), Name: text(name)}
	atom, _, err := instanceRegisterClass.Call(uintptr(unsafe.Pointer(&class)))
	if atom == 0 {
		return fmt.Errorf("无法注册文件接收窗口：%w", err)
	}
	relay, _, err := instanceCreateWindow.Call(0, uintptr(unsafe.Pointer(class.Name)), 0, 0, 0, 0, 0, 0, ^uintptr(2), 0, uintptr(module), 0)
	if relay == 0 {
		return fmt.Errorf("无法创建文件接收窗口：%w", err)
	}
	instance.relay = relay
	return nil
}
func (instance *appInstance) close() {
	instance.queue.setNotify(nil)
	instanceDestroyWindow.Call(instance.relay)
	windows.ReleaseMutex(instance.mutex)
	windows.CloseHandle(instance.mutex)
	runtime.KeepAlive(instance.callback)
}
func activateExistingWindow(owner uintptr) {
	if minimized, _, _ := instanceIsIconic.Call(owner); minimized != 0 {
		showWindow.Call(owner, 9)
	} // SW_RESTORE, only if minimized.
	target, _, _ := instanceGetPopup.Call(owner)
	if visible, _, _ := instanceIsVisible.Call(target); target == 0 || visible == 0 {
		target = owner
	}
	instanceSetForeground.Call(target)
}
