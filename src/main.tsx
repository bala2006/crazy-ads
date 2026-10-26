import React from 'react';
import { createRoot } from 'react-dom/client';
// Bundled UI font (same files the renderer uses) — works on images without system fonts.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import App from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
