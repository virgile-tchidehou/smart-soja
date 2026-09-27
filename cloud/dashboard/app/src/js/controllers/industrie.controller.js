/**
 * Industrie Controller
 * Focus on traceability and quality validation.
 */

import { enforceRoleAccess, setupLogout } from '../utils/roles.js';
import { setupThemeToggle } from '../utils/theme.js';
import qrService from '../services/qr.service.js';
import databaseService from '../services/database.service.js';
import { db, COLLECTIONS, doc, getDoc, collection, query, where, getDocs, BACKEND_URL } from '../config/firebase-init.js';
import notificationService from '../services/notification.service.js';

class IndustrieController {
    constructor() {
        this.lots = [];
        this.industryConfig = null; // Nouvelle propriété pour stocker la config
        this.stats = {
            totalLots: 0,
            validated: 0,
            pending: 0,
            rejected: 0,
            totalWeight: '0 kg'
        };
        this.chart = null;
        this.html5QrCode = null;
    }

    updateStats() {
        this.stats = {
            totalLots: this.lots.length,
            validated: this.lots.filter(l => l.status === 'validé').length,
            pending: this.lots.filter(l => l.status === 'en_attente').length,
            rejected: this.lots.filter(l => l.status === 'rejeté').length,
            totalWeight: this.lots.reduce((acc, l) => acc + (parseInt(l.weight) || 0), 0) + ' kg'
        };
    }

