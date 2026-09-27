const mqtt = require('mqtt');
const admin = require('firebase-admin');

/**
 * Service gérant la connexion MQTT et la synchronisation avec Firebase.
 */
class BridgeService {
    constructor() {
        this.client = null;
        this.db = admin.firestore();
        this.rtdb = admin.database();
    }

    init() {
        const brokerUrl = process.env.VITE_MQTT_BROKER_URL
            .replace('wss://', 'mqtts://')
            .replace(':8884/mqtt', ':8883');

        const mqttOptions = {
            username: process.env.VITE_MQTT_USERNAME,
            password: process.env.VITE_MQTT_PASSWORD,
            clean: true,
            connectTimeout: 4000,
            reconnectPeriod: 1000,
        };

        console.log(`🔌 Initialisation du Bridge MQTT sur ${brokerUrl}...`);
        this.client = mqtt.connect(brokerUrl, mqttOptions);

        this.client.on('connect', () => {
            console.log('✅ Bridge connecté au broker HiveMQ');
            this.client.subscribe(process.env.VITE_MQTT_TOPIC_SENSORS, (err) => {
                if (!err) {
                    console.log(`📡 Écoute du topic : ${process.env.VITE_MQTT_TOPIC_SENSORS}`);
                }
            });
        });

        this.client.on('message', (topic, message) => this.handleMessage(topic, message));
        this.client.on('error', (err) => console.error('❌ Erreur MQTT:', err));
    }

    async handleMessage(topic, message) {
        try {
            const unitId = topic.split('/').pop();
            const rawPayload = message.toString();
            let payload;

            // 1. Validation JSON
            try {
                payload = JSON.parse(rawPayload);
            } catch (e) {
                console.error(`⚠️ [${unitId}] Payload JSON invalide :`, rawPayload);
                return;
            }

            // 2. Validation du schéma minimal
            if (!payload || typeof payload !== 'object') return;
            
            console.log(`📥 [${unitId}] Données reçues :`, payload);

            // 3. Mise à jour temps réel (RTDB)
            const unitRef = this.rtdb.ref(`units/${unitId}`);
            await unitRef.update({ 
                ...payload, 
                lastSeen: Date.now(),
                status: 'online'
            });

            // 4. Mise à jour Firestore (Dernière activité)
            const unitDocRef = this.db.collection('units').doc(unitId);
            await unitDocRef.set({ 
                lastSeen: new Date().toISOString(),
                status: 'actif'
            }, { merge: true });

            // 5. Archivage Historique (uniquement si données capteurs présentes)
            if (payload.humidity || payload.weight || payload.temperature) {
                await this.db.collection('telemetry_history').add({
                    unitId,
                    ...payload,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            }

        } catch (error) {
            console.error('❌ Erreur critique dans le Bridge MQTT :', error);
        }
    }
}

module.exports = new BridgeService();
