(function () {
  const BAR_ID = 'pwa-install-bar';
  const INSTALLED_KEY = 'pwaInstalled';
  const DISMISSED_AT_KEY = 'pwaInstallDismissedAt';
  const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

  const bar = document.getElementById(BAR_ID);
  const btnInstall = document.getElementById('pwa-install-btn');
  const btnLater = document.getElementById('pwa-later-btn');
  const btnClose = document.getElementById('pwa-close-btn');

  let deferredPrompt = null;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIos = () =>
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;

  const isInSafari = () =>
    /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);

  const markInstalled = () => {
    localStorage.setItem(INSTALLED_KEY, '1');
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

  /* ---------- iOS Instructions ---------- */
  const createIosInstructions = () => {
    if (!document.getElementById('pwa-ios-instructions')) {
      const instructions = document.createElement('div');
      instructions.id = 'pwa-ios-instructions';
      instructions.style.marginTop = '8px';
      instructions.innerHTML = `
        <strong>📱 How to install on iPhone:</strong><br>
        1. Tap the <span style="font-size:18px;">&#x2191;</span> Share icon in Safari.<br>
        2. Select <em>"Add to Home Screen"</em>.
      `;
      bar.appendChild(instructions);
    }
  };

  const removeIosInstructions = () => {
    const instructions = document.getElementById('pwa-ios-instructions');
    if (instructions) instructions.remove();
  };

  /* ---------- iOS Arrow ---------- */
  const createIosArrow = () => {
    if (!document.getElementById('pwa-ios-arrow')) {
      const arrow = document.createElement('div');
      arrow.id = 'pwa-ios-arrow';
      arrow.style.position = 'fixed';
      arrow.style.width = '36px';
      arrow.style.height = '36px';
      arrow.style.bottom = '80px'; // approximate Safari toolbar offset
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
    const arrow = document.getElementById('pwa-ios-arrow');
    if (arrow) arrow.remove();
  };

  const showIosHelper = () => {
    createIosInstructions();
    createIosArrow();
  };

  const toggleIosHelper = () => {
    const instructions = document.getElementById('pwa-ios-instructions');
    if (instructions) {
      removeIosInstructions();
      removeIosArrow();
    } else {
      showIosHelper();
    }
  };

  /* ---------- Bar Show/Hide ---------- */
  const showBar = () => {
    if (bar.hasAttribute('hidden')) bar.removeAttribute('hidden');
    void bar.offsetHeight;
    bar.classList.add('show');
    if (isIos() && isInSafari()) showIosHelper();
  };

  const hideBar = () => {
    bar.classList.remove('show');
    setTimeout(() => bar.setAttribute('hidden', ''), 420);
    removeIosArrow();
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    hideBar();
  };

  btnLater.addEventListener('click', dismiss);
  btnClose.addEventListener('click', dismiss);

  btnInstall.addEventListener('click', async () => {
    if (isIos() && isInSafari()) {
      toggleIosHelper();
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (choice && choice.outcome === 'accepted') {
      markInstalled();
    } else {
      dismiss();
    }
  });

  /* ---------- Android Install ---------- */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (shouldShow()) showBar();
  });

  /* ---------- iOS Auto Show ---------- */
  if (isIos() && isInSafari() && shouldShow()) {
    btnInstall.textContent = 'How to Install';
    showIosHelper();
  }

  if (isStandalone()) markInstalled();

  window.addEventListener('appinstalled', () => {
    markInstalled();
  });
})();
 