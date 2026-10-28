//go:build windows

package main

import (
	"fmt"
	"golang.org/x/sys/windows"
	"path/filepath"
	"runtime"
	"testing"
	"unsafe"
)

// Uses the actual User32 COPYDATA route. The Linux release environment only
// cross-compiles this test; it must be executed on Windows to verify delivery.
func TestWindowsOpenRequestMessageDelivery(t *testing.T) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	if unsafe.Sizeof(uintptr(0)) == 8 && (unsafe.Sizeof(instanceWindowClass{}) != 80 || unsafe.Sizeof(instanceCopyData{}) != 24 || unsafe.Offsetof(instanceCopyData{}.Data) != 16) {
		t.Fatal("Windows x64 ABI layout mismatch")
	}
	instance := &appInstance{}
	if err := instance.createRelay(fmt.Sprintf("Linkyyy.Tekaku.Test.%d", windows.GetCurrentProcessId())); err != nil {
		t.Fatal(err)
	}
	defer instanceDestroyWindow.Call(instance.relay)
	paths := []string{filepath.Join(t.TempDir(), "中文 文件.md"), filepath.Join(t.TempDir(), "second.md")}
	packet, err := encodeOpenRequest(paths)
	if err != nil {
		t.Fatal(err)
	}
	data := instanceCopyData{Kind: openRequestMessageKind, Size: uint32(len(packet)), Data: uintptr(unsafe.Pointer(&packet[0]))}
	var accepted uintptr
	sent, _, err := instanceSendMessage.Call(instance.relay, 0x004a, 0, uintptr(unsafe.Pointer(&data)), 3, 3000, uintptr(unsafe.Pointer(&accepted)))
	runtime.KeepAlive(packet)
	if sent == 0 || accepted != 1 {
		t.Fatalf("request not accepted: %v", err)
	}
	for _, want := range paths {
		got, ok := instance.queue.next()
		if !ok || got != want {
			t.Fatalf("file not queued: %q", got)
		}
	}
}
