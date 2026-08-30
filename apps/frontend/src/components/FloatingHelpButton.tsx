import React from 'react';
import { Activity } from 'lucide-react';

export const FloatingHelpButton: React.FC = () => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 1000,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        backgroundColor: '#ffffff',
        color: 'var(--rzp-text-primary)',
        border: '1px solid var(--rzp-border)',
        padding: '0.5rem 1rem',
        borderRadius: '9999px',
        fontWeight: 600,
        fontSize: '0.8125rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      }}
    >
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--rzp-green)', display: 'inline-block' }} />
      <Activity size={14} color="var(--rzp-green)" />
      RRE Engine: Active
    </div>
  );
};
