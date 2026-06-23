const express = require('express');
const router = express.Router();
const { dbQuery } = require('../config/db');
const { sendAdminNotificationEmail } = require('../services/emailService');

// Validation simple d'email
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

// Les numéros de téléphone ne sont plus acceptés, seuls les e-mails sont admis.

// Générateur de code coupon unique et lisible
function generateCoupon(rewardName) {
  let prefix = 'REWARD';
  const nameLower = rewardName.toLowerCase();
  
  if (nameLower.includes('5%')) prefix = '5REDUC';
  else if (nameLower.includes('10%')) prefix = '10REDUC';
  else if (nameLower.includes('15%')) prefix = '15REDUC';
  else if (nameLower.includes('50%')) prefix = '50REDUC';
  else if (nameLower.includes('livraison')) prefix = 'LIVR';
  else if (nameLower.includes('porte-clés') || nameLower.includes('porte-cles')) prefix = 'KEYCHAIN';
  else if (nameLower.includes('t-shirt')) prefix = 'TSHIRT';
  else if (nameLower.includes('5 dt')) prefix = 'BON5DT';
  else if (nameLower.includes('10 dt')) prefix = 'BON10DT';
  else prefix = 'CHANCE';

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomStr = '';
  for (let i = 0; i < 6; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SPIN-${prefix}-${randomStr}`;
}

// Sélection pondérée
function selectWeightedReward(rewards) {
  const sumWeights = rewards.reduce((sum, item) => sum + item.probability, 0);
  
  // Si la somme des probabilités est nulle ou très faible, choix uniforme
  if (sumWeights <= 0) {
    const randomIndex = Math.floor(Math.random() * rewards.length);
    return rewards[randomIndex];
  }

  let r = Math.random() * sumWeights;
  for (const reward of rewards) {
    if (r < reward.probability) {
      return reward;
    }
    r -= reward.probability;
  }
  return rewards[rewards.length - 1];
}

// POST /api/spin - Lancer la roue
router.post('/', async (req, res) => {
  const { email } = req.body;
  
  // Récupérer l'IP du client
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  // Standardiser l'IP (enlever les préfixes IPv6 pour localhost ex: ::ffff:)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // 1. Validation de l'email
  if (!email) {
    return res.status(400).json({ success: false, error: 'Veuillez saisir une adresse email.' });
  }

  const trimmedInput = email.trim();

  if (!validateEmail(trimmedInput)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Adresse email invalide. Veuillez saisir une adresse email correcte.' 
    });
  }

  const standardizedIdentifier = trimmedInput.toLowerCase();

  try {
    // Vérifier si l'identifiant doit outrepasser la limite de double-spin (azizlatrache5@gmail.com)
    const isBypass = standardizedIdentifier === 'azizlatrache5@gmail.com';

    // 1b. Vérifier que l'identifiant est bien vérifié depuis moins de 7 jours (sauf bypass)
    if (!isBypass) {
      const verification = await dbQuery.get(
        "SELECT verified_at FROM email_verifications WHERE email = ? AND verified_at >= datetime('now', '-7 days')",
        [standardizedIdentifier]
      );
      if (!verification) {
        return res.status(403).json({
          success: false,
          error: 'Vérification requise. Veuillez vérifier votre identifiant d’abord.'
        });
      }
    }

    if (!isBypass) {
      // 2. Vérification double-spin pour les utilisateurs normaux
      const identifierExists = await dbQuery.get(
        'SELECT id FROM users_spins WHERE user_identifier = ?',
        [standardizedIdentifier]
      );
      if (identifierExists) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cette adresse email a déjà été utilisée pour lancer la roue.' 
        });
      }

      // On vérifie si l'IP a déjà joué (sauf pour localhost/127.0.0.1)
      if (ip && ip !== '127.0.0.1' && ip !== '::1') {
        const ipExists = await dbQuery.get(
          'SELECT id FROM users_spins WHERE user_identifier = ?',
          [ip]
        );
        if (ipExists) {
          return res.status(400).json({ success: false, error: 'Votre appareil (IP) a déjà été utilisé pour lancer la roue.' });
        }
      }
    }

    // 3. Sélection de la récompense avec gestion de stock concurrentielle
    let chosenReward = null;
    let attempts = 0;
    
    while (attempts < 5) {
      // Récupérer les récompenses actives et en stock (stock > 0 ou stock = -1)
      const activeRewards = await dbQuery.all(
        'SELECT * FROM rewards WHERE active = 1 AND (stock > 0 OR stock = -1)'
      );

      if (activeRewards.length === 0) {
        return res.status(500).json({ success: false, error: 'Aucune récompense n’est actuellement disponible.' });
      }

      chosenReward = selectWeightedReward(activeRewards);

      // Gestion du stock
      if (chosenReward.stock > 0) {
        const updateResult = await dbQuery.run(
          'UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0',
          [chosenReward.id]
        );
        if (updateResult.changes > 0) {
          break; // Stock réservé avec succès
        } else {
          attempts++; // Concurrence, retry
        }
      } else {
        break; // Pas de limite de stock (réduction, livraison...)
      }
    }

    if (!chosenReward) {
      return res.status(500).json({ success: false, error: 'Erreur lors de la sélection de la récompense.' });
    }

    // 4. Générer coupon
    const couponCode = generateCoupon(chosenReward.name);

    // 5. Sauvegarder dans la table users_spins
    // En cas de bypass, on ajoute un suffixe timestamp pour éviter l'erreur UNIQUE de SQLite
    const dbIdentifier = isBypass ? `${standardizedIdentifier}#${Date.now()}` : standardizedIdentifier;
    
    await dbQuery.run(
      'INSERT INTO users_spins (user_identifier, reward, coupon_code) VALUES (?, ?, ?)',
      [dbIdentifier, chosenReward.name, couponCode]
    );

    // Si IP disponible, non locale et pas en mode bypass, on bloque l'IP
    if (!isBypass && ip && ip !== '127.0.0.1' && ip !== '::1') {
      try {
        await dbQuery.run(
          'INSERT INTO users_spins (user_identifier, reward, coupon_code) VALUES (?, ?, ?)',
          [ip, chosenReward.name, couponCode]
        );
      } catch (err) {
        console.warn('IP déjà enregistrée pour double-spin ou erreur:', err.message);
      }
    }



    // 6. Renvoyer le résultat
    res.json({
      success: true,
      reward: {
        id: chosenReward.id,
        name: chosenReward.name
      },
      couponCode
    });

    // 7. Envoyer la notification admin par e-mail de façon asynchrone (sans bloquer la roue)
    sendAdminNotificationEmail(standardizedIdentifier, chosenReward.name, couponCode).catch(err => {
      console.error('[Admin Notification] Impossible d\'envoyer le mail de notification :', err.message);
    });

  } catch (error) {
    console.error('Erreur lors du spin:', error);
    res.status(500).json({ success: false, error: 'Une erreur serveur est survenue lors du tirage.' });
  }
});

module.exports = router;
