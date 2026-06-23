require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// IMPORTANT: On Vercel (serverless), initialize DB BEFORE routes so it's
// ready when the first request arrives. This middleware MUST come first.
if (process.env.VERCEL) {
  let isDbInitialized = false;
  app.use(async (req, res, next) => {
    if (!isDbInitialized) {
      try {
        await initDatabase();
        isDbInitialized = true;
        console.log('[Vercel] DB initialized successfully on first request');
      } catch (err) {
        console.error('[Vercel] Lazy DB initialization failed:', err);
      }
    }
    next();
  });
}

// Routes
const rewardsRouter = require('./routes/rewards');
const spinRouter = require('./routes/spin');
const adminRouter = require('./routes/admin');
const verifyRouter = require('./routes/verify');
const { dbQuery } = require('./config/db');

// Support both /api/ and root paths
app.use('/api/rewards', rewardsRouter);
app.use('/rewards', rewardsRouter);

app.use('/api/spin', spinRouter);
app.use('/spin', spinRouter);

app.use('/api/verify', verifyRouter);
app.use('/verify', verifyRouter);

app.use('/api/admin', adminRouter);
app.use('/admin', adminRouter);

// GET /spins -> liste des résultats
app.get('/spins', async (req, res) => {
  try {
    const spins = await dbQuery.all(
      "SELECT id, user_identifier as email, reward, coupon_code, created_at FROM users_spins WHERE (user_identifier LIKE '+%' OR user_identifier LIKE '%@%') ORDER BY created_at DESC"
    );
    res.json({ success: true, data: spins });
  } catch (error) {
    console.error('Erreur GET /spins:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des lancers' });
  }
});

app.get('/api/spins', async (req, res) => {
  try {
    const spins = await dbQuery.all(
      "SELECT id, user_identifier as email, reward, coupon_code, created_at FROM users_spins WHERE (user_identifier LIKE '+%' OR user_identifier LIKE '%@%') ORDER BY created_at DESC"
    );
    res.json({ success: true, data: spins });
  } catch (error) {
    console.error('Erreur GET /api/spins:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des lancers' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Initialisation de la base de données et lancement du serveur (local only)
async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Serveur démarré sur http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Impossible de démarrer le serveur:', error);
    process.exit(1);
  }
}

if (!process.env.VERCEL) {
  startServer();
}

module.exports = app;
