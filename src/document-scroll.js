// Keep the real editor's scroll position, caret behavior and accessibility; the
// visible native scrollbar lives after the outline, at the workspace's right edge.
export function installDocumentScroll() {
  const bar = document.querySelector('#document-scrollbar');
  const spacer = bar.firstElementChild;
  const page = document.querySelector('.page-scroll');
  const source = document.querySelector('#source-editor');
  let pending = 0;
  const active = () => document.body.classList.contains('is-source') ? source : page;
  function update() {
    pending = 0;
    const field = active(), range = Math.max(0, field.scrollHeight - field.clientHeight);
    spacer.style.height = `${bar.clientHeight + range}px`;
    bar.style.visibility = range > 0 ? 'visible' : 'hidden';
    if (Math.abs(bar.scrollTop - field.scrollTop) > 0.5) bar.scrollTop = field.scrollTop;
    bar.setAttribute('aria-controls', field === source ? 'source-editor' : 'editor');
  }
  function refresh() { if (!pending) pending = requestAnimationFrame(update); }
  page.addEventListener('scroll', refresh, {passive:true});
  source.addEventListener('scroll', refresh, {passive:true});
  source.addEventListener('input', refresh);
  bar.addEventListener('scroll', () => { const field = active(); if (Math.abs(field.scrollTop - bar.scrollTop) > 0.5) field.scrollTop = bar.scrollTop; }, {passive:true});
  const resize = new ResizeObserver(refresh);
  for (const node of [page, source, document.querySelector('.paper')]) resize.observe(node);
  new MutationObserver(refresh).observe(document.body, {attributes:true,attributeFilter:['class']});
  refresh();
  return {refresh};
}
