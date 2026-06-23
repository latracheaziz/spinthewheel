const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;
const dataDir = isVercel ? '/tmp' : path.join(__dirname, '../../data');

if (!isVercel && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur de connexion à SQLite:', err.message);
  } else {
    console.log('Connecté à la base de données SQLite.');
  }
});

// Promisification des méthodes de sqlite3
const dbQuery = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

// Initialisation des tables
async function initDatabase() {
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      probability REAL NOT NULL,
      active INTEGER NOT NULL,
      stock INTEGER NOT NULL
    )
  `);

  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS users_spins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_identifier TEXT UNIQUE NOT NULL,
      reward TEXT NOT NULL,
      coupon_code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      email TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seeding initial des récompenses si la table est vide
  const count = await dbQuery.get('SELECT COUNT(*) as count FROM rewards');
  if (count.count === 0) {
    const initialRewards = [
      { name: 'Essaie à la prochaine', probability: 0.20, active: 1, stock: -1 },
      { name: 'Essaie à la prochaine', probability: 0.20, active: 1, stock: -1 },
      { name: '5% de réduction', probability: 0.20, active: 1, stock: -1 },
      { name: '10% de réduction', probability: 0.10, active: 1, stock: -1 },
      { name: '15% de réduction', probability: 0.10, active: 1, stock: -1 },
      { name: 'Livraison gratuite', probability: 0.08, active: 1, stock: -1 },
      { name: '50% de réduction sur 3ème achat', probability: 0.05, active: 1, stock: -1 },
      { name: 'Porte-clés gratuit', probability: 0.03, active: 1, stock: 10 },
      { name: 'T-shirt gratuit', probability: 0.02, active: 1, stock: 5 },
      { name: 'Bon d’achat 5 DT', probability: 0.01, active: 1, stock: -1 },
      { name: 'Bon d’achat 10 DT', probability: 0.01, active: 1, stock: -1 }
    ];

    for (const reward of initialRewards) {
      await dbQuery.run(
        'INSERT INTO rewards (name, probability, active, stock) VALUES (?, ?, ?, ?)',
        [reward.name, reward.probability, reward.active, reward.stock]
      );
    }
    console.log('Table des récompenses initialisée avec succès.');
  }
}

module.exports = {
  db,
  dbQuery,
  initDatabase
};
