# Documentation Technique Approfondie : Électronique SMART-SOJA

Ce document constitue le dossier technique complet de la partie électronique du système **SMART-SOJA**. Il est conçu pour servir de référence pour le chapitre "Conception et Réalisation" de votre mémoire.

---

## 1. Philosophie de Conception

La conception matérielle repose sur trois piliers :

1. **Modularité** : Séparation des fonctions (Puissance, Acquisition, Traitement).
2. **Robustesse** : Utilisation de composants industriels (MOSFETs, Diodes de puissance) et protection contre les environnements ruraux.
3. **Fiabilité** : Passage d'un prototypage sur plaque d'essai à un **Circuit Imprimé (PCB)** dédié pour éliminer les faux contacts.

---

## 2. Unité de Traitement et Gestion des GPIO

Le cœur du système est un **ESP32-DEVKITC-32E**. Le choix des broches a été méticuleusement effectué pour éviter les conflits avec les "strapping pins" du microcontrôleur.

### 2.1 Tableau d'Affectation des Broches (Pinout)

| Groupe                | Broche ESP32 | Fonction                   | Signal             |
| :-------------------- | :----------- | :------------------------- | :----------------- |
| **Capteurs**          | GPIO 32      | Capteur IR Entrée (IR1)    | Digital (High/Low) |
|                       | GPIO 33      | Capteur IR Sac (IR2)       | Digital (High/Low) |
|                       | GPIO 36 (VP) | Sonde Humidité 1 (Soil1)   | Analogique (ADC)   |
|                       | GPIO 39 (VN) | Sonde Humidité 2 (Soil2)   | Analogique (ADC)   |
|                       | GPIO 25      | Capteur Temp/Hum (DHT22)   | Série (1-Wire)     |
|                       | GPIO 4 / 16  | Module Pesée HX711 (DT/SCK)| Série (DT / SCK)   |
|                       | GPIO 35 / 34 | Potentiomètres Tamis/Vis   | Analogique (ADC)   |
| **Actionneurs**       | GPIO 26      | Servo-moteur Trémie (SG90) | PWM (5V)           |
|                       | GPIO 2       | Servo-moteur Vanne (SG90)  | PWM (5V)           |
|                       | GPIO 14      | Moteur Tamis (vibration)   | PWM (12V)          |
|                       | GPIO 12      | Vis sans fin (brassage)    | PWM (12V)          |
|                       | GPIO 13      | Ventilateur 12V            | Digital (12V)      |
|                       | GPIO 27      | Résistance Chauffe         | PWM (12V)          |
|                       | GPIO 17      | Buzzer                     | Digital (5V)       |
| **Interface**         | GPIO 15      | Bouton Start (ON/OFF)      | Digital Input      |
|                       | GPIO 0       | Arrêt d'Urgence            | Digital (Pull-up)  |
|                       | Bus I2C      | Afficheur LCD 16x2         | SDA (21) / SCL (22)|

---

## 3. Schéma Électrique : Blocs Fonctionnels

Le schéma est segmenté en zones critiques pour assurer l'intégrité des signaux.

### 3.1 Zone Alimentation et Régulation

* **Entrée 12V DC** : Alimentation directe des moteurs et de la chauffe.
* **Protection** : Fusible **5A** et condensateurs de filtrage (470µF) pour absorber les appels de courant.
* **Conversion** : Module **LM2596** (Régulateur Buck) réglé sur **5V** pour alimenter les composants logiques et le rétroéclairage LCD.

### 3.2 Zone de Puissance (Commutation)

* **Composant** : MOSFET **IRLZ44N**.
* **Justification** : Choisi pour sa faible résistance à l'état passant ($R_{DS(on)}$) et sa capacité à être piloté directement en 3.3V (Logic Level).
* **Protections** :
  * Résistance de grille de **220Ω** pour protéger l'ESP32.
  * Résistance de rappel de **10kΩ** pour éviter les démarrages intempestifs.
  * Diodes **1N5408** pour la protection contre les courants de retour (Inductive Kickback).

---

## 4. Conception du Circuit Imprimé (PCB)

La carte a été conçue sous **KiCad** avec une approche "Double Face" (Top & Bottom).

* **Pistes de Puissance** : Largeur de **1.0 mm** minimum pour les lignes 12V et Masse.
* **Plan de Masse** : Un plan de masse étendu sur les deux faces permet de dissiper la chaleur et de réduire les parasites électromagnétiques.
* **Connectique** : Borniers à vis (**T-Blocks**) pour une fixation solide des câbles moteurs.

---

## 5. Bilan Énergétique et Dimensionnement

Basé sur les mesures réelles du prototype :

### 5.1 Consommation du Système

* **Logique (ESP32 + LCD + Sensors)** : ~1.85 W.
* **Mécanique (Moteurs + Servos)** : ~9.30 W.
* **Séchage (Résistance 6Ω)** : ~24 W.
* **Total en Charge Maximale** : **~35 W**.

### 5.2 Source de Production : Panneau Solaire 50W

Le panneau de **50W** est dimensionné pour couvrir la consommation maximale (~35W) tout en rechargeant la batterie en période d'ensoleillement direct. Une batterie **LiFePO4 de 20Ah** est recommandée pour assurer une autonomie de 4 heures en mode traitement intensif.

---

## 6. Liste des Fichiers de Fabrication (Gerber)

Le dossier `gerber/` contient les fichiers nécessaires à la fabrication industrielle :

* `F_Cu / B_Cu` : Tracés des pistes cuivre (Faces Avant/Arrière).
* `F_Silkscreen` : Sérigraphie pour le repérage des composants.
* `PTH / NPTH` : Fichiers de perçage pour les composants traversants.
* `Edge_Cuts` : Contour physique de la carte.
