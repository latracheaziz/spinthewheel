const path = require('path');
const fs = require('fs');

const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME;
const dataDir = isVercel ? '/tmp' : path.join(__dirname, '../../data');

if (!isVercel && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let sqlite3;
let useSQLite = false;

// Never use sqlite3 on Vercel (native binary not compatible with serverless Lambda)
if (!isVercel) {
  try {
    sqlite3 = require('sqlite3').verbose();
    useSQLite = true;
  } catch (err) {
    console.warn('[DB] Failed to load sqlite3 native package. Falling back to pure JS JSON database:', err.message);
  }
}

let db = null;
let dbQuery = null;

if (useSQLite) {
  const dbPath = path.join(dataDir, 'database.sqlite');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Erreur de connexion à SQLite:', err.message);
    } else {
      console.log('Connecté à la base de données SQLite.');
    }
  });

  // Promisification des méthodes de sqlite3
  dbQuery = {
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
} else {
  // Pure JavaScript JSON database fallback
  const jsonPath = path.join(dataDir, 'database.json');
  
  class JsonDatabase {
    constructor(filePath) {
      this.filePath = filePath;
      this.data = {
        rewards: [],
        users_spins: [],
        email_verifications: []
      };
      this.load();

      // Seed rewards synchronously if they are empty
      if (!this.data.rewards || this.data.rewards.length === 0) {
        this.data.rewards = [
          { id: 1, name: 'Essaie à la prochaine', probability: 0.21, active: 1, stock: -1 },
          { id: 2, name: 'Livraison gratuite', probability: 0.08, active: 1, stock: -1 },
          { id: 3, name: '5% de réduction', probability: 0.20, active: 1, stock: -1 },
          { id: 4, name: '10% de réduction', probability: 0.10, active: 1, stock: -1 },
          { id: 5, name: '15% de réduction', probability: 0.10, active: 1, stock: -1 },
          { id: 6, name: 'Essaie à la prochaine', probability: 0.20, active: 1, stock: -1 },
          { id: 7, name: '50% de réduction sur 3ème achat', probability: 0.05, active: 1, stock: -1 },
          { id: 8, name: 'Porte-clés gratuit', probability: 0.03, active: 1, stock: 10 },
          { id: 9, name: 'T-shirt gratuit', probability: 0.01, active: 1, stock: 5 },
          { id: 10, name: 'Bon d’achat 5 DT', probability: 0.01, active: 1, stock: -1 },
          { id: 11, name: 'Bon d’achat 10 DT', probability: 0.01, active: 1, stock: -1 }
        ];
        this.save();
      }
    }

    load() {
      try {
        if (fs.existsSync(this.filePath)) {
          const fileContent = fs.readFileSync(this.filePath, 'utf8');
          this.data = JSON.parse(fileContent);
        } else {
          this.save();
        }
      } catch (err) {
        console.error('[JsonDatabase] Error loading file, resetting:', err.message);
        this.save();
      }
    }

    save() {
      try {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
      } catch (err) {
        console.error('[JsonDatabase] Error saving file:', err.message);
      }
    }

    query(sql, params = [], singleRow = false) {
      const sqlClean = sql.trim().replace(/\s+/g, ' ');
      const sqlLower = sqlClean.toLowerCase();

      // --- CREATE TABLE ---
      if (sqlLower.startsWith('create table')) {
        return { changes: 0 };
      }

      // --- REWARDS TABLE ---
      if (sqlLower.includes('from rewards') || sqlLower.includes('into rewards') || sqlLower.includes('update rewards')) {
        // SELECT COUNT(*) FROM rewards
        if (sqlLower.includes('count(*)')) {
          return { count: this.data.rewards.length };
        }
        // SELECT * FROM rewards
        if (sqlLower.startsWith('select')) {
          let list = [...this.data.rewards];
          if (sqlLower.includes('active = 1')) {
            list = list.filter(r => r.active === 1 && (r.stock > 0 || r.stock === -1));
          }
          return singleRow ? list[0] || null : list;
        }
        // INSERT INTO rewards
        if (sqlLower.startsWith('insert')) {
          const id = this.data.rewards.length > 0 ? Math.max(...this.data.rewards.map(r => r.id)) + 1 : 1;
          this.data.rewards.push({
            id,
            name: params[0],
            probability: parseFloat(params[1]),
            active: parseInt(params[2], 10),
            stock: parseInt(params[3], 10)
          });
          this.save();
          return { lastID: id, changes: 1 };
        }
        // UPDATE rewards
        if (sqlLower.startsWith('update')) {
          if (sqlLower.includes('stock = stock - 1')) {
            const id = params[0];
            const reward = this.data.rewards.find(r => r.id === id);
            if (reward && reward.stock > 0) {
              reward.stock -= 1;
              this.save();
            }
            return { changes: 1 };
          }
          // Admin update
          const id = params[4];
          const reward = this.data.rewards.find(r => r.id === id);
          if (reward) {
            reward.name = params[0];
            reward.probability = params[1];
            reward.active = params[2];
            reward.stock = params[3];
            this.save();
          }
          return { changes: 1 };
        }
      }

      // --- USERS_SPINS TABLE ---
      if (sqlLower.includes('from users_spins') || sqlLower.includes('into users_spins')) {
        // SELECT COUNT(*) FROM users_spins
        if (sqlLower.includes('count(*)')) {
          const filteredSpins = this.data.users_spins.filter(s => 
            s.user_identifier && (s.user_identifier.includes('@') || s.user_identifier.startsWith('+'))
          );
          return { count: filteredSpins.length, total: filteredSpins.length };
        }
        // SELECT reward, COUNT(*) as count FROM users_spins GROUP BY reward
        if (sqlLower.includes('group by reward')) {
          const counts = {};
          this.data.users_spins.forEach(s => {
            if (s.user_identifier && (s.user_identifier.includes('@') || s.user_identifier.startsWith('+'))) {
              counts[s.reward] = (counts[s.reward] || 0) + 1;
            }
          });
          return Object.keys(counts).map(reward => ({
            reward,
            count: counts[reward]
          }));
        }
        // SELECT
        if (sqlLower.startsWith('select')) {
          if (sqlLower.includes('user_identifier = ?')) {
            const user = params[0];
            const record = this.data.users_spins.find(s => s.user_identifier === user);
            return record || null;
          }
          // spins list
          let list = this.data.users_spins
            .filter(s => s.user_identifier && (s.user_identifier.includes('@') || s.user_identifier.startsWith('+')))
            .map(s => ({ 
              id: s.id, 
              email: s.user_identifier, 
              reward: s.reward, 
              coupon_code: s.coupon_code, 
              created_at: s.created_at 
            }))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          return list;
        }
        // INSERT
        if (sqlLower.startsWith('insert')) {
          const id = this.data.users_spins.length > 0 ? Math.max(...this.data.users_spins.map(s => s.id)) + 1 : 1;
          this.data.users_spins.push({
            id,
            user_identifier: params[0],
            reward: params[1],
            coupon_code: params[2],
            created_at: new Date().toISOString()
          });
          this.save();
          return { lastID: id, changes: 1 };
        }
      }

      // --- EMAIL_VERIFICATIONS TABLE ---
      if (sqlLower.includes('from email_verifications') || sqlLower.includes('into email_verifications') || sqlLower.includes('update email_verifications')) {
        // SELECT
        if (sqlLower.startsWith('select')) {
          const email = params[0];
          const record = this.data.email_verifications.find(v => v.email === email);
          if (record) {
            if (sqlLower.includes('-7 days')) {
              if (!record.verified_at) return null;
              const verifiedTime = new Date(record.verified_at).getTime();
              const limitTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
              if (verifiedTime < limitTime) return null;
            }
            return record;
          }
          return null;
        }
        // INSERT
        if (sqlLower.startsWith('insert')) {
          const email = params[0];
          const code = params[1];
          let record = this.data.email_verifications.find(v => v.email === email);
          if (!record) {
            record = { email, code, verified_at: null, created_at: new Date().toISOString() };
            this.data.email_verifications.push(record);
          }
          record.code = code;
          if (sqlClean.includes('datetime(') || sqlClean.includes("code, verified_at") || sqlClean.includes("'BYPASS'")) {
            record.verified_at = new Date().toISOString();
          } else {
            record.verified_at = null;
          }
          record.created_at = new Date().toISOString();
          this.save();
          return { lastID: email, changes: 1 };
        }
        // UPDATE
        if (sqlLower.startsWith('update')) {
          const email = params[0];
          const record = this.data.email_verifications.find(v => v.email === email);
          if (record) {
            record.verified_at = new Date().toISOString();
            this.save();
          }
          return { changes: 1 };
        }
      }

      console.warn('[JsonDatabase] Unhandled query:', sql);
      return null;
    }
  }

  const jsonDb = new JsonDatabase(jsonPath);
  dbQuery = {
    run(sql, params = []) {
      return Promise.resolve(jsonDb.query(sql, params));
    },
    get(sql, params = []) {
      return Promise.resolve(jsonDb.query(sql, params, true));
    },
    all(sql, params = []) {
      return Promise.resolve(jsonDb.query(sql, params, false));
    },
    exec(sql) {
      return Promise.resolve(jsonDb.query(sql, [], false));
    }
  };
}

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
      { name: 'Essaie à la prochaine', probability: 0.21, active: 1, stock: -1 },
      { name: 'Livraison gratuite', probability: 0.08, active: 1, stock: -1 },
      { name: '5% de réduction', probability: 0.20, active: 1, stock: -1 },
      { name: '10% de réduction', probability: 0.10, active: 1, stock: -1 },
      { name: '15% de réduction', probability: 0.10, active: 1, stock: -1 },
      { name: 'Essaie à la prochaine', probability: 0.20, active: 1, stock: -1 },
      { name: '50% de réduction sur 3ème achat', probability: 0.05, active: 1, stock: -1 },
      { name: 'Porte-clés gratuit', probability: 0.03, active: 1, stock: 10 },
      { name: 'T-shirt gratuit', probability: 0.01, active: 1, stock: 5 },
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
