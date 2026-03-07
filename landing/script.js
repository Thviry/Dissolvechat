// ── Configuration — update before each release ─────────────────────────────
const GITHUB_REPO     = 'Thviry/Dissolvechat';
const RELEASE_VERSION = '0.1.3-beta';
const RELEASE_ASSETS  = {
  windows: `Dissolve_0.1.3_x64-setup.exe`,
  mac:     `Dissolve_0.1.3_universal.dmg`,
  linux:   `Dissolve_0.1.3_amd64.AppImage`,
};

// ── Derived URLs ────────────────────────────────────────────────────────────
const BASE            = `https://github.com/${GITHUB_REPO}/releases/download/v${RELEASE_VERSION}`;
const GITHUB_RELEASES = `https://github.com/${GITHUB_REPO}/releases`;

const DOWNLOAD_URLS = {
  windows: `${BASE}/${RELEASE_ASSETS.windows}`,
  mac:     `${BASE}/${RELEASE_ASSETS.mac}`,
  linux:   `${BASE}/${RELEASE_ASSETS.linux}`,
};

// ── OS detection ────────────────────────────────────────────────────────────
function detectOS() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win'))                          return 'windows';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'windows'; // no native app yet
  if (ua.includes('mac'))                          return 'mac';
  if (ua.includes('linux'))                        return 'linux';
  return 'windows'; // sensible default
}

// ── Wire up DOM ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const os = detectOS();
  const OS_LABELS = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };

  // Hero primary button
  const heroBtn = document.getElementById('hero-download-btn');
  const heroOs  = document.getElementById('hero-os');
  const heroVer = document.getElementById('hero-version');
  if (heroBtn && heroOs) {
    heroOs.textContent = OS_LABELS[os];
    heroBtn.href       = DOWNLOAD_URLS[os];
  }
  if (heroVer) {
    heroVer.textContent = `v${RELEASE_VERSION} · Open source`;
  }

  // Hero alt links
  const altMap = {
    'alt-windows': 'windows',
    'alt-mac':     'mac',
    'alt-linux':   'linux',
  };
  for (const [id, platform] of Object.entries(altMap)) {
    const el = document.getElementById(id);
    if (el) el.href = DOWNLOAD_URLS[platform];
  }

  // Download section cards
  const dlMap = {
    'dl-windows': 'windows',
    'dl-mac':     'mac',
    'dl-linux':   'linux',
  };
  for (const [id, platform] of Object.entries(dlMap)) {
    const el = document.getElementById(id);
    if (el) el.href = DOWNLOAD_URLS[platform];
  }

  // GitHub links
  for (const id of ['nav-github', 'footer-github', 'dl-github-link']) {
    const el = document.getElementById(id);
    if (el) el.href = GITHUB_RELEASES;
  }

  // Footer license link
  const licenseEl = document.getElementById('footer-license');
  if (licenseEl) {
    licenseEl.href = `https://github.com/${GITHUB_REPO}/blob/main/LICENSE`;
  }
});
