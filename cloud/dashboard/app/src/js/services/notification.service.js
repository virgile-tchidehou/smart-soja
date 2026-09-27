/**
 * SMART-SOJA — Notification Service
 * Système de toasts modernes premium avec animations fluides et feedback visuel
 */

class NotificationService {
    constructor() {
        this.container = null;
        this.toasts = [];
        this._createContainer();
    }

    /**
     * Crée le conteneur de toasts s'il n'existe pas
     */
    _createContainer() {
        if (document.querySelector('.toast-container')) {
            this.container = document.querySelector('.toast-container');
            return;
        }
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    }

    /**
     * Affiche une notification
     * @param {string} title - Titre de la notification
     * @param {string} message - Message détaillé
     * @param {string} type - 'success', 'error', 'info', 'warning'
     * @param {number} duration - Durée en ms
     */
    show(title, message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };

        const progressId = `progress-${Date.now()}-${Math.random()}`;

        toast.innerHTML = `
            <div class="toast-backdrop"></div>
            <div class="toast-icon">
                <i class="fas ${icons[type]}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${this._escapeHtml(title)}</div>
                <div class="toast-message">${this._escapeHtml(message)}</div>
            </div>
            <button class="toast-close" aria-label="Fermer">
                <i class="fas fa-times"></i>
            </button>
            <div class="toast-progress">
                <div class="toast-progress-bar" id="${progressId}"></div>
            </div>
        `;

        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('visible'), 10);

        // Bouton fermer
        toast.querySelector('.toast-close').onclick = (e) => {
            e.preventDefault();
            this.remove(toast);
        };

        // Anime la barre de progression
        const progressBar = document.getElementById(progressId);
        if (progressBar && duration > 0) {
            progressBar.style.animation = `toastProgressFill ${duration}ms linear forwards`;
        }

        // Auto-suppression
        const timeout = setTimeout(() => {
            this.remove(toast);
        }, duration);

        // Pause la progression au survol
        toast.addEventListener('mouseenter', () => {
            clearTimeout(timeout);
            progressBar && (progressBar.style.animationPlayState = 'paused');
        });

        toast.addEventListener('mouseleave', () => {
            setTimeout(() => {
                this.remove(toast);
            }, 500);
            progressBar && (progressBar.style.animationPlayState = 'running');
        });
    }

    /**
     * Escape HTML pour éviter les injections
     */
    _escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    success(title, message, duration = 4000) {
        this.show(title, message, 'success', duration);
    }

    error(title, message, duration = 5000) {
        this.show(title, message, 'error', duration);
    }

    info(title, message, duration = 4000) {
        this.show(title, message, 'info', duration);
    }

    warning(title, message, duration = 4500) {
        this.show(title, message, 'warning', duration);
    }

    remove(toast) {
        if (!toast.classList.contains('removing')) {
            toast.classList.add('removing');
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
            setTimeout(() => {
                toast.remove();
            }, 400);
        }
    }

    /**
     * Vide tous les toasts
     */
    clearAll() {
        this.toasts.forEach(toast => this.remove(toast));
    }
}

const notificationService = new NotificationService();
export default notificationService;