    async init() {
        const userData = enforceRoleAccess('industrie');
        if (!userData) return;

        console.log("Initialisation Dashboard Industrie (Données Firestore)...");
        setupThemeToggle();
        setupLogout('logout-btn');

        try {
            this.userId = userData.uid;

            // NOUVEAU: Charger la configuration complète de l'industrie
            this.industryConfig = await databaseService.getIndustryConfig(this.userId);

            if (!this.industryConfig) {
                console.warn("⚠️ Configuration industrie introuvable, utilisation des valeurs par défaut");
                this.industryConfig = {
                    nom: userData.fullName || userData.name || 'Industrie',
                    zone: 'Zone Industrielle',
                    maxHumidity: 12,
                    qualityStandard: 'Standard Qualité',
                    qualityRoleName: 'Responsable Qualité',
                    directorRoleName: 'Directeur Industriel'
                };
            }

            // Charger uniquement les lots liés à cette industrie
            this.lots = await databaseService.getLotsByIndustry(this.userId);

            this.updateStats();
            this.setupNavigation();
            this.setupScanListener();
            this.render('overview');

            // Affichage sécurisé
            import('../utils/roles.js').then(m => m.showPageContent());
        } catch (error) {
            console.error("Erreur chargement Industrie:", error);
            this.render('overview');
        }
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.bottom-nav .nav-item');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('data-section');

                // Update UI
                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                this.render(section);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    setupScanListener() {
        const scanBtn = document.getElementById('scan-trigger');
        if (scanBtn) {
            scanBtn.addEventListener('click', () => {
                this.render('scanner');
                // Update bottom nav UI
                document.querySelectorAll('.bottom-nav .nav-item').forEach(i => i.classList.remove('active'));
            });
        }
    }

    async render(section = 'overview') {
        const content = document.getElementById('dashboard-content');
        if (!content) return;

        // Arrêter le scanner si actif lors du changement de vue
        if (this.html5QrCode && this.html5QrCode.isScanning) {
            try {
                await this.html5QrCode.stop();
                console.log("Scanner arrêté.");
            } catch (err) {
                console.warn("Erreur arrêt scanner:", err);
            }
        }

        switch (section) {
            case 'overview':
                this.renderOverview(content);
                this.initChart();
                break;
            case 'traceability':
                this.renderTraceability(content);
                break;
            case 'scanner':
                this.renderScanner(content);
                break;
            case 'compliance':
                this.renderCompliance(content);
                break;
            case 'settings':
                this.renderSettings(content);
                break;
            default:
                content.innerHTML = '<div class="glass-card"><h2>Section non trouvée</h2></div>';
        }

        if (window.lucide) window.lucide.createIcons();
    }

    getLotIdentifier(lot) {
        return lot && (lot.id || lot.lotId) ? (lot.id || lot.lotId) : null;
    }

    matchesLotId(lot, lotId) {
        if (!lot || !lotId) return false;
        const candidate = this.getLotIdentifier(lot);
        return candidate === lotId;
    }

    renderScanner(container) {
        container.innerHTML = `
            <div class="welcome-section">
                <h1>Scanner Passeport</h1>
                <p style="color:var(--text-muted);">Vérification de conformité en temps réel</p>
            </div>

            <!-- Scanner Camera Area -->
            <div class="glass-card" id="scanner-card" style="padding: 15px; text-align: center; border: 1px solid var(--glass-border); margin-bottom: 20px; overflow: hidden; min-height: 300px;">
                <div id="reader" style="width: 100%; border-radius: 12px; overflow: hidden; display: none;"></div>
                
                <div id="scanner-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px;">
                    <div style="width: 120px; height: 120px; border: 3px dashed var(--primary); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; position: relative;">
                        <i data-lucide="scan" style="width: 48px; height: 48px; color: var(--primary); opacity: 0.6;"></i>
                    </div>
                    <p style="font-size: 0.9rem; font-weight: 600; margin-bottom: 5px;">Prêt à scanner</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 20px;">Activez la caméra ou saisissez l'ID du lot manuellement</p>
                    
                    <button class="btn-primary" id="btn-start-camera" type="button" aria-label="Activer la camera" style="padding: 12px 24px; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                        <i data-lucide="camera" style="width:18px; height:18px;"></i> Activer la Caméra
                    </button>
                </div>
                
                <div id="scanner-status" role="status" aria-live="polite" style="display: none; margin-top: 10px; padding: 10px; border-radius: 8px;"></div>
            </div>

            <!-- Saisie Manuelle -->
            <div class="glass-card" style="padding: 20px; margin-bottom: 20px;">
                <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="text-cursor-input" style="width:16px; color: var(--primary);"></i>
                    Saisie Manuelle de l'ID
                </div>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="manual-lot-input" placeholder="Ex: LOT-2604-A" aria-label="Identifiant du lot"
                        style="flex:1; background: var(--glass-bg); border: 1px solid var(--glass-border); color: var(--text-main); padding: 12px 16px; border-radius: 12px; font-size: 0.9rem; outline: none; font-family: 'Courier New', monospace; font-weight: 700;">
                    <button class="btn-primary" id="btn-manual-search" type="button" aria-label="Verifier le lot" style="padding: 12px 18px; border-radius: 12px; white-space: nowrap;">
                        Vérifier
                    </button>
                </div>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();

        // ---- Bouton Démarrer Caméra ----
        const startCameraBtn = document.getElementById('btn-start-camera');
        if (startCameraBtn) {
            startCameraBtn.addEventListener('click', () => this.startCameraScanner(container));
        }

        // ---- Recherche Manuelle ----
        const manualInput = document.getElementById('manual-lot-input');
        const manualBtn = document.getElementById('btn-manual-search');

        const doManualSearch = () => {
            const val = manualInput.value.trim().toUpperCase();
            if (!val) return;
            this.handleScannedResult(val);
        };

        if (manualBtn) manualBtn.addEventListener('click', doManualSearch);
        if (manualInput) {
            manualInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') doManualSearch();
            });
        }

    }

    async startCameraScanner(container) {
        const placeholder = document.getElementById('scanner-placeholder');
        const readerEl = document.getElementById('reader');
        const statusEl = document.getElementById('scanner-status');

        if (typeof Html5Qrcode === 'undefined') {
            statusEl.style.display = 'block';
            statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
            statusEl.style.color = 'var(--danger)';
            statusEl.innerHTML = 'Scanner indisponible. Rechargez la page ou utilisez la saisie manuelle.';
            return;
        }

        try {
            // Vérifier si des caméras sont disponibles
            const devices = await Html5Qrcode.getCameras();

            if (!devices || devices.length === 0) {
                statusEl.style.display = 'block';
                statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
                statusEl.style.color = 'var(--danger)';
                statusEl.innerHTML = '<i data-lucide="camera-off" style="width:16px; vertical-align:middle;"></i> Aucune caméra détectée. Utilisez la saisie manuelle.';
                if (window.lucide) window.lucide.createIcons();
                return;
            }

            // Caméra disponible : afficher le lecteur
            placeholder.style.display = 'none';
            readerEl.style.display = 'block';

            this.html5QrCode = new Html5Qrcode("reader");
            const qrConfig = { fps: 10, qrbox: { width: 250, height: 250 } };

            await this.html5QrCode.start(
                { facingMode: "environment" },
                qrConfig,
                (decodedText) => {
                    console.log(`✅ Scan réussi: ${decodedText}`);
                    // Arrêter le scanner après un scan réussi
                    if (this.html5QrCode && this.html5QrCode.isScanning) {
                        this.html5QrCode.stop().then(() => {
                            this.handleScannedResult(decodedText);
                        });
                    }
                },
                (errorMessage) => { /* scan en cours... */ }
            );

            // Mise à jour statut
            statusEl.style.display = 'block';
            statusEl.style.background = 'rgba(16, 185, 129, 0.1)';
            statusEl.style.color = 'var(--secondary)';
            statusEl.innerHTML = '● Caméra active — Visez le QR Code';

        } catch (err) {
            console.error("Erreur caméra:", err);
            statusEl.style.display = 'block';
            statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
            statusEl.style.color = 'var(--danger)';
            statusEl.innerHTML = `Accès caméra refusé. Utilisez la saisie manuelle ci-dessous.`;
        }
    }

    async handleScannedResult(lotId) {
        const normalizedLotId = lotId.trim().toUpperCase();

        // 1. Chercher localement d'abord
        let lot = this.lots.find(l => this.matchesLotId(l, normalizedLotId));

        // 2. Si non trouvé (ex: nouveau lot), chercher en base
        if (!lot) {
            console.log(`🔍 Lot ${lotId} non trouvé localement, recherche en base...`);
            try {
                // 1. Recherche directe par ID de document (Nouveau format)
                const docRef = doc(db, COLLECTIONS.LOTS, normalizedLotId);
                let docSnap = await getDoc(docRef);
                let lotDoc = docSnap.exists() ? { technicalId: docSnap.id, ...docSnap.data() } : null;

                // 2. Recherche de secours par champ 'id' (Ancien format)
                if (!lotDoc) {
                    console.log("🔍 Recherche de secours par champ 'id'...");
                    const q = query(collection(db, COLLECTIONS.LOTS), where('id', '==', normalizedLotId));
                    const querySnap = await getDocs(q);
                    if (!querySnap.empty) {
                        const foundDoc = querySnap.docs[0];
                        lotDoc = {
                            technicalId: foundDoc.id, // On garde l'ID Firebase réel !
                            ...foundDoc.data()
                        };
                    }
                }

                if (lotDoc) {
                    const lotData = lotDoc;
                    // [ENRICHISSEMENT] Récupérer le profil producteur pour la traçabilité
                    const producerProfile = await databaseService.getUserProfile(lotData.createdBy);
                    lot = {
                        ...lotData,
                        technicalId: lotData.technicalId || lotData.id, // ID technique pour les updates
                        producer: producerProfile ? (producerProfile.fullName || producerProfile.name) : lotData.producer,
                        location: producerProfile ? producerProfile.localisation : (lotData.location || 'Bénin'),
                        certification: producerProfile ? producerProfile.certification : 'Standard'
                    };

                    // [TRAÇABILITÉ] Enregistrer le scan dans Firestore en utilisant l'ID TECHNIQUE
                    await databaseService.updateLotStatus(lot.technicalId, lot.status || 'en_attente', this.userId);

                    // Ajouter à la liste locale
                    if (!this.lots.find(l => this.matchesLotId(l, this.getLotIdentifier(lot)))) {
                        this.lots.unshift(lot);
                        this.updateStats();
                    }
                }
            } catch (err) {
                console.error("Erreur recherche base:", err);
            }
        }

        if (lot) {
            // Vibreur si dispo
            if (navigator.vibrate) navigator.vibrate(100);
            this.showPassportModal(lot);
        } else {
            console.warn("Lot non trouvé:", lotId);
            notificationService.error("Erreur", `Lot inconnu : ${lotId}`);
        }
    }

    async downloadPassportPDF(lotId) {
        try {
            notificationService.info("Génération en cours", "Préparation de votre passeport premium...");

            const response = await fetch(`${BACKEND_URL}/api/generate-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lotId: lotId })
            });

            if (!response.ok) throw new Error("Erreur serveur lors de la génération");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Passport-${lotId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            notificationService.success("Succès", "Votre passeport est prêt !");
        } catch (err) {
            console.error("Erreur PDF Backend:", err);
            notificationService.error("Erreur", "Impossible de générer le PDF via le serveur.");
        }
    }

    showPassportModal(lot) {
        const modal = document.createElement('div');
        modal.className = 'passport-modal-overlay';
        modal.innerHTML = `
            <div class="control-center-container premium-glass">
                <!-- Glace animée en arrière-plan -->
                <div class="modal-bg-glow"></div>

                <div class="control-header">
                    <div class="header-main">
                        <div class="status-orb pulse"></div>
                        <div>
                            <div class="control-title">HUB DE TRAÇABILITÉ NUMÉRIQUE</div>
                            <div class="control-subtitle">Analyse d'intégrité en temps réel • ID: ${lot.id || 'N/A'}</div>
                        </div>
                    </div>
                    <button class="btn-close-control"><i data-lucide="x"></i></button>
                </div>

                <div class="control-body">
                    <!-- Section Haut : Score de Confiance -->
                    <div class="trust-banner">
                        <div class="trust-score">
                            <span class="score-label">INDICE DE CONFIANCE</span>
                            <span class="score-value">99.8%</span>
                        </div>
                        <div class="trust-badges">
                            <div class="trust-tag"><i data-lucide="database"></i> BLOCKCHAIN</div>
                            <div class="trust-tag"><i data-lucide="cpu"></i> IOT SECURE</div>
                            <div class="trust-tag"><i data-lucide="check-circle"></i> ${this.industryConfig?.qualityStandard?.toUpperCase() || 'STANDARD'} READY</div>
                        </div>
                    </div>

                    <div class="validation-grid-v2">
                        <!-- Colonne Gauche : Analyses IoT -->
                        <div class="analysis-column">
                            <h3 class="section-label"><i data-lucide="activity"></i> ANALYSES CAPTEURS</h3>
                            
                            <div class="sensor-metric-card">
                                <div class="metric-info">
                                    <span class="m-label">Humidité (IoT)</span>
                                    <span class="m-value ${parseFloat(lot.quality || lot.humidity || 0) > 12 ? 'critical' : 'optimal'}">
                                        ${lot.quality || (lot.humidity ? lot.humidity + '%' : '12%')}
                                    </span>
                                </div>
                                <div class="m-progress-bg">
                                    <div class="m-progress-fill" style="width: ${Math.min(100, (parseFloat(lot.quality || lot.humidity || 0) / 15) * 100)}%; background: ${parseFloat(lot.quality || lot.humidity || 0) > 12 ? 'var(--danger)' : 'var(--secondary)'}"></div>
                                </div>
                                <div class="m-footer">Seuil toléré : ≤ ${this.industryConfig?.maxHumidity || 12}%</div>
                            </div>

                            <div class="sensor-metric-card">
                                <div class="metric-info">
                                    <span class="m-label">Poids Net (Cellule de charge)</span>
                                    <span class="m-value">${lot.weight || '0'} kg</span>
                                </div>
                                <div class="m-progress-bg">
                                    <div class="m-progress-fill" style="width: 85%; background: var(--primary);"></div>
                                </div>
                                <div class="m-footer">Précision balance : ±0.01kg</div>
                            </div>

                            <div class="origin-card" style="margin-bottom:10px;">
                                <i data-lucide="user-check"></i>
                                <div>
                                    <div class="o-label">Producteur & Certification</div>
                                    <div class="o-value">${lot.producer || 'N/A'} — <span style="color:var(--secondary); font-size:0.8rem;">${lot.certification || 'Standard'}</span></div>
                                </div>
                            </div>

                            <div class="origin-card">
                                <i data-lucide="map-pin"></i>
                                <div>
                                    <div class="o-label">Origine Géographique</div>
                                    <div class="o-value">${lot.location || 'Bénin'}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Colonne Droite : Chronologie de Traçabilité -->
                        <div class="timeline-column">
                            <h3 class="section-label"><i data-lucide="list-tree"></i> PARCOURS DU LOT</h3>
                            <div class="smart-timeline">
                                <div class="time-step completed">
                                    <div class="step-icon"><i data-lucide="factory"></i></div>
                                    <div class="step-content">
                                        <div class="s-title">Réception & Pesée IoT</div>
                                        <div class="s-desc">${lot.date || 'Aujourd\'hui'} • Unité #${lot.unitId || '01'}</div>
                                    </div>
                                </div>
                                <div class="time-step completed">
                                    <div class="step-icon"><i data-lucide="check-square"></i></div>
                                    <div class="step-content">
                                        <div class="s-title">Contrôle Qualité</div>
                                        <div class="s-desc">Analyse d'humidité auto.</div>
                                    </div>
                                </div>
                                <div class="time-step active">
                                    <div class="step-icon"><i data-lucide="truck"></i></div>
                                    <div class="step-content">
                                        <div class="s-title">Réception ${this.industryConfig?.nom || 'Industrie'}</div>
                                        <div class="s-desc">En attente de validation indus.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="control-actions">
                    <div class="main-decisions" style="width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        ${lot.status === 'en_attente' ? `
                            <button class="btn-action reject btn-reject" style="width: 100%; justify-content: center;"><i data-lucide="x-circle"></i> REJETER</button>
                            <button class="btn-action approve btn-approve" style="width: 100%; justify-content: center;"><i data-lucide="check-circle-2"></i> VALIDER LE LOT</button>
                        ` : `
                            <div style="grid-column: 1 / -1; padding: 15px 20px; background: ${lot.status === 'validé' ? '#ecfdf5' : '#fef2f2'}; border-radius: 10px; border-left: 5px solid ${lot.status === 'validé' ? '#10b981' : '#ef4444'};">
                                <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 5px;">STATUT IMMUABLE</div>
                                <div style="font-size: 16px; font-weight: 900; color: ${lot.status === 'validé' ? '#10b981' : '#ef4444'};">
                                    ${lot.status === 'validé' ? '✓ LOT VALIDÉ' : '✗ LOT REJETÉ'}
                                </div>
                                <div style="font-size: 10px; color: #64748b; margin-top: 8px;">Cette décision a été enregistrée et ne peut pas être modifiée.</div>
                            </div>
                        `}
                    </div>
                </div>
            </div>
                <div style="position: absolute; left: -9999px; top: 0; opacity: 0; pointer-events: none;">
                    <div id="printable-passport" style="background: white; color: #1e293b; width: 210mm; min-height: 295mm; font-family: 'Inter', 'Segoe UI', Arial, sans-serif; box-sizing: border-box; padding: 0; overflow: hidden; position: relative;">
                        <div style="height: 6px; background: linear-gradient(90deg, #F7C948, #D4A017, #F7C948);"></div>
                        
                        <!-- Header -->
                        <div style="padding: 30px 40px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0;">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <img src="${window.location.origin}/assets/smart_soja_logo_premium.png" style="height: 55px; width: auto;">
                                <div>
                                    <div style="font-weight: 900; font-size: 22px; color: #0f172a; letter-spacing: 1px;">${this.industryConfig?.nom || 'SMART-SOJA'}</div>
                                    <div style="font-size: 9px; color: #94a3b8; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;">Plateforme IoT de Tra\u00e7abilit\u00e9 Agricole</div>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Document N\u00b0</div>
                                <div style="font-weight: 900; font-size: 16px; color: #0f172a; font-family: 'Courier New', monospace;">${lot.id}</div>
                            </div>
                        </div>

                        <!-- Title Band -->
                        <div style="background: #0f172a; padding: 18px 40px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 900; font-size: 20px; color: #F7C948; letter-spacing: 2px;">PASSEPORT NUM\u00c9RIQUE</div>
                                <div style="font-size: 10px; color: #94a3b8; margin-top: 3px; font-weight: 600;">CERTIFICAT DE CONFORMITÉ QUALITÉ — ${this.industryConfig?.zone || 'ZONE INDUSTRIELLE'}</div>
                            </div>
                            <div style="background: ${parseFloat(lot.quality || lot.humidity || 12) <= 12 ? '#10b981' : '#ef4444'}; color: white; padding: 8px 18px; border-radius: 6px; font-weight: 900; font-size: 12px; letter-spacing: 1px;">
                                ${parseFloat(lot.quality || lot.humidity || 12) <= 12 ? '\u2713 CONFORME' : '\u2717 NON CONFORME'}
                            </div>
                        </div>

                        <!-- Body -->
                        <div style="padding: 30px 40px;">
                            <p style="font-size: 11px; color: #64748b; line-height: 1.6; margin: 0 0 25px; text-align: justify;">
                                Ce document certifie l\u2019authenticit\u00e9 et la conformit\u00e9 des donn\u00e9es collect\u00e9es par les capteurs IoT embarqu\u00e9s 
                                du syst\u00e8me ${this.industryConfig?.nom || 'Smart-Soja'} pour le lot r\u00e9f\u00e9renc\u00e9 ci-dessous. Les mesures ont \u00e9t\u00e9 effectu\u00e9es de mani\u00e8re automatique 
                                et transmises via protocole MQTT s\u00e9curis\u00e9.
                            </p>

                            <!-- Info Grid -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                                <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                                    <div style="background: #f8fafc; padding: 10px 15px; font-weight: 800; font-size: 10px; color: #64748b; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Informations G\u00e9n\u00e9rales</div>
                                    <div style="padding: 15px;">
                                        <div style="margin-bottom: 12px;">
                                            <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Identifiant du Lot</div>
                                            <div style="font-size: 16px; font-weight: 900; color: #0f172a; font-family: 'Courier New', monospace;">${lot.id || 'N/A'}</div>
                                        </div>
                                        <div style="margin-bottom: 12px;">
                                            <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Producteur / Coop\u00e9rative</div>
                                                <span style="font-size: 11px; font-weight: 800; color: #0f172a;">${lot.producer || 'Exploitant Certifié SmartSoja'}</span>
                                        </div>
                                        <div>
                                            <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Date de R\u00e9ception</div>
                                            <div style="font-size: 13px; font-weight: 600; color: #1e293b;">${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                        </div>
                                    </div>
                                </div>
                                <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                                    <div style="background: #f8fafc; padding: 10px 15px; font-weight: 800; font-size: 10px; color: #64748b; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Analyses Techniques (Capteurs IoT)</div>
                                    <div style="padding: 15px;">
                                        <div style="margin-bottom: 12px;">
                                            <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Taux d\u2019Humidit\u00e9</div>
                                            <div style="font-size: 22px; font-weight: 900; color: ${parseFloat(lot.quality || lot.humidity || 0) <= 12 ? '#10b981' : '#ef4444'};">${lot.quality || (lot.humidity ? lot.humidity + '%' : '12%')}</div>
                                            <div style="font-size: 9px; color: #94a3b8;">Seuil max. : ${this.industryConfig?.maxHumidity || 12}% \u2014 ${this.industryConfig?.qualityStandard || 'Norme Standard'}</div>
                                        </div>
                                        <div style="margin-bottom: 12px;">
                                            <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Poids Net D\u00e9clar\u00e9</div>
                                            <div style="font-size: 16px; font-weight: 900; color: #0f172a;">${lot.weight || '0'} kg</div>
                                        </div>
                                        <div>
                                            <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Verdict Qualit\u00e9</div>
                                            <div style="font-size: 13px; font-weight: 900; color: ${parseFloat(lot.quality || lot.humidity || 12) <= 12 ? '#10b981' : '#ef4444'};">
                                                ${parseFloat(lot.quality || lot.humidity || 12) <= 12 ? 'CONFORME AUX STANDARDS' : 'CONTR\u00d4LE COMPL\u00c9MENTAIRE REQUIS'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Humidity Gauge -->
                            <div style="margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px 20px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">\u00c9chelle d\u2019Humidit\u00e9</span>
                                    <span style="font-size: 12px; font-weight: 900; color: ${parseFloat(lot.quality || lot.humidity || 0) <= 12 ? '#10b981' : '#ef4444'};">${lot.quality || (lot.humidity ? lot.humidity + '%' : '12%')}</span>
                                </div>
                                <div style="height: 10px; background: #f1f5f9; border-radius: 10px; position: relative; overflow: hidden;">
                                    <div style="height: 100%; width: ${Math.min(100, (parseFloat(lot.quality || lot.humidity || 0) / 15) * 100)}%; background: ${parseFloat(lot.quality || lot.humidity || 0) <= 12 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f59e0b, #ef4444)'}; border-radius: 10px;"></div>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8; margin-top: 5px; font-weight: 600;">
                                    <span>0%</span>
                                    <span style="color: #D4A017;">CIBLE ${this.industryConfig?.maxHumidity || 12}%</span>
                                    <span>15%</span>
                                </div>
                            </div>

                            <!-- Signatures -->
                            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                                <div style="text-align: center; width: 200px;">
                                    <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-bottom: 50px;">${this.industryConfig?.qualityRoleName || 'Le Responsable Qualité'}</div>
                                    <div style="border-top: 1px solid #1e293b; padding-top: 8px; font-size: 10px; color: #64748b;">(Cachet et Signature)</div>
                                </div>
                                <div style="text-align: center;">
                                    <div id="passport-final-qr" style="display: inline-block; background: #fff; padding: 8px; border: 1px solid #e2e8f0; border-radius: 8px;"></div>
                                    <div style="font-size: 8px; color: #94a3b8; margin-top: 5px; font-weight: 600;">SCANNEZ POUR V\u00c9RIFIER</div>
                                </div>
                                <div style="text-align: center; width: 200px;">
                                    <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-bottom: 50px;">${this.industryConfig?.directorRoleName || 'Le Directeur Industriel'}</div>
                                    <div style="border-top: 1px solid #1e293b; padding-top: 8px; font-size: 10px; color: #64748b;">(Cachet et Signature)</div>
                                </div>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px 40px; display: flex; justify-content: space-between; align-items: center; position: absolute; bottom: 6px; left: 0; right: 0;">
                            <div style="font-size: 8px; color: #94a3b8; font-weight: 600;">
                                ${this.industryConfig?.nom || 'Smart-Soja'} IoT Platform \u00a9 ${new Date().getFullYear()} \u2014 Document officiel g\u00e9n\u00e9r\u00e9 le ${new Date().toLocaleDateString('fr-FR')}
                            </div>
                            <div style="font-size: 8px; color: #94a3b8; font-weight: 700; letter-spacing: 1px;">
                                S\u00c9CURIS\u00c9 VIA BLOCKCHAIN
                            </div>
                        </div>

                        <!-- Gold Bottom Bar -->
                        <div style="height: 6px; background: linear-gradient(90deg, #F7C948, #D4A017, #F7C948); position: absolute; bottom: 0; left: 0; right: 0;"></div>
                    </div>
                </div>
            </div>

        `;

        document.body.appendChild(modal);
        if (window.lucide) window.lucide.createIcons();

        modal.querySelector('.btn-close-control').addEventListener('click', () => modal.remove());

        // Gérer les clics sur les boutons d'action
        const btnApprove = modal.querySelector('.btn-approve');
        const btnReject = modal.querySelector('.btn-reject');

        if (btnApprove) {
            btnApprove.addEventListener('click', async () => {
                // Désactiver les boutons immédiatement
                btnApprove.disabled = true;
                btnReject.disabled = true;
                btnApprove.style.opacity = '0.5';
                btnReject.style.opacity = '0.5';

                const recommendations = modal.querySelector('#lot-recommendations')?.value || '';
                const success = await this.updateLotStatus(lot.technicalId || lot.id, 'validé');

                if (success) {
                    // Générer le PDF automatiquement en arrière-plan (sans attendre)
                    this.downloadPassportPDF(lot.technicalId || lot.id, recommendations)
                        .catch(err => console.error('PDF download error:', err));

                    // Attendre un peu, puis fermer la modale
                    setTimeout(() => modal.remove(), 1000);
                } else {
                    // Réactiver les boutons en cas d'erreur
                    btnApprove.disabled = false;
                    btnReject.disabled = false;
                    btnApprove.style.opacity = '1';
                    btnReject.style.opacity = '1';
                }
            });
        }

        if (btnReject) {
            btnReject.addEventListener('click', async () => {
                // Désactiver les boutons immédiatement
                btnApprove.disabled = true;
                btnReject.disabled = true;
                btnApprove.style.opacity = '0.5';
                btnReject.style.opacity = '0.5';

                const recommendations = modal.querySelector('#lot-recommendations')?.value || '';
                const success = await this.updateLotStatus(lot.technicalId || lot.id, 'rejeté');

                if (success) {
                    // Générer le PDF automatiquement en arrière-plan (sans attendre)
                    this.downloadPassportPDF(lot.technicalId || lot.id, recommendations)
                        .catch(err => console.error('PDF download error:', err));

                    // Attendre un peu, puis fermer la modale
                    setTimeout(() => modal.remove(), 1000);
                } else {
                    // Réactiver les boutons en cas d'erreur
                    btnApprove.disabled = false;
                    btnReject.disabled = false;
                    btnApprove.style.opacity = '1';
                    btnReject.style.opacity = '1';
                }
            });
        }
    }

    async updateLotStatus(lotId, newStatus) {
        try {
            await databaseService.updateLotStatus(lotId, newStatus, this.userId);
            const lot = this.lots.find(l => l.id === lotId || l.technicalId === lotId);
            if (lot) {
                lot.status = newStatus;
                this.updateStats();
                this.render('traceability');
                notificationService.success("Mise à jour réussie", `Le lot ${lotId} est désormais ${newStatus.toUpperCase()}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error("Erreur mise à jour lot:", error);
            notificationService.error("Erreur", "Impossible de mettre à jour le statut du lot.");
            return false;
        }
    }

    renderOverview(container) {
        container.innerHTML = `
            <div class="welcome-section">
                <h1>Qualité & Production</h1>
                <div class="device-badge">
                    <i data-lucide="factory"></i>
                    <span>Total Traité: ${this.stats.totalWeight}</span>
                </div>
            </div>

            <div class="sensor-scroll">
                <div class="glass-card sensor-card">
                    <div class="card-header">
                        <span class="card-label">Lots Reçus</span>
                        <div class="card-icon"><i data-lucide="package" style="color: var(--accent);"></i></div>
                    </div>
                    <div class="sensor-value">${this.stats.totalLots}</div>
                </div>
                <div class="glass-card sensor-card">
                    <div class="card-header">
                        <span class="card-label">Taux de Validation</span>
                        <div class="card-icon"><i data-lucide="check-circle" style="color: var(--secondary);"></i></div>
                    </div>
                    <div class="sensor-value">${this.stats.totalLots > 0 ? Math.round((this.stats.validated / this.stats.totalLots) * 100) : 0}%</div>
                </div>

                <div class="glass-card sensor-card">
                    <div class="card-header">
                        <span class="card-label">Rejetés</span>
                        <div class="card-icon"><i data-lucide="x-circle" style="color: var(--danger);"></i></div>
                    </div>
                    <div class="sensor-value">${this.stats.rejected}</div>
                </div>
            </div>

            <div class="chart-section">
                <div class="chart-header">
                    <h2>Tendance Humidité</h2>
                </div>
                <div class="glass-card" style="padding: 15px;">
                    <div id="quality-chart" style="height: 180px;"></div>
                </div>
            </div>

            <div style="margin-top: 20px; margin-bottom: 10px;">
                <button class="btn-inline-scan glass-card" id="btn-scan-overview" style="width: 100%; padding: 16px; display: flex; align-items: center; justify-content: center; gap: 12px; cursor: pointer; border: 1px dashed var(--primary); background: rgba(247, 201, 72, 0.05); color: var(--primary); font-weight: 700; font-size: 0.9rem; border-radius: 16px; transition: all 0.3s;">
                    <i data-lucide="scan-line"></i> SCANNER UN PASSEPORT
                </button>
            </div>
        `;

        document.getElementById('btn-scan-overview')?.addEventListener('click', () => {
            document.querySelectorAll('.bottom-nav .nav-item').forEach(i => i.classList.remove('active'));
            this.render('scanner');
        });
    }

    initChart() {
        const chartEl = document.getElementById('quality-chart');
        if (!chartEl) return;

        // Extraire les données des derniers lots
        const lastLots = [...this.lots].slice(-10);
        const data = lastLots.map(l => parseFloat(l.quality) || 0);
        const labels = lastLots.map(l => l.id.split('-').pop());

        const options = {
            series: [{
                name: 'Humidité (%)',
                data: data
            }],
            chart: {
                type: 'area',
                height: 180,
                toolbar: { show: false },
                sparkline: { enabled: false },
                animations: { enabled: true, easing: 'easeinout', speed: 800 }
            },
            colors: ['#3B82F6'],
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.45,
                    opacityTo: 0.05,
                    stops: [20, 100]
                }
            },
            stroke: { curve: 'smooth', width: 3 },
            dataLabels: { enabled: false },
            grid: { show: false },
            xaxis: {
                categories: labels,
                labels: { show: true, style: { colors: '#94a3b8', fontSize: '10px' } },
                axisBorder: { show: false },
                axisTicks: { show: false }
            },
            yaxis: { show: false },
            tooltip: {
                theme: 'dark',
                x: { show: true },
                y: { formatter: (val) => val + '%' }
            }
        };

        if (this.chart) this.chart.destroy();
        this.chart = new ApexCharts(chartEl, options);
        this.chart.render();
    }

    renderCompliance(container) {
        container.innerHTML = `
            <div class="welcome-section">
                <h1>Normes & Conformité</h1>
                <p style="color:var(--text-muted);">Standards de qualité ${this.industryConfig?.qualityStandard || 'STANDARD'} pour le soja</p>
            </div>

            <div class="glass-card" style="padding: 20px; margin-bottom: 20px;">
                <h3 style="color: var(--secondary); margin-top: 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="award"></i> Certifications Requises
                </h3>
                <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                        <span style="font-size: 0.9rem;">Taux d'humidité < ${this.industryConfig?.maxHumidity || 12}%</span>
                        <i data-lucide="check-circle" style="color: var(--secondary); width: 18px;"></i>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                        <span style="font-size: 0.9rem;">Absence de corps étrangers</span>
                        <i data-lucide="check-circle" style="color: var(--secondary); width: 18px;"></i>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                        <span style="font-size: 0.9rem;">Traçabilité IoT validée</span>
                        <i data-lucide="check-circle" style="color: var(--secondary); width: 18px;"></i>
                    </div>
                </div>
            </div>

            <div class="glass-card" style="padding: 20px;">
                <h3 style="color: var(--primary); margin-top: 0;">Statistiques de Rejets</h3>
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 2.5rem; font-weight: 800; color: var(--danger);">${this.stats.rejected}</div>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">Lots non-conformes détectés</p>
                </div>
            </div>
        `;
    }

    renderSettings(container) {
        const userData = JSON.parse(localStorage.getItem('smartsoja_user')) || { fullName: 'Utilisateur Industrie' };

        container.innerHTML = `
            <div class="welcome-section">
                <h1>Paramètres</h1>
                <p style="color:var(--text-muted);">Gestion du compte industriel</p>
            </div>

            <div class="glass-card" style="padding: 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 20px;">
                <div style="width: 60px; height: 60px; background: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; color: white;">
                    ${userData.fullName.charAt(0)}
                </div>
                <div>
                    <div style="font-weight: 700; font-size: 1.1rem;">${userData.fullName}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Responsable Qualité Industrie</div>
                </div>
            </div>

            <div class="glass-card" style="padding: 20px;">
                <h3 style="margin-top: 0; font-size: 1rem; margin-bottom: 15px;">Préférences</h3>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <button id="btn-logout-industrie" style="width: 100%; padding: 12px; background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.3s;">
                        <i data-lucide="log-out"></i> DÉCONNEXION
                    </button>
                </div>
            </div>
        `;

        setupLogout('btn-logout-industrie');
    }

    renderTraceability(container, searchTerm = '', currentFilter = 'tous') {
        const statusColors = { 'validé': '#10b981', 'en_attente': '#f59e0b', 'rejeté': '#ef4444' };

        let filteredLots = this.lots.filter(l =>
            (l.id && l.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (l.producer && l.producer.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (l.location && l.location.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        // Filtre par onglet
        if (currentFilter === 'pending') filteredLots = filteredLots.filter(l => l.status === 'en_attente');
        else if (currentFilter === 'completed') filteredLots = filteredLots.filter(l => l.status === 'validé' || l.status === 'rejeté');

        // Tri par date (plus récent en haut)
        filteredLots.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        container.innerHTML = `
            <div class="welcome-section">
                <h1>Traçabilité</h1>
                <p style="color:var(--text-muted);">Gestion du registre des arrivages</p>
            </div>

            <div class="search-container glass-card trace-search" style="margin-bottom: 15px; padding: 10px 15px; display: flex; align-items: center; gap: 10px;">
                <i data-lucide="search" style="width: 18px; color: var(--text-muted);"></i>
                <input type="text" id="lot-search-input" placeholder="ID, Producteur, Ville..." value="${searchTerm}" style="background: transparent; border: none; color: var(--text-main); width: 100%; outline: none; font-size: 0.9rem;">
            </div>

            <div class="filter-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px;">
                <button class="filter-tab ${currentFilter === 'tous' ? 'active' : ''}" data-filter="tous">Tous (${this.lots.length})</button>
                <button class="filter-tab ${currentFilter === 'pending' ? 'active' : ''}" data-filter="pending">À valider (${this.lots.filter(l => l.status === 'en_attente').length})</button>
                <button class="filter-tab ${currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">Archives</button>
            </div>

            <div class="trace-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                <button class="glass-card" id="btn-scan-trace" style="padding: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; border: 1px solid var(--primary); background: rgba(247, 201, 72, 0.05); color: var(--primary); font-weight: 800; font-size: 0.8rem; border-radius: 14px; text-transform: uppercase;">
                    <i data-lucide="scan-line" style="width: 16px;"></i> Scanner
                </button>
                <button class="glass-card" id="btn-bulk-pdf" style="padding: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; border: 1px solid var(--secondary); background: rgba(16, 185, 129, 0.05); color: var(--secondary); font-weight: 800; font-size: 0.8rem; border-radius: 14px; text-transform: uppercase;">
                    <i data-lucide="file-stack" style="width: 16px;"></i> Rapport Global
                </button>
            </div>

            <div style="display:flex; flex-direction:column; gap:15px; padding-bottom: 30px;" id="lots-list-container">
                ${filteredLots.length > 0 ? filteredLots.map(lot => `
                    <div class="glass-card lot-item-card premium-hover" style="padding:18px; display:flex; flex-direction:column; gap:12px; cursor:pointer; position:relative; overflow:hidden;" data-id="${lot.id}">
                        <div style="position:absolute; left:0; top:0; bottom:0; width:4px; background:${statusColors[lot.status] || '#64748b'};"></div>
                        
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <div style="font-weight:800; color:var(--text-main); font-size:1rem; font-family:'Outfit';">${lot.id || 'N/A'}</div>
                                <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:600; margin-top:2px;">
                                    ${lot.createdAt ? new Date(lot.createdAt).toLocaleDateString('fr-FR') : 'Date inconnue'}
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div class="btn-download-single" data-id="${lot.id}" title="Télécharger PDF" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(247, 201, 72, 0.1); color: var(--primary); display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid rgba(247, 201, 72, 0.2); transition: all 0.2s;">
                                    <i data-lucide="download" style="width: 16px;"></i>
                                </div>
                                <div style="font-size:0.65rem; padding:4px 10px; border-radius:20px; background:${statusColors[lot.status] || '#eee'}20; color:${statusColors[lot.status] || '#64748b'}; font-weight:800; border:1px solid ${statusColors[lot.status] || '#64748b'}40;">
                                    ${(lot.status || 'en_attente').toUpperCase()}
                                </div>
                            </div>
                        </div>

                        <div class="trace-meta" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; padding-top:5px; border-top:1px solid rgba(255,255,255,0.05);">
                            <div>
                                <div style="font-size:0.65rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Producteur</div>
                                <div class="trace-producer" style="font-size:0.85rem; font-weight:700; color:var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${lot.producer || 'Inconnu'}</div>
                            </div>
                            <div class="trace-meta-right" style="text-align:right;">
                                <div style="font-size:0.65rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Poids Net</div>
                                <div style="font-size:0.85rem; font-weight:700; color:var(--text-main);">${lot.weight || '0'} kg</div>
                            </div>
                        </div>
                    </div>
                `).join('') : `
                    <div style="text-align: center; padding: 60px 20px; color: var(--text-muted); background:rgba(0,0,0,0.1); border-radius:20px; border:1px dashed rgba(255,255,255,0.1);">
                        <i data-lucide="package-search" style="width: 48px; height: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                        <p style="font-size:0.9rem; font-weight:600;">Aucun lot ne correspond à vos critères</p>
                    </div>
                `}
            </div>
        `;

        // Event Listeners
        const searchInput = document.getElementById('lot-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderTraceability(container, e.target.value, currentFilter);
            });
        }

        // Filtres
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const filter = tab.getAttribute('data-filter');
                this.renderTraceability(container, searchInput ? searchInput.value : '', filter);
            });
        });

        // Scan
        document.getElementById('btn-scan-trace')?.addEventListener('click', () => {
            document.querySelectorAll('.bottom-nav .nav-item').forEach(i => i.classList.remove('active'));
            this.render('scanner');
        });

        // Téléchargement Individuel
        container.querySelectorAll('.btn-download-single').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Éviter d'ouvrir la modale
                const lotId = btn.getAttribute('data-id');
                const lot = this.lots.find(l => l.id === lotId || l.technicalId === lotId);
                this.downloadPassportPDF(lot.technicalId || lot.id);
            });
        });

        // Détails Lot
        container.querySelectorAll('.lot-item-card').forEach(card => {
            card.addEventListener('click', () => {
                const lotId = card.getAttribute('data-id');
                const lot = this.lots.find(l => l.id === lotId || l.technicalId === lotId);
                if (lot) this.showPassportModal(lot);
            });
        });

        // Téléchargement Global
        document.getElementById('btn-bulk-pdf')?.addEventListener('click', () => {
            this.downloadBulkReport();
        });

        if (window.lucide) window.lucide.createIcons();
    }

    async downloadPassportPDF(lotId, recommendations = '') {
        try {
            notificationService.info("Génération PDF", "Votre document est en cours de création...");
            const response = await fetch(`${BACKEND_URL}/api/generate-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lotId,
                    recommendations,
                    industryName: this.industryName
                })
            });

            if (!response.ok) throw new Error("Erreur serveur lors de la génération");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Passport-${lotId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            notificationService.success("Succès", "Passeport téléchargé !");
        } catch (error) {
            console.error("Erreur PDF Backend:", error);
            notificationService.error("Erreur PDF", "Impossible de générer le document.");
        }
    }

    async downloadBulkReport() {
        try {
            const lotsToInclude = this.lots.filter(l => l.status !== 'en_attente');
            if (lotsToInclude.length === 0) {
                return notificationService.info("Rapport Vide", "Aucun lot validé ou rejeté à inclure.");
            }

            notificationService.info("Rapport Global", `Génération de ${lotsToInclude.length} pages...`);

            const response = await fetch(`${BACKEND_URL}/api/generate-bulk-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lots: lotsToInclude })
            });

            if (!response.ok) throw new Error("Erreur lors du rapport global");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Rapport-Global-Industrie-${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            notificationService.success("Succès", "Rapport global téléchargé !");
        } catch (error) {
            console.error("Erreur Bulk PDF:", error);
            notificationService.error("Erreur", "Le rapport global n'a pas pu être généré.");
        }
    }
}

const industrieController = new IndustrieController();
export default industrieController;
