export type OpportunityState =
  | 'OBSERVED'
  | 'AT_RISK'
  | 'DIAGNOSED'
  | 'VALUED'
  | 'PRIORITIZED'
  | 'ACTION_DISPATCHED'
  | 'PARTIALLY_RECOVERED'
  | 'RECOVERED'
  | 'FAILED'
  | 'EXPIRED'
  | 'UNRECOVERABLE'
  | 'POLICY_BLOCKED';

export class InvalidStateTransitionException extends Error {
  constructor(currentState: string, targetState: string) {
    super(
      `INVALID_STATE_TRANSITION: Cannot transition opportunity from '${currentState}' to '${targetState}'`,
    );
    this.name = 'InvalidStateTransitionException';
  }
}

export class StateTransitionMatrix {
  private static readonly ALLOWED_TRANSITIONS: Record<
    OpportunityState,
    OpportunityState[]
  > = {
    OBSERVED: ['DIAGNOSED', 'UNRECOVERABLE'],
    AT_RISK: ['DIAGNOSED', 'UNRECOVERABLE'],
    DIAGNOSED: ['VALUED', 'UNRECOVERABLE'],
    VALUED: ['PRIORITIZED', 'POLICY_BLOCKED', 'UNRECOVERABLE'],
    PRIORITIZED: ['ACTION_DISPATCHED', 'POLICY_BLOCKED', 'EXPIRED'],
    ACTION_DISPATCHED: [
      'RECOVERED',
      'PARTIALLY_RECOVERED',
      'FAILED',
      'EXPIRED',
    ],
    PARTIALLY_RECOVERED: [
      'ACTION_DISPATCHED',
      'RECOVERED',
      'FAILED',
      'EXPIRED',
    ],
    RECOVERED: [],
    FAILED: [],
    EXPIRED: [],
    UNRECOVERABLE: [],
    POLICY_BLOCKED: [],
  };

  static isValidTransition(
    currentState: OpportunityState,
    targetState: OpportunityState,
  ): boolean {
    if (currentState === targetState) {
      return true; // No-op idempotent transition
    }

    const allowedTargetStates = this.ALLOWED_TRANSITIONS[currentState] || [];
    return allowedTargetStates.includes(targetState);
  }
}
