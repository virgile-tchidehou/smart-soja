const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');
const qrService = require('./qr.service');

const execFileAsync = util.promisify(execFile);

// Pré-chargement du logo en base64 pour performance
const logoPath = path.join(__dirname, '../image/smart_soja_logo_premium.png');
let logoBase64 = '';
try {
    if (fs.existsSync(logoPath)) {
        logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    }
} catch (e) {
    console.error("Erreur lecture logo:", e);
}

/**
 * Génère le Passeport Numérique au format PDF via wkhtmltopdf
 */
async function generatePassportPDF(lotData) {
    const tempDir = os.tmpdir();
    const htmlFile = path.join(tempDir, `passport-${lotData.id}-${Date.now()}.html`);
    const pdfFile = path.join(tempDir, `passport-${lotData.id}-${Date.now()}.pdf`);

    try {
        // 0. Générer le QR Code Premium pour ce lot
        const qrBase64 = await qrService.generateLotQR(lotData.id);

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800&family=Inter:wght@400;600;700&display=swap');
                
                body {
                    font-family: 'Inter', sans-serif;
                    color: #0f172a;
                    margin: 0;
                    padding: 0;
                    background: #fff;
                }

                .document-wrapper {
                    padding: 40px;
                    padding-bottom: 70px;
                    position: relative;
                    min-height: 297mm;
                }
                
                .border-frame {
                    position: absolute;
                    top: 15px; left: 15px; right: 15px; bottom: 15px;
                    border: 1px solid #e2e8f0;
                    pointer-events: none;
                    z-index: 10;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 45px;
                    border-bottom: 4px solid #0f172a;
                    padding-bottom: 25px;
                }
                
                .logo-area {
                    display: flex;
                    align-items: center;
                    gap: 18px;
                }

                .logo-img {
                    height: 55px;
                    border-radius: 10px;
                }

                .brand-info h1 {
                    font-family: 'Outfit', sans-serif;
                    margin: 0;
                    font-size: 32px;
                    font-weight: 800;
                    color: #0f172a;
                    letter-spacing: -1.5px;
                    line-height: 1;
                }
                
                .brand-tagline {
                    font-size: 10px;
                    color: #64748b;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    margin-top: 5px;
                }

                .doc-type {
                    text-align: right;
                }

                .doc-label {
                    font-size: 10px;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }

                .doc-value {
                    font-family: 'Outfit', sans-serif;
                    font-size: 22px;
                    font-weight: 800;
                    color: #0f172a;
                }

                .main-title-section {
                    background: #0f172a;
                    color: #fff;
                    padding: 25px 30px;
                    border-radius: 14px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 40px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                }

                .title-content h2 {
                    margin: 0;
                    font-family: 'Outfit', sans-serif;
                    font-size: 24px;
                    color: #F7C948;
                    letter-spacing: 1px;
                }

                .title-content p {
                    margin: 5px 0 0 0;
                    font-size: 11px;
                    color: #94a3b8;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .status-pill {
                    background: ${lotData.status === 'validé' ? '#10b981' : '#ef4444'};
                    padding: 8px 18px;
                    border-radius: 30px;
                    font-size: 13px;
                    font-weight: 800;
                    letter-spacing: 1px;
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                    margin-bottom: 40px;
                }

                .info-card {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    padding: 25px;
                    position: relative;
                    overflow: hidden;
                }

                .card-header {
                    font-size: 11px;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    margin-bottom: 18px;
                    letter-spacing: 1.5px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .card-value {
                    font-size: 22px;
                    font-weight: 700;
                    color: #0f172a;
                    margin-bottom: 5px;
                }

                .card-sub {
                    font-size: 13px;
                    color: #64748b;
                }

                .metric-box {
                    display: flex;
                    align-items: flex-end;
                    gap: 8px;
                }

                .metric-unit {
                    font-size: 14px;
                    color: #64748b;
                    font-weight: 500;
                    padding-bottom: 4px;
                }

                .qr-section {
                    display: flex;
                    gap: 35px;
                    align-items: center;
                    background: #fff;
                    border: 1px dashed #cbd5e1;
                    border-radius: 20px;
                    padding: 30px;
                    margin-bottom: 40px;
                }

                .qr-image {
                    width: 150px;
                    height: 150px;
                    padding: 10px;
                    background: #fff;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }

                .qr-text {
                    flex: 1;
                }

                .qr-title {
                    font-family: 'Outfit', sans-serif;
                    font-size: 18px;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 10px;
                }

                .qr-desc {
                    font-size: 13px;
                    color: #475569;
                    line-height: 1.6;
                }

                .recommendations {
                    border-left: 6px solid #F7C948;
                    background: #fffef2;
                    padding: 25px 30px;
                    border-radius: 0 16px 16px 0;
                    margin-bottom: 45px;
                }

                .rec-label {
                    font-size: 12px;
                    font-weight: 800;
                    color: #0f172a;
                    text-transform: uppercase;
                    margin-bottom: 10px;
                }

                .rec-body {
                    font-size: 14px;
                    color: #334155;
                    font-style: italic;
                    line-height: 1.6;
                }

                .signatures {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-top: 60px;
                    margin-bottom: 40px;
                }

                .signature-box {
                    width: 220px;
                    text-align: center;
                }

                .sig-line {
                    border-top: 2px solid #0f172a;
                    margin-top: 60px;
                    padding-top: 10px;
                    font-size: 11px;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                }

                .stamp-premium {
                    width: 140px;
                    height: 140px;
                    border: 5px double ${lotData.status === 'validé' ? '#10b981' : '#ef4444'};
                    border-radius: 50%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: ${lotData.status === 'validé' ? '#10b981' : '#ef4444'};
                    transform: rotate(-12deg);
                    opacity: 0.85;
                    padding: 10px;
                }

                .stamp-top { font-size: 8px; font-weight: 800; text-transform: uppercase; }
                .stamp-mid { font-size: 16px; font-weight: 900; margin: 5px 0; border-top: 1px solid; border-bottom: 1px solid; width: 100%; text-align: center; }
                .stamp-bot { font-size: 10px; font-weight: 700; }

                .footer {
                    position: absolute;
                    bottom: 15px;
                    left: 40px;
                    right: 40px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 10px;
                    color: #94a3b8;
                    border-top: 1px solid #f1f5f9;
                    padding-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="border-frame"></div>
            
            <div class="document-wrapper">
                <div class="header">
                    <div class="logo-area">
                        ${logoBase64 ? `<img src="${logoBase64}" class="logo-img">` : '<div style="background:#0f172a; color:#fff; padding:10px; border-radius:8px; font-weight:800;">SS</div>'}
                        <div class="brand-info">
                            <h1>SMART-SOJA</h1>
                            <div class="brand-tagline">Excellence & Traçabilité IoT</div>
                        </div>
                    </div>
                    <div class="doc-type">
                        <div class="doc-label">Passeport Numérique</div>
                        <div class="doc-value">#${lotData.id}</div>
                    </div>
                </div>

                <div class="main-title-section">
                    <div class="title-content">
                        <h2>CERTIFICAT D'INTÉGRITÉ</h2>
                        <p>Validation Qualité — ${lotData.industryName || 'Zone Industrielle'}</p>
                    </div>
                    <div class="status-pill">${lotData.status === 'validé' ? 'VALIDE / CONFORME' : 'REJETÉ / NON CONFORME'}</div>
                </div>

                <div class="info-grid">
                    <div class="info-card">
                        <div class="card-header">PRODUCTEUR & ORIGINE</div>
                        <div class="card-value">${lotData.producer || 'Exploitant Smart-Soja'}</div>
                        <div class="card-sub">Zone : ${lotData.location || 'Bénin'}</div>
                        <div style="font-size: 11px; color:#10b981; font-weight:700; margin-top:10px;">★ CERTIFICATION SMART-SOJA PLATINUM</div>
                    </div>
                    <div class="info-card">
                        <div class="card-header">MESURES PHYSIQUES (IOT)</div>
                        <div class="metric-box">
                            <span class="card-value">${lotData.humidity || lotData.quality || '12.0'}%</span>
                            <span class="metric-unit">Humidité (Cible: ≤ 12%)</span>
                        </div>
                        <div class="metric-box" style="margin-top:10px;">
                            <span class="card-value" style="font-size:18px;">${lotData.weight || '0'} kg</span>
                            <span class="metric-unit">Poids Net Certifié</span>
                        </div>
                    </div>
                </div>

                <div class="qr-section">
                    <img src="${qrBase64}" class="qr-image">
                    <div class="qr-text">
                        <div class="qr-title">Vérification Instantanée</div>
                        <div class="qr-desc">
                            Scannez ce code QR pour accéder à l'historique complet sur la blockchain Smart-Soja. 
                            Toutes les mesures de température, d'humidité et de poids sont horodatées et 
                            signées numériquement par l'unité de pesage IoT.
                        </div>
                        <div style="margin-top: 15px; font-family: 'Courier New', monospace; font-size: 12px; font-weight: 700; color: #64748b;">
                            ID-TECH: ${lotData.id || lotData.technicalId || 'N/A'}
                        </div>
                    </div>
                </div>

                <div class="recommendations">
                    <div class="rec-label">RECOMMANDATIONS INDUSTRIELLES</div>
                    <div class="rec-body">
                        "${lotData.recommendations || 'Aucune recommandation spécifique. Le lot répond aux standards de qualité industrielle pour la transformation.'}"
                    </div>
                    <div style="margin-top: 15px; font-size: 11px; font-weight: 800; text-align: right;">
                        Par : ${lotData.industryName}
                    </div>
                </div>

                <div class="signatures">
                    <div class="signature-box">
                        <div class="sig-line">Responsable Qualité (${lotData.industryName || 'Industrie'})</div>
                    </div>
                    <div class="stamp-premium">
                        <div class="stamp-top">SMART-SOJA PLATFORM</div>
                        <div class="stamp-mid">${lotData.status === 'validé' ? 'CONFORME' : 'REJETÉ'}</div>
                        <div class="stamp-bot">${lotData.industryName || 'Certifié'}</div>
                    </div>
                    <div class="signature-box">
                        <div class="sig-line">Directeur des Opérations</div>
                    </div>
                </div>

                <div class="footer">
                    <div>Généré par Smart-Soja Backend v2.0 (High-End Edition)</div>
                    <div>© 2026 Smart-Soja - Système de Traçabilité Agricole par Capteurs IoT</div>
                </div>
            </div>
        </body>
        </html>
        `;

        // Écrire le HTML dans un fichier temporaire
        fs.writeFileSync(htmlFile, htmlContent);

        // Déterminer le chemin vers wkhtmltopdf
        let wkhtmltopdfPath = 'wkhtmltopdf';
        if (process.platform === 'win32') {
            const wkhtmltopdfWindows = path.join(__dirname, '../node_modules/.bin/wkhtmltopdf.cmd');
            if (fs.existsSync(wkhtmltopdfWindows)) {
                wkhtmltopdfPath = wkhtmltopdfWindows;
            }
        }

        // Exécuter wkhtmltopdf
        try {
            await execFileAsync(wkhtmltopdfPath, [
                '--quiet',
                '--enable-local-file-access',
                '--print-media-type',
                '--dpi', '150',
                '--lowquality',
                '--page-size', 'A4',
                '--margin-top', '0',
                '--margin-right', '0',
                '--margin-bottom', '0',
                '--margin-left', '0',
                htmlFile,
                pdfFile
            ]);
        } catch (error) {
            console.error('❌ Erreur wkhtmltopdf:', error.message);
            throw new Error(`PDF generation failed: ${error.message}`);
        }

        // Lire le fichier PDF généré
        const pdfBuffer = fs.readFileSync(pdfFile);
        return pdfBuffer;
    } catch (err) {
        console.error('❌ Erreur génération PDF Backend:', err);
        throw err;
    } finally {
        // Nettoyer les fichiers temporaires
        try {
            if (fs.existsSync(htmlFile)) fs.unlinkSync(htmlFile);
            if (fs.existsSync(pdfFile)) fs.unlinkSync(pdfFile);
        } catch (e) {
            console.warn('⚠️ Erreur nettoyage fichiers temporaires:', e.message);
        }
    }
}

async function generateBulkPassportPDF(lotsArray) {
    const tempDir = os.tmpdir();
    const htmlFile = path.join(tempDir, `bulk-passport-${Date.now()}.html`);
    const pdfFile = path.join(tempDir, `bulk-passport-${Date.now()}.pdf`);

    try {
        let fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800&family=Inter:wght@400;600;700&display=swap');
                
                body { font-family: 'Inter', sans-serif; color: #0f172a; margin: 0; padding: 0; }
                .page-break { page-break-after: always; }
                
                .passport-page { 
                    padding: 40px; 
                    height: 100%; 
                    position: relative; 
                    min-height: 297mm; 
                    box-sizing: border-box; 
                    background: white; 
                }

                .border-frame {
                    position: absolute;
                    top: 15px; left: 15px; right: 15px; bottom: 15px;
                    border: 1px solid #e2e8f0;
                    pointer-events: none;
                    z-index: 10;
                }
                
                .header { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    border-bottom: 4px solid #0f172a; 
                    padding-bottom: 20px; 
                    margin-bottom: 30px; 
                }

                .logo-container { display: flex; align-items: center; gap: 12px; }
                .logo-img { height: 45px; border-radius: 8px; }
                .brand-info h1 { font-family: 'Outfit', sans-serif; margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; }
                
                .status-badge { 
                    padding: 6px 14px; 
                    border-radius: 30px; 
                    font-weight: 800; 
                    font-size: 11px; 
                    text-transform: uppercase; 
                    color: white; 
                }
                .status-badge.valid { background: #10b981; }
                .status-badge.reject { background: #ef4444; }

                .passport-id { font-family: 'Outfit', sans-serif; font-size: 26px; font-weight: 800; color: #0f172a; margin-bottom: 2px; }
                
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
                .card { padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background: #f8fafc; }
                .card-title { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 800; margin-bottom: 10px; letter-spacing: 1px; }
                .value { font-size: 16px; font-weight: 700; color: #0f172a; }
                
                .recommendation-box { 
                    margin-top: 20px; 
                    padding: 20px; 
                    background: #fffef2; 
                    border: 1px solid #F7C948; 
                    border-left: 5px solid #F7C948; 
                    border-radius: 10px; 
                }
                .rec-title { font-size: 10px; font-weight: 800; color: #020617; text-transform: uppercase; margin-bottom: 8px; }
                .rec-content { font-size: 12px; color: #334155; font-style: italic; }

                .footer { 
                    position: absolute; 
                    bottom: 40px; 
                    left: 40px; 
                    right: 40px; 
                    border-top: 1px solid #f1f5f9; 
                    padding-top: 20px; 
                    font-size: 10px; 
                    color: #94a3b8; 
                    display: flex; 
                    justify-content: space-between; 
                }

                .signature-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
                .sig-box { width: 180px; text-align: center; }
                .sig-line { border-top: 2px solid #0f172a; margin-top: 50px; padding-top: 8px; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; }

                .stamp { 
                    width: 110px; 
                    height: 110px; 
                    border: 4px double; 
                    border-radius: 50%; 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center; 
                    font-weight: 800; 
                    transform: rotate(-10deg); 
                    opacity: 0.8; 
                }
                .stamp.valid { color: #10b981; border-color: #10b981; }
                .stamp.reject { color: #ef4444; border-color: #ef4444; }
                .stamp-top { font-size: 7px; text-transform: uppercase; }
                .stamp-mid { font-size: 12px; margin: 2px 0; border-top: 1px solid; border-bottom: 1px solid; width: 100%; text-align: center; }
            </style>
        </head>
        <body>
        `;

        lotsArray.forEach((lot, index) => {
            const isLast = index === lotsArray.length - 1;
            const statusClass = lot.status === 'validé' ? 'valid' : 'reject';

            fullHtml += `
            <div class="passport-page ${isLast ? '' : 'page-break'}">
                <div class="border-frame"></div>
                
                <div class="header">
                    <div class="logo-container">
                        ${logoBase64 ? `<img src="${logoBase64}" class="logo-img">` : '<div style="background:#0f172a; color:#fff; padding:8px; border-radius:6px; font-weight:800; font-size:12px;">SS</div>'}
                        <div class="brand-info">
                            <h1>SMART-SOJA</h1>
                        </div>
                    </div>
                    <div class="status-badge ${statusClass}">${lot.status === 'validé' ? 'VALIDE' : 'REJETÉ'}</div>
                </div>

                <div class="passport-id">#${lot.id}</div>
                <div style="color:#94a3b8; font-size: 11px; margin-bottom: 30px; font-weight: 600;">ARCHIVE CERTIFIÉE — ${new Date().toLocaleDateString('fr-FR')}</div>

                <div class="grid">
                    <div class="card">
                        <div class="card-title">Origine & Producteur</div>
                        <div class="value">${lot.producer || 'Exploitant Certifié'}</div>
                        <div style="font-size: 12px; color:#64748b; margin-top:5px;">${lot.location || 'Bénin'}</div>
                    </div>
                    <div class="card">
                        <div class="card-title">Analyse Qualité IoT</div>
                        <div class="value">${lot.humidity || lot.quality || '12.0'}% <span style="font-weight:400; font-size:12px; color:#64748b;">Humidité</span></div>
                        <div style="font-size: 12px; color:#64748b; margin-top:5px;">Poids Net : ${lot.weight || '0'} kg</div>
                    </div>
                </div>

                <div class="recommendation-box">
                    <div class="rec-title">Décision & Observations</div>
                    <div class="rec-content">
                        "${lot.recommendations || 'Aucune recommandation particulière. Lot conforme aux standards.'}"
                    </div>
                </div>

                <div class="signature-section">
                    <div class="sig-box">
                        <div class="sig-line">Responsable (${lot.industryName || 'Industrie'})</div>
                    </div>
                    <div class="stamp ${statusClass}">
                        <div class="stamp-top">SMART-SOJA</div>
                        <div class="stamp-mid">${lot.status === 'validé' ? 'CONFORME' : 'REJETÉ'}</div>
                        <div style="font-size: 8px;">${lot.industryName || 'Industrie'}</div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-line">Direction Technique</div>
                    </div>
                </div>

                <div class="footer">
                    <div>Rapport d'Archive Numérique v2.0</div>
                    <div>Page ${index + 1} sur ${lotsArray.length} — ID: ${lot.id}</div>
                </div>
            </div>
            `;
        });

        fullHtml += `</body></html>`;

        // Écrire le HTML dans un fichier temporaire
        fs.writeFileSync(htmlFile, fullHtml);

        // Déterminer le chemin vers wkhtmltopdf
        let wkhtmltopdfPath = 'wkhtmltopdf';
        if (process.platform === 'win32') {
            const wkhtmltopdfWindows = path.join(__dirname, '../node_modules/.bin/wkhtmltopdf.cmd');
            if (fs.existsSync(wkhtmltopdfWindows)) {
                wkhtmltopdfPath = wkhtmltopdfWindows;
            }
        }

        // Exécuter wkhtmltopdf
        try {
            await execFileAsync(wkhtmltopdfPath, [
                '--quiet',
                '--enable-local-file-access',
                '--print-media-type',
                '--dpi', '150',
                '--lowquality',
                '--page-size', 'A4',
                '--margin-top', '0',
                '--margin-right', '0',
                '--margin-bottom', '0',
                '--margin-left', '0',
                htmlFile,
                pdfFile
            ]);
        } catch (error) {
            console.error('❌ Erreur wkhtmltopdf (bulk):', error.message);
            throw new Error(`PDF generation failed: ${error.message}`);
        }

        // Lire le fichier PDF généré
        const pdfBuffer = fs.readFileSync(pdfFile);
        return pdfBuffer;
    } catch (err) {
        console.error('❌ Erreur Bulk PDF:', err);
        throw err;
    } finally {
        // Nettoyer les fichiers temporaires
        try {
            if (fs.existsSync(htmlFile)) fs.unlinkSync(htmlFile);
            if (fs.existsSync(pdfFile)) fs.unlinkSync(pdfFile);
        } catch (e) {
            console.warn('⚠️ Erreur nettoyage fichiers temporaires (bulk):', e.message);
        }
    }
}

module.exports = { generatePassportPDF, generateBulkPassportPDF };
