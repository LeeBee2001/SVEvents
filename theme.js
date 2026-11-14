/* Hell/Dunkel: wird im <head> geladen, damit die Seite nicht kurz aufblitzt. */
(function () {
  var KEY = 'sv.theme';
  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function apply(t) {
    var root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
  }
  apply(read());
  window.svTheme = {
    get: function () {
      var t = read();
      return t === 'light' || t === 'dark' ? t : 'auto';
    },
    set: function (t) {
      try {
        if (t === 'auto') localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, t);
      } catch (e) { /* ohne Speicher geht es trotzdem, nur ohne Merken */ }
      apply(t);
    }
  };
})();
