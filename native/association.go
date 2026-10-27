package main

import (
	"fmt"
	"strings"
)

const markdownProgID = "Tekaku.Markdown"

// All entries are relative to HKEY_CURRENT_USER. In particular, this plan never
// writes an extension's default value or Windows' protected UserChoice keys.
type associationValue struct{ Key, Name, Value string }

func associationPlan(executable string) ([]associationValue, error) {
	if executable == "" || strings.ContainsAny(executable, "\x00\r\n\"") {
		return nil, fmt.Errorf("无效的程序路径")
	}
	command := `"` + executable + `" "%1"`
	icon := `"` + executable + `",0`
	classes := `Software\Classes\`
	program := classes + markdownProgID
	application := classes + `Applications\Tekaku.exe`
	return []associationValue{
		{program, "", "Markdown 文档 · 手书"},
		{program + `\DefaultIcon`, "", icon},
		{program + `\shell\open\command`, "", command},
		{application, "FriendlyAppName", "手书 Tekaku"},
		{application + `\DefaultIcon`, "", icon},
		{application + `\shell\open\command`, "", command},
		{application + `\SupportedTypes`, ".md", ""},
		{application + `\SupportedTypes`, ".markdown", ""},
		{classes + `.md\OpenWithProgids`, markdownProgID, ""},
		{classes + `.markdown\OpenWithProgids`, markdownProgID, ""},
	}, nil
}
