import React from 'react';
import { AuditTrailItem } from '../types';
import { X, History } from 'lucide-react';

interface Props {
  opportunityId: string | null;
  auditTrail: AuditTrailItem[];
  loading: boolean;
  onClose: () => void;
}

export const AuditTimelineModal: React.FC<Props> = ({ opportunityId, auditTrail, loading, onClose }) => {
  if (!opportunityId) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155', width: '100%', maxWidth: '650px', padding: '1.5rem', color: '#f8fafc', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={18} color="#a5b4fc" /> Audit Trail — {opportunityId.substring(0, 16)}...
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading audit timeline...</div>
          ) : auditTrail.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No audit records found.</div>
          ) : (
            <div style={{ borderLeft: '2px solid #334155', paddingLeft: '1rem', marginLeft: '0.5rem' }}>
              {auditTrail.map((item, index) => (
                <div key={item.id || index} style={{ marginBottom: '1.25rem', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-1.35rem', top: '0.25rem', width: '0.625rem', height: '0.625rem', borderRadius: '50%', backgroundColor: '#60a5fa' }} />
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {new Date(item.timestamp).toLocaleString()} • <strong style={{ color: '#c084fc' }}>{item.actor}</strong>
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#38bdf8', marginTop: '0.125rem' }}>
                    {item.eventType}
                  </div>
                  {item.userExplanation && (
                    <div style={{ fontSize: '0.8125rem', color: '#cbd5e1', marginTop: '0.25rem', backgroundColor: '#0f172a', padding: '0.5rem', borderRadius: '0.25rem', borderLeft: '3px solid #38bdf8' }}>
                      {item.userExplanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #334155' }}>
          <button
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#334155', color: '#ffffff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
