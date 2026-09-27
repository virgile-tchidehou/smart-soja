# Results

## Prototype physique réalisé

![Vue d'ensemble du prototype](images/Smart-Soja.PNG)

Le système est structuré en blocs physiques distincts montés sur un châssis en acier (tubes 30×30 mm) avec parois en contreplaqué, assurant à la fois la rigidité mécanique nécessaire aux vibrations du tamisage et l'isolation thermique requise pour le séchage. Détail des blocs assemblés : bloc d'entrée (trémie + servomoteur + IR), bloc de tamisage (cadre suspendu, moteur DC) et bloc de séchage actif (résistances 12 V, ventilateur, sondes capacitives, vis sans fin) — voir [04-mechanical-design.md](04-mechanical-design.md).

## Bilan des validations fonctionnelles

Le détail des tests est présenté dans [07-testing-validation.md](07-testing-validation.md). En synthèse :

1. **Acquisition de données** — DHT22 stable, sondes capacitives cohérentes avec l'état du soja, LCD fiable temps réel.
2. **Traitement et pilotage** — l'ESP32 exécute correctement la logique de contrôle (actionneurs, interface, sauvegarde locale).
3. **Actionneurs** — moteur de tamis, résistance chauffante, ventilateur et servomoteurs répondent tous correctement aux commandes.
4. **Traçabilité numérique** — génération de QR Code et transmission MQTT fonctionnelles à 100 %, payloads JSON reçus sans erreur.
5. **Fiabilité** — arrêt d'urgence instantané, sauvegarde locale en cas de déconnexion réseau (Store-and-Forward).

## Limites de la validation actuelle

- **Cycle complet nettoyage + séchage** — testé composant par composant, pas encore en cycle opérationnel prolongé ; le taux de pureté et l'atteinte du seuil d'humidité cible ne sont pas encore quantifiés précisément.
- **Charge réelle** — tests réalisés sur de petites masses de soja de test ; le comportement en charge réelle (2 à 5 kg) reste à valider.
- **Conditions environnementales extrêmes** — tests en laboratoire stable uniquement ; robustesse terrain (poussière, vibrations, chaleur) non validée.
- **Autonomie réelle** — estimée à partir de mesures de courant isolées par sous-système, pas encore en cycle opérationnel complet.
- **Module de pesée (HX711)** — validation de précision et de stabilité prévue lors d'une phase d'intégration ultérieure.

## Voir aussi

- [07-testing-validation.md](07-testing-validation.md) — protocole et résultats détaillés par sous-système
- [09-future-improvements.md](09-future-improvements.md) — priorités avant déploiement opérationnel
