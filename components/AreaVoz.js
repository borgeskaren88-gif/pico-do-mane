'use client';
import React from 'react';
import { Area } from './ui';
import MicBtn from './MicBtn';

// Caixa de texto com botão de ditado por voz embaixo.
export default function AreaVoz({ value, onChange, placeholder, rows }) {
  return (
    <div>
      <Area value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
      <MicBtn value={value} onChange={onChange} label="Ditar por voz" />
    </div>
  );
}
