# Future Improvements

Le prototype SMART-SOJA est, à ce stade (juin 2026), une **preuve de concept fonctionnelle** : chaque module a été validé individuellement (voir [07-testing-validation.md](07-testing-validation.md)), mais des étapes restent nécessaires avant un déploiement en conditions réelles.

## Axe 1 — Validation en charge réelle

- Cycles complets nettoyage + séchage avec charges progressives : 100 g, 500 g, 2 kg, 5 kg, en laboratoire.
- Mesure du temps de séchage nécessaire pour atteindre la cible d'humidité (< 12 %).
- Mesure du taux de pureté du soja après tamisage.
- Vérification de la stabilité des paramètres (température, humidité) dans la chambre de séchage.
- Validation de l'autonomie batterie en fonctionnement continu (voir [06-energy-system.md](06-energy-system.md)).

## Axe 2 — Intégration et robustesse mécanique

- Finalisation de l'intégration du module de pesée (cellule de charge + HX711), avec étalonnage sur la plage 0–5 kg conforme au cahier des charges (FP4, ±0,1 %).
- Validation de la résistance du cadre de tamisage aux vibrations prolongées (> 30 min) et identification des renforts structurels nécessaires.
- Documentation du protocole de maintenance préventive (nettoyage des tamis, inspection des connexions, étalonnage périodique des capteurs).

## Axe 3 — Campagne terrain

- Tests en conditions réelles sur des sites de collecte, avec mesures comparatives par rapport à des équipements de référence certifiés.
- Validation en conditions environnementales extrêmes : température > 30 °C, humidité relative > 70 %, exposition à la poussière.

## Pistes d'évolution du produit

Au-delà des travaux de validation immédiats, plusieurs axes de développement produit sont envisagés :

- PCB v2 (routage multicouche, réduction du prototype vers une carte industrialisable).
- Application mobile pour l'exploitant (en complément du dashboard web).
- Mises à jour firmware OTA (Over-The-Air) pour la maintenance à distance de la flotte.
- Prédiction d'humidité assistée par IA à partir de l'historique des lots.
- Déploiement industriel à plus grande échelle (fleet management multi-unités pour coopératives).

## Conclusion

Le projet SMART-SOJA démontre qu'une démarche d'ingénierie mécatronique rigoureuse — associée aux technologies IoT et à une traçabilité numérique robuste — peut contribuer à améliorer la qualité des produits agricoles à chaque étape de la chaîne de valeur béninoise, de la parcelle à l'usine. Les figures et éléments de travail issus du mémoire sont conservés dans [`research/thesis/`](../research/thesis/). Le PDF complet n'est pas distribué dans le dépôt public.
