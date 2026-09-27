const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const pdfService = require('../services/pdf.service');
const qrService = require('../services/qr.service');

const db = admin.firestore();

/**
 * Route: Générer un QR Code pour un Lot
 */
router.post('/generate-qr', async (req, res) => {
    try {
        const { lotId } = req.body;
        if (!lotId) return res.status(400).json({ error: "lotId manquant" });
        
        const qrBase64 = await qrService.generateLotQR(lotId);
        res.json({ qr: qrBase64 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Route: Générer un Passeport PDF
 */
router.post('/generate-pdf', async (req, res) => {
    try {
        const { lotId, recommendations, industryName } = req.body;
        if (!lotId) return res.status(400).json({ error: "lotId manquant" });

        // 1. Recherche directe par ID de document
        let lotDoc = await db.collection('lots').doc(lotId).get();
        let lotData = null;

        if (lotDoc.exists) {
            lotData = { id: lotDoc.id, ...lotDoc.data() };
        } else {
            // 2. Recherche de secours par champ 'id' (Ancien format)
            console.log(`🔍 [PDF] Recherche de secours pour ${lotId}...`);
            const querySnap = await db.collection('lots').where('id', '==', lotId).get();
            if (!querySnap.empty) {
                const found = querySnap.docs[0];
                lotData = { id: found.id, ...found.data() };
            }
        }

        if (!lotData) return res.status(404).json({ error: "Lot non trouvé" });
        
        const enrichedData = {
            ...lotData,
            recommendations: recommendations || 'Aucune recommandation particulière.',
            industryName: industryName || 'Industrie Partenaire Smart-Soja'
        };

        const pdfBuffer = await pdfService.generatePassportPDF(enrichedData);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Passport-${lotId}.pdf`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error("Erreur PDF:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Route: Générer un Rapport Global (Multi-pages)
 */
router.post('/generate-bulk-pdf', async (req, res) => {
    try {
        const { lots } = req.body;
        if (!lots || !Array.isArray(lots)) return res.status(400).json({ error: "Tableau de lots manquant" });

        console.log(`📊 Génération rapport global pour ${lots.length} lots...`);
        const pdfBuffer = await pdfService.generateBulkPassportPDF(lots);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Rapport-Global-Industrie.pdf');
        res.send(pdfBuffer);
    } catch (err) {
        console.error("Erreur Bulk PDF:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
