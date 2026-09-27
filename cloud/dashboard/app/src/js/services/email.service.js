/**
 * SMART-SOJA — Email Service
 * Intégration EmailJS pour l'envoi de notifications.
 */

import emailjs from '@emailjs/browser';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

// Initialisation
emailjs.init(PUBLIC_KEY);

class EmailService {
    /**
     * Envoie l'email de bienvenue avec les identifiants
     */
    async sendWelcomeEmail(userData, password) {
        try {
            const templateParams = {
                to_name: userData.name,
                to_email: userData.email,
                password: password,
                login_url: window.location.origin + '/pages/dashboards/login.html'
            };

            console.log("Envoi de l'email de bienvenue à:", userData.email);
            
            const response = await emailjs.send(
                SERVICE_ID,
                TEMPLATE_ID,
                templateParams
            );

            console.log("Email envoyé avec succès !", response.status, response.text);
            return true;
        } catch (error) {
            console.error("Erreur EmailJS:", error);
            throw error;
        }
    }
}

const emailService = new EmailService();
export default emailService;
