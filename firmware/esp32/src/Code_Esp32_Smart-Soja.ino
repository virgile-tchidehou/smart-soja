#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>
#include <DHT.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ================= SERVOS =================
Servo servoTremie;
Servo servoVanne;

// ================= LCD =================
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ================= DHT =================
#define PIN_DHT       25
#define DHTTYPE       DHT22
DHT dht(PIN_DHT, DHTTYPE);

// ================= WIFI & MQTT =================
const char *ssid = "Atchamou";
const char *password = "Dodjiatchamou26";
const char *mqtt_server = "9b78c87e5b10457c94878087b5bce6cd.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char *mqtt_user = "smartsoja";
const char *mqtt_pass = "SmartSoja26@";

WiFiClientSecure espClient;
PubSubClient client(espClient);
String unit_id = "SS-LOCAL-01";

// ================= PINS =================
#define PIN_IR1           32
#define PIN_IR2           33

#define PIN_SOIL1         36
#define PIN_SOIL2         39

#define PIN_POT_TAMIS     35
#define PIN_POT_VIS       34

#define PIN_SERVO_TREMIE  26
#define PIN_SERVO_VANNE    2

#define PIN_MOTEUR_TAMIS  14
#define PIN_VIS_SANS_FIN  12

#define PIN_VENTILATEUR   13
#define PIN_RESISTANCE    27
#define PIN_BUZZER        17

#define PIN_START         15
#define PIN_STOP           0

// ================= SEUILS CAPTEURS =================
#define SOIL_ADC_MAX              1680
#define SEUIL_HUMIDITE_DEFAULT    120   // 12,0 % en dixièmes (compat MQTT plateforme)

// ================= SERVO TRÉMIE (rotation continue) =================
const int   TREMIE_ARRET         =  95;
const int   TREMIE_OUVRIR        =  65;
const int   TREMIE_FERMER        = 125;
const int   TREMIE_COUPLE_FERME  =  99;
const unsigned long TREMIE_T_OUVRIR  = 500;
const unsigned long TREMIE_T_FERMER  = 1000;

// ================= TIMINGS GRAFCET (ms) =================
unsigned long T_TAMIS     = 1000000;
unsigned long T_MESURE    =  5000;
unsigned long T_SECHAGE   =  5000;
unsigned long T_TRANSFERT =  5000;

// ================= PARAMÈTRES CONFIGURABLES =================
int seuil_humidite = SEUIL_HUMIDITE_DEFAULT;
int poids_cible_g = 100; // 100g par défaut
bool mode_manuel = false;

// ================= ETAPES GRAFCET =================
enum etape_t {
  E0_VEILLE,
  E2_TREMIE,
  E3_TAMIS,
  E4_HUMIDITE,
  E5_SECHAGE,
  E6_TRANSFERT,
  E7_PESEE,
  E8_ENREGISTREMENT,
  E9_SECURITE
};

// ================= VARIABLES PARTAGÉES =================
static portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

volatile etape_t etape        = E0_VEILLE;
volatile float   temperature  = 0.0f;
volatile int     soil1_val    = 0;
volatile int     soil2_val    = 0;
volatile int     pot_tamis    = 0;
volatile int     pot_vis      = 0;
volatile float   poids        = 0.0f;
volatile bool    stop_cycle   = false;

// États des actionneurs pour la télémétrie
volatile bool state_alimentation = false;
volatile bool state_tamis = false;
volatile bool state_ventilo = false;
volatile bool state_heat = false;
volatile bool state_vis = false;
volatile bool state_vanne = false;

#define GET_ETAPE()  ({ portENTER_CRITICAL(&mux); etape_t _e = etape; portEXIT_CRITICAL(&mux); _e; })
#define SET_ETAPE(e) do { portENTER_CRITICAL(&mux); etape = (e); portEXIT_CRITICAL(&mux); } while(0)
#define GET_STOP()   ({ portENTER_CRITICAL(&mux); bool _s = stop_cycle; portEXIT_CRITICAL(&mux); _s; })
#define SET_STOP(v)  do { portENTER_CRITICAL(&mux); stop_cycle = (v); portEXIT_CRITICAL(&mux); } while(0)

