package main

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"unicode/utf8"
)

const (
	maxOpenRequestBytes = 256 * 1024
	maxOpenRequestPaths = 128
	maxPendingOpenPaths = 1024
)

type openRequest struct {
	Version int      `json:"version"`
	Paths   []string `json:"paths"`
}

func encodeOpenRequest(paths []string) ([]byte, error) {
	data, err := json.Marshal(openRequest{Version: 1, Paths: paths})
	if err != nil {
		return nil, err
	}
	if _, err := decodeOpenRequest(data); err != nil {
		return nil, err
	}
	return data, nil
}

func decodeOpenRequest(data []byte) ([]string, error) {
	if len(data) == 0 || len(data) > maxOpenRequestBytes || !utf8.Valid(data) {
		return nil, fmt.Errorf("打开请求过大或编码无效")
	}
	var request openRequest
	if err := json.Unmarshal(data, &request); err != nil {
		return nil, fmt.Errorf("无效的文件打开请求")
	}
	if request.Version != 1 || len(request.Paths) > maxOpenRequestPaths {
		return nil, fmt.Errorf("不支持此打开请求或文件数量过多")
	}
	for _, path := range request.Paths {
		if !filepath.IsAbs(path) || strings.ContainsRune(path, 0) {
			return nil, fmt.Errorf("文件路径必须是有效的绝对路径")
		}
	}
	return request.Paths, nil
}

// Files remain queued until the frontend explicitly pulls them. Notifications
// may arrive before the embedded page or while a modal dialog is open.
type openRequestQueue struct {
	mu     sync.Mutex
	paths  []string
	notify func()
}

func (q *openRequestQueue) add(paths []string) bool {
	q.mu.Lock()
	if len(q.paths)+len(paths) > maxPendingOpenPaths {
		q.mu.Unlock()
		return false
	}
	q.paths = append(q.paths, paths...)
	notify := q.notify
	q.mu.Unlock()
	if notify != nil {
		notify()
	}
	return true
}
func (q *openRequestQueue) setNotify(notify func()) {
	q.mu.Lock()
	q.notify = notify
	pending := len(q.paths) > 0
	q.mu.Unlock()
	if pending && notify != nil {
		notify()
	}
}
func (q *openRequestQueue) next() (string, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if len(q.paths) == 0 {
		return "", false
	}
	path := q.paths[0]
	q.paths[0] = ""
	q.paths = q.paths[1:]
	return path, true
}
