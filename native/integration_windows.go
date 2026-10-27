//go:build windows

package main

import (
	"fmt"
	"os"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

var shell32 = windows.NewLazySystemDLL("shell32.dll")

type integrationState struct {
	Registered bool   `json:"registered"`
	Message    string `json:"message"`
}

func associationRegistered(exe string) bool {
	plan, err := associationPlan(exe)
	if err != nil {
		return false
	}
	for _, entry := range plan {
		key, err := registry.OpenKey(registry.CURRENT_USER, entry.Key, registry.QUERY_VALUE)
		if err != nil {
			return false
		}
		value, _, err := key.GetStringValue(entry.Name)
		key.Close()
		if err != nil || !strings.EqualFold(value, entry.Value) {
			return false
		}
	}
	return true
}

func notifyAssociations() { shell32.NewProc("SHChangeNotify").Call(0x08000000, 0, 0, 0) }

func registerAssociation(exe string) error {
	plan, err := associationPlan(exe)
	if err != nil {
		return err
	}
	for _, entry := range plan {
		key, _, err := registry.CreateKey(registry.CURRENT_USER, entry.Key, registry.SET_VALUE)
		if err != nil {
			return fmt.Errorf("无法添加文件关联：%w", err)
		}
		err = key.SetStringValue(entry.Name, entry.Value)
		key.Close()
		if err != nil {
			return fmt.Errorf("无法写入文件关联：%w", err)
		}
	}
	notifyAssociations()
	return nil
}

// Only delete our own program keys and named OpenWithProgids values. Never
// delete .md/.markdown keys, another program's entries, or a user's default.
func removeAssociation(exe string) error {
	plan, err := associationPlan(exe)
	if err != nil {
		return err
	}
	command := plan[2].Value
	for _, path := range []string{`Software\Classes\` + markdownProgID, `Software\Classes\Applications\Tekaku.exe`} {
		key, err := registry.OpenKey(registry.CURRENT_USER, path+`\shell\open\command`, registry.QUERY_VALUE)
		if err == registry.ErrNotExist {
			continue
		}
		if err != nil {
			return err
		}
		value, _, err := key.GetStringValue("")
		key.Close()
		if err != nil {
			return err
		}
		if !strings.EqualFold(command, value) {
			return fmt.Errorf("关联已指向另一份手书，请从该程序中移除")
		}
	}
	for _, extension := range []string{".md", ".markdown"} {
		key, err := registry.OpenKey(registry.CURRENT_USER, `Software\Classes\`+extension+`\OpenWithProgids`, registry.SET_VALUE)
		if err == registry.ErrNotExist {
			continue
		}
		if err != nil {
			return err
		}
		err = key.DeleteValue(markdownProgID)
		key.Close()
		if err != nil && err != registry.ErrNotExist {
			return err
		}
	}
	for _, path := range []string{`Software\Classes\` + markdownProgID, `Software\Classes\Applications\Tekaku.exe`} {
		if err := deleteOwnRegistryTree(path); err != nil {
			return err
		}
	}
	notifyAssociations()
	return nil
}

func deleteOwnRegistryTree(path string) error {
	key, err := registry.OpenKey(registry.CURRENT_USER, path, registry.ENUMERATE_SUB_KEYS)
	if err == registry.ErrNotExist {
		return nil
	}
	if err != nil {
		return err
	}
	names, err := key.ReadSubKeyNames(-1)
	key.Close()
	if err != nil {
		return err
	}
	for _, name := range names {
		if err := deleteOwnRegistryTree(path + `\` + name); err != nil {
			return err
		}
	}
	err = registry.DeleteKey(registry.CURRENT_USER, path)
	if err == registry.ErrNotExist {
		return nil
	}
	return err
}

func executablePath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("无法定位程序：%w", err)
	}
	return exe, nil
}

func setApplicationID() {
	if proc := shell32.NewProc("SetCurrentProcessExplicitAppUserModelID"); proc.Find() == nil {
		proc.Call(uintptr(unsafe.Pointer(text("Linkyyy.Tekaku"))))
	}
}