// ================= HELPERS HUMIDITÉ =================
int adc_to_pct(int adc) {
  return constrain((adc * 100) / SOIL_ADC_MAX, 0, 100);
}

int compute_humidity_pct(int s1, int s2) {
  return max(adc_to_pct(s1), adc_to_pct(s2));
}

bool is_too_humid(int s1, int s2, int seuil_tenths) {
  return (compute_humidity_pct(s1, s2) * 10) > seuil_tenths;
}

// ================= HELPERS TRÉMIE =================
void tremie_ouvrir() {
  servoTremie.attach(PIN_SERVO_TREMIE);
  servoTremie.write(TREMIE_OUVRIR);
  vTaskDelay(pdMS_TO_TICKS(TREMIE_T_OUVRIR));
  servoTremie.write(TREMIE_ARRET);
  vTaskDelay(pdMS_TO_TICKS(50));
  servoTremie.detach();
}

void tremie_fermer() {
  servoTremie.attach(PIN_SERVO_TREMIE);
  servoTremie.write(TREMIE_FERMER);
  vTaskDelay(pdMS_TO_TICKS(TREMIE_T_FERMER));
  servoTremie.write(TREMIE_COUPLE_FERME);
}

// ================= SAFE STOP =================
void safe_stop() {
  ledcWrite(PIN_MOTEUR_TAMIS, 0);
  ledcWrite(PIN_VIS_SANS_FIN, 0);
  digitalWrite(PIN_VENTILATEUR, LOW);
  digitalWrite(PIN_RESISTANCE,  LOW);
  tremie_fermer();
  servoVanne.write(0);
  digitalWrite(PIN_BUZZER, HIGH);

  // Mettre à jour les états pour la télémétrie
  portENTER_CRITICAL(&mux);
  state_tamis = false;
  state_vis = false;
  state_ventilo = false;
  state_heat = false;
  state_alimentation = false;
  state_vanne = false;
  portEXIT_CRITICAL(&mux);
}

// ================= ACTUATEURS =================
void apply_actuators(etape_t e) {
  switch (e) {

    case E0_VEILLE:
      ledcWrite(PIN_MOTEUR_TAMIS, 0);
      ledcWrite(PIN_VIS_SANS_FIN, 0);
      digitalWrite(PIN_VENTILATEUR, LOW);
      digitalWrite(PIN_RESISTANCE,  LOW);
      servoVanne.write(0);
      digitalWrite(PIN_BUZZER, LOW);
      servoTremie.attach(PIN_SERVO_TREMIE);
      servoTremie.write(TREMIE_COUPLE_FERME);

      // Mettre à jour les états pour la télémétrie
      portENTER_CRITICAL(&mux);
      state_tamis = false;
      state_vis = false;
      state_ventilo = false;
      state_heat = false;
      state_alimentation = false;
      state_vanne = false;
      portEXIT_CRITICAL(&mux);
      break;

    case E2_TREMIE:
      tremie_ouvrir();

      // Mettre à jour les états pour la télémétrie
      portENTER_CRITICAL(&mux);
      state_alimentation = true;
      portEXIT_CRITICAL(&mux);
      break;

    case E3_TAMIS: {
      portENTER_CRITICAL(&mux);
      int spd = pot_tamis;
      portEXIT_CRITICAL(&mux);
      ledcWrite(PIN_MOTEUR_TAMIS, spd);

      // Mettre à jour les états pour la télémétrie
      portENTER_CRITICAL(&mux);
      state_tamis = true;
      state_alimentation = false;
      portEXIT_CRITICAL(&mux);
      break;
    }

    case E4_HUMIDITE:
      ledcWrite(PIN_MOTEUR_TAMIS, 0);

      // Mettre à jour les états pour la télémétrie
      portENTER_CRITICAL(&mux);
      state_tamis = false;
      portEXIT_CRITICAL(&mux);
      break;

    case E5_SECHAGE: {
      digitalWrite(PIN_VENTILATEUR, HIGH);
      digitalWrite(PIN_RESISTANCE,  HIGH);
      portENTER_CRITICAL(&mux);
      int spd = pot_vis;
      portEXIT_CRITICAL(&mux);
      ledcWrite(PIN_VIS_SANS_FIN, spd);

      // Mettre à jour les états pour la télémétrie
      portENTER_CRITICAL(&mux);
      state_ventilo = true;
      state_heat = true;
      state_vis = true;
      portEXIT_CRITICAL(&mux);
      break;
    }

    case E6_TRANSFERT:
      digitalWrite(PIN_VENTILATEUR, LOW);
      digitalWrite(PIN_RESISTANCE,  LOW);
      ledcWrite(PIN_VIS_SANS_FIN, 0);
      servoVanne.write(90);

      // Mettre à jour les états pour la télémétrie
      portENTER_CRITICAL(&mux);
      state_ventilo = false;
      state_heat = false;
      state_vis = false;
      state_vanne = true;
      portEXIT_CRITICAL(&mux);
      break;

    case E7_PESEE:
      // Mettre à jour les états pour la télémétrie
      portENTER_CRITICAL(&mux);
      state_vanne = false;
      portEXIT_CRITICAL(&mux);
      break;

    case E8_ENREGISTREMENT:
      servoVanne.write(0);
      tremie_fermer();

      // Mettre à jour les états pour la télémétrie
      portENTER_CRITICAL(&mux);
      state_alimentation = false;
      portEXIT_CRITICAL(&mux);
      break;

    case E9_SECURITE:
      safe_stop();
      break;
  }
}

