import React, { useState, useEffect } from 'react';
import Wheel from './components/Wheel';
import Modal from './components/Modal';
import { Mail, Play, ShieldAlert, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import './styles/main.css';

export default function App() {
  const [rewards, setRewards] = useState([]);
  const [email, setEmail] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  
  // Résultats du tirage
  const [winningIndex, setWinningIndex] = useState(null);
  const [rewardWon, setRewardWon] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  
  // Modals & retours utilisateur
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  // États pour la double vérification à 6 chiffres
  const [verificationStep, setVerificationStep] = useState('input_email'); // 'input_email' | 'verify_code'
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const API_URL = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

  // Charger les récompenses
  const fetchRewards = async () => {
    try {
      const res = await fetch(`${API_URL}/rewards`);
      const data = await res.json();
      if (data.success) {
        setRewards(data.data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des récompenses:', error);
      setErrorMsg('Impossible de charger les lots. Vérifiez que l’API backend fonctionne.');
    }
  };

  useEffect(() => {
    fetchRewards();
  }, []);

  // Lancement de la requête physique de spin sur le backend
  const triggerSpin = async (emailToSpin) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setWinningIndex(null);
    setRewardWon(null);
    setCouponCode('');

    try {
      const res = await fetch(`${API_URL}/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToSpin })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Erreur lors du tirage.');
        setLoading(false);
        return;
      }

      // Trouver l'index de la récompense dans notre liste locale de récompenses
      const index = rewards.findIndex(r => r.id === data.reward.id);
      if (index === -1) {
        await fetchRewards();
        setErrorMsg('Une mise à jour des récompenses a eu lieu. Veuillez réessayer.');
        setLoading(false);
        return;
      }

      // Stocker les détails du gain et lancer la roue
      setWinningIndex(index);
      setRewardWon(data.reward);
      setCouponCode(data.couponCode);
      setIsSpinning(true);
      setLoading(false);

    } catch (err) {
      console.error(err);
      setErrorMsg('Erreur réseau. Impossible de contacter le serveur de tirage.');
      setLoading(false);
    }
  };

  // Première étape : demande de spin, vérifie si l'adresse email est déjà validée (7 jours)
  const handleSpinRequest = async (e) => {
    e.preventDefault();
    if (isSpinning) return;
    
    const trimmedInput = email.trim();
    const isEmail = /^[a-zA-Z0-9]+[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedInput);

    if (!isEmail) {
      setErrorMsg('Veuillez saisir une adresse email valide (ex: exemple@email.com).');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API_URL}/verify/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedInput })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Erreur lors de la vérification.');
        setLoading(false);
        return;
      }

      if (data.verified) {
        // Déjà vérifié dans les 7 derniers jours ! On lance le spin direct.
        setLoading(false);
        await triggerSpin(trimmedInput);
      } else {
        // Non vérifié ou expiré, on passe à l'étape d'entrée du code OTP
        setLoading(false);
        setVerificationStep('verify_code');
        setSuccessMsg(data.message || 'Un code de vérification vous a été envoyé.');
      }

    } catch (err) {
      console.error(err);
      setErrorMsg('Erreur réseau. Impossible de contacter le serveur de vérification.');
      setLoading(false);
    }
  };

  // Deuxième étape : validation du code à 6 chiffres reçu
  const handleVerifyCodeSubmit = async (e) => {
    e.preventDefault();
    if (isVerifying || !verificationCode) return;

    setIsVerifying(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedInput = email.trim();

    try {
      const res = await fetch(`${API_URL}/verify/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedInput, code: verificationCode })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Code de vérification incorrect.');
        setIsVerifying(false);
        return;
      }

      // Code validé avec succès !
      setVerificationStep('input_email');
      setVerificationCode('');
      setIsVerifying(false);

      // Déclencher automatiquement le spin
      await triggerSpin(trimmedInput);

    } catch (err) {
      console.error(err);
      setErrorMsg('Erreur réseau lors de la validation du code.');
      setIsVerifying(false);
    }
  };

  // Fin de la rotation physique de la roue
  const handleSpinFinished = () => {
    setIsSpinning(false);
    
    // Déclencher les confettis s'il y a eu gain (pas un "pas de chance")
    const isLosing = rewardWon.name.toLowerCase().includes('pas de chance') || 
                     rewardWon.name.toLowerCase().includes('perdu') ||
                     rewardWon.name.toLowerCase().includes('prochaine') ||
                     rewardWon.name.toLowerCase().includes('essaie');
    if (!isLosing) {
      // Effet confetti premium
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
      // Deuxième explosion décalée pour plus de volume
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 100,
          origin: { x: 0.3, y: 0.5 }
        });
        confetti({
          particleCount: 100,
          spread: 100,
          origin: { x: 0.7, y: 0.5 }
        });
      }, 300);
    }

    // Ouvrir la popup du résultat
    setIsModalOpen(true);
    setSuccessMsg(`Félicitations ! Vous avez gagné : ${rewardWon.name}`);

    // Auto-refresh automatique après 8 secondes pour réinitialiser complètement le jeu
    setTimeout(() => {
      window.location.reload();
    }, 8000);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Rafraîchir la page pour réinitialiser complètement l'état
    window.location.reload();
  };

  return (
    <>
      <header>
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src="/logo.png" 
            alt="Griffin Logo" 
            style={{ 
              height: '35px', 
              width: 'auto', 
              filter: 'brightness(0) invert(1)',
              opacity: '0.9'
            }} 
          />
          <span>SPIN</span> AND WIN
        </div>
      </header>

      <main className="app-container">
        <div className="game-layout">
          {/* Section Gauche : Texte & Formulaire */}
          <div className="intro-section">
            <span className="brand-badge">Offres exclusives</span>
            <h1 className="intro-title">
              Tentez votre chance 
              <span>& Gagnez un cadeau !</span>
            </h1>
            <p className="intro-desc">
              Entrez votre adresse email ci-dessous pour faire tourner la roue.
              Vous pouvez remporter des codes de réduction, la livraison gratuite, des porte-clés et même des t-shirts gratuits !
            </p>

            <div className="glass-panel spin-card">
              {verificationStep === 'input_email' ? (
                <form onSubmit={handleSpinRequest}>
                  <div className="form-group">
                    <label htmlFor="user-email" className="form-label">
                      Adresse e-mail
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Mail 
                        size={18} 
                        style={{ 
                          position: 'absolute', 
                          left: '12px', 
                          color: 'var(--text-secondary)' 
                        }} 
                      />
                      <input
                        id="user-email"
                        type="email"
                        placeholder="exemple@email.com"
                        className="input-field"
                        style={{ paddingLeft: '40px', width: '100%' }}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isSpinning || loading}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn-spin"
                    disabled={isSpinning || loading || !email}
                  >
                    <Play size={18} fill="white" />
                    {loading ? 'Connexion...' : isSpinning ? 'Rotation en cours...' : 'Lancer la roue'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyCodeSubmit}>
                  <div className="form-group">
                    <label htmlFor="verification-code" className="form-label">
                      Code de vérification (6 chiffres)
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        id="verification-code"
                        type="text"
                        maxLength="6"
                        placeholder="123456"
                        className="input-field"
                        style={{ textAlign: 'center', letterSpacing: '0.3rem', fontSize: '1.2rem', width: '100%' }}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        disabled={isSpinning || isVerifying}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
                    <button
                      type="button"
                      className="btn-admin"
                      style={{ flex: 1, padding: '0.85rem 1.2rem', borderRadius: '12px', justifyContent: 'center' }}
                      onClick={() => {
                        setVerificationStep('input_email');
                        setVerificationCode('');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      disabled={isSpinning || isVerifying}
                    >
                      Retour
                    </button>
                    <button
                      type="submit"
                      className="btn-spin"
                      style={{ flex: 2, margin: 0 }}
                      disabled={isSpinning || isVerifying || verificationCode.length !== 6}
                    >
                      <Play size={18} fill="white" />
                      {isVerifying ? 'Vérification...' : 'Valider'}
                    </button>
                  </div>
                </form>
              )}

              {errorMsg && (
                <div className="alert alert-error">
                  <ShieldAlert size={18} />
                  <span>{errorMsg}</span>
                </div>
              )}
              
              {successMsg && !isSpinning && (
                <div className="alert alert-success">
                  <Award size={18} />
                  <span>{successMsg}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section Droite : La Roue */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Wheel
              rewards={rewards}
              isSpinning={isSpinning}
              onSpinFinished={handleSpinFinished}
              winningIndex={winningIndex}
            />
          </div>
        </div>
      </main>

      {/* Modal du résultat final */}
      {rewardWon && (
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          reward={rewardWon}
          couponCode={couponCode}
        />
      )}

      <footer>
        <div className="footer-brand">
          <span>GRIFFIN</span> STORE
        </div>
      </footer>
    </>
  );
}
