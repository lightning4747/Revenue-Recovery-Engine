import React from 'react';
import { ShieldCheck, LogOut } from 'lucide-react';

interface Props {
  onLogout: () => void;
}

export const HeaderBanner: React.FC<Props> = ({ onLogout }) => {
  return (
    <header
      style={{
        backgroundColor: 'var(--rzp-topbar)',
        color: '#ffffff',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* Left Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ShieldCheck size={28} color="#2160d5" style={{ fill: '#2160d5', stroke: '#ffffff' }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, fontStyle: 'italic', letterSpacing: '-0.5px', color: '#ffffff' }}>
              Razorpay
            </span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Revenue Recovery Engine
            </span>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={onLogout}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 0.875rem',
            backgroundColor: '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 500,
            transition: 'background 0.2s',
          }}
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </header>
  );
};
