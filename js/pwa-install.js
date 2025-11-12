/* pwa-install.v2.js — drop-in replacement, uses pwa2-* IDs */
(function () {
  const BAR_ID = 'pwa2-install-bar';
  const INSTALLED_KEY = 'pwa2Installed';
  const DISMISSED_AT_KEY = 'pwa2InstallDismissedAt';
  const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

  const bar = document.getElementById(BAR_ID);
  const btnInstall = document.getElementById('pwa2-install-btn');
  const btnLater = document.getElementById('pwa2-later-btn');
  const btnClose = document.getElementById('pwa2-close-btn');

  let deferredPrompt = null;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIos = () =>
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;

  const isInSafari = () =>
    /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);

  const markInstalled = () => {
    try { localStorage.setItem(INSTALLED_KEY, '1'); } catch(_) {}
    hideBar();
    removeIosArrow();
    removeIosInstructions();
  };

  const cooldownActive = () => {
    const ts = parseInt(localStorage.getItem(DISMISSED_AT_KEY) || '0', 10);
    return ts && Date.now() - ts < COOLDOWN_MS;
  };

  const shouldShow = () => {
    if (isStandalone()) return false;
    if (localStorage.getItem(INSTALLED_KEY) === '1') return false;
    if (cooldownActive()) return false;
    return true;
  };

  /* iOS helpers (IDs renamed) */
  const createIosInstructions = () => {
    if (!document.getElementById('pwa2-ios-instructions')) {
      const instructions = document.createElement('div');
      instructions.id = 'pwa2-ios-instructions';
      instructions.style.marginTop = '8px';
      instructions.innerHTML = `
        <strong>📱 How to install on iPhone:</strong><br>
        1. Tap the <span style="font-size:18px;">&#x2191;</span> Share icon in Safari.<br>
        2. Select <em>"Add to Home Screen"</em>.
      `;
      if (bar) bar.appendChild(instructions);
    }
  };

  const removeIosInstructions = () => {
    const instructions = document.getElementById('pwa2-ios-instructions');
    if (instructions) instructions.remove();
  };

  const createIosArrow = () => {
    if (!document.getElementById('pwa2-ios-arrow')) {
      const arrow = document.createElement('div');
      arrow.id = 'pwa2-ios-arrow';
      arrow.style.position = 'fixed';
      arrow.style.width = '36px';
      arrow.style.height = '36px';
      arrow.style.bottom = '80px';
      arrow.style.left = '50%';
      arrow.style.transform = 'translateX(-50%)';
      arrow.style.background = `url('data:image/svg+xml;utf8,<svg fill="%23fff" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L12 18M12 2L5 9M12 2L19 9"/></svg>') no-repeat center center`;
      arrow.style.backgroundSize = 'contain';
      arrow.style.animation = 'pwa-arrow-bounce 1s ease-in-out infinite';
      arrow.style.zIndex = 10001;
      arrow.style.pointerEvents = 'none';
      arrow.style.opacity = 0.9;
      document.body.appendChild(arrow);
    }
  };

  const removeIosArrow = () => {
    const arrow = document.getElementById('pwa2-ios-arrow');
    if (arrow) arrow.remove();
  };

  /* Bar show/hide */
  const showBar = () => {
    if (!bar) return;
    if (bar.hasAttribute('hidden')) bar.removeAttribute('hidden');
    void bar.offsetHeight;
    bar.classList.add('show');
    if (isIos() && isInSafari()) createIosInstructions(), createIosArrow();
  };

  const hideBar = () => {
    if (!bar) return;
    bar.classList.remove('show');
    setTimeout(() => bar.setAttribute('hidden', ''), 420);
    removeIosArrow();
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_AT_KEY, String(Date.now())); } catch(_) {}
    hideBar();
  };

  btnLater?.addEventListener('click', dismiss);
  btnClose?.addEventListener('click', dismiss);

  btnInstall?.addEventListener('click', async () => {
    if (isIos() && isInSafari()) {
      toggleIosHelper();
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (choice && choice.outcome === 'accepted') markInstalled();
    else dismiss();
  });

  function toggleIosHelper(){
    const instructions = document.getElementById('pwa2-ios-instructions');
    if (instructions) { removeIosInstructions(); removeIosArrow(); }
    else showIosHelper();
  }
  function showIosHelper(){ createIosInstructions(); createIosArrow(); }

  /* Android install event */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (shouldShow()) showBar();
  });

  /* iOS auto show */
  if (isIos() && isInSafari() && shouldShow()) {
    if (btnInstall) btnInstall.textContent = 'How to Install';
    showIosHelper();
  }

  if (isStandalone()) markInstalled();

  window.addEventListener('appinstalled', () => {
    markInstalled();
  });
})();
