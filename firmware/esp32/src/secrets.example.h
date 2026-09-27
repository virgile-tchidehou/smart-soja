// ============================================================
// secrets.example.h — Template public versionné.
// Pour utiliser le projet :
//   1. Copier ce fichier en src/secrets.h
//   2. Remplacer les placeholders par vos vraies valeurs
// NE JAMAIS mettre les vraies valeurs dans CE fichier.
// ============================================================
#pragma once

// --- Wi-Fi ---
#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// --- HiveMQ Cloud (ou autre broker MQTT TLS) ---
#define MQTT_SERVER   "xxxxxxxxxxxxxxxxxxxxxxxx.s1.eu.hivemq.cloud"
#define MQTT_PORT     8883
#define MQTT_USER     "YOUR_MQTT_USER"
#define MQTT_PASSWORD "YOUR_MQTT_PASSWORD"
