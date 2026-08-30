import React from 'react';
import { ShieldCheck, LogOut, Sliders } from 'lucide-react';

interface Props {
  onLogout: () => void;
  onOpenPolicyModal: () => void;
}

export const Topbar: React.FC<Props> = ({ onLogout, onOpenPolicyModal }) => {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        backgroundColor: 'var(--rzp-topbar)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        zIndex: 1000,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Left Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ShieldCheck size={26} color="#2160d5" style={{ fill: '#2160d5', stroke: '#ffffff' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, fontStyle: 'italic', letterSpacing: '-0.5px' }}>
            Razorpay
          </span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Revenue Recovery Control Tower
          </span>
        </div>
      </div>

      {/* Centered Test Mode Badge Pill */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          top: 0,
          backgroundColor: '#1f2937',
          borderBottomLeftRadius: '0.75rem',
          borderBottomRightRadius: '0.75rem',
          padding: '0.25rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          border: '1px solid #374151',
          borderTop: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px', color: '#e5e7eb' }}>
          TEST MODE ENABLED
        </span>
      </div>

      {/* Right Controls: Policy Configuration & Sign Out */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={onOpenPolicyModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.375rem 0.875rem',
            backgroundColor: '#1f2937',
            color: '#38bdf8',
            border: '1px solid #374151',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 600,
            transition: 'background 0.2s',
          }}
        >
          <Sliders size={14} /> Merchant Policy
        </button>

        <button
          onClick={onLogout}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.375rem 0.875rem',
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
