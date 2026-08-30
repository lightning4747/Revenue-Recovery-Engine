import React from 'react';
import { LayoutDashboard, Sliders, ShieldCheck } from 'lucide-react';

interface Props {
  activeNav: string;
  onNavSelect: (nav: string) => void;
}

export const Sidebar: React.FC<Props> = ({ activeNav, onNavSelect }) => {
  const navItems = [
    { id: 'queue', label: 'Recovery Queue', icon: LayoutDashboard },
    { id: 'policy', label: 'Policy Guardrails', icon: Sliders },
  ];

  return (
    <aside
      style={{
        width: '224px',
        backgroundColor: 'var(--rzp-sidebar)',
        borderRight: '1px solid var(--rzp-border)',
        position: 'fixed',
        top: '56px',
        bottom: 0,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem 0.75rem',
        overflowY: 'auto',
        zIndex: 900,
      }}
    >
      {/* Section Header */}
      <div
        style={{
          padding: '0 0.75rem',
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: 'var(--rzp-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.75rem',
        }}
      >
        CONTROL TOWER
      </div>

      {/* Navigation Items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavSelect(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.625rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: isActive ? '#ffffff' : 'transparent',
                color: isActive ? 'var(--rzp-blue)' : 'var(--rzp-text-primary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              <Icon size={18} color={isActive ? 'var(--rzp-blue)' : 'var(--rzp-text-secondary)'} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom Information Box */}
      <div
        style={{
          marginTop: 'auto',
          padding: '0.875rem',
          backgroundColor: '#ffffff',
          borderRadius: '0.5rem',
          border: '1px solid var(--rzp-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <ShieldCheck size={16} color="var(--rzp-green)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--rzp-text-primary)' }}>
            MVP Ledger Verification
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--rzp-text-secondary)', lineHeight: 1.4 }}>
          Transactions locked & verified via Razorpay payment webhooks & ledger state machine.
        </p>
      </div>
    </aside>
  );
};
