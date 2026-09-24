(function () {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    return;
  }

  let deferredPrompt = null;

  function hideInstallPrompt() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) {
      banner.classList.remove('visible');
    }
  }

  function bindInstallButton(button) {
    if (!button) return;

    button.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        hideInstallPrompt();

        if (choice.outcome === 'accepted') {
          console.log('PWA install accepted');
        } else {
          console.log('PWA install dismissed');
        }
        return;
      }

      const isSafari = /Safari\//.test(navigator.userAgent) && !/Chrome|CriOS|OPR|Opera/.test(navigator.userAgent);
      if (isSafari) {
        const banner = document.getElementById('pwaInstallBanner');
        if (!banner) return;

        banner.querySelector('strong').textContent = 'Add to Home Screen';
        banner.querySelector('span').textContent = 'Tap the Share button and choose Add to Home Screen.';
        banner.querySelector('#pwaInstallButton').textContent = 'Open Share';
        return;
      }

      hideInstallPrompt();
    });
  }

  function buildInstallBanner() {
    const existing = document.getElementById('pwaInstallBanner');
    if (existing) {
      bindInstallButton(existing.querySelector('#pwaInstallButton'));
      return existing;
    }

    const banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.innerHTML = `
      <div class="pwa-banner__content">
        <div>
          <strong>Install Infinine</strong>
          <span>Get quick access and launch it like an app.</span>
        </div>
        <button id="pwaInstallButton" type="button">Install</button>
      </div>
    `;

    const bannerStyle = document.createElement('style');
    bannerStyle.textContent = `
      #pwaInstallBanner {
        position: fixed;
        left: 16px;
        right: 16px;
        bottom: 20px;
        z-index: 99999;
        display: none;
      }
      #pwaInstallBanner.visible {
        display: block;
      }
      .pwa-banner__content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        max-width: 520px;
        margin: 0 auto;
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.96);
        border: 1px solid rgba(125, 211, 252, 0.25);
        box-shadow: 0 18px 50px rgba(2, 6, 23, 0.35);
        color: #e2e8f0;
        font-family: 'Poppins', Arial, sans-serif;
      }
      .pwa-banner__content strong {
        display: block;
        font-size: 15px;
        margin-bottom: 4px;
      }
      .pwa-banner__content span {
        display: block;
        font-size: 12px;
        color: #cbd5e1;
      }
      #pwaInstallButton {
        border: none;
        border-radius: 10px;
        background: linear-gradient(90deg, #22c55e, #38bdf8);
        color: #020617;
        font-weight: 700;
        font-size: 13px;
        padding: 10px 16px;
        cursor: pointer;
      }
      @media (max-width: 520px) {
        .pwa-banner__content {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `;

    document.head.appendChild(bannerStyle);
    document.body.appendChild(banner);

    const button = banner.querySelector('#pwaInstallButton');
    bindInstallButton(button);
    return banner;
  }

  function showInstallPrompt() {
    const banner = buildInstallBanner();
    banner.classList.add('visible');
  }

  const serviceWorkerUrl = window.location.pathname.includes('/Admin/') || window.location.pathname.includes('/terms/')
    ? '../service-worker.js'
    : './service-worker.js';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
        console.warn('Service worker registration failed:', error);
      });
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallPrompt();
  });

  window.addEventListener('appinstalled', () => {
    hideInstallPrompt();
  });

  const isSafari = /Safari\//.test(navigator.userAgent) && !/Chrome|CriOS|OPR|Opera/.test(navigator.userAgent);
  if (!('beforeinstallprompt' in window) && isSafari) {
    setTimeout(() => showInstallPrompt(), 1500);
  }
})();
