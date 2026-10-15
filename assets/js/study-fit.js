/* assets/js/study-fit.js
   Hand-drawn figures (```ascii) and equations (```eq) in the study notes are
   drawn on a character grid, so wrapping them would break them. On a narrow
   screen each one is set a little smaller until it fits its column, down to
   a floor that stays readable (9.5px); past that floor it scrolls sideways instead.
   No JavaScript: they scroll at full size. */
(function () {
  var blocks = document.querySelectorAll('.note-content pre.fig-ascii, .note-content pre.fig-eq, .note-content .language-ascii pre, .note-content .language-eq pre');
  if (!blocks.length) return;
  var FLOOR = 9.5;

  function fit() {
    blocks.forEach(function (pre) {
      pre.style.fontSize = '';
      var size = parseFloat(getComputedStyle(pre).fontSize);
      while (pre.scrollWidth > pre.clientWidth + 1 && size > FLOOR) {
        size = Math.max(FLOOR, size - 0.5);
        pre.style.fontSize = size + 'px';
      }
    });
  }

  var queued = false;
  function refit() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; fit(); });
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  else fit();
  window.addEventListener('resize', refit);
})();
