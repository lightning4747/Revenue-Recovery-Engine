import { TaxonomyMapper } from './taxonomy.mapper';

describe('TaxonomyMapper', () => {
  it('should map invalid_otp to CUSTOMER_AUTH_TIMEOUT with probability 0.75', () => {
    const result = TaxonomyMapper.mapTaxonomy('customer', 'payment_authentication', 'invalid_otp');
    expect(result).toEqual({
      cause: 'CUSTOMER_AUTH_TIMEOUT',
      recoverabilityClass: 'TEMPORARY',
      recoveryProbability: 0.75,
      causeConfidence: 0.95,
    });
  });

  it('should map insufficient_funds to INSUFFICIENT_FUNDS with probability 0.60', () => {
    const result = TaxonomyMapper.mapTaxonomy('bank', 'payment_authorization', 'insufficient_funds');
    expect(result).toEqual({
      cause: 'INSUFFICIENT_FUNDS',
      recoverabilityClass: 'CUSTOMER_ACTION_REQUIRED',
      recoveryProbability: 0.6,
      causeConfidence: 0.9,
    });
  });

  it('should map expired_card to CARD_INVALID with UNRECOVERABLE probability 0.00', () => {
    const result = TaxonomyMapper.mapTaxonomy('customer', 'payment_initiation', 'expired_card');
    expect(result).toEqual({
      cause: 'CARD_INVALID',
      recoverabilityClass: 'UNRECOVERABLE',
      recoveryProbability: 0.0,
      causeConfidence: 0.99,
    });
  });

  it('should fallback to UNKNOWN_LEAKAGE for unrecognized errors', () => {
    const result = TaxonomyMapper.mapTaxonomy('custom', 'unknown_step', 'random_code');
    expect(result).toEqual({
      cause: 'UNKNOWN_LEAKAGE',
      recoverabilityClass: 'UNKNOWN',
      recoveryProbability: 0.3,
      causeConfidence: 0.5,
    });
  });
});
