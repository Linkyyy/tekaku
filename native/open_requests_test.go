package main

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestOpenRequestRoundTripAndActivation(t *testing.T) {
	paths := []string{filepath.Join(t.TempDir(), "中文 文件 & 引号.md"), filepath.Join(t.TempDir(), "second.markdown")}
	packet, err := encodeOpenRequest(paths)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := decodeOpenRequest(packet)
	if err != nil || len(decoded) != len(paths) {
		t.Fatalf("roundtrip failed: %v %v", decoded, err)
	}
	for i := range paths {
		if decoded[i] != paths[i] {
			t.Fatal("path modified by transport")
		}
	}
	packet, err = encodeOpenRequest(nil)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err = decodeOpenRequest(packet)
	if err != nil || len(decoded) != 0 {
		t.Fatal("launch without files must activate, not create an empty tab")
	}
}
func TestOpenRequestRejectsMalformedPackets(t *testing.T) {
	many := make([]string, maxOpenRequestPaths+1)
	for i := range many {
		many[i] = filepath.Join(t.TempDir(), "test.md")
	}
	requests := [][]byte{nil, []byte(`{`), []byte(`{"version":2,"paths":[]}`), []byte(`{"version":1,"paths":["relative.md"]}`), []byte(`{"version":1,"paths":["\u0000"]}`), []byte{0xff}, []byte(strings.Repeat(" ", maxOpenRequestBytes+1))}
	packet, _ := json.Marshal(openRequest{Version: 1, Paths: many})
	requests = append(requests, packet)
	for _, packet := range requests {
		if _, err := decodeOpenRequest(packet); err == nil {
			t.Fatalf("accepted malformed request: %.40q", packet)
		}
	}
}
func TestOpenQueuePreservesStartupOrderAndCopiesArguments(t *testing.T) {
	var queue openRequestQueue
	paths := []string{"first.md", "second.md"}
	if !queue.add(paths) {
		t.Fatal("startup request rejected")
	}
	paths[0] = "modified.md"
	called := 0
	queue.setNotify(func() { called++ })
	if called != 1 {
		t.Fatal("pending startup files were not announced when UI attached")
	}
	for _, want := range []string{"first.md", "second.md"} {
		got, ok := queue.next()
		if !ok || got != want {
			t.Fatalf("got %q want %q", got, want)
		}
	}
	if _, ok := queue.next(); ok {
		t.Fatal("duplicate delivery")
	}
	queue.add(nil)
	if called != 2 {
		t.Fatal("activation-only request was not announced")
	}
}
func TestOpenQueueCapacityIsAtomicAndNotificationDoesNotHoldLock(t *testing.T) {
	var queue openRequestQueue
	queue.add(make([]string, maxPendingOpenPaths))
	if queue.add([]string{"overflow.md"}) {
		t.Fatal("queue exceeded its limit")
	}
	count := 0
	for {
		_, ok := queue.next()
		if !ok {
			break
		}
		count++
	}
	if count != maxPendingOpenPaths {
		t.Fatal("overflow partially modified queue")
	}
	queue.setNotify(func() { queue.next() })
	if !queue.add([]string{"reentrant.md"}) {
		t.Fatal("notify callback could not consume safely")
	}
	if _, ok := queue.next(); ok {
		t.Fatal("notify failed to consume")
	}
}
func TestOpenQueueConcurrentRequestsDoNotLoseFiles(t *testing.T) {
	var queue openRequestQueue
	var workers sync.WaitGroup
	for n := 0; n < 100; n++ {
		workers.Add(1)
		go func(n int) {
			defer workers.Done()
			if !queue.add([]string{fmt.Sprintf("%d.md", n)}) {
				t.Error("unexpected full queue")
			}
		}(n)
	}
	workers.Wait()
	seen := map[string]bool{}
	for {
		path, ok := queue.next()
		if !ok {
			break
		}
		if seen[path] {
			t.Fatal("duplicate path")
		}
		seen[path] = true
	}
	if len(seen) != 100 {
		t.Fatalf("lost queued files: %d", len(seen))
	}
}
