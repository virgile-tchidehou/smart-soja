const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

// 1. Initialisation Firebase Admin (Nécessaire avant les routes/services)
let serviceAccount;
try {
    serviceAccount = require('./serviceAccountKey.json');
} catch (e) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        console.error("❌ Erreur: Aucune clé Firebase Admin trouvée.");
        process.exit(1);
    }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL
});

// 2. Import des Modules Applicatifs
const passportRoutes = require('./routes/passport.routes');
const bridgeService = require('./services/bridge.service');

// 3. Initialisation Express
const app = express();
app.use(cors());
app.use(express.json());

// Logger de requêtes simple
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// Montage des routes
app.use('/api', passportRoutes);

// Route de Santé (Health Check)
app.get('/health', (req, res) => res.json({ status: 'UP', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur API SMART-SOJA démarré sur le port ${PORT}`);
});

// 4. Démarrage du Bridge MQTT
try {
    bridgeService.init();
} catch (err) {
    console.error("❌ Échec du démarrage du Bridge MQTT:", err);
}
