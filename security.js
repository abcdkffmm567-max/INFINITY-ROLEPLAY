(()=>{
  'use strict';

  // UI deterrent only. Browser developer tools cannot be fully disabled by a website.
  // Real security must still rely on backend authorization, Firebase rules and server-side secrets.
  const stop = (e) => {
    if (!e) return false;
    try { e.preventDefault(); } catch (_) {}
    try { e.stopPropagation(); } catch (_) {}
    try { e.stopImmediatePropagation(); } catch (_) {}
    return false;
  };

  const denyContextMenu = (e) => stop(e);

  // Block right-click/context menu as early and broadly as possible.
  window.addEventListener('contextmenu', denyContextMenu, true);
  document.addEventListener('contextmenu', denyContextMenu, true);
  document.oncontextmenu = () => false;
  window.oncontextmenu = () => false;

  // Also block secondary-button mouse/pointer attempts on the page.
  ['mousedown','mouseup','pointerdown','pointerup','auxclick'].forEach(type => {
    window.addEventListener(type, (e) => {
      if (e && (e.button === 2 || e.which === 3)) stop(e);
    }, true);
  });



  // Prevent normal page text selection/copying. Keep form fields usable so users can type/edit.
  const isEditableTarget = (target) => {
    if (!target || !target.closest) return false;
    return !!target.closest('input, textarea, select, [contenteditable="true"]');
  };

  const denySelection = (e) => {
    if (!isEditableTarget(e.target)) stop(e);
  };

  document.addEventListener('selectstart', denySelection, true);
  document.addEventListener('copy', (e) => {
    if (!isEditableTarget(e.target)) stop(e);
  }, true);
  document.addEventListener('cut', (e) => {
    if (!isEditableTarget(e.target)) stop(e);
  }, true);
  document.addEventListener('dragstart', (e) => {
    if (!isEditableTarget(e.target)) stop(e);
  }, true);

  // Block Ctrl/Cmd+A and Ctrl/Cmd+C outside editable form controls.
  window.addEventListener('keydown', (e) => {
    const k = String(e.key || '').toLowerCase();
    if (!isEditableTarget(e.target) && (e.ctrlKey || e.metaKey) && ['a','c','x'].includes(k)) {
      stop(e);
    }
  }, true);

  // Common DevTools / source shortcuts.
  window.addEventListener('keydown', (e) => {
    const k = String(e.key || '').toLowerCase();
    const blocked =
      k === 'f12' ||
      (e.ctrlKey && e.shiftKey && ['i','j','c','k'].includes(k)) ||
      (e.ctrlKey && ['u','s'].includes(k));
    if (blocked) stop(e);
  }, true);

  // Prevent dragging images into a new tab/window.
  window.addEventListener('dragstart', (e) => {
    if (e.target && e.target.tagName === 'IMG') stop(e);
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    // Disable text selection visually across the site while preserving form usability.
    const style = document.createElement('style');
    style.textContent = `html, body, body * { -webkit-user-select:none !important; user-select:none !important; -webkit-touch-callout:none !important; } input, textarea, select, [contenteditable="true"], input *, textarea *, select * { -webkit-user-select:text !important; user-select:text !important; -webkit-touch-callout:default !important; }`;
    document.head && document.head.appendChild(style);

    // Extra fallback for browsers/extensions that replace handlers later.
    document.body && document.body.addEventListener('contextmenu', denyContextMenu, true);

    document.querySelectorAll('a[target="_blank"]').forEach(a => {
      const rel = new Set(String(a.rel || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      a.rel = [...rel].join(' ');
    });
  });
})();
