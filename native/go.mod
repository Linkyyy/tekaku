module tekaku.local/desktop

go 1.27.3

require (
	github.com/jchv/go-webview2 v0.0.0-20260205173254-56598839c808
	golang.org/x/sys v0.0.0-20210218145245-beda7e5e158e
)

replace github.com/jchv/go-webview2 => ./third_party/go-webview2
