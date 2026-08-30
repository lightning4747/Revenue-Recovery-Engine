export interface DashboardSummary {
  revenueAtRiskPaise: number;
  expectedRecoverablePaise: number;
  verifiedRecoveredPaise: number;
  activeOpportunitiesCount: number;
  totalOpportunitiesCount: number;
  recoveryRatePercentage: number;
}

export interface Opportunity {
  id: string;
  merchantId: string;
  sourceType: string;
  sourceId?: string;
  amount: number;
  currency: string;
  status: string;
  cause?: string;
  recoveryProbability?: number;
  expectedRecoveryValue?: number;
  priorityScore?: number;
  attemptCount: number;
  recoveredAmount: number;
  remainingAmount: number;
  lastPaymentLinkId?: string;
  lastPaymentLinkUrl?: string;
  lastReferenceId?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditTrailItem {
  id: string;
  eventType: string;
  actor: string;
  userExplanation: string | null;
  timestamp: string;
}

export interface MerchantPolicy {
  merchantId?: string;
  minRecoveryAmountPaise: number;
  maxRetryCount: number;
  autoExecutionEnabled: boolean;
}

export interface MerchantCredentials {
  keyId?: string;
  hasKeySecret?: boolean;
  hasWebhookSecret?: boolean;
}
