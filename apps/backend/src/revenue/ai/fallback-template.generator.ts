export class FallbackTemplateGenerator {
  static generateFallbackExplanation(
    cause: string,
    source?: string,
    reason?: string,
  ): string {
    const src = source || 'unknown';
    const rsn = reason || 'unspecified_error';
    return `Payment failure classified as ${cause} based on Razorpay error taxonomy (source: ${src}, reason: ${rsn}). Action authorized per merchant policy rules.`;
  }
}
