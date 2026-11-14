/*
 * Builds the sidebar navigation on every page. The highlight bar slides to the
 * current page link. On small screens the sidebar becomes a menu.
 */

const PAGES = [
  { key: 'home', label: 'Home', href: 'index.html', group: 'Start' },
  { key: 'input', label: 'Input Studio', href: 'pages/input-studio.html', group: 'Start' },
  { key: 'simulator', label: 'Simulation Lab', href: 'pages/simulator.html', group: 'Simulate' },
  { key: 'steps', label: 'Step Explorer', href: 'pages/step-explorer.html', group: 'Simulate' },
  { key: 'arena', label: 'Algorithm Arena', href: 'pages/algorithm-arena.html', group: 'Compare' },
  { key: 'scanlook', label: 'SCAN vs LOOK', href: 'pages/scan-look.html', group: 'Compare' },
  { key: 'learning', label: 'Disk Learning', href: 'pages/disk-learning.html', group: 'Learn' },
  { key: 'workloads', label: 'Workload Studio', href: 'pages/workload-studio.html', group: 'Experiment' },
  { key: 'analytics', label: 'Analytics', href: 'pages/analytics.html', group: 'Experiment' },
  { key: 'testing', label: 'Testing', href: 'pages/testing.html', group: 'Experiment' },
  { key: 'history', label: 'History', href: 'pages/history.html', group: 'Experiment' },
];

const LOGO = `
  <svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.9"/>
    <circle cx="16" cy="16" r="8.5" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2.4" opacity="0.6"/>
    <circle cx="16" cy="16" r="2.4" fill="currentColor"/>
    <path d="M30 29 L21.5 17.5" stroke="#252C32" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="21" cy="17" r="2.6" fill="#C29B55" stroke="#252C32" stroke-width="1"/>
  </svg>`;

/** Links are written relative to the project root; pages live one folder down. */
function link(href, insidePagesFolder) {
  if (!insidePagesFolder) return href;
  return href.startsWith('pages/') ? href.slice('pages/'.length) : `../${href}`;
}

export function renderNavigation(activeKey) {
  const container = document.getElementById('sidebar');
  if (!container) return;
  const inside = window.location.pathname.includes('/pages/');

  let html = '';
  let group = '';
  for (const page of PAGES) {
    if (page.group !== group) {
      if (group) html += '</ul>';
      group = page.group;
      html += `<p class="nav-group">${group}</p><ul>`;
    }
    const current = page.key === activeKey ? ' aria-current="page"' : '';
    html += `<li><a href="${link(page.href, inside)}"${current}>${page.label}</a></li>`;
  }
  html += '</ul>';

  container.innerHTML = `
    <div class="sidebar-top">
      <a class="brand" href="${link('index.html', inside)}">${LOGO}<span>Disk<b>Lab</b></span></a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav-links">Menu</button>
    </div>
    <nav id="nav-links" class="nav-links" aria-label="Main">
      <span class="nav-indicator" aria-hidden="true"></span>
      ${html}
    </nav>
    <p class="sidebar-note">SSTF · SCAN · LOOK<br>Movement is measured in cylinders.</p>`;

  const toggle = container.querySelector('.menu-toggle');
  toggle.addEventListener('click', () => {
    const open = container.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    placeIndicator(container);
  });
  placeIndicator(container);
  window.addEventListener('resize', () => placeIndicator(container));
}

/** Moves the highlight bar next to the current page's link. */
function placeIndicator(container) {
  const nav = container.querySelector('.nav-links');
  const current = nav.querySelector('[aria-current="page"]');
  const indicator = nav.querySelector('.nav-indicator');
  if (!current) { indicator.style.opacity = '0'; return; }
  const navBox = nav.getBoundingClientRect();
  const linkBox = current.getBoundingClientRect();
  indicator.style.opacity = '1';
  indicator.style.transform = `translateY(${linkBox.top - navBox.top + nav.scrollTop}px)`;
  indicator.style.height = `${linkBox.height}px`;
}
