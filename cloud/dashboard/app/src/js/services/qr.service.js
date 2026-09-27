import { BACKEND_URL } from '../config/firebase-init.js';

class QRService {
    /**
     * Affiche la modale de sélection du type de traçabilité.
     * @param {Function} onSelect Callback avec le type choisi ('sac' ou 'lot')
     */
    showTypeSelector(onSelect) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.display = 'flex';
        modal.style.zIndex = '4000';
        modal.innerHTML = `
            <div class="modal glass-card" style="max-width: 500px; width: 90%; padding: 40px; text-align: center; border-radius: 32px;">
                <div class="selection-icon-top"><i data-lucide="qr-code"></i></div>
                <h2 style="color: var(--text-main); margin-bottom: 10px; font-weight: 800; font-family: 'Outfit';">Type de Traçabilité</h2>
                <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 35px; line-height: 1.5;">Souhaitez-vous générer un passeport pour une unité unique ou un regroupement ?</p>
                
                <div class="selection-options">
                    <button class="opt-btn" id="opt-single-sac">
                        <div class="opt-icon"><i data-lucide="package"></i></div>
                        <span>Sac Individuel</span>
                        <small>Une seule unité ensachée</small>
                    </button>
                    
                    <button class="opt-btn" id="opt-batch-lot">
                        <div class="opt-icon"><i data-lucide="layers"></i></div>
                        <span>Lot Consolidé</span>
                        <small>Regroupement de plusieurs sacs</small>
                    </button>
                </div>
                
                <button class="btn-cancel-selection">Annuler</button>
            </div>
            <style>
                .selection-icon-top { width: 60px; height: 60px; background: var(--primary); color: #000; border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
                .selection-options { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                .opt-btn {
                    background: var(--bg-darker); border: 1px solid var(--glass-border);
                    padding: 30px 20px; border-radius: 24px; cursor: pointer; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex; flex-direction: column; align-items: center; gap: 15px; color: var(--text-main);
                }
                .opt-btn:hover { background: var(--primary); color: #000; transform: translateY(-8px); border-color: var(--primary); box-shadow: 0 15px 30px var(--primary-glow); }
                .opt-btn .opt-icon { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.1); border-radius: 15px; }
                .opt-btn:hover .opt-icon { background: rgba(0,0,0,0.2); }
                .opt-btn span { font-weight: 700; font-size: 1.05rem; }
                .opt-btn small { font-size: 0.75rem; color: inherit; opacity: 0.7; font-weight: 500; }
                .btn-cancel-selection { background: none; border: none; color: var(--text-muted); cursor: pointer; font-weight: 600; padding: 10px; font-size: 1rem; transition: color 0.2s; }
                .btn-cancel-selection:hover { color: var(--text-main); }
            </style>
        `;
        document.body.appendChild(modal);
        if (window.lucide) window.lucide.createIcons();

