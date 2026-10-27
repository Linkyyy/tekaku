package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const maxImageBytes = 5 * 1024 * 1024
const maxEditorPayload = 48 * 1024 * 1024

var imageSyntax = regexp.MustCompile(`!\[(?:\\.|[^\]\\\n])*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+"(?:\\.|[^"\\])*")?\s*\)`)

// Match destinations while excluding fenced blocks and inline code spans.
func imageDestinations(content string) [][2]int {
	var result [][2]int
	fence := byte(0)
	fenceLength := 0
	offset := 0
	for _, line := range strings.SplitAfter(content, "\n") {
		trim := strings.TrimLeft(line, " \t")
		if len(trim) > 0 && (trim[0] == '`' || trim[0] == '~') {
			n := 0
			for n < len(trim) && trim[n] == trim[0] {
				n++
			}
			if n >= 3 {
				if fence == 0 {
					fence = trim[0]
					fenceLength = n
				} else if fence == trim[0] && n >= fenceLength {
					fence = 0
				}
				offset += len(line)
				continue
			}
		}
		if fence == 0 {
			for _, m := range imageSyntax.FindAllStringSubmatchIndex(line, -1) {
				ticks := 0
				for i := 0; i < m[0]; {
					if line[i] != '`' {
						i++
						continue
					}
					n := 1
					for i+n < m[0] && line[i+n] == '`' {
						n++
					}
					if ticks == 0 {
						ticks = n
					} else if ticks == n {
						ticks = 0
					}
					i += n
				}
				if ticks != 0 {
					continue
				}
				start, end := m[2], m[3]
				if line[start] == '<' {
					start++
					end--
				}
				result = append(result, [2]int{offset + start, offset + end})
			}
		}
		offset += len(line)
	}
	return result
}
func imageKind(data []byte) (string, string, error) {
	if len(data) > maxImageBytes {
		return "", "", fmt.Errorf("单张图片不能超过 5 MB")
	}
	switch {
	case bytes.HasPrefix(data, []byte{137, 80, 78, 71, 13, 10, 26, 10}):
		return "image/png", "png", nil
	case bytes.HasPrefix(data, []byte{255, 216, 255}):
		return "image/jpeg", "jpg", nil
	case bytes.HasPrefix(data, []byte("GIF87a")) || bytes.HasPrefix(data, []byte("GIF89a")):
		return "image/gif", "gif", nil
	case len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP":
		return "image/webp", "webp", nil
	case bytes.HasPrefix(data, []byte("BM")):
		return "image/bmp", "bmp", nil
	}
	if len(data) > 12 && string(data[4:8]) == "ftyp" && (string(data[8:12]) == "avif" || string(data[8:12]) == "avis") {
		return "image/avif", "avif", nil
	}
	decoder := xml.NewDecoder(bytes.NewReader(data))
	for {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		if el, ok := token.(xml.StartElement); ok {
			if el.Name.Local == "svg" {
				return "image/svg+xml", "svg", nil
			}
			break
		}
	}
	return "", "", fmt.Errorf("不支持或无效的图片格式")
}
func readImage(path string) ([]byte, string, string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, "", "", err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxImageBytes+1))
	if err != nil {
		return nil, "", "", err
	}
	mime, ext, err := imageKind(data)
	return data, mime, ext, err
}
func localImagePath(documentPath, ref string) (string, error) {
	if documentPath == "" {
		return "", fmt.Errorf("请先保存文档")
	}
	u, err := url.Parse(strings.ReplaceAll(ref, "\\", "/"))
	if err != nil {
		return "", err
	}
	decoded := u.Path
	if u.Scheme != "" || u.Host != "" {
		return "", fmt.Errorf("不是相对图片路径")
	}
	if strings.Contains(decoded, ":") || strings.HasPrefix(decoded, "/") {
		return "", fmt.Errorf("仅支持文档目录内的相对图片路径")
	}
	root, err := filepath.EvalSymlinks(filepath.Dir(documentPath))
	if err != nil {
		return "", err
	}
	path, err := filepath.EvalSymlinks(filepath.Join(root, filepath.FromSlash(decoded)))
	if err != nil {
		return "", err
	}
	relative, err := filepath.Rel(root, path)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("图片不在文档目录内")
	}
	return path, nil
}
func resolveImages(documentPath string, refs []string) map[string]string {
	result := map[string]string{}
	if len(refs) > 100 {
		refs = refs[:100]
	}
	total := 0
	for _, ref := range refs {
		path, err := localImagePath(documentPath, ref)
		if err != nil {
			continue
		}
		data, mime, _, err := readImage(path)
		if err != nil {
			continue
		}
		total += len(data)
		if total > 32*1024*1024 {
			break
		}
		result[ref] = "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data)
	}
	return result
}
func assetTarget(root, relative string) (string, error) {
	realRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", err
	}
	clean := filepath.Clean(relative)
	if filepath.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("附件路径超出文档目录")
	}
	target := filepath.Join(realRoot, clean)
	ancestor := target
	for {
		if _, statErr := os.Lstat(ancestor); statErr == nil {
			actual, resolveErr := filepath.EvalSymlinks(ancestor)
			if resolveErr != nil {
				return "", resolveErr
			}
			rel, relErr := filepath.Rel(realRoot, actual)
			if relErr != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
				return "", fmt.Errorf("附件目录指向文档外部")
			}
			break
		} else if !os.IsNotExist(statErr) {
			return "", statErr
		}
		parent := filepath.Dir(ancestor)
		if parent == ancestor {
			return "", fmt.Errorf("附件路径无效")
		}
		ancestor = parent
	}
	return target, nil
}
func writeAsset(path string, data []byte) (bool, error) {
	if existing, err := os.ReadFile(path); err == nil {
		if bytes.Equal(existing, data) {
			return false, nil
		}
		return false, fmt.Errorf("目标位置已有不同的图片：%s", filepath.Base(path))
	} else if !os.IsNotExist(err) {
		return false, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return false, err
	}
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		return false, err
	}
	_, writeErr := file.Write(data)
	closeErr := file.Close()
	if writeErr != nil || closeErr != nil {
		os.Remove(path)
		if writeErr != nil {
			return false, writeErr
		}
		return false, closeErr
	}
	return true, nil
}
func saveDocumentImages(content, oldPath, newPath string) (result string, err error) {
	if len(content) > maxEditorPayload {
		return "", fmt.Errorf("待保存内容过大，请减少图片数量")
	}
	var created []string
	defer func() {
		if err != nil {
			for _, p := range created {
				os.Remove(p)
			}
		}
	}()
	var out strings.Builder
	offset := 0
	for _, segment := range imageDestinations(content) {
		src := content[segment[0]:segment[1]]
		replacement := src
		if strings.HasPrefix(src, "data:image/") {
			header, encoded, ok := strings.Cut(src, ",")
			if !ok || !strings.HasSuffix(header, ";base64") {
				return "", fmt.Errorf("图片数据无效")
			}
			data, decodeErr := base64.StdEncoding.DecodeString(encoded)
			if decodeErr != nil {
				return "", decodeErr
			}
			_, ext, kindErr := imageKind(data)
			if kindErr != nil {
				return "", kindErr
			}
			hash := sha256.Sum256(data)
			folder := strings.TrimSuffix(filepath.Base(newPath), filepath.Ext(newPath)) + ".assets"
			name := fmt.Sprintf("%x.%s", hash[:12], ext)
			target, targetErr := assetTarget(filepath.Dir(newPath), filepath.Join(folder, name))
			if targetErr != nil {
				return "", targetErr
			}
			added, writeErr := writeAsset(target, data)
			if writeErr != nil {
				return "", writeErr
			}
			if added {
				created = append(created, target)
			}
			replacement = (&url.URL{Path: filepath.ToSlash(filepath.Join(folder, name))}).EscapedPath()
		} else if oldPath != "" && filepath.Clean(filepath.Dir(oldPath)) != filepath.Clean(filepath.Dir(newPath)) && !strings.Contains(src, ":") && !strings.HasPrefix(src, "/") {
			source, readErr := localImagePath(oldPath, src)
			// Preserve an already unresolved reference verbatim rather than guessing its contents.
			if readErr == nil {
				data, _, _, imageErr := readImage(source)
				if imageErr != nil {
					return "", imageErr
				}
				parsed, _ := url.Parse(strings.ReplaceAll(src, "\\", "/"))
				target, targetErr := assetTarget(filepath.Dir(newPath), filepath.FromSlash(parsed.Path))
				if targetErr != nil {
					return "", targetErr
				}
				added, writeErr := writeAsset(target, data)
				if writeErr != nil {
					return "", writeErr
				}
				if added {
					created = append(created, target)
				}
			}
		}
		out.WriteString(content[offset:segment[0]])
		out.WriteString(replacement)
		offset = segment[1]
	}
	out.WriteString(content[offset:])
	result = out.String()
	if len(result) > maxDocumentBytes {
		return "", fmt.Errorf("Markdown 文档超过 8 MB")
	}
	if err = replaceFile(newPath, []byte(result)); err != nil {
		return "", err
	}
	return result, nil
}
