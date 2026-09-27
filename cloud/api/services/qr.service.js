const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

/**
 * Génère un QR Code Premium avec Logo pour un Lot
 * @param {string} lotId - L'identifiant du lot
 * @returns {Promise<string>} - Image Base64 du QR Code personnalisé
 */
async function generateLotQR(lotId) {
    try {
        const qrContent = lotId; 
        const size = 600;
        const logoPath = path.join(__dirname, '../image/smart_soja_logo_premium.png');
        
        // 1. Générer le QR Code de base en haute qualité
        const canvas = createCanvas(size, size);
        await QRCode.toCanvas(canvas, qrContent, {
            errorCorrectionLevel: 'H', // Haute correction pour permettre le logo
            margin: 1,
            color: {
                dark: '#020617',  // Bleu nuit profond (Smart-Soja Identity)
                light: '#ffffff'
            },
            width: size
        });

        const ctx = canvas.getContext('2d');

        // 2. Ajouter le logo au centre si le fichier existe
        if (fs.existsSync(logoPath)) {
            const logo = await loadImage(logoPath);
            
            // Calcul de la taille du logo (environ 22% de la taille du QR)
            const logoSize = size * 0.22;
            const x = (size - logoSize) / 2;
            const y = (size - logoSize) / 2;

            // Dessiner un fond blanc arrondi pour le logo (meilleure lisibilité)
            ctx.fillStyle = '#ffffff';
            const padding = 10;
            drawRoundedRect(ctx, x - padding, y - padding, logoSize + (padding * 2), logoSize + (padding * 2), 15);
            ctx.fill();

            // Dessiner le logo
            ctx.drawImage(logo, x, y, logoSize, logoSize);
        }
        
        return canvas.toDataURL('image/png');
    } catch (err) {
        console.error('❌ Erreur génération QR Premium:', err);
        throw err;
    }
}

/**
 * Helper pour dessiner un rectangle arrondi
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

module.exports = { generateLotQR, drawRoundedRect };