// ================= TÂCHE GRAFCET =================
void task_grafcet(void *pv) {

  unsigned long t_etape = 0;
  etape_t       last_e  = E9_SECURITE;

  for (;;) {

    etape_t e = GET_ETAPE();

    // En mode manuel, le GRAFCET ne gère pas les transitions automatiques
    portENTER_CRITICAL(&mux);
    bool manual_mode = mode_manuel;
    portEXIT_CRITICAL(&mux);

    if (e != last_e) {
      apply_actuators(e);
      t_etape = millis();
      last_e  = e;
    }

    bool ir1  = (digitalRead(PIN_IR1) == LOW);   // LOW = détecte soja
    bool ir2  = (digitalRead(PIN_IR2) == LOW);   // LOW = détecte soja
    bool stop = GET_STOP();

    portENTER_CRITICAL(&mux);
    int   s1  = soil1_val;
    int   s2  = soil2_val;
    float pds = poids;
    int   seuil_h = seuil_humidite;
    int   poids_cible = poids_cible_g;
    unsigned long t_tamis = T_TAMIS;
    unsigned long t_mesure = T_MESURE;
    unsigned long t_sechage = T_SECHAGE;
    unsigned long t_transfert = T_TRANSFERT;
    portEXIT_CRITICAL(&mux);

    unsigned long dt = millis() - t_etape;

    // En mode manuel, on ne traite que l'arrêt d'urgence
    if (manual_mode) {
      if (stop) {
        SET_ETAPE(E9_SECURITE);
      }
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }

    switch (e) {

      case E0_VEILLE:
        // START=LOW (pressé, pullup externe) + IR1 détecte + IR2 détecte + pas de stop
        if (ir1 && ir2 && !stop)
          SET_ETAPE(E2_TREMIE);
        break;

      case E2_TREMIE:
        if (stop)
          SET_ETAPE(E9_SECURITE);
        else
          SET_ETAPE(E3_TAMIS);
        break;

      case E3_TAMIS:
{
    portENTER_CRITICAL(&mux);
    int spd = pot_tamis;
    portEXIT_CRITICAL(&mux);

    ledcWrite(PIN_MOTEUR_TAMIS, spd);

    if (dt >= t_tamis && !stop)
        SET_ETAPE(E4_HUMIDITE);
    else if (stop)
        SET_ETAPE(E9_SECURITE);

    break;
}

      case E4_HUMIDITE:
        if (stop) { SET_ETAPE(E9_SECURITE); break; }
        if (dt >= t_mesure) {
          bool humide = is_too_humid(s1, s2, seuil_h);
          SET_ETAPE(humide ? E5_SECHAGE : E6_TRANSFERT);
        }
        break;

      case E5_SECHAGE:
{
    portENTER_CRITICAL(&mux);
    int spd = pot_vis;
    portEXIT_CRITICAL(&mux);

    ledcWrite(PIN_VIS_SANS_FIN, spd);

    if (dt >= t_sechage)
        SET_ETAPE(E4_HUMIDITE);

    break;
}

      case E6_TRANSFERT:
        if (stop) { SET_ETAPE(E9_SECURITE); break; }
        if (dt >= t_transfert)
          SET_ETAPE(E7_PESEE);
        break;

      case E7_PESEE:
  if (stop) { SET_ETAPE(E9_SECURITE); break; }
  // Simulation : après 3 secondes, on attribue un poids aléatoire entre 100g et 500g
  if (dt >= 3000 && pds == 0.0f) {
    float simPoids = 100.0f + (float)(esp_random() % 401); // 100..500g
    portENTER_CRITICAL(&mux);
    poids = simPoids;
    portEXIT_CRITICAL(&mux);
    Serial.printf("[PESEE] Poids simulé : %.1f g\n", simPoids);
  }
  if (pds >= (float)poids_cible)
    SET_ETAPE(E8_ENREGISTREMENT);
  break;

      case E8_ENREGISTREMENT:
  if (stop) { SET_ETAPE(E9_SECURITE); break; }
  if (!ir2) {  // ir2=false → soja évacué
    portENTER_CRITICAL(&mux);
    poids = 0.0f;  // reset pour le prochain cycle
    portEXIT_CRITICAL(&mux);
    SET_ETAPE(E0_VEILLE);
  }
  break;

      case E9_SECURITE:
        safe_stop();
        break;
    }

    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// ================= TÂCHE CAPTEURS =================
void task_sensors(void *pv) {

  static float last_t = 25.0f;

  for (;;) {

    int s1 = analogRead(PIN_SOIL1);
    int s2 = analogRead(PIN_SOIL2);

    int pt = map(analogRead(PIN_POT_TAMIS), 0, 4095, 0, 255);
    int pv = map(analogRead(PIN_POT_VIS),   0, 4095, 0, 255);

    float t = dht.readTemperature();
    if (!isnan(t))
      last_t = (last_t * 0.7f) + (t * 0.3f);

    // STOP : LOW = bouton pressé (logique normale avec INPUT_PULLUP)
    bool stop_now = (digitalRead(PIN_STOP) == LOW);

    portENTER_CRITICAL(&mux);
    soil1_val   = s1;
    soil2_val   = s2;
    pot_tamis   = pt;
    pot_vis     = pv;
    temperature = last_t;
    stop_cycle  = stop_now;
    portEXIT_CRITICAL(&mux);

    vTaskDelay(pdMS_TO_TICKS(1500));
  }
}

// ================= TÂCHE LCD =================
void task_lcd(void *pv) {

  for (;;) {

    etape_t e = GET_ETAPE();

    portENTER_CRITICAL(&mux);
    float temp = temperature;
    int   s1   = soil1_val;
    int   s2   = soil2_val;
    portEXIT_CRITICAL(&mux);

    int hum_pct = compute_humidity_pct(s1, s2);

    lcd.setCursor(0, 0);
    switch (e) {
      case E0_VEILLE:          lcd.print("VEILLE          "); break;
      case E2_TREMIE:          lcd.print("TREMIE          "); break;
      case E3_TAMIS:           lcd.print("TAMIS           "); break;
      case E4_HUMIDITE:        lcd.print("HUMIDITE        "); break;
      case E5_SECHAGE:         lcd.print("SECHAGE         "); break;
      case E6_TRANSFERT:       lcd.print("TRANSFERT       "); break;
      case E7_PESEE:           lcd.print("PESEE           "); break;
      case E8_ENREGISTREMENT:  lcd.print("ENREG.          "); break;
      case E9_SECURITE:        lcd.print("!! ARRET !!     "); break;
    }

    lcd.setCursor(0, 1);
    lcd.print("T:");
    lcd.print((int)temp);
    lcd.print("C H:");
    lcd.print(hum_pct);
    lcd.print("%   ");

    vTaskDelay(pdMS_TO_TICKS(500));
  }
}

// ================= WIFI & MQTT =================
void configurer_wifi_mqtt() {
  WiFi.begin(ssid, password);
  Serial.print("Connexion WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connecté!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  // Générer unit_id basé sur MAC
  unit_id = "SS-" + String(WiFi.macAddress().substring(12));

  espClient.setInsecure(); // Nécessaire pour HiveMQ Cloud sans certificat racine
  client.setServer(mqtt_server, mqtt_port);
}

void callback_mqtt(char *topic, byte *payload, unsigned int length) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) {
    Serial.println("Erreur de désérialisation JSON");
    return;
  }

  // Gestion des commandes
  if (doc.containsKey("mode")) {
    String modeStr = doc["mode"].as<String>();
    if (modeStr == "auto") {
      Serial.println("Mode: AUTOMATIQUE");
      portENTER_CRITICAL(&mux);
      mode_manuel = false;
      portEXIT_CRITICAL(&mux);
      if (doc.containsKey("action") && doc["action"].as<String>() == "cycle_start") {
        // Démarrer le cycle
        if (GET_ETAPE() == E0_VEILLE) {
          SET_ETAPE(E2_TREMIE);
        }
      }
    } else if (modeStr == "manual") {
      Serial.println("Mode: MANUEL");
      portENTER_CRITICAL(&mux);
      mode_manuel = true;
      portEXIT_CRITICAL(&mux);
      // En mode manuel, on peut contrôler les actionneurs individuellement
    }
  }

  // Contrôle manuel des actionneurs
  if (mode_manuel && doc.containsKey("action") && doc["action"].as<String>() == "control_manual") {
    String device = doc["device"].as<String>();
    String state = doc["state"].as<String>();
    bool active = (state == "ON");

    Serial.printf("Commande manuelle: %s -> %s\n", device.c_str(), state.c_str());

    portENTER_CRITICAL(&mux);

    if (device == "servo_tremie") {
      if (active) {
        tremie_ouvrir();
        state_alimentation = true;
      } else {
        tremie_fermer();
        state_alimentation = false;
      }
    } else if (device == "tamis") {
      int spd = active ? pot_tamis : 0;
      ledcWrite(PIN_MOTEUR_TAMIS, spd);
      state_tamis = active;
    } else if (device == "ventilateur") {
      digitalWrite(PIN_VENTILATEUR, active ? HIGH : LOW);
      state_ventilo = active;
    } else if (device == "chauffage") {
      digitalWrite(PIN_RESISTANCE, active ? HIGH : LOW);
      state_heat = active;
    } else if (device == "vis_soja") {
      int spd = active ? pot_vis : 0;
      ledcWrite(PIN_VIS_SANS_FIN, spd);
      state_vis = active;
    } else if (device == "servo_vanne") {
      servoVanne.write(active ? 90 : 0);
      state_vanne = active;
    }

    portEXIT_CRITICAL(&mux);
  }

  if (doc.containsKey("action") && doc["action"].as<String>() == "emergency_stop") {
    SET_STOP(true);
    Serial.println("Arrêt d'urgence reçu via MQTT");
  }

  if (doc.containsKey("config")) {
    JsonObject config = doc["config"];

    portENTER_CRITICAL(&mux);

    if (config.containsKey("seuil_humidite")) {
      seuil_humidite = config["seuil_humidite"];
      Serial.printf("Seuil humidité mis à jour: %.1f %%\n", seuil_humidite / 10.0f);
    }
    if (config.containsKey("poids_cible")) {
      poids_cible_g = config["poids_cible"];
      Serial.printf("Poids cible mis à jour: %d g\n", poids_cible_g);
    }
    if (config.containsKey("temps_tamis_ms")) {
      T_TAMIS = config["temps_tamis_ms"];
      Serial.printf("Temps tamis mis à jour: %lu ms\n", T_TAMIS);
    }
    if (config.containsKey("temps_mesure_ms")) {
      T_MESURE = config["temps_mesure_ms"];
      Serial.printf("Temps mesure mis à jour: %lu ms\n", T_MESURE);
    }
    if (config.containsKey("temps_sechage_ms")) {
      T_SECHAGE = config["temps_sechage_ms"];
      Serial.printf("Temps séchage mis à jour: %lu ms\n", T_SECHAGE);
    }
    if (config.containsKey("temps_transfert_ms")) {
      T_TRANSFERT = config["temps_transfert_ms"];
      Serial.printf("Temps transfert mis à jour: %lu ms\n", T_TRANSFERT);
    }

    portEXIT_CRITICAL(&mux);

    Serial.println("Configuration appliquée");
  }
}

void task_mqtt(void *pv) {
  unsigned long timer_telemetrie = 0;

  for (;;) {
    // Connexion MQTT
    if (!client.connected()) {
      Serial.println("Tentative de connexion MQTT...");
      if (client.connect(("SmartSoja_" + unit_id).c_str(), mqtt_user, mqtt_pass)) {
        Serial.println("MQTT Connecté !");
        client.subscribe(("smart-soja/commands/" + unit_id).c_str());
        client.setCallback(callback_mqtt);
      } else {
        Serial.print("Échec, rc=");
        Serial.print(client.state());
        Serial.println(" retry in 5s");
      }
    }

    client.loop();

    // Envoi télémétrie toutes les 5 secondes
    if (millis() - timer_telemetrie >= 5000) {
      timer_telemetrie = millis();

      StaticJsonDocument<512> doc;
      doc["unitId"] = unit_id;
      doc["step"] = (int)GET_ETAPE();
      
      portENTER_CRITICAL(&mux);
      int s1 = soil1_val;
      int s2 = soil2_val;
      doc["humidity"] = compute_humidity_pct(s1, s2);
      doc["humidity_s1"] = adc_to_pct(s1);
      doc["humidity_s2"] = adc_to_pct(s2);
      doc["temperature"] = temperature;
      doc["weight"] = poids;
      doc["alarm"] = GET_STOP();
      doc["ir1"] = (digitalRead(PIN_IR1) == LOW);
      doc["ir2"] = (digitalRead(PIN_IR2) == LOW);
      
      JsonObject controls = doc.createNestedObject("controls");
      controls["alimentation"] = state_alimentation;
      controls["tamis"] = state_tamis;
      controls["ventilo"] = state_ventilo;
      controls["heat"] = state_heat;
      controls["vis"] = state_vis;
      controls["vanne"] = state_vanne;
      portEXIT_CRITICAL(&mux);

      String payload;
      serializeJson(doc, payload);
      String topic = "smart-soja/telemetry/" + unit_id;

      if (client.connected()) {
        client.publish(topic.c_str(), payload.c_str());
        Serial.println("Télémétrie envoyée: " + payload);
      }
    }

    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// ================= SETUP =================
void setup() {

  Serial.begin(115200);

  Wire.begin(21, 22);
  lcd.begin();
  lcd.backlight();
  lcd.clear();
  lcd.print("INIT SYSTEM");

  pinMode(PIN_START,       INPUT);   // pullup externe sur la carte
  pinMode(PIN_STOP,        INPUT_PULLUP);  // repos=HIGH, pressé=LOW
  pinMode(PIN_IR1,         INPUT);
  pinMode(PIN_IR2,         INPUT);

  pinMode(PIN_VENTILATEUR, OUTPUT);
  pinMode(PIN_RESISTANCE,  OUTPUT);
  pinMode(PIN_BUZZER,      OUTPUT);

  digitalWrite(PIN_VENTILATEUR, LOW);
  digitalWrite(PIN_RESISTANCE,  LOW);
  digitalWrite(PIN_BUZZER,      LOW);

  servoTremie.attach(PIN_SERVO_TREMIE);
  servoTremie.write(TREMIE_COUPLE_FERME);

  servoVanne.attach(PIN_SERVO_VANNE);
  servoVanne.write(0);

  ledcAttach(PIN_MOTEUR_TAMIS, 5000, 8);
  ledcAttach(PIN_VIS_SANS_FIN, 5000, 8);

  dht.begin();

  // Configuration WiFi et MQTT
  configurer_wifi_mqtt();

  xTaskCreatePinnedToCore(task_grafcet, "graf", 4096, NULL, 3, NULL, 1);
  xTaskCreatePinnedToCore(task_sensors, "sens", 4096, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(task_lcd,     "lcd",  4096, NULL, 1, NULL, 1);
  xTaskCreatePinnedToCore(task_mqtt,    "mqtt", 4096, NULL, 1, NULL, 0);

  delay(1000);
  lcd.clear();
  lcd.print("READY");
}

// ================= LOOP =================
void loop() {
  vTaskDelay(pdMS_TO_TICKS(1000));
}
