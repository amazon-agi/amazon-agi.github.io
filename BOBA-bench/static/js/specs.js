// Chain page: open the request named in the URL hash.
(function() {
  function openFromHash() {
    var id = location.hash.replace('#', '');
    if (!id) return;
    var item = document.getElementById(id);
    if (item && item.tagName === 'DETAILS') { item.open = true; item.scrollIntoView({ behavior: 'smooth' }); }
  }
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
})();
