# 手书 Tekaku · 官网

一个轻巧、安静的 Windows Markdown 编辑器的中文产品官网。

纯静态 HTML / CSS / JavaScript，**没有构建步骤、运行依赖、外部字体、追踪脚本或账号功能**。图片均随站点提供；四种编辑器皮肤预览来自实际软件界面的浏览器渲染截图。界面功能示意已明确标注。

## 预览

![官网桌面预览](./assets/website-desktop.webp)

直接打开 `index.html`，或在本目录运行任意静态文件服务器：

```sh
python3 -m http.server 8080
```

打开 `http://localhost:8080`。适配桌面、平板、手机，支持键盘访问和减少动态效果设置。不需要 npm install。

## GitHub Pages

官网文件位于仓库的 **gh-pages 分支根目录**，可直接作为 Pages 发布目录：

1. 打开 [仓库 Settings → Pages](https://github.com/Linkyyy/tekaku/settings/pages)。
2. Source 选择 **Deploy from a branch**。
3. Branch 选择 **gh-pages**，目录选择 **/ (root)**，保存。

启用并部署成功后的标准地址为 `https://linkyyy.github.io/tekaku/`。仅推送分支不代表 GitHub Pages 已启用；以 Pages 设置页的部署状态为准。

网站全部资源使用相对路径，支持 `/tekaku/` 项目子路径，也可部署至其他静态托管服务。

## 下载与维护

- [Windows v0.5.0 便携包（约 1.8 MB）](https://github.com/Linkyyy/tekaku/raw/refs/heads/downloads/windows-v0.5.0/Tekaku-0.5.0-windows-x64.zip)
- [版本说明](https://github.com/Linkyyy/tekaku/tree/downloads/windows-v0.5.0)
- 下载 ZIP 的 SHA-256：`98779fa139182a2ac1f149687ebe516d12aeea789e63a98b774c999ceb41d003`

新版本发布时，更新 `index.html` 中的版本号、下载链接、体积、最近更新内容和 SHA-256，以及本说明。替换皮肤截图时保留 `assets/editor-{white,paper,sage,night}.webp` 文件名。更换域名后，更新 `og:image` 的绝对地址。

桌面端使用系统 WebView2，支持 Windows 10 / 11 x64。1.8 MB 是 ZIP 体积，非内存占用；官网 FAQ 已注明依赖、图片附件移动方式、未签名和 Markdown 支持范围。
