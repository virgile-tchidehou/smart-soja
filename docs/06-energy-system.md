# Energy System

Pour garantir un fonctionnement ininterrompu en milieu rural hors réseau, SMART-SOJA repose sur une alimentation photovoltaïque autonome, dimensionnée à partir du besoin réel du prototype (et non sur estimation forfaitaire).

## Spécifications

| Paramètre | Valeur |
|---|---|
| Production (panneau) | Monocristallin 50 W (peak) |
| Stockage (batterie) | Plomb-acide 12 V / 20 Ah (240 Wh) |
| Bilan de puissance crête | 37,85 W (toutes charges ON) |
| Consommation journalière estimée | ≈ 113,5 Wh (pour 3 h de travail) |
| Autonomie théorique (sans soleil) | ≈ 1 jour (à 50 % de décharge) |
| Conversion | Régulateurs Buck LM2596 (efficacité > 85 %) |

## Méthode de dimensionnement

**Étape 1 — Bilan de puissance crête.** Somme des consommations réelles des composants du prototype (deux moteurs, deux résistances, deux ventilateurs, ESP32) :

```
P_tot = 9,0 W (2 moteurs) + 24,0 W (2 résistances) + 3,6 W (2 ventilateurs) + 1,25 W (ESP32)
      = 37,85 W
```

**Étape 2 — Énergie consommée par jour.** Pour une utilisation de 3 h/jour (≈ 18 cycles de traitement) :

```
E_jour = 37,85 W × 3 h ≈ 113,5 Wh/jour
```

**Étape 3 — Validation de la batterie.** La batterie 12 V/20 Ah a une capacité totale de 240 Wh. En limitant la décharge à 50 % (standard pour prolonger la durée de vie d'une batterie au plomb), l'énergie réellement disponible est de **120 Wh**.

> 120 Wh disponibles > 113,5 Wh nécessaires → la batterie couvre une session de travail quotidienne en autonomie.

**Étape 4 — Validation du panneau solaire.** Avec un ensoleillement moyen de 5 h/jour au Bénin, le panneau de 50 W produit :

```
E_produite = 50 W × 5 h = 250 Wh/jour
```

> 250 Wh produits > 113,5 Wh nécessaires → le panneau recharge la batterie facilement, avec une marge de sécurité pour les jours de faible ensoleillement.

## Résultats mesurés en test

Voir [07-testing-validation.md](07-testing-validation.md#validation-du-système-énergétique) pour le profil de consommation mesuré au multimètre (pic maximum observé : 1,5 A, tension batterie stable > 12 V, aucun effondrement de tension constaté).

## Limites connues

L'autonomie réelle en cycle complet et la stabilité thermique de l'électronique sous fonctionnement prolongé n'ont pas encore été validées en conditions de terrain — voir [09-future-improvements.md](09-future-improvements.md).