        modal.querySelector('#opt-single-sac').onclick = () => { modal.remove(); onSelect('sac'); };
        modal.querySelector('#opt-batch-lot').onclick = () => { modal.remove(); onSelect('lot'); };
        modal.querySelector('.btn-cancel-selection').onclick = () => modal.remove();
    }

    /**
     * Affiche une modale pour choisir entre le lot actuel ou un lot de l'historique.
     * @param {Array} history Liste des lots récents
     * @param {Function} onSelect Callback (lotId ou 'current')
     */
    showLotSelector(history, onSelect) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.display = 'flex';
        modal.style.zIndex = '4000';
        modal.innerHTML = `
            <div class="modal glass-card" style="max-width: 550px; width: 95%; padding: 30px; border-radius: 28px;">
                <h2 style="font-family: 'Outfit'; font-weight: 800; margin-bottom: 20px; text-align: center;">Sélection du Lot</h2>
                
                <div class="selection-list" style="max-height: 400px; overflow-y: auto; padding-right: 5px;">
                    <!-- Option Lot Actuel -->
                    <div class="lot-option current" id="select-current-lot" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); padding: 15px; border-radius: 16px; margin-bottom: 20px; cursor: pointer; display: flex; align-items: center; gap: 15px; transition: all 0.3s;">
                        <div style="width: 45px; height: 45px; background: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #000;">
                            <i data-lucide="play-circle"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 1rem; color: var(--primary);">SESSION EN COURS</div>
                            <div style="font-size: 0.8rem; opacity: 0.7;">Générer un QR avec les mesures actuelles</div>
                        </div>
                        <i data-lucide="chevron-right"></i>
                    </div>

                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding-left: 5px;">Lots Récents</div>
                    
                    ${history.length === 0 ? '<p style="text-align: center; padding: 20px; color: var(--text-muted);">Aucun historique disponible</p>' :
                history.slice(0, 8).map(lot => `
                        <div class="lot-option history-select" data-id="${lot.id}" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); padding: 12px 15px; border-radius: 14px; margin-bottom: 10px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.2s;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="font-size: 0.85rem; font-weight: 700;">${lot.id}</div>
                                <div style="font-size: 0.7rem; color: var(--text-muted);">${lot.date}</div>
                            </div>
                            <div style="font-size: 0.85rem; font-weight: 800; color: var(--secondary);">${lot.weight}kg • ${lot.humidity}%</div>
                        </div>
                    `).join('')}
                </div>

                <button class="btn-cancel-selection" style="width: 100%; margin-top: 20px; padding: 12px; background: rgba(255,255,255,0.05); border: none; border-radius: 12px; color: var(--text-muted); cursor: pointer; font-weight: 600;">Annuler</button>
            </div>
            <style>
                .lot-option:hover { transform: scale(1.02); background: rgba(255,255,255,0.08) !important; border-color: var(--primary) !important; }
                .lot-option.current:hover { background: rgba(59, 130, 246, 0.2) !important; }
                .selection-list::-webkit-scrollbar { width: 4px; }
                .selection-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            </style>
        `;
        document.body.appendChild(modal);
        if (window.lucide) window.lucide.createIcons();

        modal.querySelector('#select-current-lot').onclick = () => { modal.remove(); onSelect('current'); };
        modal.querySelectorAll('.history-select').forEach(el => {
            el.onclick = () => { modal.remove(); onSelect(el.getAttribute('data-id')); };
        });
        modal.querySelector('.btn-cancel-selection').onclick = () => modal.remove();
    }

    /**
     * Génère et affiche l'étiquette premium.
     * @param {Object} data Données du lot (type, weight, humidity, unitId)
     */
    generatePremiumLabel(data) {
        const { type, weight, humidity, unitId, lotId: existingLotId, date: existingDate, industryName } = data;
        const prefix = type === 'sac' ? 'SAC' : 'LOT';
        const lotId = existingLotId || `SS-${prefix}-${Date.now().toString().slice(-6)}`;
        const date = existingDate || new Date().toLocaleDateString();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.display = 'flex';
        modal.style.zIndex = '4000';
        modal.innerHTML = `
            <div class="label-preview-container">
                <div class="label-actions no-print">
                    <button class="btn-close-qr" style="background: var(--bg-darker); color: var(--text-main); border: 1px solid var(--glass-border); padding: 12px 20px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600; transition: all 0.3s;"><i data-lucide="x"></i> Fermer</button>
                    <button class="btn-print-label" style="background: var(--primary); color: #000; border: none; padding: 12px 20px; border-radius: 12px; cursor: pointer; font-weight: 700; display: flex; align-items: center; gap: 8px; transition: all 0.3s; box-shadow: 0 4px 15px var(--primary-glow);"><i data-lucide="printer"></i> Imprimer l'Étiquette</button>
                </div>
                
                <div class="premium-label" id="printable-label">
                    <div class="label-header">
                        <div class="label-logo">
                            <img src="/assets/smart_soja_logo_premium.png" alt="Logo">
                            <span>SMART-SOJA</span>
                        </div>
                        <div class="label-auth">${type === 'sac' ? 'UNITÉ : SAC' : 'UNITÉ : LOT'}</div>
                    </div>
                    
                    <div class="label-body">
                        <div id="premium-qrcode"></div>
                        <div class="label-info">
                            <div class="info-row">
                                <span class="label">Référence</span>
                                <span class="value">${lotId}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Date</span>
                                <span class="value">${date}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Type</span>
                                <span class="value"><span class="badge-${type}">${type === 'sac' ? 'Sac' : 'Batch Regroupé'}</span></span>
                            </div>
                            <div class="info-row">
                                <span class="label">Poids Global</span>
                                <span class="value">${weight} kg</span>
                            </div>
                            ${industryName ? `<div class="info-row">
                                <span class="label">Industrie Destinataire</span>
                                <span class="value" style="color: var(--accent);">${industryName}</span>
                            </div>` : ''}
                        </div>
                    </div>
                    
                    <div class="label-footer">
                        <div class="footer-msg">L'innovation au service de l'agriculture béninoise</div>
                        <div class="unit-id">${unitId}</div>
                    </div>
                    
                    <div class="crop-mark top-left"></div>
                    <div class="crop-mark top-right"></div>
                    <div class="crop-mark bottom-left"></div>
                    <div class="crop-mark bottom-right"></div>
                </div>
            </div>
            <style>
                @page { size: auto; margin: 0mm; }
                .label-preview-container { width: 100%; max-width: 450px; font-family: 'Inter', sans-serif; }
                .label-actions { display: flex; justify-content: space-between; margin-bottom: 20px; }
                
                .btn-close-qr:hover { background: var(--danger) !important; color: white !important; border-color: var(--danger) !important; }
                .btn-print-label:hover { transform: translateY(-2px); box-shadow: 0 8px 25px var(--primary-glow) !important; }

                .premium-label {
                    background: white; color: #000; padding: 40px; border-radius: 16px;
                    position: relative; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                }
                .label-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                .label-logo { display: flex; align-items: center; gap: 10px; }
                .label-logo img { height: 30px; }
                .label-logo span { font-weight: 900; font-family: 'Outfit', sans-serif; font-size: 1.1rem; }
                .label-auth { font-size: 0.6rem; font-weight: 800; color: #64748b; letter-spacing: 1px; }
                
                .label-body { display: flex; gap: 30px; align-items: center; }
                #premium-qrcode { background: #f8fafc; padding: 10px; border-radius: 12px; border: 1px solid #f1f5f9; }
                
                .label-info { flex: 1; display: flex; flex-direction: column; gap: 12px; }
                .info-row { display: flex; flex-direction: column; }
                .info-row .label { font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; }
                .info-row .value { font-size: 0.9rem; font-weight: 800; color: #1e293b; }
                
                .badge-sac { background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 100px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; }
                .badge-lot { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 100px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; }

                .label-footer { margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px; display: flex; justify-content: space-between; align-items: center; }
                .footer-msg { font-size: 0.55rem; color: #94a3b8; font-style: italic; }
                .unit-id { font-size: 0.6rem; font-weight: 700; color: #000; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; }

                .crop-mark { position: absolute; width: 15px; height: 15px; border-color: #cbd5e1; border-style: solid; }
                .top-left { top: 0; left: 0; border-width: 1px 0 0 1px; }
                .top-right { top: 0; right: 0; border-width: 1px 1px 0 0; }
                .bottom-left { bottom: 0; left: 0; border-width: 0 0 1px 1px; }
                .bottom-right { bottom: 0; right: 0; border-width: 0 1px 1px 0; }

                @media print {
                    @page { margin: 0; }
                    body { margin: 0; padding: 0; }
                    body > *:not(.modal-overlay) { display: none !important; }
                    .modal-overlay { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: white !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; }
                    .no-print { display: none !important; }
                    .premium-label { box-shadow: none !important; border: none !important; width: 100mm; height: 100mm; display: flex; flex-direction: column; justify-content: center; border-radius: 0 !important; }
                }
            </style>
        `;

        document.body.appendChild(modal);
        if (window.lucide) window.lucide.createIcons();

        // Generate the QR Code via Backend API
        setTimeout(async () => {
            try {
                const target = document.getElementById("premium-qrcode");
                if (!target) return;

                const response = await fetch(`${BACKEND_URL}/api/generate-qr`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lotId: lotId })
                });

                const data = await response.json();
                if (data.qr) {
                    target.innerHTML = `<img src="${data.qr}" style="width: 160px; height: 160px; display: block; border-radius: 8px;">`;
                }
            } catch (err) {
                console.error("QR Backend Error:", err);
                // Fallback local si le backend est HS
                target.innerHTML = `<div style="padding:20px; font-size:10px; color:red;">Erreur Backend QR</div>`;
            }
        }, 150);

        modal.querySelector('.btn-close-qr').onclick = () => modal.remove();
        modal.querySelector('.btn-print-label').onclick = () => window.print();
    }
}

const qrService = new QRService();
export default qrService;
