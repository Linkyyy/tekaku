package main

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

var pngData, _ = base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1gAAAABJRU5ErkJggg==")

func TestImageAttachmentsResolveAndSaveAs(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "中文 笔记.md")
	uri := "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngData)
	content := "# 图文\n\n![说明](" + uri + ")\n\n![同一张](" + uri + ")"
	saved, err := saveDocumentImages(content, "", path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(saved, "data:image") {
		t.Fatal("inline data was not extracted")
	}
	matches := imageDestinations(saved)
	if len(matches) != 2 {
		t.Fatalf("image count %d", len(matches))
	}
	ref := saved[matches[0][0]:matches[0][1]]
	if !strings.Contains(ref, ".assets/") {
		t.Fatalf("not a relative attachment: %s", ref)
	}
	assets, err := filepath.Glob(filepath.Join(root, "*.assets", "*.png"))
	if err != nil || len(assets) != 1 {
		t.Fatalf("duplicate attachments: %v %v", assets, err)
	}
	if resolveImages(path, []string{ref})[ref] != uri {
		t.Fatal("relative image could not be hydrated")
	}
	destDir := t.TempDir()
	dest := filepath.Join(destDir, "副本.md")
	if _, err := saveDocumentImages(saved, path, dest); err != nil {
		t.Fatal(err)
	}
	if resolveImages(dest, []string{ref})[ref] != uri {
		t.Fatal("save-as did not copy attachment")
	}
}
func TestImagesInsideCodeRemainLiteral(t *testing.T) {
	uri := "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngData)
	content := "```md\n![example](" + uri + ")\n```\n\n`![inline](" + uri + ")`\n"
	path := filepath.Join(t.TempDir(), "code.md")
	saved, err := saveDocumentImages(content, "", path)
	if err != nil {
		t.Fatal(err)
	}
	if saved != content {
		t.Fatal("code examples were rewritten")
	}
}
func TestRejectImageTraversalAndAssetSymlink(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	path := filepath.Join(root, "doc.md")
	if err := os.WriteFile(filepath.Join(outside, "private.png"), pngData, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := localImagePath(path, "../private.png"); err == nil {
		t.Fatal("allowed parent traversal")
	}
	if err := os.Symlink(outside, filepath.Join(root, "doc.assets")); err != nil {
		t.Skip("symlink not available")
	}
	uri := "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngData)
	if _, err := saveDocumentImages("![image]("+uri+")", "", path); err == nil {
		t.Fatal("wrote through an external symlink")
	}
	files, _ := os.ReadDir(outside)
	if len(files) != 1 {
		t.Fatal("modified files outside the document directory")
	}
}
func TestSaveAsDoesNotOverwriteUnrelatedAsset(t *testing.T) {
	source := t.TempDir()
	dest := t.TempDir()
	if err := os.WriteFile(filepath.Join(source, "pic.png"), pngData, 0600); err != nil {
		t.Fatal(err)
	}
	original := []byte("user-owned content")
	if err := os.WriteFile(filepath.Join(dest, "pic.png"), original, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := saveDocumentImages("![pic](pic.png)", filepath.Join(source, "a.md"), filepath.Join(dest, "b.md")); err == nil {
		t.Fatal("expected collision error")
	}
	data, _ := os.ReadFile(filepath.Join(dest, "pic.png"))
	if string(data) != string(original) {
		t.Fatal("overwrote unrelated content")
	}
}
