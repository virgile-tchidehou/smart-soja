# Database (Firebase)

SMART-SOJA utilise **Firebase Firestore** comme base de données temps réel pour la traçabilité. La configuration de déploiement (règles de sécurité, index, jeu de données initial) vit avec l'application qui la déploie : [`cloud/dashboard/app/firestore.rules`](../dashboard/app/firestore.rules), [`firestore.indexes.json`](../dashboard/app/firestore.indexes.json), [`rtdb_seed.json`](../dashboard/app/rtdb_seed.json).

## Collections principales

| Collection | Contenu |
|---|---|
| `users` | Comptes utilisateurs et rôles (admin / industrie / exploitant) |
| `units` | Unités SMART-SOJA déployées (flotte), identifiées par `unitId` |
| `lots` | Lots de soja traités : passeport numérique (voir format JSON dans [05-software-architecture.md](../../docs/05-software-architecture.md)) |
| `telemetry` | Historique des trames de télémétrie périodique publiées via MQTT |

## Règles d'accès

Accès en lecture/écriture réservé aux utilisateurs authentifiés (`request.auth != null`), avec une règle plus fine sur `users/{userId}` : un utilisateur peut lire/modifier son propre profil, ou tout profil s'il a le rôle `admin`.

## Flux d'alimentation

Le pipeline MQTT → Firestore est assuré par [`cloud/api/`](../api/) (backend Node.js), qui valide chaque message avant écriture. Voir [02-system-architecture.md](../../docs/02-system-architecture.md) pour le schéma complet.
