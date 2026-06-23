const { initDatabase, dbQuery } = require('./config/db');

// Sélection pondérée (même fonction que dans spin.js)
function selectWeightedReward(rewards) {
  const sumWeights = rewards.reduce((sum, item) => sum + item.probability, 0);
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

async function runTest() {
  console.log('--- Lancement du test de distribution statistique ---');
  
  // 1. Initialiser la BD locale
  await initDatabase();

  // 2. Récupérer les récompenses actives
  const activeRewards = await dbQuery.all(
    'SELECT * FROM rewards WHERE active = 1 AND (stock > 0 OR stock = -1)'
  );

  console.log(`Récompenses actives trouvées : ${activeRewards.length}`);
  activeRewards.forEach(r => {
    console.log(`- ${r.name} (Poids initial : ${r.probability * 100}%, Stock : ${r.stock})`);
  });

  if (activeRewards.length === 0) {
    console.error('Aucune récompense active pour le test.');
    process.exit(1);
  }

  // 3. Simuler 10 000 tirages
  const iterations = 10000;
  const counts = {};
  
  // Initialiser les compteurs
  activeRewards.forEach(r => {
    counts[r.name] = 0;
  });

  console.log(`\nSimulation de ${iterations} tirages en cours...`);
  
  for (let i = 0; i < iterations; i++) {
    const chosen = selectWeightedReward(activeRewards);
    counts[chosen.name] = (counts[chosen.name] || 0) + 1;
  }

  // 4. Afficher la distribution réelle vs théorique
  console.log('\n--- Résultats de la simulation ---');
  activeRewards.forEach(r => {
    const count = counts[r.name];
    const realPercentage = ((count / iterations) * 100).toFixed(2);
    const expectedPercentage = (r.probability * 100).toFixed(2);
    const difference = (parseFloat(realPercentage) - parseFloat(expectedPercentage)).toFixed(2);
    
    console.log(`"${r.name}":`);
    console.log(`  - Tirages : ${count} / ${iterations}`);
    console.log(`  - Probabilité réelle   : ${realPercentage}%`);
    console.log(`  - Probabilité attendue : ${expectedPercentage}%`);
    console.log(`  - Écart                 : ${difference > 0 ? '+' : ''}${difference}%`);
  });
  
  console.log('\nLe test de distribution est terminé.');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Erreur durant le test:', err);
  process.exit(1);
});
