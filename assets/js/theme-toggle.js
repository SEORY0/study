/* assets/js/theme-toggle.js
   The [dark] / [light] button. The theme lives on <html> (the head's FOUC
   guard sets it before first paint) and in localStorage under the main
   site's key, so seory0.github.io and /study/ keep one choice. */
document.addEventListener('DOMContentLoaded', function () {
  var root = document.documentElement;
  var button = document.getElementById('nav-theme-btn');
  if (!button) return;

  function sync() {
    button.setAttribute('aria-pressed', String(root.classList.contains('theme-dark')));
  }

  button.addEventListener('click', function () {
    var dark = !root.classList.contains('theme-dark');
    root.classList.toggle('theme-dark', dark);
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
    sync();
  });
  sync();
});
