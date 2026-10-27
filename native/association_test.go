package main

import (
	"strings"
	"testing"
)

func TestAssociationPlanPreservesWindowsDefaults(t *testing.T) {
	exe := `C:\Users\写作 用户\手书 0.8\Tekaku.exe`
	plan, err := associationPlan(exe)
	if err != nil {
		t.Fatal(err)
	}
	commands, extensions := 0, 0
	for _, entry := range plan {
		if !strings.HasPrefix(entry.Key, `Software\Classes\`) || strings.Contains(entry.Key, "UserChoice") {
			t.Fatalf("unexpected registry key: %s", entry.Key)
		}
		if strings.HasSuffix(entry.Key, `\command`) {
			commands++
			if entry.Value != `"`+exe+`" "%1"` {
				t.Fatalf("incorrect shell quoting: %s", entry.Value)
			}
		}
		if strings.HasPrefix(entry.Key, `Software\Classes\.`) {
			extensions++
			if !strings.HasSuffix(entry.Key, `\OpenWithProgids`) || entry.Name != markdownProgID {
				t.Fatal("would modify an extension default")
			}
		}
	}
	if commands != 2 || extensions != 2 {
		t.Fatalf("missing Open With entries: commands=%d extensions=%d", commands, extensions)
	}
}

func TestAssociationPlanRejectsInvalidCommandPaths(t *testing.T) {
	for _, path := range []string{"", "a\x00b", "a\r\nb", `C:\a"b.exe`} {
		if _, err := associationPlan(path); err == nil {
			t.Errorf("accepted %q", path)
		}
	}
}
