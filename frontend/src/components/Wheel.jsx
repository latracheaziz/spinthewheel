import React, { useState, useEffect, useRef } from 'react';
import '../styles/wheel.css';

const COLORS = [
  '#7c3aed', // Violet royal
  '#db2777', // Rose profond
  '#ea580c', // Orange cuivré
  '#0d9488', // Turquoise sombre
  '#2563eb', // Bleu électrique
  '#ca8a04', // Or foncé
  '#e11d48', // Rouge rubis
  '#16a34a'  // Vert émeraude
];

export default function Wheel({ rewards, isSpinning, onSpinFinished, winningIndex }) {
  const [rotation, setRotation] = useState(0);
  const [localSpinning, setLocalSpinning] = useState(false);
  const [spinCount, setSpinCount] = useState(1);
  const svgRef = useRef(null);

  // Filtrer uniquement les récompenses actives pour l'affichage sur la roue
  const activeRewards = rewards.filter(r => r.active === 1);
  const N = activeRewards.length;
  const angleStep = N > 0 ? 360 / N : 0;

  // Positionner les LEDs sur le pourtour (rayon ~205px par rapport à un centre virtuel)
  const [leds, setLeds] = useState([]);
  useEffect(() => {
    const tempLeds = [];
    const numLeds = 24;
    for (let i = 0; i < numLeds; i++) {
      const angle = (i * 360) / numLeds;
      const rad = (angle * Math.PI) / 180;
      // Rayon relatif au pourcentage de la roue
      const x = 50 + 51 * Math.cos(rad); // en % du conteneur parent
      const y = 50 + 51 * Math.sin(rad); // en % du conteneur parent
      tempLeds.push({ id: i, x, y });
    }
    setLeds(tempLeds);
  }, []);

  // Déclencher la rotation quand winningIndex change et que le spin est actif
  useEffect(() => {
    if (isSpinning && winningIndex !== null && winningIndex !== -1 && N > 0) {
      setLocalSpinning(true);
      
      // Trouver l'index de la récompense gagnante dans le tableau filtré des récompenses actives
      const winningReward = rewards[winningIndex];
      const activeWinningIndex = activeRewards.findIndex(r => r.id === winningReward.id);

      if (activeWinningIndex !== -1) {
        // Angle médian du secteur gagnant (rappel : 0 deg commence à 3h, va dans le sens horaire)
        const midAngle = (activeWinningIndex * angleStep) + (angleStep / 2);
        
        // Pour aligner le milieu du segment gagnant au pointeur qui est en haut (12h, soit 270 deg) :
        // midAngle + rotation = 270 => rotation = 270 - midAngle.
        const stopAngle = 270 - midAngle;
        
        // Accumuler plusieurs tours complets pour un effet visuel saisissant
        const totalRot = (spinCount * 360 * 5) + stopAngle;
        
        setRotation(totalRot);
        setSpinCount(prev => prev + 1);
      }
    }
  }, [isSpinning, winningIndex, N]);

  const handleTransitionEnd = () => {
    setLocalSpinning(false);
    if (isSpinning) {
      onSpinFinished();
    }
  };

  // Fonction pour raccourcir les textes trop longs pour l'affichage sur la roue
  const getShortName = (fullName) => {
    const nameLower = fullName.toLowerCase();
    if (nameLower.includes('pas de chance')) return 'Pas de chance';
    if (nameLower.includes('prochaine') || nameLower.includes('essaie')) return 'Essaie encore';
    if (nameLower.includes('50%')) return '50% s/ 3e achat';
    if (nameLower.includes('15%')) return '15% de Réduc.';
    if (nameLower.includes('10%')) return '10% de Réduc.';
    if (nameLower.includes('5%')) return '5% de Réduc.';
    if (nameLower.includes('livraison')) return 'Livr. Gratuite';
    if (nameLower.includes('porte-clés') || nameLower.includes('porte-cles')) return 'Porte-Clés';
    if (nameLower.includes('t-shirt')) return 'T-Shirt Offert';
    if (nameLower.includes('5 dt')) return 'Bon 5 DT';
    if (nameLower.includes('10 dt')) return 'Bon 10 DT';
    return fullName;
  };

  // Rendu des segments de la roue en SVG
  const renderSegments = () => {
    const paths = [];
    const lines = [];
    const texts = [];
    const C = 200; // Centre SVG
    const R = 190; // Rayon

    for (let i = 0; i < N; i++) {
      const startAngle = i * angleStep;
      const endAngle = (i + 1) * angleStep;
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      // Calcul des coordonnées du contour de l'arc
      const x1 = C + R * Math.cos(startRad);
      const y1 = C + R * Math.sin(startRad);
      const x2 = C + R * Math.cos(endRad);
      const y2 = C + R * Math.sin(endRad);

      const d = `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`;
      const color = COLORS[i % COLORS.length];

      // Calcul de l'angle du texte (médian)
      const textAngle = startAngle + angleStep / 2;
      
      // Obtenir la version abrégée du texte pour la roue
      const displayName = getShortName(activeRewards[i].name);

      // 1. Ajouter le secteur de couleur
      paths.push(
        <path 
          key={`path-${activeRewards[i].id}`}
          d={d} 
          fill={color} 
          stroke="rgba(0,0,0,0.15)" 
          strokeWidth="2"
        />
      );

      // 2. Ajouter la ligne séparatrice
      lines.push(
        <line 
          key={`line-${activeRewards[i].id}`}
          x1={C} y1={C} x2={x1} y2={y1} 
          stroke="rgba(255, 255, 255, 0.25)" 
          strokeWidth="1.5"
        />
      );

      // 3. Ajouter le texte au-dessus du secteur
      texts.push(
        <text
          key={`text-${activeRewards[i].id}`}
          x={C + 178} // Décalage optimal vers l'extérieur
          y={C}
          className="wheel-segment-text"
          textAnchor="end"
          dominantBaseline="middle"
          transform={`rotate(${textAngle}, ${C}, ${C})`}
        >
          {displayName}
        </text>
      );
    }

    return (
      <g>
        {/* Chemins de couleur (fond) */}
        <g id="wheel-paths">{paths}</g>
        {/* Lignes séparatrices (milieu) */}
        <g id="wheel-lines">{lines}</g>
        {/* Textes (premier plan, garantit qu'aucun texte n'est masqué) */}
        <g id="wheel-texts">{texts}</g>
      </g>
    );
  };

  return (
    <div className="wheel-container">
      {/* LEDs lumineuses décoratives */}
      {leds.map(led => (
        <div
          key={led.id}
          className="wheel-led"
          style={{
            left: `${led.x}%`,
            top: `${led.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        />
      ))}

      {/* Flèche pointeur dorée en haut */}
      <div className="wheel-pointer">
        <svg viewBox="0 0 36 44" fill="none" className="wheel-pointer-svg">
          <path 
            d="M18 44L0 8C0 8 4 0 18 0C32 0 36 8 36 8L18 44Z" 
            fill="url(#pointer-gradient)" 
          />
          <path 
            d="M18 36L4 8C4 8 7.5 2 18 2C28.5 2 32 8 32 8L18 36Z" 
            fill="#f59e0b" 
          />
          <circle cx="18" cy="12" r="4" fill="#ffffff" />
          <defs>
            <linearGradient id="pointer-gradient" x1="18" y1="0" x2="18" y2="44" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fbbf24" />
              <stop offset="1" stopColor="#d97706" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* La roue interactive */}
      <div className={`wheel-outer ${localSpinning ? 'spinning' : ''}`}>
        <div className="wheel-svg-wrapper">
          {N > 0 ? (
            <svg
              ref={svgRef}
              viewBox="0 0 400 400"
              className="wheel-svg"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: localSpinning 
                  ? 'transform 6000ms cubic-bezier(0.1, 0.8, 0.1, 1)' 
                  : 'none'
              }}
              onTransitionEnd={handleTransitionEnd}
            >
              {renderSegments()}
              {/* Cercle de bordure intérieur */}
              <circle cx="200" cy="200" r="190" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
            </svg>
          ) : (
            <div style={{ color: 'white', textAlign: 'center', marginTop: '45%' }}>
              Chargement de la roue...
            </div>
          )}
        </div>

        {/* Centre de la roue (moyeu fixe / décoratif) */}
        <div className="wheel-center">
          <div className="wheel-center-inner">
            Spin!
          </div>
        </div>
      </div>
    </div>
  );
}
