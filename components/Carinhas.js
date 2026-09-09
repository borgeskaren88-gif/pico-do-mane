'use client';
import React from 'react';

// Humores com carinhas fofas desenhadas à mão (SVG, sem emoji). Cada humor tem
// uma cor pastel e uma expressão própria.
export const HUMORES = [
  ['feliz', 'feliz', '#F2A9BD'],
  ['animada', 'animada', '#F6D45E'],
  ['tranquila', 'tranquila', '#A9D6B4'],
  ['normal', 'normal', '#C3DBDF'],
  ['cansada', 'cansada', '#CBCBB9'],
  ['triste', 'triste', '#9DB8E6'],
  ['ansiosa', 'ansiosa', '#C6B6E2'],
  ['brava', 'brava', '#E58A86'],
  ['surpresa', 'surpresa', '#F3C39C'],
];
export const COR_HUMOR = Object.fromEntries(HUMORES.map(([k, , c]) => [k, c]));
export const LABEL_HUMOR = Object.fromEntries(HUMORES.map(([k, l]) => [k, l]));

// Desenha a carinha de um humor. `size` em px.
export function Carinha({ humor, size = 56 }) {
  const cor = COR_HUMOR[humor] || '#C3DBDF';
  const ink = { fill: 'none', stroke: '#3A2C20', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const dot = (cx, cy) => <circle cx={cx} cy={cy} r="1.7" fill="#3A2C20" />;

  let rosto = null;
  switch (humor) {
    case 'feliz':
      rosto = (<>
        <path d="M14 19 L17 16 L20 19" {...ink} />
        <path d="M24 19 L27 16 L30 19" {...ink} />
        <path d="M18 25 Q22 29 26 25" {...ink} />
      </>); break;
    case 'animada':
      rosto = (<>
        <path d="M15 16 L18 18.5 L15 21" {...ink} />
        <path d="M29 16 L26 18.5 L29 21" {...ink} />
        <path d="M18 25 Q22 29 26 25" {...ink} />
      </>); break;
    case 'tranquila':
      rosto = (<>
        <path d="M14 18 Q17 21 20 18" {...ink} />
        <path d="M24 18 Q27 21 30 18" {...ink} />
        <path d="M19 25 Q22 27 25 25" {...ink} />
      </>); break;
    case 'normal':
      rosto = (<>{dot(17, 18)}{dot(27, 18)}<path d="M19 26 L25 26" {...ink} /></>); break;
    case 'cansada':
      rosto = (<>
        <path d="M14 18 Q17 20 20 18" {...ink} />
        <path d="M24 18 Q27 20 30 18" {...ink} />
        <path d="M19 26 Q22 25 25 26" {...ink} />
      </>); break;
    case 'triste':
      rosto = (<>
        <path d="M14 16.5 Q17 15 20 16.5" {...ink} />
        <path d="M24 16.5 Q27 15 30 16.5" {...ink} />
        <path d="M17 19 Q15.5 22 17 23 Q18.5 22 17 19" fill="#6F9BE0" stroke="none" />
        <path d="M18 28 Q22 25 26 28" {...ink} />
      </>); break;
    case 'ansiosa':
      rosto = (<>{dot(17, 18)}{dot(27, 18)}
        <path d="M17.5 26 q1.5 -2 3 0 q1.5 2 3 0" {...ink} />
        <path d="M32 11 Q30.5 13.5 32 14.5 Q33.5 13.5 32 11" fill="#8FB8E6" stroke="none" />
      </>); break;
    case 'brava':
      rosto = (<>
        <path d="M13 7 L16 2 L19 7 M20.5 6 L23 1 L25.5 6 M27 7 L30 2 L33 7" fill={cor} stroke="none" />
        <path d="M14 15 L19 17" {...ink} />
        <path d="M30 15 L25 17" {...ink} />
        {dot(17, 20)}{dot(27, 20)}
        <path d="M18 28 Q22 25 26 28" {...ink} />
      </>); break;
    case 'surpresa':
      rosto = (<>
        <circle cx="17" cy="18" r="2.3" {...ink} />
        <circle cx="27" cy="18" r="2.3" {...ink} />
        <circle cx="22" cy="27" r="2" {...ink} />
      </>); break;
    default:
      rosto = (<>{dot(17, 18)}{dot(27, 18)}<path d="M19 26 L25 26" {...ink} /></>);
  }

  return (
    <svg width={size} height={size} viewBox="0 0 44 40" style={{ display: 'block' }} aria-hidden="true">
      <rect x="6" y="4" width="32" height="30" rx="14" ry="15" fill={cor} />
      {rosto}
    </svg>
  );
}
