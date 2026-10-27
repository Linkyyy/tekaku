package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestReadUTF8AndBOM(t *testing.T) {
	path := filepath.Join(t.TempDir(), "中文.md")
	if err := os.WriteFile(path, append([]byte{0xef, 0xbb, 0xbf}, []byte("# 中文\n\n**内容**")...), 0600); err != nil {
		t.Fatal(err)
	}
	doc, err := readDocument(path)
	if err != nil {
		t.Fatal(err)
	}
	if doc.Name != "中文.md" || doc.Content != "# 中文\n\n**内容**" {
		t.Fatalf("wrong document: %+v", doc)
	}
}
func TestRejectsNonUTF8AndLargeFiles(t *testing.T) {
	path := filepath.Join(t.TempDir(), "invalid.md")
	if err := os.WriteFile(path, []byte{0xff, 0xfe, 0x41, 0}, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := readDocument(path); err == nil {
		t.Fatal("expected encoding rejection")
	}
	if err := os.WriteFile(path, bytes.Repeat([]byte{'x'}, maxDocumentBytes+1), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := readDocument(path); err == nil {
		t.Fatal("expected size rejection")
	}
}
func TestReplaceExistingAndCleanupOnFailure(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "existing.md")
	if err := os.WriteFile(path, []byte("original"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := replaceFile(path, []byte("新的内容")); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(path)
	if string(data) != "新的内容" {
		t.Fatalf("not replaced: %s", data)
	}
	targetDir := filepath.Join(dir, "folder")
	if err := os.Mkdir(targetDir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := replaceFile(targetDir, []byte("cannot replace directory")); err == nil {
		t.Fatal("expected replacement failure")
	}
	entries, _ := filepath.Glob(filepath.Join(dir, ".tekaku-*.tmp"))
	if len(entries) != 0 {
		t.Fatalf("temporary files leaked: %v", entries)
	}
	data, _ = os.ReadFile(path)
	if string(data) != "新的内容" {
		t.Fatal("unrelated original file was modified")
	}
}
func TestPreferencesRoundtripAndCorruptRecovery(t *testing.T) {
	path := filepath.Join(t.TempDir(), "preferences.json")
	prefs := map[string]string{"tekaku-dark": "true", "tekaku-draft": "{\"content\":\"中文\"}"}
	if err := savePreferences(path, prefs); err != nil {
		t.Fatal(err)
	}
	got := loadPreferences(path)
	if got["tekaku-draft"] != prefs["tekaku-draft"] {
		t.Fatalf("lost draft: %v", got)
	}
	if err := os.WriteFile(path, []byte("broken JSON"), 0600); err != nil {
		t.Fatal(err)
	}
	if len(loadPreferences(path)) != 0 {
		t.Fatal("expected fresh preferences after corrupt file")
	}
}
