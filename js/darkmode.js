function applyTheme(mode) {
  const toggleBtn = document.getElementById('themeToggle');
  if (mode === 'dark') {
    document.body.classList.add('dark-mode');
    if (toggleBtn) toggleBtn.textContent = '☀️';
  } else {
    document.body.classList.remove('dark-mode');
    if (toggleBtn) toggleBtn.textContent = '🌙';
  }
  localStorage.setItem('darkMode', mode);
}

function setupThemeToggle() {
  const toggleBtn = document.getElementById('themeToggle');
  const savedMode = localStorage.getItem('darkMode') || 'light';
  applyTheme(savedMode);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-mode');
      applyTheme(isDark ? 'light' : 'dark');
    });
  }
}

window.addEventListener('DOMContentLoaded', setupThemeToggle);