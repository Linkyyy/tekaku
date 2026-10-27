package main

// Windows SC_SIZE direction values are not the same as WM_NCHITTEST values.
func resizeCommand(action string) (uintptr, bool) {
	directions := map[string]uintptr{"resize-left": 1, "resize-right": 2, "resize-top": 3, "resize-top-left": 4, "resize-top-right": 5, "resize-bottom": 6, "resize-bottom-left": 7, "resize-bottom-right": 8}
	direction, ok := directions[action]
	return 0xF000 | direction, ok
}

func packScreenPoint(x, y int32) uintptr { return uintptr(uint32(uint16(x)) | uint32(uint16(y))<<16) }

func resizeBorder(dpi uint32) int32 {
	if dpi < 96 {
		dpi = 96
	}
	return int32((4*dpi + 48) / 96)
}

func minimumWindowSize(dpi uint32, workWidth, workHeight int32, fullscreen bool) (int32, int32) {
	if fullscreen {
		return 1, 1
	}
	if dpi < 96 {
		dpi = 96
	}
	return min(720*int32(dpi)/96, workWidth), min(500*int32(dpi)/96, workHeight)
}
