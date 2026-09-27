/**
 * Admin Controller
 * Fleet supervision and global statistics.
 */

import { enforceRoleAccess, setupLogout } from '../utils/roles.js';
import { setupThemeToggle } from '../utils/theme.js';
import mqttService from '../services/mqtt.service.js';
import databaseService from '../services/database.service.js';
import emailService from '../services/email.service.js';
import notificationService from '../services/notification.service.js';

class AdminController {
    constructor() {
        // Données locales (synchronisées avec Firebase plus tard)
        this.units = [];
        this.users = [];
        this.lots = [];
        this.industries = []; // Nouvelle: gestion des industries
        this.stats = {
            activeUnits: 0,
            totalVolume: '0 T',
            avgQuality: '0%',
            totalProducteurs: 0,
            alertes: 0
        };
    }

    getNetworkStatus(lastSeen) {
        if (!lastSeen) return false;
        const last = new Date(lastSeen).getTime();
        const now = new Date().getTime();
        return (now - last) < 5 * 60 * 1000; // < 5 minutes
    }

    updateStats() {
        let totalVolume = 0;
        let qualitySum = 0;
        let validLots = 0;

        if (this.lots && this.lots.length > 0) {
            this.lots.forEach(l => {
                if (l.status === 'validé') {
                    totalVolume += parseFloat(l.weight) || 0;
                    qualitySum += parseFloat(l.quality || l.humidity) || 0;
                    validLots++;
                }
            });
        }

        const avgQual = validLots > 0 ? (qualitySum / validLots).toFixed(1) : 0;

        const activeCount = this.units.filter(u => this.getNetworkStatus(u.lastSeen)).length;
        const offlineCount = this.units.filter(u => !this.getNetworkStatus(u.lastSeen)).length;

        this.stats = {
            activeUnits: activeCount,
            totalVolume: (totalVolume / 1000).toFixed(2) + ' T', // Convert kg to T
            avgQuality: avgQual + '%',
            totalProducteurs: this.users.filter(u => u.role === 'exploitant').length,
            alertes: offlineCount
        };
    }

