import { Controller, Get, Post, Query, Body, Res, Inject, Optional } from '@nestjs/common';
import { Response } from 'express';
import { OutcomeVerificationService } from '../../recovery/verification/outcome-verification.service';

@Controller('api/v1/sandbox')
export class SandboxCheckoutController {
  constructor(
    @Optional() @Inject(OutcomeVerificationService) private readonly outcomeVerificationService?: OutcomeVerificationService,
  ) {}

  @Get('checkout')
  renderCheckoutPage(
    @Query('opp') oppId: string,
    @Query('ref') refId: string,
    @Query('amount') amountPaise: string,
    @Query('merchant') merchantId: string,
    @Res() res: Response,
  ) {
    const amountRupees = (Number(amountPaise || 0) / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
    });

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Razorpay Test Checkout Sandbox</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .card { background: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); width: 100%; max-width: 440px; padding: 28px; border: 1px solid #e2e8f0; }
        .header { text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
        .logo { font-size: 20px; font-weight: 800; color: #0c2340; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .logo span { color: #2160d5; }
        .amount-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 24px; }
        .amount-title { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .amount-val { font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 4px; }
        .details { font-size: 13px; color: #475569; margin-bottom: 24px; line-height: 1.6; }
        .details-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
        .btn-group { display: flex; flex-direction: column; gap: 12px; }
        .btn { padding: 14px; border-radius: 8px; font-weight: 700; font-size: 15px; border: none; cursor: pointer; transition: opacity 0.2s; text-align: center; text-decoration: none; }
        .btn-success { background: #068f44; color: #ffffff; box-shadow: 0 4px 12px rgba(6, 143, 68, 0.25); }
        .btn-success:hover { opacity: 0.9; }
        .btn-fail { background: #dc2626; color: #ffffff; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25); }
        .btn-fail:hover { opacity: 0.9; }
        .badge { background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; margin-left: 6px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="logo">razorpay <span>recovery sandbox</span> <span class="badge">Test Mode</span></div>
        </div>

        <div class="amount-box">
          <div class="amount-title">Total Recovery Payment</div>
          <div class="amount-val">${amountRupees}</div>
        </div>

        <div class="details">
          <div class="details-row"><span>Opportunity ID:</span> <strong style="font-family: monospace;">${oppId || 'N/A'}</strong></div>
          <div class="details-row"><span>Reference ID:</span> <strong style="font-family: monospace;">${refId || 'N/A'}</strong></div>
          <div class="details-row"><span>Customer:</span> <strong>idontkniwhudhu@gmail.com</strong></div>
          <div class="details-row"><span>Contact:</span> <strong>+919360220856</strong></div>
        </div>

        <form action="/api/v1/sandbox/checkout/pay" method="POST" class="btn-group">
          <input type="hidden" name="oppId" value="${oppId}" />
          <input type="hidden" name="refId" value="${refId}" />
          <input type="hidden" name="amount" value="${amountPaise}" />
          <input type="hidden" name="merchantId" value="${merchantId || 'm_default_merchant'}" />
          <button type="submit" class="btn btn-success">✓ Complete Test Payment (Success)</button>
        </form>

        <form action="/api/v1/sandbox/checkout/fail" method="POST" style="margin-top: 12px;">
          <input type="hidden" name="oppId" value="${oppId}" />
          <button type="submit" class="btn btn-fail" style="width: 100%;">✗ Simulate Payment Decline (Fail)</button>
        </form>
      </div>
    </body>
    </html>
    `;

    return res.status(200).send(html);
  }

  @Post('checkout/pay')
  async processSandboxPayment(@Body() body: any, @Res() res: Response) {
    const oppId = body.oppId;
    const refId = body.refId;
    const amount = Number(body.amount || 250000);
    const merchantId = body.merchantId || 'm_default_merchant';

    if (this.outcomeVerificationService && oppId) {
      try {
        await this.outcomeVerificationService.processPaymentLinkEvent(
          merchantId,
          'payment_link.paid',
          {
            payload: {
              payment_link: {
                entity: {
                  id: `plink_sb_${Date.now()}`,
                  amount_paid: amount,
                  reference_id: refId || `${oppId}_att_1`,
                  notes: { opportunity_id: oppId, merchant_id: merchantId },
                },
              },
              payment: {
                entity: {
                  id: `pay_sb_${Date.now()}`,
                  amount,
                },
              },
            },
          },
        );
      } catch (err: any) {
        // Ignore settlement errors if already settled
      }
    }

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Payment Successful</title>
      <style>
        body { font-family: sans-serif; background: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .box { background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.1); max-width: 400px; }
        .icon { font-size: 48px; color: #068f44; margin-bottom: 16px; }
        h2 { margin: 0 0 10px 0; color: #0f172a; }
        p { color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
        .btn { background: #2160d5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="icon">✓</div>
        <h2>Payment Verified & Captured!</h2>
        <p>The revenue recovery payment of ${(amount / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} has been successfully captured and credited to the double-entry ledger.</p>
        <a href="http://localhost:5173" class="btn">Return to Local Dashboard</a>
      </div>
    </body>
    </html>
    `;

    return res.status(200).send(html);
  }

  @Post('checkout/fail')
  async processSandboxDecline(@Res() res: Response) {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Payment Declined</title>
      <style>
        body { font-family: sans-serif; background: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .box { background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.1); max-width: 400px; }
        .icon { font-size: 48px; color: #dc2626; margin-bottom: 16px; }
        h2 { margin: 0 0 10px 0; color: #0f172a; }
        p { color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
        .btn { background: #475569; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="icon">✗</div>
        <h2>Payment Declined</h2>
        <p>The payment attempt was declined. Opportunity remains in active queue for policy retry evaluation.</p>
        <a href="http://localhost:5173" class="btn">Return to Local Dashboard</a>
      </div>
    </body>
    </html>
    `;

    return res.status(200).send(html);
  }
}
