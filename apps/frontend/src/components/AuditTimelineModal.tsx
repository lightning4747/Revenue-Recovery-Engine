import React from 'react';
import { AuditTrailItem } from '../types';
import { X, History, Clock } from 'lucide-react';

interface Props {
  opportunityId: string | null;
  auditTrail: AuditTrailItem[];
  loading: boolean;
  onClose: () => void;
}

export const AuditTimelineModal: React.FC<Props> = ({ opportunityId, auditTrail, loading, onClose }) => {
  if (!opportunityId) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid var(--rzp-border)',
          width: '100%',
          maxWidth: '680px',
          padding: '1.75rem',
          color: 'var(--rzp-text-primary)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--rzp-border)',
            paddingBottom: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={20} color="var(--rzp-blue)" /> Audit Trail
            </h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--rzp-text-secondary)' }} className="font-mono">
              Opportunity ID: {opportunityId}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--rzp-text-secondary)',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Timeline Content Area */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--rzp-text-secondary)' }}>
              Loading audit timeline...
            </div>
          ) : auditTrail.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--rzp-text-secondary)' }}>
              No audit event trail recorded for this opportunity.
            </div>
          ) : (
            <div style={{ borderLeft: '2px solid var(--rzp-blue-status-border)', paddingLeft: '1.25rem', marginLeft: '0.75rem' }}>
              {auditTrail.map((item, index) => (
                <div key={item.id || index} style={{ marginBottom: '1.5rem', position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: '-1.625rem',
                      top: '0.25rem',
                      width: '0.75rem',
                      height: '0.75rem',
                      borderRadius: '50%',
                      backgroundColor: 'var(--rzp-blue)',
                      border: '2px solid #ffffff',
                      boxShadow: '0 0 0 2px var(--rzp-blue-status-border)',
                    }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--rzp-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Clock size={12} />
                    {new Date(item.timestamp).toLocaleString()} • <strong style={{ color: 'var(--rzp-purple)' }}>{item.actor}</strong>
                  </div>

                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--rzp-text-primary)', marginTop: '0.25rem' }}>
                    {item.eventType}
                  </div>

                  {item.userExplanation && (
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--rzp-text-primary)',
                        marginTop: '0.375rem',
                        backgroundColor: '#f8fafc',
                        padding: '0.625rem 0.875rem',
                        borderRadius: '0.375rem',
                        borderLeft: '3px solid var(--rzp-blue)',
                        border: '1px solid var(--rzp-border)',
                        borderLeftWidth: '3px',
                      }}
                    >
                      {item.userExplanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--rzp-border)' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#ffffff',
              color: 'var(--rzp-text-primary)',
              border: '1px solid var(--rzp-border)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
