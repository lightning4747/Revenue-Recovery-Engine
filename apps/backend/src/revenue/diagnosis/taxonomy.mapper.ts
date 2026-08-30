export interface DiagnosisTaxonomy {
  cause: string;
  recoverabilityClass:
    | 'TEMPORARY'
    | 'CUSTOMER_ACTION_REQUIRED'
    | 'PAYMENT_INSTRUMENT_INVALID'
    | 'BANK_GATEWAY_FAILURE'
    | 'UNRECOVERABLE'
    | 'UNKNOWN';
  recoveryProbability: number;
  causeConfidence: number;
  strategy: string;
}

export class TaxonomyMapper {
  static mapTaxonomy(
    source?: string,
    step?: string,
    reason?: string,
  ): DiagnosisTaxonomy {
    const src = (source || '').toLowerCase().replace(/ /g, '_');
    const stp = (step || '').toLowerCase().replace(/ /g, '_');
    const rsn = (reason || '').toLowerCase().replace(/ /g, '_');

    // 1. Unrecoverable / Invalid Payment Instruments
    if (
      rsn.includes('expired_card') ||
      rsn.includes('card_invalid') ||
      rsn.includes('stolen_card') ||
      rsn.includes('blacklisted')
    ) {
      return {
        cause: 'CARD_INVALID',
        recoverabilityClass: 'UNRECOVERABLE',
        recoveryProbability: 0.0,
        causeConfidence: 0.99,
        strategy: 'Hard Decline Policy Guard (Unrecoverable)',
      };
    }

    // 2. Customer Authentication Timeouts / Verification Errors
    if (
      rsn.includes('invalid_otp') ||
      rsn.includes('auth_failed') ||
      rsn.includes('verification_failed') ||
      (src === 'customer' && stp.includes('authentication'))
    ) {
      return {
        cause: 'CUSTOMER_AUTH_TIMEOUT',
        recoverabilityClass: 'TEMPORARY',
        recoveryProbability: 0.75,
        causeConfidence: 0.95,
        strategy: '1-Click Pre-Filled 3DS Re-Authentication',
      };
    }

    // 3. Insufficient Funds / Customer Action Required
    if (
      rsn.includes('insufficient_funds') ||
      rsn.includes('limit_exceeded') ||
      rsn.includes('user_cancelled')
    ) {
      return {
        cause: 'INSUFFICIENT_FUNDS',
        recoverabilityClass: 'CUSTOMER_ACTION_REQUIRED',
        recoveryProbability: 0.6,
        causeConfidence: 0.9,
        strategy: 'Partial Payment & Flexible Schedule Auth',
      };
    }

    // 4. Network / Transport Timeouts
    if (rsn.includes('timeout') || rsn.includes('network_error')) {
      return {
        cause: 'NETWORK_TIMEOUT',
        recoverabilityClass: 'TEMPORARY',
        recoveryProbability: 0.65,
        causeConfidence: 0.8,
        strategy: 'Acquiring Gateway Reroute & Instant Re-Trigger',
      };
    }

    // 5. Bank Gateway Outages / Technical Errors
    if (
      src === 'bank' ||
      rsn.includes('gateway_error') ||
      rsn.includes('system_error') ||
      stp.includes('issuer_bank') ||
      rsn.includes('bank_technical_error')
    ) {
      return {
        cause: 'BANK_TECHNICAL_OUTAGE',
        recoverabilityClass: 'BANK_GATEWAY_FAILURE',
        recoveryProbability: 0.7,
        causeConfidence: 0.85,
        strategy: 'Issuing Bank Telemetry Monitoring & Smart Retry',
      };
    }

    // 6. Unknown / Unclassified Failure Fallback
    return {
      cause: 'UNKNOWN_LEAKAGE',
      recoverabilityClass: 'UNKNOWN',
      recoveryProbability: 0.3,
      causeConfidence: 0.5,
      strategy: 'Manual Recon Audit & Policy Review',
    };
  }
}
