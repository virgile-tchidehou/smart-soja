# Project Overview

![SMART-SOJA](images/smart-soja-hero.png)

## Contexte

Le soja (*Glycine max*) occupe une place croissante dans l'économie agricole du Bénin : la production nationale est passée de 157 620 tonnes en 2015 à plus de 257 000 tonnes en 2020, faisant du soja la 4ᵉ source de devises du pays. L'émergence de la **Zone Industrielle de Glo-Djigbé (GDIZ)** impose désormais des standards de qualité stricts aux lots livrés par les producteurs, encadrés par la norme béninoise **NB 01.07.004** (homologuée en 2021) :

- Taux d'humidité **< 12 %** (seuil critique contre les moisissures et pour la performance des presses à huile)
- Pureté spécifique **> 98 %** (absence de débris végétaux, cailloux, grains brisés)
- Intégrité du grain (limitation des grains cassés)

Or, le battage traditionnel et le séchage au sol pratiqués en zone rurale ne permettent pas d'atteindre ces standards : le diagnostic du MAEP et de l'UNPS relève des **pertes post-récolte de 15 à 25 %** et des refoulements réguliers de camions aux portes des usines.

## Problématique

> Comment concevoir une unité mobile et autonome de pré-traitement du soja permettant d'améliorer le nettoyage, le contrôle de l'humidité, la pesée et la traçabilité des lots dans les zones rurales de production au Bénin ?

## Objectifs

**Objectif général** — Concevoir une unité mobile, autonome et connectée de pré-traitement du soja adaptée au nettoyage, au séchage, à la pesée et à la traçabilité numérique des lots en milieu rural béninois.

**Objectifs spécifiques**
1. **Analyser** les besoins de pré-traitement du soja et les exigences de qualité des unités de transformation.
2. **Développer** une solution mécatronique intégrant les sous-systèmes mécanique, électronique, énergétique et logiciel.
3. **Évaluer** les performances fonctionnelles du prototype (nettoyage, humidité, pesée, consommation énergétique, traçabilité).

## Solution proposée

SMART-SOJA est une unité mobile qui combine :

| Sous-système | Rôle |
|---|---|
| Mécanique | Nettoyage par tamisage vibrant, séchage actif par air chaud brassé, pesée |
| Électronique | Acquisition capteurs (humidité, température, présence, poids) et pilotage des actionneurs 12 V |
| Contrôle-commande | ESP32 + FreeRTOS, logique séquentielle GRAFCET, sécurité prioritaire |
| Énergie | Panneau solaire 50 W + batterie plomb-acide 12 V/20 Ah, autonomie hors réseau |
| IoT & traçabilité | MQTT + JSON, tableau de bord web, génération d'un passeport numérique par lot (QR Code) |

Comparée au tri manuel (aucune mesure, aucune traçabilité) et aux unités industrielles importées (raccordement réseau/diesel, coût élevé), SMART-SOJA rapproche la technologie du producteur : autonomie solaire totale, mesure d'humidité précise par double sonde capacitive, et traçabilité numérique infalsifiable pour sécuriser l'entrée en usine.

## Origine du projet

Le projet a été développé dans le cadre d'un stage de fin de cycle (Licence Professionnelle en Informatique Industrielle et Maintenance, EGEI/UCAO), réalisé chez **QOTTO Bénin**, entreprise spécialisée dans les systèmes solaires connectés hors-réseau. Cette immersion a directement nourri les choix de conception : dimensionnement énergétique, systèmes embarqués et maintenance électronique.

## État d'avancement (juin 2026)

Le prototype est un **démonstrateur fonctionnel validé en tests unitaires** : chaque sous-système (capteurs, moteurs, séchage, transmission MQTT, génération de QR Code) fonctionne correctement pris individuellement, avec une transmission MQTT à 100 % d'intégrité et zéro perte de message. Restent à valider avant déploiement : le cycle complet nettoyage + séchage en charge réelle (2 à 5 kg), l'intégration finale du module de pesée (HX711), et la robustesse en conditions de terrain. Voir [08-results.md](08-results.md) pour le détail des résultats et [09-future-improvements.md](09-future-improvements.md) pour la feuille de route.

## Pour aller plus loin

- [02-system-architecture.md](02-system-architecture.md) — architecture globale Edge/Cloud/Application
- [03-hardware-design.md](03-hardware-design.md) — électronique et PCB
- [04-mechanical-design.md](04-mechanical-design.md) — conception mécanique
- [05-software-architecture.md](05-software-architecture.md) — firmware FreeRTOS, GRAFCET, plateforme web
- [06-energy-system.md](06-energy-system.md) — dimensionnement solaire/batterie
- [research/thesis/](../research/thesis/) — mémoire complet (source de cette documentation)
