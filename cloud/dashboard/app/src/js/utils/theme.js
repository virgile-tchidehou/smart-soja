/**
 * SMART-SOJA — Centralized Theme Management
 * Handles Dark/Light mode toggle across all pages.
 * Uses body.light-mode class (compatible with existing CSS).
 */

const STORAGE_KEY = 'smartsoja-theme';

/**
 * Apply saved theme on page load (call early to avoid FOUC).
 * @returns {string} The current theme ('dark' or 'light')
 */
export function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY) || 'light';
    if (saved === 'light') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
    return saved;
}

/**
 * Toggle between dark and light theme.
 * @returns {string} The new theme after toggle
 */
export function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    const newTheme = isLight ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, newTheme);
    return newTheme;
}

/**
 * Bind a button to toggle the theme.
 * @param {string} buttonId — ID of the toggle button
 */
export function setupThemeToggle(buttonId = 'theme-toggle-btn') {
    const btn = document.getElementById(buttonId);
    if (btn) {
        btn.addEventListener('click', () => toggleTheme());
    }
    // Apply saved theme immediately
    initTheme();
}
