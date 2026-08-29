import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { FallbackTemplateGenerator } from './fallback-template.generator';

@Injectable()
export class AiExplanationService {
  private readonly logger = new Logger(AiExplanationService.name);
  private readonly aiClient?: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('LLM_API_KEY') || process.env.LLM_API_KEY;
    if (apiKey) {
      try {
        this.aiClient = new GoogleGenAI({ apiKey });
      } catch (err: any) {
        this.logger.warn(`Failed to initialize LLM client: ${err?.message}`);
      }
    }
  }

  async generateExplanation(
    cause: string,
    source?: string,
    reason?: string,
  ): Promise<string> {
    const fallback = FallbackTemplateGenerator.generateFallbackExplanation(
      cause,
      source,
      reason,
    );

    if (!this.aiClient) {
      this.logger.debug(
        'LLM_API_KEY not configured. Returning deterministic fallback explanation.',
      );
      return fallback;
    }

    const prompt = `Provide a concise 1-2 sentence human-readable narrative explanation for a payment recovery system describing why a transaction failed. Technical cause: ${cause}, Error source: ${source || 'N/A'}, Error reason: ${reason || 'N/A'}.`;

    try {
      const llmCallPromise = (async () => {
        const modelName =
          this.configService.get<string>('LLM_MODEL') ||
          process.env.LLM_MODEL ||
          'gemini-2.5-flash';
        const response = await this.aiClient!.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        const text = response?.text?.trim();
        if (!text) {
          throw new Error('Empty response from LLM');
        }
        return text;
      })();

      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('LLM_TIMEOUT_3000MS')), 3000),
      );

      const explanation = await Promise.race([llmCallPromise, timeoutPromise]);
      this.logger.log(`AI_EXPLANATION_GENERATED: "${explanation.substring(0, 80)}..."`);
      return explanation;
    } catch (error: any) {
      this.logger.warn(
        `AI_SERVICE_FALLBACK: LLM call failed or timed out (${error?.message}). Returning deterministic fallback explanation.`,
      );
      return fallback;
    }
  }
}
