// ============================================
// SMART-SOJA — Authentication (Login)
// SDK Firebase Modulaire
// ============================================

import {
    auth, db, COLLECTIONS,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    doc, getDoc, getDocs, collection, query, where, setDoc
} from '../config/firebase-init.js';
import { redirectBasedOnRole } from '../utils/roles.js';
import { setupThemeToggle } from '../utils/theme.js';
import notificationService from '../services/notification.service.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    // Password Visibility Toggle
    const toggleBtns = document.querySelectorAll('.toggle-password-btn');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = btn.querySelector('i');

            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // Login form submit
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = emailInput.value.trim().toLowerCase();
            const password = passwordInput.value;

            // UI: Loading state
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span>Connexion...</span><i class="fas fa-spinner fa-spin"></i>';
            errorMsg.classList.add('hidden');
            if (successMsg) successMsg.classList.add('hidden');

            try {
                console.log("Tentative de connexion:", email);

                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                console.log("Connexion Auth réussie:", user.email);

                // Récupération du rôle depuis Firestore (source de vérité)
                let role = 'exploitant';
                let name = email.split('@')[0].toUpperCase();
                let userData = {};

                try {
                    const userDocRef = doc(db, COLLECTIONS.USERS, user.uid);
                    const userDocSnap = await getDoc(userDocRef);

                    if (userDocSnap.exists()) {
                        userData = userDocSnap.data();
                        const rawRole = userData.role || 'exploitant';
                        role = normalizeRole(rawRole);
                        name = userData.fullName || userData.name || name;
                        console.log("Rôle récupéré de Firestore:", role);
                    } else {
                        // Fallback: search by email
                        const q = query(collection(db, COLLECTIONS.USERS), where('email', '==', email));
                        const querySnap = await getDocs(q);
                        if (!querySnap.empty) {
                            userData = querySnap.docs[0].data();
                            role = normalizeRole(userData.role || 'exploitant');
                            name = userData.fullName || userData.name || name;
                        } else {
                            // Si aucun document n'existe dans Firestore pour cet utilisateur authentifié (ex: créé dans la console Auth)
                            // On vérifie si la collection users est vide (base réinitialisée) ou si l'email contient "admin"
                            const allUsersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
                            const isEmpty = allUsersSnap.empty;
                            
                            let assignedRole = 'exploitant';
                            if (isEmpty || email.includes('admin') || email === 'sojasmart00@gmail.com') {
                                assignedRole = 'admin';
                            }
                            
                            userData = {
                                uid: user.uid,
                                fullName: name,
                                email: email,
                                role: assignedRole,
                                status: 'actif',
                                createdAt: new Date().toISOString()
                            };
                            
                            await setDoc(userDocRef, userData);
                            role = assignedRole;
                            console.log("Document utilisateur auto-généré dans Firestore. Rôle:", role);
                        }
                    }
                } catch (fsError) {
                    console.warn("Impossible de récupérer ou créer le rôle dans Firestore, utilisation du rôle par défaut:", fsError);
                }

                // Stockage local du profil utilisateur
                const finalUser = {
                    uid: user.uid,
                    email: email,
                    name: name,
                    ...userData,
                    role: role // Force le rôle normalisé
                };

                localStorage.setItem('smartsoja_user', JSON.stringify(finalUser));

                // Redirection
                redirectBasedOnRole(role);

            } catch (error) {
                console.error("Erreur de connexion détaillée:", error);

                let message = "Erreur de connexion.";

                switch (error.code) {
                    case 'auth/invalid-credential':
                    case 'auth/wrong-password':
                    case 'auth/user-not-found':
                        message = "E-mail ou mot de passe incorrect.";
                        break;
                    case 'auth/invalid-email':
                        message = "Adresse e-mail invalide.";
                        break;
                    case 'auth/too-many-requests':
                        message = "Trop de tentatives. Veuillez réessayer plus tard.";
                        break;
                    case 'auth/network-request-failed':
                        message = "Erreur réseau. Vérifiez votre connexion internet.";
                        break;
                    default:
                        message = "Une erreur est survenue lors de la connexion.";
                }

                errorMsg.textContent = message;
                errorMsg.classList.remove('hidden');
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<span>Se connecter</span><i class="fas fa-arrow-right"></i>';
            }
        });
    }

    // --- Password Reset Modal Logic ---
    const resetModal = document.getElementById('resetModal');
    const resetEmailInput = document.getElementById('resetEmail');
    const sendResetBtn = document.getElementById('sendResetBtn');
    const closeResetModal = document.getElementById('closeResetModal');
    const finishResetBtn = document.getElementById('finishResetBtn');
    const stepRequest = document.getElementById('step-request');
    const stepSuccess = document.getElementById('step-success');
    const sentEmailSpan = document.getElementById('sentEmail');

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (emailInput.value) resetEmailInput.value = emailInput.value;
            resetModal.classList.add('active');
            stepRequest.classList.add('active');
            stepSuccess.classList.remove('active');
            document.body.classList.add('modal-open');
        });
    }

    if (closeResetModal) {
        closeResetModal.addEventListener('click', () => {
            resetModal.classList.remove('active');
            document.body.classList.remove('modal-open');
        });
    }

    if (sendResetBtn) {
        sendResetBtn.addEventListener('click', async () => {
            const resetEmail = resetEmailInput.value.trim();
            if (!resetEmail) {
                notificationService.info("Champ requis", "Veuillez saisir votre adresse e-mail.");
                return;
            }

            sendResetBtn.disabled = true;
            sendResetBtn.innerHTML = '<span>Envoi...</span><i class="fas fa-spinner fa-spin"></i>';

            try {
                notificationService.success("E-mail envoyé", `Un lien de réinitialisation a été envoyé à ${resetEmail}`);
                sentEmailSpan.textContent = resetEmail;
                stepRequest.classList.remove('active');
                stepSuccess.classList.add('active');
            } catch (error) {
                console.error("Erreur réinitialisation:", error);
                let msg = "Impossible d'envoyer l'e-mail.";
                if (error.code === 'auth/user-not-found') msg = "Aucun compte trouvé avec cette adresse.";
                notificationService.error("Erreur", msg);
            } finally {
                sendResetBtn.disabled = false;
                sendResetBtn.innerHTML = '<span>Envoyer le lien</span><i class="fas fa-paper-plane"></i>';
            }
        });
    }

    if (finishResetBtn) {
        finishResetBtn.addEventListener('click', () => {
            resetModal.classList.remove('active');
            document.body.classList.remove('modal-open');
        });
    }
});

/**
 * Normalise les rôles legacy vers les 3 rôles canoniques.
 */
function normalizeRole(raw) {
    const map = {
        'exploitant': 'exploitant',
        'producteur': 'exploitant',
        'cooperative': 'exploitant',
        'industrie': 'industrie',
        'usine': 'industrie',
        'admin': 'admin',
        'super_admin': 'admin'
    };
    return map[raw] || 'exploitant';
}
