//go:build windows

// Adapted for Tekaku from github.com/jchv/go-webview2 (MIT, see ../LICENSE).
package webviewloader

import (
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

const LoaderSHA256 = "c4674acf95f0800793a4a6d61132adf5dfa694c218e482d86093494c4e84100a"

var (
	loadOnce sync.Once
	module   *windows.DLL
	loadErr  error
)

func load() (*windows.DLL, error) {
	loadOnce.Do(func() { module, loadErr = loadVerified() })
	return module, loadErr
}

func loadVerified() (*windows.DLL, error) {
	executable, err := os.Executable()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(filepath.Dir(executable), "WebView2Loader.dll")
	name, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return nil, err
	}
	// Deny replacement or modification between verification and LoadLibraryEx.
	handle, err := windows.CreateFile(name, windows.GENERIC_READ, windows.FILE_SHARE_READ, nil, windows.OPEN_EXISTING, windows.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		return nil, fmt.Errorf("请完整解压下载包，保留 Tekaku.exe 旁的 WebView2Loader.dll：%w", err)
	}
	file := os.NewFile(uintptr(handle), path)
	defer file.Close()
	hash := sha256.New()
	if _, err = io.Copy(hash, io.LimitReader(file, 1<<20)); err != nil {
		return nil, err
	}
	if fmt.Sprintf("%x", hash.Sum(nil)) != LoaderSHA256 {
		return nil, fmt.Errorf("WebView2Loader.dll 校验失败，请从官方 GitHub 下载完整压缩包")
	}
	// This SDK loader imports Windows components only; never search CWD or PATH.
	library, err := windows.LoadLibraryEx(path, 0, windows.LOAD_LIBRARY_SEARCH_SYSTEM32)
	if err != nil {
		return nil, fmt.Errorf("无法加载已校验的 WebView2Loader.dll：%w", err)
	}
	return &windows.DLL{Name: path, Handle: library}, nil
}

func proc(name string) (*windows.Proc, error) {
	library, err := load()
	if err != nil {
		return nil, err
	}
	return library.FindProc(name)
}

func CompareBrowserVersions(v1, v2 string) (int, error) {
	a, err := windows.UTF16PtrFromString(v1)
	if err != nil {
		return 0, err
	}
	b, err := windows.UTF16PtrFromString(v2)
	if err != nil {
		return 0, err
	}
	compare, err := proc("CompareBrowserVersions")
	if err != nil {
		return 0, err
	}
	var result int32
	hr, _, _ := compare.Call(uintptr(unsafe.Pointer(a)), uintptr(unsafe.Pointer(b)), uintptr(unsafe.Pointer(&result)))
	if hr&0x80000000 != 0 {
		return 0, fmt.Errorf("CompareBrowserVersions: HRESULT 0x%X", hr)
	}
	return int(result), nil
}

func GetInstalledVersion() (string, error) {
	getVersion, err := proc("GetAvailableCoreWebView2BrowserVersionString")
	if err != nil {
		return "", err
	}
	var result *uint16
	hr, _, _ := getVersion.Call(0, uintptr(unsafe.Pointer(&result)))
	defer windows.CoTaskMemFree(unsafe.Pointer(result))
	if hr&0x80000000 != 0 {
		if hr&0xffff == uintptr(windows.ERROR_FILE_NOT_FOUND) {
			return "", nil
		}
		return "", fmt.Errorf("GetAvailableCoreWebView2BrowserVersionString: HRESULT 0x%X", hr)
	}
	return windows.UTF16PtrToString(result), nil
}

func CreateCoreWebView2EnvironmentWithOptions(browserExecutableFolder, userDataFolder *uint16, environmentOptions, completedHandler uintptr) (uintptr, error) {
	create, err := proc("CreateCoreWebView2EnvironmentWithOptions")
	if err != nil {
		return 0, err
	}
	hr, _, _ := create.Call(uintptr(unsafe.Pointer(browserExecutableFolder)), uintptr(unsafe.Pointer(userDataFolder)), environmentOptions, completedHandler)
	return hr, nil
}
