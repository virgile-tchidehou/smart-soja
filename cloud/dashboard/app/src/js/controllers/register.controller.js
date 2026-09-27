// ============================================
// SMART-SOJA — Registration (Industries uniquement)
// SDK Firebase Modulaire
// ============================================

import {
    auth, db, COLLECTIONS,
    createUserWithEmailAndPassword,
    signOut,
    doc, setDoc, collection, serverTimestamp
} from '../config/firebase-init.js';
import { setupThemeToggle } from '../utils/theme.js';
import notificationService from '../services/notification.service.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const companyNameInput = document.getElementById('companyName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const telephoneInput = document.getElementById('telephone');
    const locationInput = document.getElementById('location');
    const registerBtn = document.getElementById('registerBtn');
    const errorMsg = document.getElementById('errorMsg');

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

    // Register form submit
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const companyName = companyNameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const telephone = telephoneInput.value.trim();
        const location = locationInput ? locationInput.value.trim() : '';

        // Nouveaux champs industrie
        const qualityStandard = document.getElementById('qualityStandard')?.value.trim() || '';
        const maxHumidity = parseFloat(document.getElementById('maxHumidity')?.value) || 12;
        const qualityContact = document.getElementById('qualityContact')?.value.trim() || '';
        const directorContact = document.getElementById('directorContact')?.value.trim() || '';

        // UI: Loading state
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<span>Création du compte...</span><i class="fas fa-spinner fa-spin"></i>';
        errorMsg.classList.add('hidden');

        try {
            console.log("Inscription industrie:", companyName, email);

            // 1. Création compte Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const timestamp = serverTimestamp();

            // 2. Sauvegarde dans Firestore (collection industries) avec tous les champs
            await setDoc(doc(db, 'industries', user.uid), {
                id: user.uid,
                industryId: user.uid,
                nom: companyName,
                email: email,
                qualityStandard: qualityStandard,
                maxHumidity: maxHumidity,
                qualityRoleName: qualityContact,
                directorRoleName: directorContact,
                telephone: telephone,
                localisation: location,
                createdAt: timestamp,
                status: 'actif',
                statut: 'actif'
            });

            // 3. Écriture dans la collection users pour le rôle
            await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
                uid: user.uid,
                fullName: companyName,
                email: email,
                role: 'industrie',
                industryId: user.uid,
                localisation: location,
                qualityStandard: qualityStandard,
                maxHumidity: maxHumidity,
                createdAt: timestamp,
                status: 'actif',
                lotsCount: 0,
                conformRate: 0
            });

            // 4. Déconnexion pour forcer la connexion manuelle
            await signOut(auth);
            localStorage.removeItem('smartsoja_user');

            notificationService.success("Compte créé", "Votre compte industrie a été créé avec succès. Veuillez vous connecter.");

            // Délai pour laisser le temps de lire la notification
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2500);

        } catch (error) {
            console.error("Erreur d'inscription détaillée:", error);

            let message = "Erreur lors de la création du compte.";

            switch (error.code) {
                case 'auth/email-already-in-use':
                    message = "Cette adresse e-mail est déjà associée à un compte.";
                    break;
                case 'auth/weak-password':
                    message = "Le mot de passe est trop faible (6 caractères minimum).";
                    break;
                case 'auth/invalid-email':
                    message = "L'adresse e-mail n'est pas valide.";
                    break;
                case 'auth/operation-not-allowed':
                    message = "L'inscription est actuellement désactivée.";
                    break;
                case 'auth/network-request-failed':
                    message = "Erreur réseau. Vérifiez votre connexion internet.";
                    break;
                default:
                    message = error.message || "Une erreur est survenue.";
            }

            errorMsg.textContent = message;
            errorMsg.classList.remove('hidden');
        } finally {
            registerBtn.disabled = false;
            registerBtn.innerHTML = '<span>Finaliser l\'inscription</span><i class="fas fa-check-circle"></i>';
        }
    });
});