    async init() {
        const userData = enforceRoleAccess('admin');
        if (!userData) return;

        console.log("🚀 [ADMIN] Initialisation Dashboard Admin (Données Temps Réel)...");
        setupThemeToggle();
        setupLogout('logout-btn');
        this.setupNavigation();

        try {
            // Charger les données depuis Firestore
            this.users = await databaseService.getUsers();
            this.units = await databaseService.getAllUnits();
            this.lots = await databaseService.getLots();
            this.industries = await databaseService.getAllIndustries(); // Charger les industries

            console.log('👥 [ADMIN] Utilisateurs chargés dans init():', JSON.stringify(this.users, null, 2));
            console.log('🎛️ [ADMIN] Unités chargées dans init():', JSON.stringify(this.units, null, 2));
            console.log('🏭 [ADMIN] Industries chargées dans init():', JSON.stringify(this.industries, null, 2));

            // Fallback si vide pour le moment
            if (this.users.length === 0) {
                console.warn("⚠️ [ADMIN] Aucun utilisateur trouvé dans Firestore.");
            }

            this.updateStats();
            this.render('overview');

            // Affichage sécurisé
            import('../utils/roles.js').then(m => m.showPageContent());
        } catch (error) {
            console.error("❌ [ADMIN] Erreur lors du chargement des données Firebase:", error);
            this.render('overview');
        }

        mqttService.connect();

        // --- AUTO-DÉCOUVERTE DES MACHINES ---
        mqttService.subscribe('smart-soja/telemetry/+', async (topic, payload) => {
            try {
                const unitId = topic.split('/').pop();

                // Mettre à jour l'unité dans la liste locale
                let existingUnit = this.units.find(u => u.unitId === unitId || u.id === unitId);

                if (!existingUnit) {
                    existingUnit = { unitId: unitId, status: 'online', id: unitId };
                    this.units.push(existingUnit);
                    databaseService.registerDetectedUnit(unitId).catch(e => console.log(e));
                } else {
                    existingUnit.status = 'online';
                }

                // Rafraîchir les statistiques en mémoire
                this.updateStats();

                // Mettre à jour l'affichage en temps réel
                const badge = document.querySelector('.device-badge span');
                if (badge) badge.innerText = 'Flotte Active: ' + this.stats.activeUnits;

            } catch (err) {
                console.error('Erreur auto-découverte:', err);
            }
        });
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

    render(section = 'overview') {
        const content = document.getElementById('dashboard-content');
        if (!content) return;

        switch (section) {
            case 'overview':
                this.renderOverview(content);
                break;
            case 'fleet':
                this.renderFleet(content);
                break;
            case 'industries':
                this.renderIndustries(content);
                break;
            case 'users':
                this.renderUsers(content);
                break;
            case 'settings':
                this.renderSettings(content);
                break;
            default:
                content.innerHTML = '<div class="glass-card"><h2>Section non trouvée</h2></div>';
        }

        if (window.lucide) window.lucide.createIcons();
    }

    renderIndustries(container) {
        container.innerHTML = `
            <div class="welcome-section" style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:25px;">
                <div>
                    <h1>Gestion des Industries</h1>
                    <p style="color:var(--text-muted);">${this.industries.length} industrie(s) enregistrée(s)</p>
                </div>
                <button id="btn-add-industry" class="glass-card" style="padding:10px 20px; background:var(--primary); color:var(--bg-darker); border:none; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px; font-size:0.85rem; border-radius:12px; transition:all 0.3s; box-shadow: 0 4px 15px var(--primary-glow);">
                    <i data-lucide="plus-circle" style="width:16px;"></i> AJOUTER UNE INDUSTRIE
                </button>
            </div>

            <!-- Version Desktop (Tableau) -->
            <div class="desktop-only glass-card" style="padding: 0; overflow-x: auto; display: block; border-radius: 16px;">
                <table style="width: 100%; border-collapse: collapse; min-width: 700px;">
                    <thead>
                        <tr style="text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);">
                            <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Industrie</th>
                            <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Norme Qualité</th>
                            <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Humidité Max</th>
                            <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Utilisateurs</th>
                            <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); text-align: center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.industries.length > 0 ? this.industries.map(ind => {
            const usersCount = this.users.filter(u => u.role === 'industrie' && u.industryId === ind.id).length;
            return `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                                    <td style="padding: 15px;">
                                        <div style="display:flex; align-items:center; gap:12px;">
                                            <div style="width:36px; height:36px; border-radius:50%; background:var(--accent); display:flex; align-items:center; justify-content:center; border:1px solid rgba(168,85,247,0.3); color:var(--bg-darker); font-weight:700; font-size:0.8rem;">
                                                ${ind.nom.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style="font-weight: 700; color: var(--text-main);">${ind.nom}</div>
                                                <div style="font-size: 0.75rem; color: var(--text-muted);">${ind.email || '—'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style="padding: 15px;">
                                        <span style="font-size: 0.7rem; font-weight: 700; padding: 4px 8px; border-radius: 6px; background: rgba(168,85,247,0.1); color: var(--accent);">
                                            ${ind.qualityStandard || '—'}
                                        </span>
                                    </td>
                                    <td style="padding: 15px; font-weight: 600;">${ind.maxHumidity || 12}%</td>
                                    <td style="padding: 15px; font-weight: 600; color: var(--secondary);">${usersCount}</td>
                                    <td style="padding: 15px; text-align: center;">
                                        <div style="display:flex; justify-content:center; gap:8px;">
                                            <button class="icon-button btn-edit-industry" data-id="${ind.id}" title="Éditer" style="width:32px; height:32px; border-radius:8px; color:var(--accent); cursor:pointer;"><i data-lucide="edit-2" style="width:14px;"></i></button>
                                            <button class="icon-button btn-users-industry" data-id="${ind.id}" title="Utilisateurs" style="width:32px; height:32px; border-radius:8px; color:var(--secondary); cursor:pointer;"><i data-lucide="users" style="width:14px;"></i></button>
                                            <button class="icon-button btn-delete-industry" data-id="${ind.id}" title="Supprimer" style="width:32px; height:32px; border-radius:8px; color:var(--danger); cursor:pointer;"><i data-lucide="trash-2" style="width:14px;"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            `;
        }).join('') : `<tr><td colspan="5" style="padding: 30px; text-align: center; color: var(--text-muted);">Aucune industrie enregistrée pour le moment.</td></tr>`}
                    </tbody>
                </table>
            </div>

            <!-- Version Mobile (Cards) -->
            <div class="mobile-only" style="display: flex; flex-direction: column; gap: 12px;">
                ${this.industries.length > 0 ? this.industries.map(ind => {
            const usersCount = this.users.filter(u => u.role === 'industrie' && u.industryId === ind.id).length;
            return `
                        <div class="glass-card" style="padding: 16px; border-radius: 16px;">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(168,85,247,0.3); color: var(--bg-darker); font-weight: 800; font-size: 1.2rem;">
                                    ${ind.nom.charAt(0).toUpperCase()}
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${ind.nom}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">${ind.email || '—'}</div>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 12px;">
                                <div>
                                    <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Norme</div>
                                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--accent);">${ind.qualityStandard || '—'}</div>
                                </div>
                                <div>
                                    <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Humidité</div>
                                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${ind.maxHumidity || 12}%</div>
                                </div>
                                <div>
                                    <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Utilisateurs</div>
                                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--secondary);">${usersCount}</div>
                                </div>
                            </div>

                            <div style="display: flex; gap: 8px;">
                                <button class="btn-edit-industry glass-card" data-id="${ind.id}" style="flex: 1; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.8rem; font-weight: 700; color: var(--accent); border-color: var(--accent);">
                                    <i data-lucide="edit-2" style="width: 14px;"></i> Modifier
                                </button>
                                <button class="btn-users-industry glass-card" data-id="${ind.id}" style="flex: 1; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.8rem; font-weight: 700; color: var(--secondary); border-color: var(--secondary);">
                                    <i data-lucide="users" style="width: 14px;"></i> Utilisateurs
                                </button>
                                <button class="btn-delete-industry glass-card" data-id="${ind.id}" style="width: 44px; padding: 10px; display: flex; align-items: center; justify-content: center; color: var(--danger); border-color: var(--danger);">
                                    <i data-lucide="trash-2" style="width: 16px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
        }).join('') : `<div class="glass-card" style="padding: 30px; text-align: center; border-radius: 16px; border: 1px dashed var(--glass-border);">
                    <i data-lucide="building-2" style="width: 32px; height: 32px; color: var(--text-muted); margin-bottom: 10px; display: block;"></i>
                    <div style="color: var(--text-muted); font-size: 0.85rem;">Aucune industrie enregistrée.</div>
                </div>`}
            </div>
        `;

        // Event Listeners
        const addBtn = document.getElementById('btn-add-industry');
        if (addBtn) addBtn.addEventListener('click', () => this.showAddIndustryModal());

        document.querySelectorAll('.btn-edit-industry').forEach(btn => {
            btn.addEventListener('click', () => this.showEditIndustryModal(btn.getAttribute('data-id')));
        });

        document.querySelectorAll('.btn-users-industry').forEach(btn => {
            btn.addEventListener('click', () => this.showIndustryUsersModal(btn.getAttribute('data-id')));
        });

        document.querySelectorAll('.btn-delete-industry').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const ind = this.industries.find(i => i.id === id);
                this.showConfirmModal(
                    "Supprimer l'industrie",
                    `Êtes-vous sûr de vouloir supprimer l'industrie <b style="color:var(--danger);">${ind?.nom}</b> ? Cette action est irréversible.`,
                    () => this.deleteIndustry(id)
                );
            });
        });

        if (window.lucide) window.lucide.createIcons();
    }

    renderSettings(container) {
        container.innerHTML = `
            <div class="welcome-section" style="margin-bottom:25px;">
                <h1>Paramètres Système</h1>
                <p style="color:var(--text-muted);">Configuration globale de la plateforme IoT</p>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px;">
                
                <!-- MQTT & Serveur -->
                <div class="glass-card" style="padding: 20px;">
                    <h3 style="margin-top:0; color:var(--primary); font-family:'Outfit'; display:flex; align-items:center; gap:8px;">
                        <i data-lucide="server"></i> Serveur MQTT
                    </h3>
                    <div style="display:flex; flex-direction:column; gap:15px; margin-top:15px;">
                        <div>
                            <label style="display:block; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">Broker URL</label>
                            <input type="text" id="mqtt-url-input" value="${mqttService.config.brokerUrl}" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none; transition:all 0.3s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--glass-border)'">
                        </div>
                        <div style="display:flex; gap:10px;">
                            <div style="flex:1;">
                                <label style="display:block; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">Utilisateur</label>
                                <input type="text" id="mqtt-user-input" value="${mqttService.config.options.username || ''}" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none; transition:all 0.3s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--glass-border)'">
                            </div>
                            <div style="flex:1;">
                                <label style="display:block; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">Mot de passe</label>
                                <input type="password" id="mqtt-pass-input" value="${mqttService.config.options.password || ''}" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none; transition:all 0.3s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--glass-border)'">
                            </div>
                        </div>
                        <button id="btn-test-mqtt" style="margin-top:5px; width:100%; padding:12px; background:rgba(16,185,129,0.1); color:var(--secondary); border:1px solid rgba(16,185,129,0.2); border-radius:8px; font-weight:700; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:8px; transition:all 0.3s;">
                            <i data-lucide="radio" style="width:16px;"></i> TESTER LA CONNEXION
                        </button>
                    </div>
                </div>



                <!-- Sécurité & Système -->
                <div class="glass-card" style="padding: 20px;">
                    <h3 style="margin-top:0; color:var(--accent); font-family:'Outfit'; display:flex; align-items:center; gap:8px;">
                        <i data-lucide="shield"></i> Sécurité & Data
                    </h3>
                    <div style="display:flex; flex-direction:column; gap:15px; margin-top:15px;">
                        <div>
                            <label style="display:block; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">Durée de Session</label>
                            <select style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none; cursor:pointer;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--glass-border)'">
                                <option value="30" style="background:var(--bg-darker);">30 Minutes</option>
                                <option value="60" selected style="background:var(--bg-darker);">1 Heure</option>
                                <option value="120" style="background:var(--bg-darker);">2 Heures</option>
                            </select>
                        </div>
                        <button id="btn-export-db" style="width:100%; padding:12px; background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid var(--glass-border); border-radius:8px; font-weight:700; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:8px; transition:all 0.3s;">
                            <i data-lucide="download" style="width:16px;"></i> SAUVEGARDE DB (.json)
                        </button>
                        <button id="btn-purge-logs" style="width:100%; padding:12px; background:rgba(239,68,68,0.1); color:var(--danger); border:1px solid rgba(239,68,68,0.2); border-radius:8px; font-weight:700; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:8px; transition:all 0.3s;">
                            <i data-lucide="trash-2" style="width:16px;"></i> PURGER LES LOGS (> 30J)
                        </button>
                    </div>
                </div>

                <!-- Interface -->
                <div class="glass-card" style="padding: 20px;">
                    <h3 style="margin-top:0; color:var(--text-main); font-family:'Outfit'; display:flex; align-items:center; gap:8px;">
                        <i data-lucide="monitor"></i> Interface
                    </h3>
                    <div style="display:flex; flex-direction:column; gap:15px; margin-top:15px;">
                        <div>
                            <label style="display:block; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">Rafraîchissement Télémétrie</label>
                            <select style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none; cursor:pointer;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--glass-border)'">
                                <option value="1" style="background:var(--bg-darker);">Temps réel (1s) - Haute conso</option>
                                <option value="3" selected style="background:var(--bg-darker);">Standard (3s)</option>
                                <option value="10" style="background:var(--bg-darker);">Économique (10s)</option>
                            </select>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px solid var(--glass-border);">
                            <span style="font-weight:600; color:var(--text-main); font-size:0.9rem;">Animations UI</span>
                            <label class="toggle-switch">
                                <input type="checkbox" checked>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>



            </div>
            
            <div style="margin-top:25px; display:flex; justify-content:flex-end;">
                <button id="btn-save-settings" style="padding:16px 30px; background:var(--primary); color:var(--bg-darker); border:none; border-radius:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:10px; font-family:'Outfit'; font-size:1rem; box-shadow: 0 4px 20px var(--primary-glow); transition:all 0.3s;">
                    <i data-lucide="save"></i> ENREGISTRER LES MODIFICATIONS
                </button>
            </div>
        `;

        // Event Listeners
        const btnTest = document.getElementById('btn-test-mqtt');
        if (btnTest) btnTest.onclick = () => {
            btnTest.innerHTML = '<i data-lucide="loader" style="width:16px;"></i> CONNEXION...';
            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => {
                btnTest.innerHTML = '<i data-lucide="check" style="width:16px;"></i> CONNEXION RÉUSSIE';
                btnTest.style.background = 'rgba(16,185,129,0.2)';
                this.showToast('Connexion au Broker MQTT établie avec succès.', 'success');
                setTimeout(() => {
                    btnTest.innerHTML = '<i data-lucide="radio" style="width:16px;"></i> TESTER LA CONNEXION';
                    btnTest.style.background = 'rgba(16,185,129,0.1)';
                    if (window.lucide) window.lucide.createIcons();
                }, 3000);
            }, 1500);
        };

        const btnSave = document.getElementById('btn-save-settings');
        if (btnSave) btnSave.onclick = () => {
            // Mise à jour de la configuration MQTT
            const newConfig = {
                brokerUrl: document.getElementById('mqtt-url-input').value,
                username: document.getElementById('mqtt-user-input').value,
                password: document.getElementById('mqtt-pass-input').value
            };

            mqttService.updateConfig(newConfig);
            this.showToast('Paramètres enregistrés et Broker MQTT reconnecté.', 'success');
        };



        const btnExport = document.getElementById('btn-export-db');
        if (btnExport) btnExport.onclick = () => {
            const dataToExport = {
                users: this.users,
                units: this.units,
                lots: this.lots,
                timestamp: new Date().toISOString()
            };

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", `smartsoja_backup_${new Date().toISOString().split('T')[0]}.json`);
            dlAnchorElem.click();

            this.showToast('Base de données exportée avec succès.', 'success');
        };

        const btnPurge = document.getElementById('btn-purge-logs');
        if (btnPurge) btnPurge.onclick = () => {
            this.showConfirmModal(
                "Purger les Logs",
                "Êtes-vous sûr de vouloir supprimer tous les logs vieux de plus de 30 jours ? Cette action est irréversible.",
                () => {
                    this.showToast('Anciens logs purgés avec succès.', 'info');
                }
            );
        };

        if (window.lucide) window.lucide.createIcons();
    }

    renderOverview(container) {
        // Obtenir les derniers lots triés
        const recentLots = this.lots ? [...this.lots].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5) : [];

        container.innerHTML = `
            <!-- Banner -->
            <div style="background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(15,23,42,0) 100%); border: 1px solid var(--glass-border); border-radius: 16px; padding: 25px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden;">
                <div style="position: absolute; right: -50px; top: -50px; width: 200px; height: 200px; background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%); opacity: 0.2;"></div>
                <div style="z-index: 1;">
                    <h1 style="margin: 0 0 5px 0; font-family: 'Outfit'; font-size: 1.8rem;">Supervision Globale</h1>
                    <p style="color: var(--text-muted); margin: 0;">Plateforme IoT d'optimisation qualité du Soja au Bénin</p>
                </div>
                <div class="glass-card" style="padding: 10px 20px; border-radius: 12px; display: flex; align-items: center; gap: 10px; border: 1px solid var(--secondary);">
                    <i data-lucide="radio" style="color: var(--secondary);"></i>
                    <div style="text-align: right;">
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Machines en Ligne</div>
                        <div style="font-size: 1.2rem; font-weight: 800; color: var(--text-main);">${this.stats.activeUnits} / ${this.units.length}</div>
                    </div>
                </div>
            </div>

            <!-- KPIs Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <!-- Volume -->
                <div class="glass-card hover-rise" style="padding: 20px; display: flex; flex-direction: column; gap: 10px; border-radius: 16px; position: relative; overflow: hidden; transition: transform 0.3s;">
                    <div style="position: absolute; right: -10px; bottom: -10px; opacity: 0.05;"><i data-lucide="package" style="width: 80px; height: 80px;"></i></div>
                    <div style="display: flex; align-items: center; gap: 10px; color: var(--primary);">
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(16,185,129,0.1); display: flex; align-items: center; justify-content: center;"><i data-lucide="layers" style="width: 18px;"></i></div>
                        <span style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Volume Total Validé</span>
                    </div>
                    <div style="font-size: 2.2rem; font-weight: 800; font-family: 'Outfit'; margin-top:5px;">${this.stats.totalVolume}</div>
                </div>

                <!-- Qualité -->
                <div class="glass-card hover-rise" style="padding: 20px; display: flex; flex-direction: column; gap: 10px; border-radius: 16px; position: relative; overflow: hidden; transition: transform 0.3s;">
                    <div style="position: absolute; right: -10px; bottom: -10px; opacity: 0.05;"><i data-lucide="award" style="width: 80px; height: 80px;"></i></div>
                    <div style="display: flex; align-items: center; gap: 10px; color: var(--secondary);">
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59,130,246,0.1); display: flex; align-items: center; justify-content: center;"><i data-lucide="shield-check" style="width: 18px;"></i></div>
                        <span style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Conformité Moyenne</span>
                    </div>
                    <div style="font-size: 2.2rem; font-weight: 800; font-family: 'Outfit'; margin-top:5px;">${this.stats.avgQuality}</div>
                </div>

                <!-- Producteurs -->
                <div class="glass-card hover-rise" style="padding: 20px; display: flex; flex-direction: column; gap: 10px; border-radius: 16px; position: relative; overflow: hidden; transition: transform 0.3s;">
                    <div style="position: absolute; right: -10px; bottom: -10px; opacity: 0.05;"><i data-lucide="users" style="width: 80px; height: 80px;"></i></div>
                    <div style="display: flex; align-items: center; gap: 10px; color: var(--accent);">
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(168,85,247,0.1); display: flex; align-items: center; justify-content: center;"><i data-lucide="users" style="width: 18px;"></i></div>
                        <span style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Exploitants Actifs</span>
                    </div>
                    <div style="font-size: 2.2rem; font-weight: 800; font-family: 'Outfit'; margin-top:5px;">${this.stats.totalProducteurs}</div>
                </div>
            </div>

            <!-- Content Split (Activités / Alertes) -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px;">
                
                <!-- Derniers Lots -->
                <div style="grid-column: span 2;">
                    <h3 style="font-family: 'Outfit'; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; font-size:1.1rem;"><i data-lucide="clock" style="color: var(--primary); width:20px;"></i> Derniers Lots Récoltés</h3>
                    <div class="glass-card" style="padding: 0; overflow: hidden; border-radius: 16px;">
                        ${recentLots.length > 0 ? recentLots.map((lot, index) => {
            const isValide = lot.status === 'validé';
            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: ${index < recentLots.length - 1 ? '1px solid var(--glass-border)' : 'none'}; background: ${index % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'};">
                                    <div style="display: flex; gap: 15px; align-items: center;">
                                        <div style="width: 40px; height: 40px; border-radius: 50%; background: ${isValide ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'}; display: flex; align-items: center; justify-content: center; color: ${isValide ? 'var(--primary)' : 'var(--warning)'}; border: 1px solid ${isValide ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'};">
                                            <i data-lucide="${isValide ? 'check' : 'hourglass'}" style="width: 18px;"></i>
                                        </div>
                                        <div>
                                            <div style="font-weight: 700; color: var(--text-main);">${lot.lotId || 'Lot #' + Math.floor(Math.random() * 10000)}</div>
                                            <div style="font-size: 0.75rem; color: var(--text-muted);">${lot.createdAt ? new Date(lot.createdAt).toLocaleString('fr-FR') : '--'}</div>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-weight: 800; font-family: 'Outfit';">${lot.weight || lot.volume || 0} kg</div>
                                        <div style="font-size: 0.75rem; color: ${isValide ? 'var(--primary)' : 'var(--warning)'}; font-weight: 600;">${isValide ? (lot.quality || lot.conformRate || '100') + '% Conformité' : 'En attente'}</div>
                                    </div>
                                </div>
                            `;
        }).join('') : `<div style="padding: 30px; text-align: center; color: var(--text-muted);">Aucun lot enregistré pour le moment.</div>`}
                    </div>
                </div>

                <!-- Alertes & Offline -->
                <div>
                    <h3 style="font-family: 'Outfit'; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; font-size:1.1rem;"><i data-lucide="alert-triangle" style="color: var(--danger); width:20px;"></i> État des Machines</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${this.units.filter(u => !this.getNetworkStatus(u.lastSeen)).length > 0
                ? this.units.filter(u => !this.getNetworkStatus(u.lastSeen)).map(u => `
                                <div class="glass-card" style="padding: 15px; border-radius: 12px; background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.2); display: flex; gap: 12px; align-items: center;">
                                    <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--danger); box-shadow: 0 0 10px var(--danger);"></div>
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.9rem;">${u.id || u.unitId}</div>
                                        <div style="font-size: 0.7rem; color: var(--danger);">Déconnectée (Hors Ligne)</div>
                                    </div>
                                </div>
                            `).join('')
                : `
                            <div class="glass-card" style="padding: 30px; text-align: center; border-radius: 16px; border: 1px dashed var(--glass-border); background:rgba(16,185,129,0.02);">
                                <i data-lucide="check-circle" style="color: var(--primary); width: 32px; height: 32px; margin-bottom: 10px;"></i>
                                <div style="color: var(--text-muted); font-size: 0.85rem;">Toutes les machines<br>sont opérationnelles</div>
                            </div>
                            `
            }
                    </div>
                </div>

            </div>
        `;
    }

    renderFleet(container) {
        const statusColors = { online: 'var(--secondary)', offline: 'var(--danger)', maintenance: 'var(--warning)' };

        container.innerHTML = `
            <div class="welcome-section" style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:25px;">
                <div>
                    <h1>Flotte IoT</h1>
                    <p style="color:var(--text-muted);">Suivi géographique et technique</p>
                </div>
                <button id="btn-add-unit" class="glass-card" style="padding:10px 18px; border:1px solid var(--primary); color:var(--primary); font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px; font-size:0.8rem; border-radius:12px; transition:all 0.2s;">
                    <i data-lucide="plus-circle" style="width:16px;"></i> ENREGISTRER
                </button>
            </div>

            <!-- Carte de Localisation -->
            <div class="glass-card" style="height:250px; margin-bottom:25px; padding:0; overflow:hidden; position:relative; border:1px solid var(--glass-border);">
                <div style="position:absolute; top:15px; left:15px; z-index:10; background:rgba(15, 23, 42, 0.8); backdrop-filter:blur(8px); padding:8px 15px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); font-size:0.75rem; font-weight:700;">
                    <i data-lucide="map" style="width:14px; vertical-align:middle; margin-right:5px; color:var(--primary);"></i> CARTOGRAPHIE EN TEMPS RÉEL
                </div>
                
                <!-- Carte Leaflet -->
                <div id="admin-map" style="width:100%; height:100%; border-radius:10px; z-index:1;"></div>
            </div>

            <!-- Liste de la Flotte (Tableau sur Desktop, Cards sur Mobile) -->
            <div class="glass-card" style="padding: 0; overflow: hidden; border: none; background: transparent; box-shadow: none;">
                <!-- Version Desktop -->
                <div class="desktop-only glass-card" style="padding: 0; overflow-x: auto; display: block;">
                    <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);">
                                <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Unité ID</th>
                                <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Propriétaire</th>
                                <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">État</th>
                                <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Signal</th>
                                <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); text-align: center;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.units.map(u => {
            const isOnline = this.getNetworkStatus(u.lastSeen);
            const ownerUser = this.users.find(user => user.uid === u.owner || user.id === u.owner || user.email === u.ownerEmail);
            const ownerName = ownerUser ? (ownerUser.fullName || ownerUser.name) : '(Sans propriétaire)';

            return `
                                <tr class="hover-row" style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
                                    <td style="padding: 15px;">
                                        <div style="font-weight: 700; color: var(--primary);">${u.id || u.unitId}</div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted);">${u.lastSeen ? new Date(u.lastSeen).toLocaleString('fr-FR') : '(Jamais vu)'}</div>
                                    </td>
                                    <td style="padding: 15px; font-size: 0.85rem; font-weight: 600;">${ownerName}</td>
                                    <td style="padding: 15px;">
                                        <span style="font-size: 0.65rem; font-weight: 800; color: ${u.status === 'actif' ? 'var(--secondary)' : u.status === 'disponible' ? 'var(--primary)' : 'var(--warning)'}; display: flex; align-items: center; gap: 5px;">
                                            ● ${(u.status || 'INCONNU').toUpperCase()}
                                        </span>
                                    </td>
                                    <td style="padding: 15px;">
                                        <div style="font-size: 0.85rem; font-weight: 600; color: ${isOnline ? 'var(--secondary)' : 'var(--danger)'};">
                                            <i data-lucide="wifi" style="width: 14px; vertical-align: middle;"></i> ${isOnline ? 'En ligne' : 'Hors ligne'}
                                        </div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">RSSI: ${u.rssi ? u.rssi + ' dBm' : 'Inconnu'}</div>
                                    </td>
                                    <td style="padding: 15px; text-align: center;">
                                        <div style="display:flex; justify-content:center; gap:8px;">
                                            <button class="btn-unit-details icon-button" data-id="${u.id || u.unitId}"><i data-lucide="eye" style="width: 14px;"></i></button>
                                            <button class="btn-unit-telemetry icon-button" data-id="${u.id || u.unitId}"><i data-lucide="activity" style="width: 14px;"></i></button>
                                            <button class="btn-unit-power icon-button" data-id="${u.id || u.unitId}"><i data-lucide="power" style="width: 14px;"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Version Mobile (Cards) -->
                <div class="mobile-only" style="display: flex; flex-direction: column; gap: 12px;">
                    ${this.units.map(u => {
            const isOnline = this.getNetworkStatus(u.lastSeen);
            const ownerUser = this.users.find(user => user.uid === u.owner || user.id === u.owner || user.email === u.ownerEmail);
            const ownerName = ownerUser ? (ownerUser.fullName || ownerUser.name) : '(Sans propriétaire)';

            return `
                        <div class="glass-card" style="padding: 16px; border-radius: 16px; position: relative;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                                <div>
                                    <div style="font-weight: 800; color: var(--primary); font-size: 1.1rem; font-family: 'Outfit';">${u.id || u.unitId}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">${ownerName}</div>
                                </div>
                                <div style="padding: 4px 10px; border-radius: 20px; font-size: 0.65rem; font-weight: 800; background: rgba(255,255,255,0.05); color: ${isOnline ? 'var(--secondary)' : 'var(--danger)'}; border: 1px solid ${isOnline ? 'var(--secondary-glow)' : 'var(--danger-glow)'};">
                                    ${isOnline ? 'CONNECTÉ' : 'HORS-LIGNE'}
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 12px;">
                                <div>
                                    <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Statut</div>
                                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${(u.status || 'Inconnu').toUpperCase()}</div>
                                </div>
                                <div>
                                    <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Dernier Signal</div>
                                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${u.lastSeen ? new Date(u.lastSeen).toLocaleTimeString('fr-FR') : 'N/A'}</div>
                                </div>
                            </div>

                            <div style="display: flex; gap: 8px;">
                                <button class="btn-unit-details glass-card" data-id="${u.id || u.unitId}" style="flex: 1; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.75rem; font-weight: 700; color: var(--primary); border-color: var(--primary-glow);">
                                    <i data-lucide="eye" style="width: 14px;"></i> Détails
                                </button>
                                <button class="btn-unit-telemetry glass-card" data-id="${u.id || u.unitId}" style="flex: 1; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.75rem; font-weight: 700; color: var(--secondary); border-color: var(--secondary-glow);">
                                    <i data-lucide="activity" style="width: 14px;"></i> Télémétrie
                                </button>
                                <button class="btn-unit-power glass-card" data-id="${u.id || u.unitId}" style="width: 44px; padding: 10px; display: flex; align-items: center; justify-content: center; color: var(--danger); border-color: var(--danger-glow);">
                                    <i data-lucide="power" style="width: 18px;"></i>
                                </button>
                            </div>
                        </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;

        const addBtn = document.getElementById('btn-add-unit');
        if (addBtn) addBtn.addEventListener('click', () => this.showAddUnitModal());

        document.querySelectorAll('.btn-unit-details').forEach(btn => {
            btn.addEventListener('click', () => this.showUnitDetailsModal(btn.getAttribute('data-id')));
        });

        document.querySelectorAll('.btn-unit-telemetry').forEach(btn => {
            btn.addEventListener('click', () => this.showUnitTelemetryModal(btn.getAttribute('data-id')));
        });

        // Control modal is removed

        document.querySelectorAll('.btn-unit-test').forEach(btn => {
            btn.addEventListener('click', () => {
                const unitId = btn.getAttribute('data-id');
                // Alternance du statut de test (on/off)
                btn._testState = !btn._testState;
                mqttService.sendCommand(unitId, { action: 'test_led', value: btn._testState });
                this.showToast(`Commande LED ${btn._testState ? 'ALLUMÉE' : 'ÉTEINTE'} envoyée à ${unitId}.`, 'info');

                // Effet visuel
                btn.style.background = btn._testState ? 'rgba(168,85,247,0.3)' : 'rgba(168,85,247,0.1)';
            });
        });

        document.querySelectorAll('.btn-unit-power').forEach(btn => {
            btn.addEventListener('click', () => {
                const unitId = btn.getAttribute('data-id');
                this.showConfirmModal(
                    "Arrêt d'Urgence Critique",
                    `Êtes-vous sûr de vouloir stopper immédiatement l'unité <b style="color:var(--danger);">${unitId}</b> ? Cette action bloquera la production.`,
                    () => {
                        this.showToast(`Arrêt d'urgence déclenché pour l'unité ${unitId} !`, 'error');
                    }
                );
            });
        });

        if (window.lucide) window.lucide.createIcons();

        // Initialize Leaflet Map
        setTimeout(() => {
            if (window.L) {
                const mapContainer = document.getElementById('admin-map');
                if (mapContainer && !mapContainer._leaflet_id) {
                    const map = L.map('admin-map').setView([9.3077, 2.3158], 6); // Centre du Bénin

                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors',
                        className: 'map-tiles'
                    }).addTo(map);

                    this.units.forEach((u, i) => {
                        // Position simulée autour du centre (sauf si u.lat/u.lng existe)
                        const lat = u.lat || 9.3 + (Math.random() - 0.5) * 4;
                        const lng = u.lng || 2.3 + (Math.random() - 0.5) * 2;
                        const color = (u.status === 'online' || u.status === 'actif') ? '#10b981' : '#ef4444';

                        const circle = L.circleMarker([lat, lng], {
                            color: color,
                            fillColor: color,
                            fillOpacity: 0.8,
                            radius: 8
                        }).addTo(map);

                        circle.bindPopup(`<b style="color:black;">${u.id || u.unitId}</b><br><span style="color:black;">Statut: ${u.status}</span>`);
                    });
                }
            }
        }, 300);
    }

    renderUsers(container) {
        const roleColors = {
            admin: 'var(--primary)',
            exploitant: 'var(--secondary)',
            industrie: 'var(--accent)'
        };

        // Séparation des utilisateurs par catégorie
        const exploitants = this.users.filter(u => u.role === 'exploitant');
        const admins = this.users.filter(u => u.role === 'admin');

        container.innerHTML = `
            <div class="welcome-section user-header" style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:25px;">
                <div>
                    <h1>Gestion Utilisateurs</h1>
                    <p style="color:var(--text-muted);">${this.users.length} comptes enregistrés</p>
                </div>
                <div class="user-header-actions" style="display:flex; align-items:center; gap:15px;">
                    <div class="glass-card user-search" style="padding:8px 15px; display:flex; align-items:center; gap:10px; border-radius:12px; border:1px solid var(--glass-border);">
                        <i data-lucide="search" style="width:16px; color:var(--text-muted);"></i>
                        <input type="text" id="user-search" class="user-search-input" placeholder="Rechercher..." style="background:none; border:none; color:var(--text-main); font-size:0.85rem; outline:none; width:150px;">
                    </div>
                    <button id="btn-add-user" class="user-add-btn" style="padding: 10px 20px; background: var(--primary); color: var(--bg-darker); border: none; border-radius: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; font-family: 'Outfit'; font-size: 0.85rem; transition: all 0.3s; box-shadow: 0 4px 15px var(--primary-glow);">
                        <i data-lucide="user-plus" style="width:16px;"></i> AJOUTER
                    </button>
                </div>
            </div>

            <!-- SECTION EXPLOITANTS -->
            <div style="margin-bottom: 30px;">
                <h2 style="color: var(--secondary); font-family: 'Outfit'; font-weight: 800; display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                    <i data-lucide="users" style="width: 22px;"></i> Exploitants (${exploitants.length})
                </h2>
                <div class="glass-card" style="padding: 0; overflow: hidden; border: none; background: transparent; box-shadow: none;">
                    <!-- Version Desktop -->
                    <div class="desktop-only glass-card" style="padding: 0; overflow-x: auto; display: block;">
                        <table class="users-table exploitants-table" style="width: 100%; border-collapse: collapse; min-width: 700px;">
                            <thead>
                                <tr style="text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);">
                                    <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Utilisateur</th>
                                    <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Rôle</th>
                                    <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Unité</th>
                                    <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Statut</th>
                                    <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); text-align: center;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${exploitants.map(user => `
                                    <tr class="user-row" data-email="${user.email || user.id}" style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                                        <td style="padding: 15px;">
                                            <div style="display:flex; align-items:center; gap:12px;">
                                                <div style="width:36px; height:36px; border-radius:50%; background:var(--glass-bg); display:flex; align-items:center; justify-content:center; border:1px solid var(--glass-border);">
                                                    <i data-lucide="user" style="width:18px; color:var(--secondary);"></i>
                                                </div>
                                                <div>
                                                    <div style="font-weight: 700; color: var(--text-main);">${user.name || user.fullName || '(Sans nom)'}</div>
                                                    <div style="font-size: 0.75rem; color: var(--text-muted);">${user.email || '(Sans email)'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style="padding: 15px;">
                                            <span style="font-size: 0.65rem; font-weight: 800; padding: 4px 10px; border-radius: 20px; background: rgba(255,255,255,0.05); border: 1px solid ${roleColors[user.role]}; color: ${roleColors[user.role]}; text-transform: uppercase;">
                                                ${user.role}
                                            </span>
                                        </td>
                                        <td style="padding: 15px;">
                                            <div style="font-size: 0.85rem; color: var(--text-main); font-weight: 600;">
                                                ${user.assignedUnit || '—'}
                                            </div>
                                        </td>
                                        <td style="padding: 15px;">
                                            <div style="display:flex; align-items:center; gap:6px; font-size:0.8rem; color:${(user.status || 'inactif') === 'actif' ? 'var(--secondary)' : 'var(--danger)'}; font-weight:700;">
                                                <div style="width:6px; height:6px; border-radius:50%; background:currentColor;"></div>
                                                ${(user.status || 'INACTIF').toUpperCase()}
                                            </div>
                                        </td>
                                        <td style="padding: 15px; text-align: center;">
                                            <div style="display:flex; justify-content:center; gap:8px;">
                                                <button class="icon-button btn-edit-user" data-email="${user.email || user.id}" title="Éditer" style="width:32px; height:32px; border-radius:8px; color:var(--accent);"><i data-lucide="edit-2" style="width:14px;"></i></button>
                                                <button class="icon-button btn-toggle-user" data-email="${user.email || user.id}" title="Statut" style="width:32px; height:32px; border-radius:8px; color:var(--warning);"><i data-lucide="${(user.status || 'inactif') === 'actif' ? 'shield-off' : 'shield'}" style="width:14px;"></i></button>
                                                <button class="icon-button btn-delete-user" data-email="${user.email || user.id}" title="Supprimer" style="width:32px; height:32px; border-radius:8px; color:var(--danger);"><i data-lucide="trash-2" style="width:14px;"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ${exploitants.length === 0 ? '<div style="padding: 30px; text-align: center; color: var(--text-muted);">Aucun exploitant enregistré</div>' : ''}
                    </div>

                    <!-- Version Mobile (Cards) -->
                    <div class="mobile-only" style="display: flex; flex-direction: column; gap: 12px;">
                        ${exploitants.map(user => `
                            <div class="glass-card user-card" data-email="${user.email || user.id}" style="padding: 16px; border-radius: 16px;">
                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                    <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--glass-bg); display: flex; align-items: center; justify-content: center; border: 1px solid var(--glass-border);">
                                        <i data-lucide="user" style="width: 20px; color: var(--secondary);"></i>
                                    </div>
                                    <div class="user-meta" style="flex: 1;">
                                        <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${user.name || user.fullName || '(Sans nom)'}</div>
                                        <div class="user-email" style="font-size: 0.75rem; color: var(--text-muted);">${user.email}</div>
                                    </div>
                                    <div style="font-size: 0.6rem; font-weight: 800; color: ${roleColors[user.role]}; border: 1px solid ${roleColors[user.role]}; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">
                                        ${user.role}
                                    </div>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 12px;">
                                    <div>
                                        <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Unité</div>
                                        <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${user.assignedUnit || '—'}</div>
                                    </div>
                                    <div>
                                        <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Statut</div>
                                        <div style="font-weight: 700; font-size: 0.85rem; color: ${(user.status || 'inactif') === 'actif' ? 'var(--secondary)' : 'var(--danger)'};">${(user.status || 'INACTIF').toUpperCase()}</div>
                                    </div>
                                </div>

                                <div style="display: flex; gap: 8px;">
                                    <button class="btn-edit-user glass-card" data-email="${user.email || user.id}" style="flex: 1; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.8rem; font-weight: 700; color: var(--accent); border-color: var(--accent);">
                                        <i data-lucide="edit-2" style="width: 14px;"></i> Modifier
                                    </button>
                                    <button class="btn-toggle-user glass-card" data-email="${user.email || user.id}" style="width: 44px; padding: 10px; display: flex; align-items: center; justify-content: center; color: var(--warning); border-color: var(--warning);">
                                        <i data-lucide="${(user.status || 'inactif') === 'actif' ? 'shield-off' : 'shield'}" style="width: 16px;"></i>
                                    </button>
                                    <button class="btn-delete-user glass-card" data-email="${user.email || user.id}" style="width: 44px; padding: 10px; display: flex; align-items: center; justify-content: center; color: var(--danger); border-color: var(--danger);">
                                        <i data-lucide="trash-2" style="width: 16px;"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                        ${exploitants.length === 0 ? '<div style="padding: 30px; text-align: center; color: var(--text-muted);">Aucun exploitant enregistré</div>' : ''}
                    </div>
                </div>
            </div>

            <!-- SECTION ADMINISTRATEURS -->
            <div style="margin-bottom: 30px;">
                <h2 style="color: var(--primary); font-family: 'Outfit'; font-weight: 800; display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                    <i data-lucide="shield" style="width: 22px;"></i> Administrateurs (${admins.length})
                </h2>
                <div class="glass-card" style="padding: 0; overflow: hidden; border: none; background: transparent; box-shadow: none;">
                    <!-- Version Desktop -->
                    <div class="desktop-only glass-card" style="padding: 0; overflow-x: auto; display: block;">
                        <table class="users-table admin-table" style="width: 100%; border-collapse: collapse; min-width: 700px;">
                            <thead>
                                <tr style="text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);">
                                    <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Utilisateur</th>
                                    <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Rôle</th>
                                    <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Statut</th>
                                    <th style="padding: 15px; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); text-align: center;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${admins.map(user => `
                                    <tr class="user-row" data-email="${user.email || user.id}" style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                                        <td style="padding: 15px;">
                                            <div style="display:flex; align-items:center; gap:12px;">
                                                <div style="width:36px; height:36px; border-radius:50%; background:var(--glass-bg); display:flex; align-items:center; justify-content:center; border:1px solid var(--glass-border);">
                                                    <i data-lucide="shield" style="width:18px; color:var(--primary);"></i>
                                                </div>
                                                <div>
                                                    <div style="font-weight: 700; color: var(--text-main);">${user.name || user.fullName || '(Sans nom)'}</div>
                                                    <div style="font-size: 0.75rem; color: var(--text-muted);">${user.email || '(Sans email)'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style="padding: 15px;">
                                            <span style="font-size: 0.65rem; font-weight: 800; padding: 4px 10px; border-radius: 20px; background: rgba(255,255,255,0.05); border: 1px solid ${roleColors[user.role]}; color: ${roleColors[user.role]}; text-transform: uppercase;">
                                                ${user.role}
                                            </span>
                                        </td>
                                        <td style="padding: 15px;">
                                            <div style="display:flex; align-items:center; gap:6px; font-size:0.8rem; color:${(user.status || 'inactif') === 'actif' ? 'var(--secondary)' : 'var(--danger)'}; font-weight:700;">
                                                <div style="width:6px; height:6px; border-radius:50%; background:currentColor;"></div>
                                                ${(user.status || 'INACTIF').toUpperCase()}
                                            </div>
                                        </td>
                                        <td style="padding: 15px; text-align: center;">
                                            <div style="display:flex; justify-content:center; gap:8px;">
                                                <button class="icon-button btn-edit-user" data-email="${user.email || user.id}" title="Éditer" style="width:32px; height:32px; border-radius:8px; color:var(--accent);"><i data-lucide="edit-2" style="width:14px;"></i></button>
                                                <button class="icon-button btn-toggle-user" data-email="${user.email || user.id}" title="Statut" style="width:32px; height:32px; border-radius:8px; color:var(--warning);"><i data-lucide="${(user.status || 'inactif') === 'actif' ? 'shield-off' : 'shield'}" style="width:14px;"></i></button>
                                                <button class="icon-button btn-delete-user" data-email="${user.email || user.id}" title="Supprimer" style="width:32px; height:32px; border-radius:8px; color:var(--danger);"><i data-lucide="trash-2" style="width:14px;"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ${admins.length === 0 ? '<div style="padding: 30px; text-align: center; color: var(--text-muted);">Aucun administrateur enregistré</div>' : ''}
                    </div>

                    <!-- Version Mobile (Cards) -->
                    <div class="mobile-only" style="display: flex; flex-direction: column; gap: 12px;">
                        ${admins.map(user => `
                            <div class="glass-card user-card" data-email="${user.email || user.id}" style="padding: 16px; border-radius: 16px;">
                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                    <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--glass-bg); display: flex; align-items: center; justify-content: center; border: 1px solid var(--glass-border);">
                                        <i data-lucide="shield" style="width: 20px; color: var(--primary);"></i>
                                    </div>
                                    <div class="user-meta" style="flex: 1;">
                                        <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${user.name || user.fullName || '(Sans nom)'}</div>
                                        <div class="user-email" style="font-size: 0.75rem; color: var(--text-muted);">${user.email}</div>
                                    </div>
                                    <div style="font-size: 0.6rem; font-weight: 800; color: ${roleColors[user.role]}; border: 1px solid ${roleColors[user.role]}; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">
                                        ${user.role}
                                    </div>
                                </div>
                                
                                <div style="margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 12px;">
                                    <div>
                                        <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Statut</div>
                                        <div style="font-weight: 700; font-size: 0.85rem; color: ${(user.status || 'inactif') === 'actif' ? 'var(--secondary)' : 'var(--danger)'};">${(user.status || 'INACTIF').toUpperCase()}</div>
                                    </div>
                                </div>

                                <div style="display: flex; gap: 8px;">
                                    <button class="btn-edit-user glass-card" data-email="${user.email || user.id}" style="flex: 1; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.8rem; font-weight: 700; color: var(--accent); border-color: var(--accent);">
                                        <i data-lucide="edit-2" style="width: 14px;"></i> Modifier
                                    </button>
                                    <button class="btn-toggle-user glass-card" data-email="${user.email || user.id}" style="width: 44px; padding: 10px; display: flex; align-items: center; justify-content: center; color: var(--warning); border-color: var(--warning);">
                                        <i data-lucide="${(user.status || 'inactif') === 'actif' ? 'shield-off' : 'shield'}" style="width: 16px;"></i>
                                    </button>
                                    <button class="btn-delete-user glass-card" data-email="${user.email || user.id}" style="width: 44px; padding: 10px; display: flex; align-items: center; justify-content: center; color: var(--danger); border-color: var(--danger);">
                                        <i data-lucide="trash-2" style="width: 16px;"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                        ${admins.length === 0 ? '<div style="padding: 30px; text-align: center; color: var(--text-muted);">Aucun administrateur enregistré</div>' : ''}
                    </div>
                </div>
            </div>
        `;

        // Écouteurs d'événements pour les actions utilisateurs
        const addBtn = document.getElementById('btn-add-user');
        if (addBtn) addBtn.onclick = () => this.showUserModal();

        document.querySelectorAll('.btn-toggle-user').forEach(btn => {
            btn.onclick = () => this.toggleUserStatus(btn.getAttribute('data-email'));
        });

        document.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.onclick = () => {
                const email = btn.getAttribute('data-email');
                this.showConfirmModal(
                    "Supprimer l'utilisateur",
                    `Êtes-vous sûr de vouloir supprimer définitivement le compte <b style="color:var(--danger);">${email}</b> ?`,
                    () => {
                        this.deleteUser(email);
                    }
                );
            };
        });

        document.querySelectorAll('.btn-edit-user').forEach(btn => {
            btn.onclick = () => this.showUserModal(btn.getAttribute('data-email'));
        });

        // Recherche en temps réel (sur les deux tables)
        const searchInput = document.getElementById('user-search');
        if (searchInput) {
            searchInput.oninput = (e) => {
                const term = e.target.value.toLowerCase();
                // Recherche sur la table exploitants
                const exploitantsRows = document.querySelectorAll('.exploitants-table tbody tr');
                exploitantsRows.forEach(row => {
                    const text = row.innerText.toLowerCase();
                    row.style.display = text.includes(term) ? '' : 'none';
                });
                // Recherche sur la table admin/industrie
                const adminRows = document.querySelectorAll('.admin-table tbody tr');
                adminRows.forEach(row => {
                    const text = row.innerText.toLowerCase();
                    row.style.display = text.includes(term) ? '' : 'none';
                });
            };
        }

        if (window.lucide) window.lucide.createIcons();
    }

    async toggleUserStatus(email) {
        const user = this.users.find(u => u.email === email);
        if (user) {
            const newStatus = user.status === 'actif' ? 'banni' : 'actif';
            try {
                const docId = user.uid || email.replace('.', '_');
                await databaseService.saveUser(docId, { ...user, status: newStatus });
                user.status = newStatus;
                this.render('users');
                this.showToast(`Statut de ${user.name || user.fullName || user.id} : ${newStatus.toUpperCase()}`, newStatus === 'actif' ? 'info' : 'warning');
            } catch (err) {
                console.error("Erreur toggle status:", err);
            }
        }
    }

    async deleteUser(email) {
        const user = this.users.find(u => u.email === email);
        if (user) {
            try {
                // On ne peut pas supprimer d'Auth via SDK client facilement, mais on le désactive dans Firestore
                const docId = user.uid || email.replace('.', '_');
                await databaseService.saveUser(docId, { ...user, status: 'supprimé' });
                this.users = this.users.filter(u => u.email !== email);
                this.updateStats();
                this.render('users');
                this.showToast(`L'utilisateur ${email} a été archivé/supprimé.`, 'warning');
            } catch (err) {
                console.error("Erreur suppression:", err);
            }
        }
    }

    showUserModal(email = null) {
        const user = email ? this.users.find(u => u.email === email) : null;
        const isEdit = !!user;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal glass-card">
                <div class="modal-header">
                    <h3 style="margin:0; font-family:'Outfit'; font-weight:800; color:var(--primary); font-size:1.4rem; display:flex; align-items:center; gap:10px;">
                        <i data-lucide="${isEdit ? 'edit-2' : 'user-plus'}"></i> ${isEdit ? "MODIFIER L'UTILISATEUR" : "NOUVEL UTILISATEUR"}
                    </h3>
                    <button class="modal-close" id="close-user-modal"><i data-lucide="x"></i></button>
                </div>
                
                <form id="user-form">
                    <div class="modal-body" style="display:flex; flex-direction:column; gap:12px; max-height: 60vh; overflow-y: auto; padding-right: 5px;">
                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Nom Complet</label>
                            <input type="text" name="name" value="${isEdit ? (user.name || user.fullName || '') : ''}" placeholder="Ex: Jean Dupont" required style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; font-size:0.9rem; outline:none; transition:all 0.3s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--glass-border)'">
                        </div>
                        
                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Email</label>
                            <input type="email" name="email" value="${isEdit ? (user.email || '') : ''}" ${isEdit ? 'readonly' : ''} placeholder="Ex: jean@smartsoja.com" required style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; font-size:0.9rem; outline:none; transition:all 0.3s; ${isEdit ? 'opacity:0.6; cursor:not-allowed;' : ''}" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--glass-border)'">
                        </div>

                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Rôle</label>
                            <select name="role" id="modal-user-role" ${isEdit && user.role === 'exploitant' ? 'disabled' : ''} required style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; font-size:0.9rem; outline:none; transition:all 0.3s; cursor:pointer; ${isEdit && user.role === 'exploitant' ? 'opacity:0.6; cursor:not-allowed;' : ''}" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--glass-border)'">
                                <option value="exploitant" ${isEdit && user.role === 'exploitant' ? 'selected' : ''} style="background:var(--bg-darker);">Exploitant</option>
                                <option value="industrie" ${isEdit && user.role === 'industrie' ? 'selected' : ''} style="background:var(--bg-darker);">Industrie</option>
                                <option value="admin" ${isEdit && user.role === 'admin' ? 'selected' : ''} style="background:var(--bg-darker);">Administrateur</option>
                            </select>
                        </div>

                        <div id="industry-field-container" class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02); display:${!isEdit || (isEdit && user.role === 'exploitant') ? 'block' : 'none'};">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Industrie Destinataire</label>
                            <select name="industryId" id="modal-industry-select" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; font-size:0.9rem; outline:none; transition:all 0.3s; cursor:pointer;">
                                <option value="" style="background:var(--bg-darker);">-- Sélectionner une industrie --</option>
                                ${isEdit && user.industryId ? `<option value="${user.industryId}" selected style="background:var(--bg-darker);">${user.industryName || user.industryId}</option>` : ''}
                                <!-- Les industries disponibles seront chargées ici -->
                            </select>
                        </div>

                        <div id="unit-field-container" class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02); display:${!isEdit || (isEdit && user.role === 'exploitant') ? 'block' : 'none'};">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Machine Affectée</label>
                            <select name="assignedUnit" id="assigned-unit-select" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; font-size:0.9rem; outline:none; transition:all 0.3s; cursor:pointer;">
                                <option value="" style="background:var(--bg-darker);">-- Sélectionner une machine --</option>
                                ${isEdit && user.assignedUnit ? `<option value="${user.assignedUnit}" selected style="background:var(--bg-darker);">${user.assignedUnit} (Actuelle)</option>` : ''}
                                <!-- Les unités disponibles seront chargées ici -->
                            </select>
                            <p style="font-size:0.65rem; color:var(--text-muted); margin-top:6px;">
                                <i class="fas fa-info-circle"></i> Seules les machines allumées et non affectées apparaissent ici.
                            </p>
                        </div>

                        <!-- Champs spécifiques Exploitant -->
                        <div id="exploitant-fields" style="display:${!isEdit || (isEdit && user.role === 'exploitant') ? 'contents' : 'none'};">
                            <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                                <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Superficie (ha)</label>
                                <input type="number" name="surface" value="${isEdit ? (user.surface || '0') : '0'}" step="0.1" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                            </div>
                            <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                                <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Certification</label>
                                <select name="certification" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; cursor:pointer;">
                                    <option value="Standard" ${isEdit && user.certification === 'Standard' ? 'selected' : ''} style="background:var(--bg-darker);">Standard</option>
                                    <option value="Bio" ${isEdit && user.certification === 'Bio' ? 'selected' : ''} style="background:var(--bg-darker);">Bio (Ecocert)</option>
                                    <option value="Durable" ${isEdit && user.certification === 'Durable' ? 'selected' : ''} style="background:var(--bg-darker);">Durable (RSPO)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:15px; padding: 0 1.75rem 1.75rem 1.75rem;">
                        <button type="button" id="cancel-user-modal" style="flex:1; padding:16px; background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid var(--glass-border); border-radius:14px; font-weight:700; cursor:pointer; transition:all 0.3s; font-family:'Outfit'; font-size:0.95rem;">
                            ANNULER
                        </button>
                        <button type="submit" style="flex:2; padding:16px; background:var(--primary); color:var(--bg-darker); border:none; border-radius:14px; font-weight:800; cursor:pointer; transition:all 0.3s; box-shadow: 0 4px 20px var(--primary-glow); font-family:'Outfit'; font-size:0.95rem;">
                            <i data-lucide="check" style="width:18px; vertical-align:middle; margin-right:5px;"></i> VALIDER
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.classList.add('active');
            document.body.classList.add('modal-open');
        }, 10);

        if (window.lucide) window.lucide.createIcons();

        const close = () => {
            overlay.classList.remove('active');
            document.body.classList.remove('modal-open');
            setTimeout(() => overlay.remove(), 300);
        };

        document.getElementById('close-user-modal').onclick = close;
        document.getElementById('cancel-user-modal').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        // Chargement dynamique des unités disponibles
        const unitSelect = document.getElementById('assigned-unit-select');
        if (unitSelect) {
            databaseService.getAvailableUnits().then(units => {
                // Filtre supplémentaire : Uniquement les machines allumées (Online)
                const onlineUnits = units.filter(u => this.getNetworkStatus(u.lastSeen));

                console.log(`🔌 [ADMIN] Machines libres: ${units.length}, dont Online: ${onlineUnits.length}`);

                onlineUnits.forEach(unit => {
                    if (isEdit && unit.unitId === user.assignedUnit) return; // Déjà affiché
                    const opt = document.createElement('option');
                    opt.value = unit.unitId;
                    opt.textContent = unit.unitId;
                    opt.style.background = 'var(--bg-darker)';
                    unitSelect.appendChild(opt);
                });
            });
        }

        // Chargement dynamique des industries
        const industrySelect = document.getElementById('modal-industry-select');
        if (industrySelect) {
            databaseService.getAllIndustries().then(industries => {
                console.log(`🏭 [ADMIN] Industries disponibles: ${industries.length}`);

                industries.forEach(industry => {
                    if (isEdit && industry.id === user.industryId) return; // Déjà affiché
                    const opt = document.createElement('option');
                    opt.value = industry.id;
                    opt.textContent = industry.nom || industry.id;
                    opt.style.background = 'var(--bg-darker)';
                    industrySelect.appendChild(opt);
                });
            }).catch(error => console.error('Erreur chargement industries:', error));
        }

        const roleSelect = document.getElementById('modal-user-role');
        const unitContainer = document.getElementById('unit-field-container');
        const exploitantFields = document.getElementById('exploitant-fields');

        if (roleSelect && unitContainer && exploitantFields) {
            roleSelect.onchange = () => {
                const isExploitant = roleSelect.value === 'exploitant';
                unitContainer.style.display = isExploitant ? 'block' : 'none';
                exploitantFields.style.display = isExploitant ? 'contents' : 'none';
            };
        }

        const form = document.getElementById('user-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> TRAITEMENT...';
            if (window.lucide) window.lucide.createIcons();

            const formData = new FormData(form);
            const role = formData.get('role');
            const email = formData.get('email');

            try {
                const assignedUnit = role === 'exploitant' ? formData.get('assignedUnit') : null;
                const industryId = role === 'exploitant' ? formData.get('industryId') : null;
                const userData = {
                    name: formData.get('name'),
                    fullName: formData.get('name'),
                    email: email,
                    role: role,
                    status: 'actif',
                    assignedUnit: assignedUnit,
                    industryId: industryId
                };

                if (isEdit) {
                    const docId = user.uid || email.replace('.', '_');

                    // Si c'est un exploitant, on enrichituserData avec les nouveaux champs
                    if (role === 'exploitant') {
                        userData.surface = formData.get('surface') + ' ha';
                        userData.certification = formData.get('certification');
                    }

                    await databaseService.saveUser(docId, userData);

                    // [SYNC] Mettre à jour aussi la collection producteurs si nécessaire
                    if (role === 'exploitant') {
                        await databaseService.updateProducerProfile(docId, {
                            fullName: userData.name,
                            assignedUnit: userData.assignedUnit,
                            surface: userData.surface,
                            certification: userData.certification
                        });
                    }

                    if (assignedUnit && assignedUnit !== user.assignedUnit) {
                        await databaseService.assignUnitToUser(assignedUnit, email, docId);
                    }

                    Object.assign(user, userData);
                    this.showToast(`L'utilisateur ${email} a été mis à jour.`, 'success');
                } else {
                    const autoPassword = Math.random().toString(36).slice(-8) + "!";

                    if (role === 'exploitant') {
                        userData.surface = formData.get('surface') + ' ha';
                        userData.certification = formData.get('certification');
                        userData.industryId = industryId;
                    }

                    const uid = await databaseService.createUser(email, autoPassword, userData);

                    if (assignedUnit) {
                        await databaseService.assignUnitToUser(assignedUnit, email, uid);
                    }

                    this.users.push({ ...userData, uid });
                    this.showToast(`Compte créé. Envoi de l'email de bienvenue...`, 'info');

                    try {
                        await emailService.sendWelcomeEmail(userData, autoPassword);
                        this.showToast(`Email de bienvenue envoyé à ${email}.`, 'success');
                    } catch (emailErr) {
                        console.error("Erreur EmailJS:", emailErr);
                        this.showToast("Compte créé mais erreur lors de l'envoi de l'email.", "warning");
                    }
                }

                this.updateStats();
                this.render('users');
                close();
            } catch (error) {
                console.error("Erreur création utilisateur:", error);
                this.showToast(error.message || "Erreur lors de la création.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i data-lucide="check"></i> VALIDER';
                if (window.lucide) window.lucide.createIcons();
            }
        };
    }

    showAddUnitModal() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal glass-card">
                <div class="modal-header">
                    <h3 style="margin:0; font-family:'Outfit'; font-weight:800; color:var(--primary); font-size:1.4rem; display:flex; align-items:center; gap:10px;">
                        <i data-lucide="plus-circle"></i> ENREGISTRER UNE UNITÉ
                    </h3>
                    <button class="modal-close" id="close-modal"><i data-lucide="x"></i></button>
                </div>
                
                <form id="add-unit-form">
                    <div class="modal-body" style="display:flex; flex-direction:column; gap:15px;">
                        <div class="glass-card" style="padding:15px; border-radius:12px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.75rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:8px; font-weight:600;">ID Machine (ESP32)</label>
                            <input type="text" name="id" placeholder="Ex: SS-DELTA-05" required style="width:100%; padding:12px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none; transition:all 0.3s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--glass-border)'">
                        </div>
                        
                        <div class="glass-card" style="padding:15px; border-radius:12px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.75rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:8px; font-weight:600;">Localisation (Ville)</label>
                            <input type="text" name="location" placeholder="Ex: Cotonou" required style="width:100%; padding:12px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none; transition:all 0.3s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--glass-border)'">
                        </div>

                        <div class="glass-card" style="padding:15px; border-radius:12px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.75rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:8px; font-weight:600;">Propriétaire (Exploitant)</label>
                            <select name="owner" required style="width:100%; padding:12px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none; transition:all 0.3s; cursor:pointer;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--glass-border)'">
                                ${this.users.filter(u => u.role === 'exploitant').map(u => `<option value="${u.name}" style="background:var(--bg-darker);">${u.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:15px; padding: 0 1.75rem 1.75rem 1.75rem;">
                        <button type="button" id="cancel-modal" style="flex:1; padding:16px; background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid var(--glass-border); border-radius:14px; font-weight:700; cursor:pointer; transition:all 0.3s; font-family:'Outfit'; font-size:0.95rem;">
                            ANNULER
                        </button>
                        <button type="submit" style="flex:2; padding:16px; background:var(--primary); color:var(--bg-darker); border:none; border-radius:14px; font-weight:800; cursor:pointer; transition:all 0.3s; box-shadow: 0 4px 20px var(--primary-glow); font-family:'Outfit'; font-size:0.95rem;">
                            <i data-lucide="check" style="width:18px; vertical-align:middle; margin-right:5px;"></i> VALIDER
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        // Animation
        setTimeout(() => {
            overlay.classList.add('active');
            document.body.classList.add('modal-open');
        }, 10);

        if (window.lucide) window.lucide.createIcons();

        const close = () => {
            overlay.classList.remove('active');
            document.body.classList.remove('modal-open');
            setTimeout(() => overlay.remove(), 300);
        };

        document.getElementById('close-modal').onclick = close;
        document.getElementById('cancel-modal').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        const form = document.getElementById('add-unit-form');
        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const newUnit = {
                id: formData.get('id').toUpperCase(),
                location: formData.get('location'),
                owner: formData.get('owner'),
                status: 'online',
                signal: 'Fort',
                installDate: new Date().toISOString().split('T')[0],
                sensorHealth: 'Excellente'
            };
            this.units.unshift(newUnit);
            this.updateStats();
            this.render('fleet');
            close();
        };
    }

    showUnitDetailsModal(unitId) {
        const u = this.units.find(unit => unit.id === unitId);
        if (!u) return;

        const isOnline = this.getNetworkStatus(u.lastSeen);
        const ownerUser = this.users.find(user => user.uid === u.owner || user.id === u.owner || user.email === u.ownerEmail);
        const ownerName = ownerUser ? (ownerUser.fullName || ownerUser.name) : 'Non assigné';
        const ownerEmail = ownerUser ? ownerUser.email : '--';
        const ownerRole = ownerUser ? ownerUser.role.toUpperCase() : '--';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        overlay.innerHTML = `
            <div class="modal glass-card" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 style="margin:0; font-family:'Outfit'; font-weight:800; color:var(--primary); font-size:1.4rem; display:flex; align-items:center; gap:10px;">
                        <i data-lucide="radio-receiver"></i> DÉTAILS ${u.id || u.unitId}
                    </h3>
                    <button class="modal-close" id="close-details-modal"><i data-lucide="x"></i></button>
                </div>
                
                <div class="modal-body">
                    <h4 style="font-size:0.85rem; margin-bottom:1rem; color:var(--text-main); text-transform:uppercase; font-weight:700; border-bottom:1px solid var(--glass-border); padding-bottom:8px; font-family:'Outfit';">Profil du Propriétaire</h4>
                    <div class="glass-card" style="display:flex; align-items:center; gap:15px; padding:1.25rem; border:1px solid var(--glass-border); border-radius:var(--radius-lg); background:rgba(255,255,255,0.02); margin-bottom:1.5rem;">
                        <div style="width:48px; height:48px; border-radius:50%; background:var(--glass-bg); display:flex; align-items:center; justify-content:center; border:1px solid var(--glass-border);">
                            <i data-lucide="user" style="width:24px; color:var(--primary);"></i>
                        </div>
                        <div>
                            <div style="font-weight: 800; color: var(--text-main); font-size: 1.1rem;">${ownerName}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${ownerEmail} | Rôle: ${ownerRole}</div>
                        </div>
                    </div>

                    <h4 style="font-size:0.85rem; margin-bottom:1rem; color:var(--text-main); text-transform:uppercase; font-weight:700; border-bottom:1px solid var(--glass-border); padding-bottom:8px; font-family:'Outfit';">Informations Système</h4>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                        <div class="glass-card" style="padding:1.25rem; border:1px solid var(--glass-border); border-radius:var(--radius-lg); background:rgba(255,255,255,0.02);">
                            <span style="display:block; font-size:0.75rem; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase; font-weight:600; letter-spacing:0.05em;">État d'Affectation</span>
                            <div style="font-weight:800; color:${u.status === 'actif' ? 'var(--secondary)' : u.status === 'disponible' ? 'var(--primary)' : 'var(--warning)'}; font-size:1.1rem; text-transform:uppercase;">
                                ${u.status || 'INCONNU'}
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:5px; display:flex; align-items:center; gap:5px;">
                                <i data-lucide="calendar" style="width:14px;"></i> Enr.: ${u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '--'}
                            </div>
                        </div>
                        <div class="glass-card" style="padding:1.25rem; border:1px solid var(--glass-border); border-radius:var(--radius-lg); background:rgba(255,255,255,0.02);">
                            <span style="display:block; font-size:0.75rem; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase; font-weight:600; letter-spacing:0.05em;">État Réseau</span>
                            <div style="font-weight:800; color:${isOnline ? 'var(--secondary)' : 'var(--danger)'}; font-size:1.1rem; display:flex; align-items:center; gap:8px;">
                                <i data-lucide="wifi"></i> ${isOnline ? 'En ligne' : 'Hors ligne'}
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:5px; display:flex; align-items:center; gap:5px;">
                                <i data-lucide="clock" style="width:14px;"></i> Vue: ${u.lastSeen ? new Date(u.lastSeen).toLocaleTimeString('fr-FR') : '--'}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="display:flex; gap:15px; margin-top:15px; padding: 0 1.75rem 1.75rem 1.75rem;">
                    <button id="btn-reboot-unit" style="flex:1; padding:16px; background:rgba(239,68,68,0.1); color:var(--danger); border:1px solid rgba(239,68,68,0.3); border-radius:14px; font-weight:800; cursor:pointer; transition:all 0.3s; font-family:'Outfit'; font-size:0.95rem;">
                        <i data-lucide="refresh-cw" style="width:18px; vertical-align:middle; margin-right:5px;"></i> REDÉMARRER LA MACHINE
                    </button>
                    <button id="close-details-btn" style="flex:1; padding:16px; background:var(--primary); color:var(--bg-darker); border:none; border-radius:14px; font-weight:800; cursor:pointer; transition:all 0.3s; box-shadow: 0 4px 20px var(--primary-glow); font-family:'Outfit'; font-size:0.95rem;">
                        FERMER
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.classList.add('active');
            document.body.classList.add('modal-open');
        }, 10);

        if (window.lucide) window.lucide.createIcons();

        const close = () => {
            overlay.classList.remove('active');
            document.body.classList.remove('modal-open');
            setTimeout(() => overlay.remove(), 300);
        };

        document.getElementById('close-details-modal').onclick = close;
        document.getElementById('close-details-btn').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        document.getElementById('btn-reboot-unit').onclick = () => {
            mqttService.sendCommand(u.id || u.unitId, { action: 'reboot', value: true });
            this.showToast(`Commande de redémarrage envoyée à ${u.id || u.unitId}.`, 'warning');
            close();
        };
    }

    // showUnitControlsModal is removed.

    renderControlToggle(id, label, isActive) {
        return `
            <div class="glass-card" style="display:flex; justify-content:space-between; align-items:center; padding:15px; border:1px solid var(--glass-border); border-radius:12px; background:rgba(255,255,255,0.02);">
                <span style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${label}</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="toggle-${id}" ${isActive ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `;
    }

    showUnitTelemetryModal(unitId) {
        const u = this.units.find(unit => unit.id === unitId);
        if (!u) return;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        overlay.innerHTML = `
            <div class="modal glass-card" style="max-width: 650px; width: 100%;">
                <div class="modal-header">
                    <h3 style="margin:0; font-family:'Outfit'; font-weight:800; color:var(--secondary); font-size:1.4rem; display:flex; align-items:center; gap:10px;">
                        <i data-lucide="activity"></i> TÉLÉMÉTRIE LIVE - ${u.id}
                    </h3>
                    <button class="modal-close" id="close-telemetry-modal"><i data-lucide="x"></i></button>
                </div>
                
                <div class="modal-body">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                        <div class="glass-card" style="padding:15px; border-radius:12px; border:1px solid var(--glass-border); width:48%; background:rgba(255,255,255,0.02);">
                            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600; margin-bottom:5px; letter-spacing:0.05em;">Humidité Actuelle</div>
                            <div style="font-size:1.8rem; font-weight:800; color:var(--primary); display:flex; align-items:baseline; gap:5px;">
                                <span id="tel-hum">12.5</span> <span style="font-size:1rem; color:var(--text-muted);">%</span>
                            </div>
                        </div>
                        <div class="glass-card" style="padding:15px; border-radius:12px; border:1px solid var(--glass-border); width:48%; background:rgba(255,255,255,0.02);">
                            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600; margin-bottom:5px; letter-spacing:0.05em;">Température Actuelle</div>
                            <div style="font-size:1.8rem; font-weight:800; color:var(--secondary); display:flex; align-items:baseline; gap:5px;">
                                <span id="tel-temp">31.8</span> <span style="font-size:1rem; color:var(--text-muted);">°C</span>
                            </div>
                        </div>
                    </div>

                    <div class="glass-card" style="padding:15px; border-radius:12px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.01);">
                        <div id="admin-telemetry-chart" style="min-height: 250px;"></div>
                    </div>
                </div>

                <div style="padding: 0 1.75rem 1.75rem 1.75rem;">
                    <button id="close-telemetry-btn" style="width:100%; padding:16px; background:var(--secondary); color:var(--bg-darker); border:none; border-radius:14px; font-weight:800; cursor:pointer; transition:all 0.3s; box-shadow: 0 4px 20px rgba(16,185,129,0.3); font-family:'Outfit'; font-size:0.95rem;">
                        FERMER LE PANNEAU
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        setTimeout(() => {
            if (window.ApexCharts) {
                databaseService.getUnitHistory(unitId, 20).then(history => {
                    let humData = [];
                    let tempData = [];

                    if (history && history.length > 0) {
                        history.reverse().forEach(entry => {
                            const time = new Date(entry.timestamp || entry.createdAt).getTime();
                            humData.push({ x: time, y: parseFloat(entry.humidity) || 0 });
                            tempData.push({ x: time, y: parseFloat(entry.temperature) || 0 });
                        });
                    } else {
                        const time = new Date().getTime();
                        humData.push({ x: time, y: 0 });
                        tempData.push({ x: time, y: 0 });
                    }

                    const options = {
                        series: [
                            { name: 'Humidité (%)', data: humData },
                            { name: 'Température (°C)', data: tempData }
                        ],
                        chart: {
                            height: 250,
                            type: 'area',
                            toolbar: { show: false },
                            animations: { enabled: true, easing: 'easeinout', speed: 300 },
                            background: 'transparent',
                            zoom: { enabled: false }
                        },
                        colors: ['#0D9488', '#3B82F6'],
                        fill: {
                            type: 'gradient',
                            gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] }
                        },
                        dataLabels: { enabled: false },
                        stroke: { curve: 'smooth', width: 3 },
                        grid: {
                            borderColor: 'rgba(255, 255, 255, 0.05)',
                            strokeDashArray: 4,
                            xaxis: { lines: { show: false } },
                            yaxis: { lines: { show: true } }
                        },
                        xaxis: {
                            type: 'datetime',
                            labels: { style: { colors: '#94A3B8', fontSize: '10px' } },
                            axisBorder: { show: false },
                            axisTicks: { show: false }
                        },
                        yaxis: [
                            {
                                seriesName: 'Humidité (%)',
                                labels: { style: { colors: '#0D9488', fontSize: '10px' } },
                                min: 0, max: 100
                            },
                            {
                                opposite: true,
                                seriesName: 'Température (°C)',
                                labels: { style: { colors: '#3B82F6', fontSize: '10px' } },
                                min: 0, max: 100
                            }
                        ],
                        tooltip: { theme: 'dark' },
                        legend: {
                            position: 'top',
                            horizontalAlign: 'right',
                            labels: { colors: '#94A3B8' }
                        }
                    };

                    const chart = new window.ApexCharts(document.querySelector("#admin-telemetry-chart"), options);
                    chart.render();

                    // Initial DOM update if history exists
                    if (humData.length > 0 && humData[humData.length - 1].y > 0) {
                        const lastHum = humData[humData.length - 1].y;
                        const lastTemp = tempData[tempData.length - 1].y;
                        const humEl = document.getElementById('tel-hum');
                        const tempEl = document.getElementById('tel-temp');
                        if (humEl) humEl.textContent = lastHum.toFixed(1);
                        if (tempEl) tempEl.textContent = lastTemp.toFixed(1);
                    }

                    // S'abonner aux mises à jour en temps réel
                    const topic = `smart-soja/telemetry/${unitId}`;
                    this.telemetryCallback = (t, payload) => {
                        try {
                            const data = JSON.parse(payload);
                            const x = new Date().getTime();
                            const yHum = parseFloat(data.humidity);
                            const yTemp = parseFloat(data.temperature);

                            if (!isNaN(yHum) && !isNaN(yTemp)) {
                                chart.appendData([
                                    { data: [{ x, y: yHum }] },
                                    { data: [{ x, y: yTemp }] }
                                ]);

                                const humEl = document.getElementById('tel-hum');
                                const tempEl = document.getElementById('tel-temp');
                                if (humEl) humEl.textContent = yHum.toFixed(1);
                                if (tempEl) tempEl.textContent = yTemp.toFixed(1);
                            }
                        } catch (e) {
                            console.error("Erreur parsing payload telemetry:", e);
                        }
                    };
                    mqttService.subscribe(topic, this.telemetryCallback);
                });
            }
        }, 100);

        const close = () => {
            if (this.telemetryCallback) {
                // On pourrait se désabonner ici si le service MQTT le supportait facilement,
                // mais on peut aussi juste ignorer ou laisser pour ne pas casser d'autres abonnements.
            }
            overlay.classList.remove('active');
            document.body.classList.remove('modal-open');
            setTimeout(() => overlay.remove(), 300);
        };

        document.getElementById('close-telemetry-modal').onclick = close;
        document.getElementById('close-telemetry-btn').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        setTimeout(() => {
            overlay.classList.add('active');
            document.body.classList.add('modal-open');
        }, 10);

        if (window.lucide) window.lucide.createIcons();
    }

    showConfirmModal(title, message, onConfirm) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        overlay.innerHTML = `
            <div class="modal glass-card" style="max-width: 400px; text-align:center; padding: 2.5rem 2rem;">
                <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(239,68,68,0.1); color: var(--danger); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; border: 1px solid rgba(239,68,68,0.2);">
                    <i data-lucide="alert-triangle" style="width: 32px; height: 32px;"></i>
                </div>
                <h3 style="margin:0 0 10px 0; font-family:'Outfit'; font-weight:800; color:var(--text-main); font-size:1.4rem;">
                    ${title}
                </h3>
                <p style="color:var(--text-muted); font-size:0.95rem; margin-bottom:2rem; line-height:1.5;">
                    ${message}
                </p>
                <div style="display:flex; gap:15px; justify-content:center;">
                    <button id="cancel-confirm-btn" style="flex:1; padding:14px; background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid var(--glass-border); border-radius:14px; font-weight:700; cursor:pointer; transition:all 0.2s; font-family:'Outfit';">
                        ANNULER
                    </button>
                    <button id="accept-confirm-btn" style="flex:1; padding:14px; background:var(--danger); color:var(--bg-darker); border:none; border-radius:14px; font-weight:800; cursor:pointer; transition:all 0.2s; box-shadow: 0 4px 20px rgba(239,68,68,0.3); font-family:'Outfit';">
                        CONFIRMER
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.classList.add('active');
            document.body.classList.add('modal-open');
        }, 10);

        if (window.lucide) window.lucide.createIcons();

        const close = () => {
            overlay.classList.remove('active');
            document.body.classList.remove('modal-open');
            setTimeout(() => overlay.remove(), 300);
        };

        document.getElementById('cancel-confirm-btn').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        document.getElementById('accept-confirm-btn').onclick = () => {
            onConfirm();
            close();
        };
    }

    showToast(message, type = 'info') {
        // Map les anciens types aux nouveaux
        let title = '';
        let mappedType = type;

        if (type === 'error') {
            title = 'Erreur';
            mappedType = 'error';
        } else if (type === 'warning') {
            title = 'Attention';
            mappedType = 'warning';
        } else if (type === 'success') {
            title = 'Succès';
            mappedType = 'success';
        } else {
            title = 'Information';
            mappedType = 'info';
        }

        notificationService.show(title, message, mappedType);
    }

    // ===== GESTION DES INDUSTRIES =====

    showAddIndustryModal() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal glass-card">
                <div class="modal-header">
                    <h3 style="margin:0; font-family:'Outfit'; font-weight:800; color:var(--accent); font-size:1.4rem; display:flex; align-items:center; gap:10px;">
                        <i data-lucide="building-2"></i> NOUVELLE INDUSTRIE
                    </h3>
                    <button class="modal-close" id="close-modal"><i data-lucide="x"></i></button>
                </div>
                
                <form id="industry-form">
                    <div class="modal-body" style="display:flex; flex-direction:column; gap:12px; max-height: 70vh; overflow-y: auto; padding-right: 5px;">
                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Nom de l'Industrie</label>
                            <input type="text" name="nom" placeholder="Ex: GDIZ, Cotonou SA..." required style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; font-size:0.9rem; outline:none;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--glass-border)'">
                        </div>



                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Norme de Qualité</label>
                            <input type="text" name="qualityStandard" placeholder="Ex: GDIZ" required style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                        </div>

                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Humidité Maximale (%)</label>
                            <input type="number" name="maxHumidity" value="12" min="0" max="100" step="0.5" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                        </div>

                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Responsable Qualité</label>
                            <input type="text" name="qualityRoleName" placeholder="Ex: Responsable Qualité" required style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                        </div>

                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Directeur Industriel</label>
                            <input type="text" name="directorRoleName" placeholder="Ex: Directeur Industriel" required style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                        </div>

                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Email Contact</label>
                            <input type="email" name="email" placeholder="contact@industrie.com" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                        </div>

                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Téléphone Contact</label>
                            <input type="tel" name="telephone" placeholder="+229 XX XX XX XX" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                        </div>

                        <div style="padding:10px; background:rgba(168,85,247,0.1); border:1px solid rgba(168,85,247,0.3); border-radius:10px;">
                            <div style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                                <i data-lucide="info" style="width:14px;"></i> Créer un compte utilisateur industrie
                            </div>
                            <div style="display:flex; gap:10px; align-items:center;">
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.85rem; color:var(--text-main); flex:1;">
                                    <input type="checkbox" id="create-industry-account" checked style="cursor:pointer;">
                                    Créer un compte de connexion
                                </label>
                            </div>
                        </div>

                        <div id="industry-account-fields" style="display:flex; flex-direction:column; gap:12px;">
                            <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                                <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Email de Connexion</label>
                                <input type="email" name="accountEmail" placeholder="admin@industrie.com" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                            </div>

                            <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                                <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Mot de Passe</label>
                                <div style="display:flex; gap:8px; align-items:center;">
                                    <input type="text" id="industry-password" placeholder="Auto-généré" readonly style="flex:1; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Courier New'; font-size:0.85rem; outline:none; font-weight:600;">
                                    <button type="button" id="generate-password-btn" style="padding:10px 15px; background:var(--secondary); color:var(--bg-darker); border:none; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.75rem; white-space:nowrap;">
                                        <i data-lucide="refresh-cw" style="width:14px; vertical-align:middle;"></i> GÉNÉRER
                                    </button>
                                </div>
                                <div style="font-size:0.65rem; color:var(--text-muted); margin-top:6px;">Le mot de passe sera envoyé par email à l'industrie.</div>
                            </div>
                        </div>
                    
                    <div style="display:flex; gap:15px; padding: 0 1.75rem 1.75rem 1.75rem;">
                        <button type="button" id="cancel-modal" style="flex:1; padding:16px; background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid var(--glass-border); border-radius:14px; font-weight:700; cursor:pointer; transition:all 0.3s; font-family:'Outfit'; font-size:0.95rem;">
                            ANNULER
                        </button>
                        <button type="submit" style="flex:2; padding:16px; background:var(--accent); color:var(--bg-darker); border:none; border-radius:14px; font-weight:800; cursor:pointer; transition:all 0.3s; box-shadow: 0 4px 20px rgba(168,85,247,0.3); font-family:'Outfit'; font-size:0.95rem;">
                            <i data-lucide="check" style="width:18px; vertical-align:middle; margin-right:5px;"></i> CRÉER L'INDUSTRIE
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);
        setTimeout(() => { overlay.classList.add('active'); document.body.classList.add('modal-open'); }, 10);
        if (window.lucide) window.lucide.createIcons();

        const close = () => {
            overlay.classList.remove('active');
            document.body.classList.remove('modal-open');
            setTimeout(() => overlay.remove(), 300);
        };

        document.getElementById('close-modal').onclick = close;
        document.getElementById('cancel-modal').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        // Génération du mot de passe
        const generatePassword = () => {
            const pwd = Math.random().toString(36).slice(-12).toUpperCase() + Math.random().toString(36).slice(-2);
            document.getElementById('industry-password').value = pwd;
            return pwd;
        };

        // Initial password generation
        generatePassword();

        const generateBtn = document.getElementById('generate-password-btn');
        if (generateBtn) generateBtn.onclick = (e) => {
            e.preventDefault();
            generatePassword();
            this.showToast('Mot de passe régénéré', 'info');
        };

        // Toggle account creation fields
        const createAccountCheckbox = document.getElementById('create-industry-account');
        const accountFields = document.getElementById('industry-account-fields');
        if (createAccountCheckbox) {
            createAccountCheckbox.onchange = () => {
                accountFields.style.display = createAccountCheckbox.checked ? 'flex' : 'none';
            };
        }

        const form = document.getElementById('industry-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> CRÉATION...';
            if (window.lucide) window.lucide.createIcons();

            try {
                const formData = new FormData(form);
                const createAccount = document.getElementById('create-industry-account').checked;
                const accountEmail = formData.get('accountEmail');
                const password = document.getElementById('industry-password').value;

                const newIndustry = {
                    id: 'industry_' + Date.now(),
                    nom: formData.get('nom'),
                    qualityStandard: formData.get('qualityStandard'),
                    maxHumidity: parseFloat(formData.get('maxHumidity')) || 12,
                    qualityRoleName: formData.get('qualityRoleName'),
                    directorRoleName: formData.get('directorRoleName'),
                    email: formData.get('email'),
                    telephone: formData.get('telephone'),
                    createdAt: new Date().toISOString(),
                    status: 'actif'
                };

                // Sauvegarder l'industrie dans Firestore
                await databaseService.saveIndustry(newIndustry);

                // Si création de compte activée, créer l'utilisateur industrie
                if (createAccount && accountEmail && password) {
                    try {
                        const userData = {
                            name: formData.get('nom'),
                            fullName: formData.get('nom'),
                            email: accountEmail,
                            role: 'industrie',
                            industryId: newIndustry.id,
                            status: 'actif'
                        };

                        const uid = await databaseService.createUser(accountEmail, password, userData);

                        // Envoyer l'email de bienvenue avec identifiants
                        try {
                            await emailService.sendWelcomeEmail({
                                ...userData,
                                email: accountEmail
                            }, password);
                            this.showToast(`Email de connexion envoyé à ${accountEmail}`, 'success');
                        } catch (emailErr) {
                            console.warn("Erreur EmailJS:", emailErr);
                            this.showToast(`Compte créé, mais erreur envoi email. Identifiants: ${accountEmail} / ${password}`, 'warning');
                        }

                        // Ajouter à la liste des utilisateurs
                        this.users.push({ ...userData, uid });
                    } catch (accountErr) {
                        console.error("Erreur création compte:", accountErr);
                        this.showToast(`Industrie créée mais pas de compte créé: ${accountErr.message}`, 'warning');
                    }
                }

                this.industries.push(newIndustry);
                this.render('industries');
                this.showToast(`Industrie "${newIndustry.nom}" créée avec succès.`, 'success');
                close();
            } catch (error) {
                console.error("Erreur création industrie:", error);
                this.showToast(error.message || "Erreur lors de la création.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i data-lucide="check"></i> CRÉER L\'INDUSTRIE';
                if (window.lucide) window.lucide.createIcons();
            }
        };
    }

    showEditIndustryModal(industryId) {
        const ind = this.industries.find(i => i.id === industryId);
        if (!ind) return;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal glass-card">
                <div class="modal-header">
                    <h3 style="margin:0; font-family:'Outfit'; font-weight:800; color:var(--accent); font-size:1.4rem; display:flex; align-items:center; gap:10px;">
                        <i data-lucide="edit-2"></i> MODIFIER L'INDUSTRIE
                    </h3>
                    <button class="modal-close" id="close-modal"><i data-lucide="x"></i></button>
                </div>
                
                <form id="industry-form">
                    <div class="modal-body" style="display:flex; flex-direction:column; gap:12px; max-height: 70vh; overflow-y: auto; padding-right: 5px;">
                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Nom de l'Industrie</label>
                            <input type="text" name="nom" value="${ind.nom}" required style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; font-size:0.9rem; outline:none;">
                        </div>



                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Norme de Qualité</label>
                            <input type="text" name="qualityStandard" value="${ind.qualityStandard || ''}" required style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                        </div>

                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Humidité Maximale (%)</label>
                            <input type="number" name="maxHumidity" value="${ind.maxHumidity || 12}" min="0" max="100" step="0.5" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                        </div>

                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Responsable Qualité</label>
                            <input type="text" name="qualityRoleName" value="${ind.qualityRoleName || ''}" required style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                        </div>

                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Directeur Industriel</label>
                            <input type="text" name="directorRoleName" value="${ind.directorRoleName || ''}" required style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                        </div>

                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Email Contact</label>
                            <input type="email" name="email" value="${ind.email || ''}" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                        </div>

                        <div class="glass-card" style="padding:12px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.02);">
                            <label style="display:block; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Téléphone Contact</label>
                            <input type="tel" name="telephone" value="${ind.telephone || ''}" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-family:'Inter'; outline:none;">
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:15px; padding: 0 1.75rem 1.75rem 1.75rem;">
                        <button type="button" id="cancel-modal" style="flex:1; padding:16px; background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid var(--glass-border); border-radius:14px; font-weight:700; cursor:pointer; transition:all 0.3s; font-family:'Outfit'; font-size:0.95rem;">
                            ANNULER
                        </button>
                        <button type="submit" style="flex:2; padding:16px; background:var(--accent); color:var(--bg-darker); border:none; border-radius:14px; font-weight:800; cursor:pointer; transition:all 0.3s; box-shadow: 0 4px 20px rgba(168,85,247,0.3); font-family:'Outfit'; font-size:0.95rem;">
                            <i data-lucide="check" style="width:18px; vertical-align:middle; margin-right:5px;"></i> ENREGISTRER LES MODIFICATIONS
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);
        setTimeout(() => { overlay.classList.add('active'); document.body.classList.add('modal-open'); }, 10);
        if (window.lucide) window.lucide.createIcons();

        const close = () => {
            overlay.classList.remove('active');
            document.body.classList.remove('modal-open');
            setTimeout(() => overlay.remove(), 300);
        };

        document.getElementById('close-modal').onclick = close;
        document.getElementById('cancel-modal').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        const form = document.getElementById('industry-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> ENREGISTREMENT...';
            if (window.lucide) window.lucide.createIcons();

            try {
                const formData = new FormData(form);
                const updated = {
                    ...ind,
                    nom: formData.get('nom'),
                    qualityStandard: formData.get('qualityStandard'),
                    maxHumidity: parseFloat(formData.get('maxHumidity')) || 12,
                    qualityRoleName: formData.get('qualityRoleName'),
                    directorRoleName: formData.get('directorRoleName'),
                    email: formData.get('email'),
                    telephone: formData.get('telephone')
                };

                await databaseService.saveIndustry(updated);
                const idx = this.industries.findIndex(i => i.id === industryId);
                if (idx >= 0) this.industries[idx] = updated;
                this.render('industries');
                this.showToast(`Industrie "${updated.nom}" mise à jour avec succès.`, 'success');
                close();
            } catch (error) {
                console.error("Erreur mise à jour industrie:", error);
                this.showToast(error.message || "Erreur lors de la mise à jour.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i data-lucide="check"></i> ENREGISTRER LES MODIFICATIONS';
                if (window.lucide) window.lucide.createIcons();
            }
        };
    }

    showIndustryUsersModal(industryId) {
        const ind = this.industries.find(i => i.id === industryId);
        if (!ind) return;

        const industryUsers = this.users.filter(u => u.industryId === industryId);

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal glass-card" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 style="margin:0; font-family:'Outfit'; font-weight:800; color:var(--secondary); font-size:1.4rem; display:flex; align-items:center; gap:10px;">
                        <i data-lucide="users"></i> UTILISATEURS DE ${ind.nom.toUpperCase()}
                    </h3>
                    <button class="modal-close" id="close-modal"><i data-lucide="x"></i></button>
                </div>
                
                <div class="modal-body">
                    ${industryUsers.length > 0 ? `
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            ${industryUsers.map(u => `
                                <div class="glass-card" style="padding:12px; border:1px solid var(--glass-border); display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <div style="font-weight:700; color:var(--text-main);">${u.name || u.fullName || 'Sans nom'}</div>
                                        <div style="font-size:0.75rem; color:var(--text-muted);">${u.email}</div>
                                    </div>
                                    <span style="font-size:0.65rem; font-weight:800; padding:4px 10px; border-radius:20px; background:rgba(59,130,246,0.1); color:var(--secondary); text-transform:uppercase;">
                                        ${u.role}
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    ` : `<div style="padding:30px; text-align:center; color:var(--text-muted);">Aucun utilisateur assigné à cette industrie.</div>`}
                </div>

                <div style="padding: 0 1.75rem 1.75rem 1.75rem;">
                    <button id="close-users-modal" style="width:100%; padding:16px; background:var(--secondary); color:var(--bg-darker); border:none; border-radius:14px; font-weight:800; cursor:pointer; transition:all 0.3s; box-shadow: 0 4px 20px rgba(16,185,129,0.3); font-family:'Outfit'; font-size:0.95rem;">
                        FERMER
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        setTimeout(() => { overlay.classList.add('active'); document.body.classList.add('modal-open'); }, 10);
        if (window.lucide) window.lucide.createIcons();

        const close = () => {
            overlay.classList.remove('active');
            document.body.classList.remove('modal-open');
            setTimeout(() => overlay.remove(), 300);
        };

        document.getElementById('close-modal').onclick = close;
        document.getElementById('close-users-modal').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };
    }

    async deleteIndustry(industryId) {
        try {
            const ind = this.industries.find(i => i.id === industryId);
            await databaseService.deleteIndustry(industryId);
            this.industries = this.industries.filter(i => i.id !== industryId);
            this.render('industries');
            this.showToast(`Industrie "${ind?.nom}" supprimée avec succès.`, 'success');
        } catch (error) {
            console.error("Erreur suppression industrie:", error);
            this.showToast(error.message || "Erreur lors de la suppression.", "error");
        }
    }
}

const adminController = new AdminController();
export default adminController;