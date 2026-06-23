# Application "Spin The Wheel" - E-Commerce de Vêtements

Ce projet implémente une roue de la fortune interactive et moderne connectée à une API backend sécurisée et une base de données SQLite.

## Structure du Projet

- `/backend` : API Express, logique de tirage pondéré, décompte de stock sécurisé, base de données SQLite.
- `/frontend` : Application React (Vite) avec une interface élégante en français, roue en SVG et panneau d'administration complet.

## Démarrage rapide

### 1. Démarrer le Backend
Ouvrez un terminal dans le dossier `backend` et exécutez :
```bash
npm install
npm run dev
```
Le serveur démarrera sur `http://localhost:5000`.

### 2. Démarrer le Frontend
Ouvrez un terminal dans le dossier `frontend` et exécutez :
```bash
npm install
npm run dev
```
L'application démarrera (généralement sur `http://localhost:5173` ou `http://localhost:5175`).

### 3. Lancer la Simulation Statistique
Pour tester la distribution statistique pondérée du backend sur 10 000 tirages :
```bash
cd backend
node src/test-distribution.js
```

Pour consulter le résumé complet de l'implémentation, voir le document de suivi :
- [walkthrough.md (Description et détails)](file:///C:/Users/Aziz/.gemini/antigravity-ide/brain/b38c3ffa-f2b4-4c32-a5b2-e6d87bb08ca7/walkthrough.md)
