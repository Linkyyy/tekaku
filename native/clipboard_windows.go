//go:build windows

package main

import (
	"fmt"
	"runtime"
	"strings"
	"time"
	"unicode/utf16"
	"unicode/utf8"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	openClipboard    = user32.NewProc("OpenClipboard")
	closeClipboard   = user32.NewProc("CloseClipboard")
	emptyClipboard   = user32.NewProc("EmptyClipboard")
	getClipboardData = user32.NewProc("GetClipboardData")
	setClipboardData = user32.NewProc("SetClipboardData")
	globalAlloc      = windows.NewLazySystemDLL("kernel32.dll").NewProc("GlobalAlloc")
	globalFree       = windows.NewLazySystemDLL("kernel32.dll").NewProc("GlobalFree")
	globalLock       = windows.NewLazySystemDLL("kernel32.dll").NewProc("GlobalLock")
	globalUnlock     = windows.NewLazySystemDLL("kernel32.dll").NewProc("GlobalUnlock")
	globalSize       = windows.NewLazySystemDLL("kernel32.dll").NewProc("GlobalSize")
)

func withClipboard(owner uintptr, action func() error) error {
	// OpenClipboard ownership belongs to a thread, not a goroutine.
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	for attempt := 0; attempt < 5; attempt++ {
		if ok, _, _ := openClipboard.Call(owner); ok != 0 {
			defer closeClipboard.Call()
			return action()
		}
		time.Sleep(8 * time.Millisecond)
	}
	return fmt.Errorf("剪贴板正被其他程序占用，请稍后重试")
}

func clipboardWrite(owner uintptr, value string) error {
	if len(value) > maxDocumentBytes || !utf8.ValidString(value) || strings.ContainsRune(value, 0) {
		return fmt.Errorf("剪贴板文本必须是不超过 8 MiB 的有效文本")
	}
	value = strings.ReplaceAll(strings.ReplaceAll(value, "\r\n", "\n"), "\n", "\r\n")
	data := append(utf16.Encode([]rune(value)), 0)
	return withClipboard(owner, func() error {
		handle, _, _ := globalAlloc.Call(0x0042, uintptr(len(data)*2)) // MOVEABLE | ZEROINIT
		if handle == 0 {
			return fmt.Errorf("无法分配剪贴板内存")
		}
		owned := true
		defer func() {
			if owned {
				globalFree.Call(handle)
			}
		}()
		memory, _, _ := globalLock.Call(handle)
		if memory == 0 {
			return fmt.Errorf("无法写入剪贴板内存")
		}
		copy(unsafe.Slice((*uint16)(unsafe.Pointer(memory)), len(data)), data)
		globalUnlock.Call(handle)
		if ok, _, _ := emptyClipboard.Call(); ok == 0 {
			return fmt.Errorf("无法清空剪贴板")
		}
		if ok, _, _ := setClipboardData.Call(13, handle); ok == 0 {
			return fmt.Errorf("无法写入剪贴板")
		}
		owned = false // Windows now owns the HGLOBAL.
		return nil
	})
}

func clipboardRead(owner uintptr) (string, error) {
	var value string
	err := withClipboard(owner, func() error {
		handle, _, _ := getClipboardData.Call(13) // CF_UNICODETEXT; never interpret HTML.
		if handle == 0 {
			return nil
		}
		size, _, _ := globalSize.Call(handle)
		if size == 0 || size%2 != 0 || size > maxDocumentBytes*2+2 {
			return fmt.Errorf("剪贴板文本过大或无效")
		}
		memory, _, _ := globalLock.Call(handle)
		if memory == 0 {
			return fmt.Errorf("无法读取剪贴板")
		}
		defer globalUnlock.Call(handle)
		data := unsafe.Slice((*uint16)(unsafe.Pointer(memory)), int(size/2))
		end := 0
		for end < len(data) && data[end] != 0 {
			end++
		}
		if end == len(data) {
			return fmt.Errorf("剪贴板文本格式无效")
		}
		value = strings.ReplaceAll(string(utf16.Decode(data[:end])), "\r\n", "\n")
		if len(value) > maxDocumentBytes {
			return fmt.Errorf("剪贴板文本不能超过 8 MiB")
		}
		return nil
	})
	return value, err
}
