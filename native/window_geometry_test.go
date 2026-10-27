package main

import "testing"

func TestNativeResizeCommandDirections(t *testing.T) {
	for index, action := range []string{"resize-left", "resize-right", "resize-top", "resize-top-left", "resize-top-right", "resize-bottom", "resize-bottom-left", "resize-bottom-right"} {
		command, ok := resizeCommand(action)
		if !ok || command != 0xF000|uintptr(index+1) {
			t.Fatalf("%s: invalid system resize command %#x", action, command)
		}
	}
	if _, ok := resizeCommand("close"); ok {
		t.Fatal("unrelated action became a resize")
	}
}

func TestNativeResizeCoordinatesAndDPI(t *testing.T) {
	for _, value := range [][2]int32{{-1500, 400}, {1800, -500}, {0, 0}, {32760, 32760}} {
		packed := packScreenPoint(value[0], value[1])
		if int32(int16(packed&0xffff)) != value[0] || int32(int16((packed>>16)&0xffff)) != value[1] {
			t.Fatalf("screen coordinate corrupted: %v", value)
		}
	}
	for _, value := range [][2]uint32{{96, 4}, {120, 5}, {144, 6}, {192, 8}} {
		if resizeBorder(value[0]) != int32(value[1]) {
			t.Fatalf("incorrect DPI border: %v", value)
		}
	}
	if width, height := minimumWindowSize(192, 1366, 728, false); width != 1366 || height != 728 {
		t.Fatal("minimum window size exceeds the monitor work area")
	}
	if width, height := minimumWindowSize(192, 1366, 728, true); width != 1 || height != 1 {
		t.Fatal("tracking limits must not enlarge a fullscreen window")
	}
}
