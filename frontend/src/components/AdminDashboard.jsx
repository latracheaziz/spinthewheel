import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, BarChart2, ShieldCheck, List, Settings, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import '../styles/admin.css';
import '../styles/main.css';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('rewards'); // 'spins' | 'stats' | 'rewards'
  const [spins, setSpins] = useState([]);
  const [stats, setStats] = useState({ totalSpins: 0, distribution: [] });
  const [rewards, setRewards] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // États de chargement et retours d'API
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const API_URL = 'http://localhost:5000/api';

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Charger la configuration des récompenses
      const rewardsRes = await fetch(`${API_URL}/rewards`);
      const rewardsJson = await rewardsRes.json();
      if (rewardsJson.success) {
        setRewards(rewardsJson.data);
      }

      // Charger l'historique des spins
      const spinsRes = await fetch(`${API_URL}/admin/spins`);
      const spinsJson = await spinsRes.json();
      if (spinsJson.success) {
        setSpins(spinsJson.data);
      }

      // Charger les statistiques
      const statsRes = await fetch(`${API_URL}/admin/stats`);
      const statsJson = await statsRes.json();
      if (statsJson.success) {
        setStats(statsJson.data);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Impossible de communiquer avec le serveur d’API. Vérifiez que le serveur backend est lancé.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculer la somme des probabilités actives pour validation en direct
  const activeRewards = rewards.filter(r => Number(r.active) === 1);
  const sumProbabilities = activeRewards.reduce((sum, r) => sum + parseFloat(r.probability || 0), 0);
  const isProbabilitySumValid = Math.abs(sumProbabilities - 1.0) < 0.0001;

  // Gérer la modification d'un champ de récompense
  const handleRewardFieldChange = (id, field, value) => {
    setRewards(prev =>
      prev.map(r => {
        if (r.id === id) {
          let val = value;
          if (field === 'probability') {
            // Permettre la saisie décimale libre
            val = value === '' ? '' : value;
          } else if (field === 'stock') {
            val = value === '' ? '' : parseInt(value, 10);
            if (isNaN(val)) val = '';
          } else if (field === 'active') {
            val = value ? 1 : 0;
          }
          return { ...r, [field]: val };
        }
        return r;
      })
    );
  };

  // Enregistrer les modifications de configuration
  const handleSaveChanges = async () => {
    if (!isProbabilitySumValid) {
      setErrorMsg('Erreur de validation : la somme des probabilités des récompenses actives doit être exactement de 100% (1.0).');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Remplacer les chaînes vides éventuelles par 0 ou -1 pour le stock
    const sanitizedRewards = rewards.map(r => ({
      ...r,
      probability: r.probability === '' ? 0 : parseFloat(r.probability),
      stock: r.stock === '' ? -1 : parseInt(r.stock, 10),
      active: Number(r.active)
    }));

    try {
      const res = await fetch(`${API_URL}/admin/rewards/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewards: sanitizedRewards })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setSuccessMsg('Configurations enregistrées avec succès !');
        fetchData(); // Recharger les données propres
      } else {
        setErrorMsg(data.error || 'Erreur lors de l’enregistrement.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erreur réseau lors de la mise à jour.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtrage des spins selon la barre de recherche
  const filteredSpins = spins.filter(
    spin =>
      spin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spin.reward.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spin.coupon_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="admin-title">Panneau d'Administration</h1>
            <p className="admin-desc">Supervisez l'activité de la roue de la chance et gérez les récompenses.</p>
          </div>
          <button 
            onClick={fetchData} 
            className="btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin-animation' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Onglets */}
      <div className="admin-tabs">
        <button
          onClick={() => setActiveTab('rewards')}
          className={`admin-tab-btn ${activeTab === 'rewards' ? 'active' : ''}`}
        >
          <Settings size={18} />
          Configuration Récompenses
        </button>
        <button
          onClick={() => setActiveTab('spins')}
          className={`admin-tab-btn ${activeTab === 'spins' ? 'active' : ''}`}
        >
          <List size={18} />
          Historique des lancers
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`admin-tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
        >
          <BarChart2 size={18} />
          Statistiques de gains
        </button>
      </div>

      {/* Contenu Onglet 1 : Configuration des récompenses */}
      {activeTab === 'rewards' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div className="config-header-row">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Liste des lots disponibles</h3>
            <div className={`prob-summary ${isProbabilitySumValid ? 'valid' : 'invalid'}`}>
              {isProbabilitySumValid ? (
                <>
                  <CheckCircle2 size={16} color="var(--success)" />
                  <span>Somme des probabilités : <strong>{(sumProbabilities * 100).toFixed(0)}% (Valide)</strong></span>
                </>
              ) : (
                <>
                  <AlertTriangle size={16} color="var(--error)" />
                  <span>Somme des probabilités : <strong style={{ textDecoration: 'underline' }}>{(sumProbabilities * 100).toFixed(1)}% / 100% (Invalide)</strong></span>
                </>
              )}
            </div>
          </div>

          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>ID</th>
                  <th>Nom de la récompense</th>
                  <th style={{ width: '180px' }}>Probabilité (0.00 à 1.00)</th>
                  <th style={{ width: '150px' }}>Stock (-1 = infini)</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Actif</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map(reward => (
                  <tr key={reward.id}>
                    <td>{reward.id}</td>
                    <td>
                      <input
                        type="text"
                        value={reward.name}
                        className="table-input"
                        onChange={(e) => handleRewardFieldChange(reward.id, 'name', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={reward.probability}
                        className="table-input"
                        onChange={(e) => handleRewardFieldChange(reward.id, 'probability', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="-1"
                        value={reward.stock}
                        className="table-input"
                        onChange={(e) => handleRewardFieldChange(reward.id, 'stock', e.target.value)}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={Number(reward.active) === 1}
                          onChange={(e) => handleRewardFieldChange(reward.id, 'active', e.target.checked)}
                        />
                        <span className="slider"></span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="config-footer">
            <button 
              onClick={handleSaveChanges} 
              className="btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              disabled={isSaving || !isProbabilitySumValid}
            >
              <Save size={18} />
              {isSaving ? 'Enregistrement...' : 'Enregistrer la configuration'}
            </button>
          </div>
        </div>
      )}

      {/* Contenu Onglet 2 : Historique des spins */}
      {activeTab === 'spins' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div className="filters-bar">
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Rechercher par email, gain ou code..."
                className="search-input"
                style={{ paddingLeft: '40px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>ID</th>
                  <th>Utilisateur (Email)</th>
                  <th>Récompense</th>
                  <th>Code Coupon</th>
                  <th>Date & Heure</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpins.length > 0 ? (
                  filteredSpins.map(spin => (
                    <tr key={spin.id}>
                      <td>{spin.id}</td>
                      <td style={{ color: 'white', fontWeight: 600 }}>{spin.email}</td>
                      <td>{spin.reward}</td>
                      <td>
                        <span className="coupon-badge">{spin.coupon_code}</span>
                      </td>
                      <td>{new Date(spin.created_at).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                      Aucun lancer trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onglet 3 : Statistiques */}
      {activeTab === 'stats' && (
        <div>
          <div className="stats-grid">
            <div className="glass-panel stat-card">
              <span className="stat-label">Nombre total de participations</span>
              <div className="stat-value">{stats.totalSpins}</div>
            </div>
            <div className="glass-panel stat-card">
              <span className="stat-label">Taux d'engagement</span>
              <div className="stat-value" style={{ color: 'var(--success)' }}>100%</div>
            </div>
            <div className="glass-panel stat-card">
              <span className="stat-label">Gains matériels restants</span>
              <div className="stat-value" style={{ color: 'var(--accent-gold)' }}>
                {rewards.filter(r => r.stock > 0).reduce((sum, r) => sum + r.stock, 0)}
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', textAlign: 'left' }}>Distribution des récompenses obtenues</h3>
            
            {stats.distribution.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {stats.distribution.map((dist, idx) => (
                  <div key={idx} style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                      <span style={{ fontWeight: 600, color: 'white' }}>{dist.reward}</span>
                      <span>{dist.count} fois ({dist.percentage}%)</span>
                    </div>
                    {/* Barre de progression simplifiée */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.05)', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          background: `linear-gradient(to right, var(--accent-purple), var(--accent-rose))`, 
                          width: `${dist.percentage}%`, 
                          height: '100%',
                          borderRadius: '5px',
                          transition: 'width 1s ease-out'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                Données insuffisantes pour afficher les graphiques. Lancez la roue au moins une fois !
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
