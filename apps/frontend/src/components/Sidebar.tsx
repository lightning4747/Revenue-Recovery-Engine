import React from 'react';
import { Home, CreditCard, RefreshCw, BarChart2, Link2, Shield, Settings, Sliders } from 'lucide-react';

interface Props {
  activeNav: string;
  onNavSelect: (nav: string) => void;
}

export const Sidebar: React.FC<Props> = ({ activeNav, onNavSelect }) => {
  const mainNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'settlements', label: 'Settlements', icon: RefreshCw },
    { id: 'reports', label: 'Reports', icon: BarChart2 },
  ];

  const productItems = [
    { id: 'payment_links', label: 'Payment Links', icon: Link2, badge: 'Active' },
    { id: 'recovery_engine', label: 'Recovery Workflows', icon: Shield },
    { id: 'merchant_policy', label: 'Policy Guardrails', icon: Sliders },
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
      {/* Main Navigation Items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.5rem' }}>
        {mainNavItems.map((item) => {
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
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: isActive ? '#ffffff' : 'transparent',
                color: isActive ? 'var(--rzp-text-primary)' : 'var(--rzp-text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: isActive ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              <Icon size={18} color={isActive ? 'var(--rzp-blue)' : 'var(--rzp-text-secondary)'} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Category Section Header */}
      <div
        style={{
          padding: '0 0.75rem',
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: 'var(--rzp-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
        }}
      >
        PAYMENT PRODUCTS
      </div>

      {/* Product Navigation Items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.5rem' }}>
        {productItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavSelect(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: isActive ? '#ffffff' : 'transparent',
                color: isActive ? 'var(--rzp-text-primary)' : 'var(--rzp-text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: isActive ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Icon size={18} color={isActive ? 'var(--rzp-blue)' : 'var(--rzp-text-secondary)'} />
                {item.label}
              </div>
              {item.badge && (
                <span
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    backgroundColor: 'var(--rzp-green-bg)',
                    color: 'var(--rzp-green)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '9999px',
                    border: '1px solid var(--rzp-green-border)',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Pinned Footer */}
      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--rzp-border)' }}>
        <button
          onClick={() => onNavSelect('settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--rzp-text-secondary)',
            fontWeight: 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
          }}
        >
          <Settings size={18} color="var(--rzp-text-secondary)" />
          Account & Settings
        </button>
      </div>
    </aside>
  );
};
