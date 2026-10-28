(() => {
  const descriptions = {
    slate: '灰蓝 · 默认主题，柔和清晰的写作空间。',
    white: '纯白 · 干净明亮，留住文字的本色。',
    paper: '纸笺 · 柔和暖色，像在纸上慢慢书写。',
    sage: '青苔 · 清新自然，给思绪一点绿意。',
    night: '深夜 · 沉静深色，陪伴安静的夜晚。',
  };
  const names = { slate: '灰蓝', white: '纯白', paper: '纸笺', sage: '青苔', night: '深夜' };
  const image = document.querySelector('#theme-image');
  const preview = document.querySelector('.theme-preview');
  const caption = document.querySelector('#theme-caption');
  const buttons = [...document.querySelectorAll('[data-theme]')];
  let request = 0;

  // Only the screenshot changes: this is a preview of the desktop app's skins.
  for (const button of buttons) {
    button.addEventListener('click', async () => {
      const current = ++request;
      const theme = button.dataset.theme;
      const next = new Image();
      next.src = `./assets/editor-${theme}.webp`;
      preview.setAttribute('aria-busy', 'true');
      try {
        await next.decode();
        if (current !== request) return;
        image.src = next.src;
        image.alt = `${names[theme]}皮肤的手书编辑器真实截图`;
        preview.dataset.previewTheme = theme;
        caption.textContent = descriptions[theme];
        for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
      } catch {
        if (current === request) caption.textContent = '预览图片暂时未能加载，请稍后再试。';
      } finally {
        if (current === request) preview.removeAttribute('aria-busy');
      }
    });
  }

  const copyButton = document.querySelector('#copy-checksum');
  const checksum = document.querySelector('#checksum');
  const copyStatus = document.querySelector('#copy-status');
  let resetLabel;
  copyButton.addEventListener('click', async () => {
    clearTimeout(resetLabel);
    try {
      await navigator.clipboard.writeText(checksum.textContent.trim());
      copyButton.textContent = '已复制';
      copyStatus.textContent = 'SHA-256 校验值已复制。';
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(checksum);
      selection.removeAllRanges();
      selection.addRange(range);
      copyButton.textContent = '请手动复制';
      copyStatus.textContent = '浏览器未允许剪贴板访问，已选中校验值，请手动复制。';
    }
    resetLabel = setTimeout(() => { copyButton.textContent = '复制'; }, 3500);
  });
})();
