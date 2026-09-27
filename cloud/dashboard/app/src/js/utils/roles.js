// ============================================
// SMART-SOJA - Role Management & Redirection
// ============================================
import { auth, signOut } from '../config/firebase-init.js';

export const ROLES = {
    EXPLOITANT: 'exploitant',
    INDUSTRIE: 'industrie',
    ADMIN: 'admin'
};

export const ROUTES = {
    admin: '/dashboards/admin.html',
    exploitant: '/dashboards/exploitant.html',
    industrie: '/dashboards/industrie.html',
    login: '/login.html'
};

export function redirectBasedOnRole(role) {
    const route = ROUTES[role] || ROUTES.login;
    console.log(`Redirection vers: ${route} (Rôle: ${role})`);
    window.location.href = route;
}

/**
 * Vérifie que l'utilisateur est authentifié ET autorisé à accéder à ce dashboard.
 * Redirige si non autorisé.
 * @param {string} allowedRole — Rôle attendu ('exploitant' | 'industrie' | 'admin')
 * @returns {Object|null} — userData si autorisé, null si redirigé
 */
export function enforceRoleAccess(allowedRole) {
    // [DEV MODE] : Décommentez la ligne ci-dessous pour bypasser l'auth pendant le dev
    // return { uid: 'dev-uid-123', role: allowedRole, name: 'Utilisateur Dev', fullName: 'Utilisateur Dev' };

    try {
        const userData = JSON.parse(localStorage.getItem('smartsoja_user'));

        if (!userData || !userData.role) {
            console.warn("Aucun utilisateur connecté, redirection vers login.");
            redirectBasedOnRole('LOGIN');
            return null;
        }

        const currentRole = userData.role;

        // Vérification directe (les rôles sont maintenant normalisés à l'auth)
        if (currentRole !== allowedRole) {
            console.warn(`Accès refusé: rôle ${currentRole} ≠ ${allowedRole}. Redirection vers son dashboard.`);
            redirectBasedOnRole(currentRole);
            return null;
        }

        return userData;
    } catch (e) {
        console.error("Erreur enforceRoleAccess:", e);
        redirectBasedOnRole('LOGIN');
        return null;
    }
}

/**
 * Affiche le contenu de la page une fois que l'auth est validée.
 */
export function showPageContent() {
    document.body.style.display = 'block';
    if (window.lucide) window.lucide.createIcons();
}

export function setupLogout(logoutBtnId = 'logoutBtn') {
    const btn = document.getElementById(logoutBtnId);
    if (btn) {
        btn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                localStorage.removeItem('smartsoja_user');
                redirectBasedOnRole('LOGIN');
            } catch (error) {
                console.error("Erreur déconnexion:", error);
                localStorage.removeItem('smartsoja_user');
                window.location.href = '/';
            }
        });
    }
}
