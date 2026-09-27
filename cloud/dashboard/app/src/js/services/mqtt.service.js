/**
 * SMART-SOJA — MQTT Service
 * Gère la communication en temps réel avec les unités ESP32.
 * Basé sur la bibliothèque 'mqtt' (npm).
 */

import mqtt from 'mqtt';

class MqttService {
    constructor() {
        this.client = null;
        this.callbacks = {}; // Callbacks par unitId
        this.globalCallbacks = []; // Callbacks génériques (patterns)
        this.config = {
            brokerUrl: import.meta.env.VITE_MQTT_BROKER_URL || 'wss://broker.emqx.io:8083/mqtt',
            topicSensors: import.meta.env.VITE_MQTT_TOPIC_SENSORS || 'smart-soja/telemetry/+',
            options: {
                keepalive: 60,
                clientId: 'smart_soja_web_' + Math.random().toString(16).substring(2, 8),
                username: import.meta.env.VITE_MQTT_USERNAME || undefined,
                password: import.meta.env.VITE_MQTT_PASSWORD || undefined,
                protocolId: 'MQTT',
                protocolVersion: 4,
                clean: true,
                reconnectPeriod: 5000,
                connectTimeout: 30 * 1000,
            }
        };

        // Charger la config persistante si elle existe
        const savedConfig = localStorage.getItem('smartsoja-mqtt-config');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            this.config.brokerUrl = parsed.brokerUrl;
            this.config.options.username = parsed.username;
            this.config.options.password = parsed.password;
        }
    }

    /**
     * Se connecte au broker MQTT.
     */
    connect() {
        if (this.client) return;

        console.log(`🔌 [MQTT] Tentative de connexion vers ${this.config.brokerUrl}...`);
        console.log(`🔌 [MQTT] Configuration:`, JSON.stringify({
            brokerUrl: this.config.brokerUrl,
            topicSensors: this.config.topicSensors,
            username: this.config.options.username || 'non défini'
        }, null, 2));

        this.client = mqtt.connect(this.config.brokerUrl, this.config.options);

        this.client.on('connect', () => {
            console.log("✅ [MQTT] Connecté au broker MQTT");
            this.client.subscribe(this.config.topicSensors, (err) => {
                if (!err) console.log(`✅ [MQTT] Abonné au topic: ${this.config.topicSensors}`);
            });
        });

        this.client.on('message', (topic, message) => {
            try {
                const payload = JSON.parse(message.toString());
                this.handleMessage(topic, payload);
            } catch (e) {
                console.warn("⚠️ [MQTT] Message non-JSON reçu:", message.toString());
            }
        });

        this.client.on('error', (err) => {
            console.error("❌ [MQTT] Erreur MQTT:", err.message);
        });

        this.client.on('reconnect', () => {
            console.log("🔄 [MQTT] Reconnexion en cours...");
        });
    }

    /**
     * Gère la réception des messages.
     */
    handleMessage(topic, payload) {
        const parts = topic.split('/');
        const unitId = parts[2];

        console.log('📨 [MQTT] Message reçu sur topic:', topic);
        console.log('📨 [MQTT] Structure du payload:', JSON.stringify(payload, null, 2));
        console.log('📨 [MQTT] Unit ID extrait:', unitId);

        // 1. Trigger spécifique à l'unité
        if (this.callbacks[unitId]) {
            this.callbacks[unitId](payload);
        }

        // 2. Trigger globaux (Auto-découverte, etc.)
        this.globalCallbacks.forEach(cb => cb(topic, payload));
    }

    /**
     * S'abonne à un topic ou un pattern générique.
     */
    subscribe(topic, callback) {
        this.globalCallbacks.push(callback);
        if (this.client && this.client.connected) {
            this.client.subscribe(topic);
        }
    }

    /**
     * S'abonne aux données d'une unité spécifique.
     * @param {string} unitId 
     * @param {Function} callback 
     */
    subscribeToUnit(unitId, callback) {
        this.callbacks[unitId] = callback;
        if (this.client && this.client.connected) {
            this.client.subscribe(`smart-soja/telemetry/${unitId}`);
        }
    }

    /**
     * Envoie une commande vers une unité (ex: Démarrer séchage).
     * @param {string} unitId 
     * @param {Object} command 
     */
    sendCommand(unitId, command) {
        if (this.client && this.client.connected) {
            const topic = `smart-soja/commands/${unitId}`;
            this.client.publish(topic, JSON.stringify(command));
            console.log(`Commande envoyée vers ${unitId}:`, command);
        } else {
            console.warn("MQTT non connecté. Impossible d'envoyer la commande.");
        }
    }

    /**
     * Met à jour la configuration et se reconnecte.
     */
    updateConfig(newConfig) {
        this.config.brokerUrl = newConfig.brokerUrl || this.config.brokerUrl;
        this.config.options.username = newConfig.username !== undefined ? newConfig.username : this.config.options.username;
        this.config.options.password = newConfig.password !== undefined ? newConfig.password : this.config.options.password;

        localStorage.setItem('smartsoja-mqtt-config', JSON.stringify({
            brokerUrl: this.config.brokerUrl,
            username: this.config.options.username,
            password: this.config.options.password
        }));

        if (this.client) {
            console.log("Reconnexion MQTT avec les nouveaux paramètres...");
            this.client.end(true, () => {
                this.client = null;
                this.connect();
            });
        } else {
            this.connect();
        }
    }
}

// Instance unique (Singleton)
const mqttService = new MqttService();
export default mqttService;
