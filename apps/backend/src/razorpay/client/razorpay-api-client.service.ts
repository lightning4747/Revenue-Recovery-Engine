import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

export interface RazorpayPaymentLinkPayload {
  amount: number;
  currency: string;
  accept_partial: boolean;
  reference_id: string;
  description?: string;
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, any>;
}

export interface RazorpayPaymentLinkResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  reference_id: string;
  short_url: string;
  notes?: Record<string, any>;
  [key: string]: any;
}

@Injectable()
export class RazorpayApiClientService {
  private readonly logger = new Logger(RazorpayApiClientService.name);

  constructor(private readonly httpService: HttpService) {}

  async createPaymentLink(
    credentials: { keyId: string; keySecret: string },
    payload: RazorpayPaymentLinkPayload,
  ): Promise<RazorpayPaymentLinkResponse> {
    const authHeader = `Basic ${Buffer.from(
      `${credentials.keyId}:${credentials.keySecret}`,
    ).toString('base64')}`;

    try {
      const response$ = this.httpService.post<RazorpayPaymentLinkResponse>(
        'https://api.razorpay.com/v1/payment_links',
        payload,
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      const response = await firstValueFrom(response$);
      this.logger.log(
        `RAZORPAY_PAYMENT_LINK_CREATED: Created Payment Link ${response.data.id} (short_url: ${response.data.short_url}, ref_id: ${response.data.reference_id})`,
      );
      return response.data;
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.error?.description ||
        error?.response?.data?.message ||
        error?.message ||
        'Unknown Razorpay API Error';
      this.logger.error(
        `RAZORPAY_API_CLIENT_ERROR: Failed to create payment link for ref_id ${payload.reference_id}: ${errorMsg}`,
      );
      throw new Error(`RAZORPAY_API_ERROR: ${errorMsg}`);
    }
  }
}
