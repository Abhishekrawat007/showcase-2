(function(){
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  if (isStandalone) {
    document.documentElement.classList.add('pwa-standalone');
    document.body.classList.add('pwa-standalone');
  }
})();

