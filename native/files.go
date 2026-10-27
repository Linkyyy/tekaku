package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"unicode/utf8"
)

const maxDocumentBytes = 8 * 1024 * 1024

type document struct {
	Name    string `json:"name"`
	Content string `json:"content"`
	Path    string `json:"path,omitempty"`
}

func readDocument(path string) (*document, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxDocumentBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxDocumentBytes {
		return nil, fmt.Errorf("文件超过 8 MB，请用大文件编辑器打开")
	}
	data = bytes.TrimPrefix(data, []byte{0xef, 0xbb, 0xbf})
	if !utf8.Valid(data) {
		return nil, fmt.Errorf("文件不是 UTF-8 编码，请先转换编码")
	}
	return &document{Name: filepath.Base(path), Content: string(data), Path: path}, nil
}

func replaceFile(path string, content []byte) error {
	file, err := os.CreateTemp(filepath.Dir(path), ".tekaku-*.tmp")
	if err != nil {
		return err
	}
	temp := file.Name()
	defer os.Remove(temp)
	if _, err = file.Write(content); err != nil {
		file.Close()
		return err
	}
	if err = file.Sync(); err != nil {
		file.Close()
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	return os.Rename(temp, path)
}

func loadPreferences(path string) map[string]string {
	prefs := map[string]string{}
	data, err := os.ReadFile(path)
	if err == nil {
		_ = json.Unmarshal(data, &prefs)
	}
	if prefs == nil {
		prefs = map[string]string{}
	}
	return prefs
}

func savePreferences(path string, prefs map[string]string) error {
	data, err := json.Marshal(prefs)
	if err != nil {
		return err
	}
	return replaceFile(path, data)
}
