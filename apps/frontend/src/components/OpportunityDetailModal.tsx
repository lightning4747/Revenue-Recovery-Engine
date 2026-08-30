import React, { useState } from 'react';
import { Opportunity } from '../types';
import { X, ExternalLink, ShieldCheck, PlayCircle, Cpu, AlertCircle, BarChart2 } from 'lucide-react';
import { approveOpportunity } from '../services/api';

interface Props {
  opportunity: Opportunity | null;
  onClose: () => void;
  onRefresh?: () => void;
}

const formatINR = (paise: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
};

const causeDetailsMap: Record<string, { label: string; explanation: string; probability: string; color: string; bg: string }> = {
  CUSTOMER_AUTH_TIMEOUT: {
    label: 'Customer Auth Timeout (3DS OTP Delay)',
    explanation: 'Payment authorization timed out waiting for customer 3DS OTP entry. High recovery potential via payment link.',
    probability: '70% Recovery Confidence',
    color: '#2160d5',
    bg: '#eff6ff',
  },
  INSUFFICIENT_FUNDS: {
    label: 'Insufficient Account Balance',
    explanation: 'Issuing bank declined transaction due to insufficient account balance at time of authorization.',
    probability: '60% Recovery Confidence',
    color: '#9333ea',
    bg: '#f3e8ff',
  },
  BANK_TECHNICAL_OUTAGE: {
    label: 'Issuing Bank Core Outage',
    explanation: 'Core banking network of the issuing bank was temporarily offline during authorization request.',
    probability: '80% Recovery Confidence',
    color: '#d97706',
    bg: '#fffbeb',
  },
  NETWORK_TIMEOUT: {
    label: 'Gateway Latency Timeout',
    explanation: 'Acquiring payment gateway experienced network latency exceeding the 5000ms SLA threshold.',
    probability: '65% Recovery Confidence',
    color: '#2563eb',
    bg: '#eff6ff',
  },
  CARD_INVALID: {
    label: 'Card Invalid / Hard Decline',
    explanation: 'Invalid card number or stolen card flag reported by issuing card network. Unrecoverable failure.',
    probability: '0% Recovery Confidence (Unrecoverable)',
    color: '#dc2626',
    bg: '#fef2f2',
  },
};

export const OpportunityDetailModal: React.FC<Props> = ({ opportunity, onClose, onRefresh }) => {
  const [actionLoading, setActionLoading] = useState(false);

  if (!opportunity) return null;

  const handleApprove = async () => {
    if (!opportunity) return;
    setActionLoading(true);
    try {
      await approveOpportunity(opportunity.id);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to approve opportunity', err);
    } finally {
      setActionLoading(false);
    }
  };

  const causeInfo = causeDetailsMap[opportunity.cause || ''] || {
    label: opportunity.cause || 'Transaction Failure Observed',
    explanation: 'System ingested raw failure event from Razorpay gateway. Executing diagnosis and valuation policy checks.',
    probability: `${Math.round((opportunity.recoveryProbability || 0.5) * 100)}% Recovery Confidence`,
    color: 'var(--rzp-blue)',
    bg: '#f8fafc',
  };

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
          maxWidth: '640px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          color: 'var(--rzp-text-primary)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
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
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--rzp-text-primary)' }}>
              Opportunity Details
            </h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--rzp-text-secondary)' }} className="font-mono">
              ID: {opportunity.id}
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

        {/* AI Root-Cause Diagnosis & Explanation Banner */}
        <div
          style={{
            backgroundColor: causeInfo.bg,
            border: `1px solid ${causeInfo.color}33`,
            borderRadius: '0.5rem',
            padding: '1.25rem',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Cpu size={18} style={{ color: causeInfo.color }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: causeInfo.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              AI Root-Cause Diagnosis
            </span>
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--rzp-text-primary)', marginBottom: '0.375rem' }}>
            {causeInfo.label}
          </div>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: 'var(--rzp-text-secondary)', lineHeight: 1.5 }}>
            {causeInfo.explanation}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: causeInfo.color }}>
              <BarChart2 size={14} /> {causeInfo.probability}
            </span>
            <span style={{ color: 'var(--rzp-text-secondary)' }}>
              Source: {opportunity.sourceType || 'FAILED_PAYMENT'}
            </span>
          </div>
        </div>

        {/* Opportunity Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.25rem',
            backgroundColor: '#f8fafc',
            padding: '1.25rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--rzp-border)',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', textTransform: 'uppercase' }}>
              Status
            </span>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--rzp-blue)', marginTop: '0.25rem' }}>
              {opportunity.status}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', textTransform: 'uppercase' }}>
              Razorpay Order & Payment ID
            </span>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--rzp-text-primary)', marginTop: '0.25rem' }} className="font-mono">
              Order: {opportunity.originalOrderId || 'N/A'}<br />
              Payment: {opportunity.originalTransactionId || 'N/A'}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', textTransform: 'uppercase' }}>
              Original Transaction Amount
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--rzp-text-primary)', marginTop: '0.25rem' }} className="font-mono">
              {formatINR(opportunity.amount)}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', textTransform: 'uppercase' }}>
              Expected Recovery Value (ERV)
            </span>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--rzp-purple)', marginTop: '0.25rem' }} className="font-mono">
              {opportunity.expectedRecoveryValue ? formatINR(opportunity.expectedRecoveryValue) : formatINR(Math.round(opportunity.amount * (opportunity.recoveryProbability || 0.6)))}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', textTransform: 'uppercase' }}>
              Verified Recovered Amount
            </span>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--rzp-green)', marginTop: '0.25rem' }} className="font-mono">
              {formatINR(opportunity.recoveredAmount || 0)}
            </div>
          </div>
        </div>

        {/* Manual Approval & Trigger Button */}
        {(opportunity.status === 'POLICY_BLOCKED' || opportunity.status === 'PRIORITIZED' || opportunity.status === 'VALUED') && (
          <div
            style={{
              backgroundColor: 'var(--rzp-blue-light)',
              padding: '1.25rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--rzp-blue-status-border)',
              marginBottom: '1.25rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--rzp-blue)', marginBottom: '0.75rem' }}>
              Manual Guardrail Override & Recovery Link Trigger
            </div>
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--rzp-blue)',
                color: '#ffffff',
                border: 'none',
                padding: '0.625rem 1.5rem',
                borderRadius: '0.375rem',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(33, 96, 213, 0.3)',
              }}
            >
              <PlayCircle size={18} /> {actionLoading ? 'Dispatching Payment Link...' : 'Approve & Dispatch Payment Link'}
            </button>
          </div>
        )}

        {/* Test Mode Link Sandbox Launch Button */}
        {opportunity.lastPaymentLinkUrl && (
          <div
            style={{
              backgroundColor: 'var(--rzp-green-bg)',
              padding: '1.25rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--rzp-green-border)',
              marginBottom: '1.25rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--rzp-green)', marginBottom: '0.5rem' }}>
              <ShieldCheck size={18} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
              Live Razorpay Hosted Payment Launch Link
            </div>
            <a
              href={opportunity.lastPaymentLinkUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--rzp-green)',
                color: '#ffffff',
                padding: '0.625rem 1.5rem',
                borderRadius: '0.375rem',
                fontWeight: 700,
                fontSize: '0.875rem',
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(6, 143, 68, 0.3)',
              }}
            >
              <ExternalLink size={16} /> Open Razorpay Payment Link
            </a>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--rzp-border)', paddingTop: '1rem' }}>
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
