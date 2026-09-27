/**
 * SMART-SOJA — Database Service
 * Centralise les interactions avec Cloud Firestore et Realtime Database.
 */

import {
    db,
    rtdb,
    COLLECTIONS,
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    deleteDoc,
    auth // Import principal
} from '../config/firebase-init.js';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, set, onValue, update } from 'firebase/database';

class DatabaseService {

    // ==========================================
    // FIRESTORE (Utilisateurs, Inventaire, Historique)
    // ==========================================

    /**
     * Récupère tous les utilisateurs
     */
    async getUsers() {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
        const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('📊 [DATABASE] getUsers() - Réponse:', JSON.stringify(users, null, 2));
        console.log('📊 [DATABASE] getUsers() - Nombre d\'utilisateurs:', users.length);
        if (users.length > 0) console.log('📊 [DATABASE] Exemple d\'utilisateur:', JSON.stringify(users[0], null, 2));
        return users;
    }

    /**
     * Récupère une unité spécifique
     */
    async getUnit(unitId) {
        const docRef = doc(db, COLLECTIONS.UNITS, unitId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    }

    /**
     * Récupère toutes les unités enregistrées
     */
    async getAllUnits() {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.UNITS));
        const units = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('📊 [DATABASE] getAllUnits() - Réponse:', JSON.stringify(units, null, 2));
        console.log('📊 [DATABASE] getAllUnits() - Nombre d\'unités:', units.length);
        if (units.length > 0) console.log('📊 [DATABASE] Exemple d\'unité:', JSON.stringify(units[0], null, 2));
        return units;
    }

    /**
     * Récupère les unités disponibles (non affectées)
     */
    async getAvailableUnits() {
        // On récupère toutes les unités pour filtrer celles qui n'ont pas de propriétaire
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.UNITS));
        const units = querySnapshot.docs
            .map(doc => ({ unitId: doc.id, ...doc.data() }))
            .filter(u => !u.owner && !u.ownerEmail);

        console.log('📊 [DATABASE] getAvailableUnits() - Réponse (Libres):', units.length);
        return units;
    }

    /**
     * Enregistre une unité détectée via MQTT (Auto-découverte)
     */
    async registerDetectedUnit(unitId) {
        const docRef = doc(db, COLLECTIONS.UNITS, unitId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.log(`Nouvelle unité détectée : ${unitId}. Enregistrement...`);
            await setDoc(docRef, {
                unitId: unitId,
                status: 'disponible',
                owner: null,
                ownerEmail: null,
                lastSeen: new Date().toISOString(),
                createdAt: new Date().toISOString()
            });
            return true;
        }

        // Mise à jour de la date de dernière vue
        await updateDoc(docRef, { lastSeen: new Date().toISOString() });
        return false;
    }

    /**
     * Assigne une unité à un utilisateur
     */
    async assignUnitToUser(unitId, userEmail, userId) {
        const docRef = doc(db, COLLECTIONS.UNITS, unitId);
        await updateDoc(docRef, {
            status: 'actif',
            owner: userId,
            ownerEmail: userEmail,
            assignedAt: new Date().toISOString()
        });
    }

    /**
     * Crée un utilisateur complet (Auth + Firestore) sans déconnecter l'admin actuel
     */
    async createUser(email, password, userData) {
        // Configuration pour l'instance secondaire
        const firebaseConfig = {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_FIREBASE_APP_ID
        };

        // On crée une application secondaire pour ne pas interférer avec la session Admin
        const secondaryApp = initializeApp(firebaseConfig, "SecondaryAuth");
        const secondaryAuth = getAuth(secondaryApp);

        try {
            // 1. Création dans Auth
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const uid = userCredential.user.uid;

            // 2. Création dans Firestore via l'instance principale
            await setDoc(doc(db, COLLECTIONS.USERS, uid), {
                ...userData,
                uid: uid,
                createdAt: new Date().toISOString()
            });

            // 3. Si c'est un exploitant, on crée aussi son profil dans 'producteurs'
            if (userData.role === 'exploitant') {
                await setDoc(doc(db, COLLECTIONS.PRODUCTEURS, uid), {
                    producerId: uid,
                    fullName: userData.fullName || userData.name,
                    email: email,
                    localisation: userData.localisation || 'Bénin',
                    assignedUnit: userData.assignedUnit || '01',
                    certification: 'Standard',
                    surface: '0 ha',
                    gps: { lat: 6.36, lng: 2.43 }, // Cotonou par défaut
                    createdAt: new Date().toISOString()
                });
            }

            // 3. Déconnexion de l'instance secondaire (obligatoire)
            await signOut(secondaryAuth);
            await deleteApp(secondaryApp);

            return uid;
        } catch (error) {
            if (secondaryApp) await deleteApp(secondaryApp);
            throw error;
        }
    }

    async getUserProfile(userId) {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
        if (!userDoc.exists()) return null;

        const userData = userDoc.data();

        // Si c'est un exploitant, on enrichit avec les données de sa collection dédiée
        if (userData.role === 'exploitant') {
            const prodDoc = await getDoc(doc(db, COLLECTIONS.PRODUCTEURS, userId));
            if (prodDoc.exists()) {
                return { ...userData, ...prodDoc.data() };
            }
        }

        return userData;
    }

    /**
     * Met à jour le profil d'un producteur
     */
    async updateProducerProfile(producerId, data) {
        await setDoc(doc(db, COLLECTIONS.PRODUCTEURS, producerId), {
            ...data,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }
    async saveUser(userId, data) {
        await setDoc(doc(db, COLLECTIONS.USERS, userId), data, { merge: true });
    }

    /**
     * Récupère tous les lots (Supervision Admin)
     */
    async getLots() {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.LOTS));
        const lots = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('📊 [DATABASE] getLots() - Réponse:', JSON.stringify(lots, null, 2));
        console.log('📊 [DATABASE] getLots() - Nombre de lots:', lots.length);
        return lots;
    }

    // ==========================================
    // LOTS DE PRODUCTION (Industrie)
    // ==========================================

    async getLotsByIndustry(industryId) {
        const q = query(
            collection(db, COLLECTIONS.LOTS),
            where('handledBy', '==', industryId),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async saveLot(lotData) {
        // Utiliser l'ID lisible (ex: SS-SAC-123) comme ID de document pour le scan
        const docId = lotData.id || `LOT-${Date.now()}`;
        const lotRef = doc(db, COLLECTIONS.LOTS, docId);

        await setDoc(lotRef, {
            ...lotData,
            status: lotData.status || 'en_attente',
            createdAt: new Date().toISOString()
        });
        return docId;
    }

    async updateLotStatus(lotId, status, industryId) {
        const lotRef = doc(db, COLLECTIONS.LOTS, lotId);
        await updateDoc(lotRef, {
            status: status,
            handledBy: industryId,
            updatedAt: new Date().toISOString()
        });
    }


    /**
     * Récupère l'historique des lots/étiquettes générés par un exploitant
     */
    async getExploitantHistory(userId) {
        const q = query(
            collection(db, COLLECTIONS.LOTS),
            where('createdBy', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const history = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('📊 [DATABASE] getExploitantHistory(' + userId + ') - Réponse:', JSON.stringify(history, null, 2));
        console.log('📊 [DATABASE] getExploitantHistory() - Nombre de lots:', history.length);
        return history;
    }

    // ==========================================
    // HISTORIQUE & RÉGLAGES (Exploitant)
    // ==========================================

    /**
     * Récupère l'historique de télémétrie pour une unité spécifique
     */
    async getUnitHistory(unitId, limitCount = 50) {
        const q = query(
            collection(db, COLLECTIONS.TELEMETRY),
            where('unitId', '==', unitId),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        const querySnapshot = await getDocs(q);
        const history = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('📊 [DATABASE] getUnitHistory(' + unitId + ') - Réponse:', JSON.stringify(history, null, 2));
        console.log('📊 [DATABASE] getUnitHistory() - Nombre d\'entrées:', history.length);
        if (history.length > 0) console.log('📊 [DATABASE] Exemple de télémétrie:', JSON.stringify(history[0], null, 2));
        return history;
    }

    /**
     * Met à jour les réglages utilisateur dans son profil Firestore
     */
    async updateUserSettings(userId, settings) {
        await setDoc(doc(db, COLLECTIONS.USERS, userId), {
            settings: settings,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    // ==========================================
    // REALTIME DATABASE (États en direct, Présence)
    // ==========================================

    /**
     * Met à jour l'état en temps réel d'une unité
     */
    updateUnitState(unitId, state) {
        if (!rtdb) return;
        const unitRef = ref(rtdb, `units/${unitId}`);
        update(unitRef, {
            ...state,
            lastSeen: Date.now()
        });
    }

    /**
     * Écoute les changements d'état d'une unité en temps réel
     */
    onUnitStateChange(unitId, callback) {
        if (!rtdb) return;
        const unitRef = ref(rtdb, `units/${unitId}`);
        onValue(unitRef, (snapshot) => {
            const data = snapshot.val();
            callback(data);
        });
    }

    /**
     * Enregistre un log de télémétrie dans Firestore (Historique)
     */
    async saveTelemetryLog(unitId, data) {
        const logRef = doc(collection(db, COLLECTIONS.TELEMETRY));
        await setDoc(logRef, {
            unitId,
            ...data,
            timestamp: new Date().toISOString()
        });
    }

    // ==========================================
    // CONFIGURATION DES INDUSTRIES
    // ==========================================

    /**
     * Récupère la configuration complète d'une industrie
     * @param {string} industryId - ID de l'industrie (UID de l'utilisateur industrie)
     * @returns {Object} Configuration avec tous les champs (nom, zone, normes, etc.)
     */
    async getIndustryConfig(industryId) {
        try {
            // Recherche par industryId (champ dans la doc)
            const q = query(
                collection(db, COLLECTIONS.INDUSTRIES),
                where('industryId', '==', industryId)
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const industryDoc = querySnapshot.docs[0];
                const config = industryDoc.data();

                // Définir les valeurs par défaut si manquantes (pour la rétrocompatibilité)
                return {
                    id: industryDoc.id,
                    industryId: config.industryId || industryId,
                    nom: config.nom || 'Industrie',
                    zone: config.zone || 'Zone Industrielle',
                    maxHumidity: config.maxHumidity || 12,
                    qualityStandard: config.qualityStandard || 'Standard Qualité',
                    logo: config.logo || null,
                    primaryColor: config.primaryColor || '#0f172a',
                    accentColor: config.accentColor || '#f7c948',
                    qualityRoleName: config.qualityRoleName || 'Responsable Qualité',
                    directorRoleName: config.directorRoleName || 'Directeur Industriel',
                    // Champs additionnels
                    email: config.email,
                    telephone: config.telephone,
                    adresse: config.adresse,
                    statut: config.statut
                };
            }

            console.warn(`⚠️ Aucune industrie trouvée avec l'ID: ${industryId}`);
            return null;
        } catch (error) {
            console.error('Erreur getIndustryConfig:', error);
            return null;
        }
    }

    async getAllIndustries() {
        try {
            const industriesRef = collection(db, COLLECTIONS.INDUSTRIES);
            const snapshot = await getDocs(industriesRef);
            const industries = [];
            snapshot.forEach(doc => {
                industries.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return industries;
        } catch (error) {
            console.error('Erreur getAllIndustries:', error);
            return [];
        }
    }

    async saveIndustry(industryData) {
        try {
            const industriesRef = collection(db, COLLECTIONS.INDUSTRIES);

            if (industryData.id) {
                // Vérifier si document existe, sinon créer
                const docRef = doc(industriesRef, industryData.id);
                await setDoc(docRef, industryData, { merge: true });
            } else {
                // Créer nouveau document
                const docRef = doc(industriesRef);
                const dataWithId = { ...industryData, id: docRef.id };
                await setDoc(docRef, dataWithId);
                industryData.id = docRef.id;
            }

            console.log('Industrie sauvegardée:', industryData);
            return industryData;
        } catch (error) {
            console.error('Erreur saveIndustry:', error);
            throw error;
        }
    }

    async deleteIndustry(industryId) {
        try {
            const industriesRef = collection(db, COLLECTIONS.INDUSTRIES);
            const docRef = doc(industriesRef, industryId);
            await deleteDoc(docRef);
            console.log('Industrie supprimée:', industryId);
        } catch (error) {
            console.error('Erreur deleteIndustry:', error);
            throw error;
        }
    }
}

const databaseService = new DatabaseService();
export default databaseService;
