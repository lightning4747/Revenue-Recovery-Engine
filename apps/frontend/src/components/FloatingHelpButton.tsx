import React from 'react';
import { HelpCircle } from 'lucide-react';

export const FloatingHelpButton: React.FC = () => {
  return (
    <button
      onClick={() => alert('Razorpay Merchant Support & Documentation: Contact support@razorpay.com or view RRE documentation.')}
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 1000,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        backgroundColor: 'var(--rzp-support)',
        color: '#ffffff',
        border: 'none',
        padding: '0.625rem 1.25rem',
        borderRadius: '9999px',
        fontWeight: 600,
        fontSize: '0.875rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--rzp-support-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--rzp-support)')}
    >
      <HelpCircle size={18} color="#ffffff" />
      Help & Support
    </button>
  );
};
