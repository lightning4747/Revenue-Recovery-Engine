import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.provider';
import * as schema from '../database/schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const existing = await this.db
      .select()
      .from(schema.merchants)
      .where(eq(schema.merchants.email, dto.email));

    if (existing.length > 0) {
      throw new ConflictException('Merchant email already registered');
    }

    const merchantId = `m_${crypto.randomBytes(12).toString('hex')}`;
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      await this.db.insert(schema.merchants).values({
        id: merchantId,
        email: dto.email,
        businessName: dto.businessName,
        passwordHash,
      });
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException('Merchant email already registered');
      }
      throw error;
    }

    const payload = { sub: merchantId, email: dto.email };
    const accessToken = this.jwtService.sign(payload);

    await this.createSessionAuditLog(merchantId, accessToken);

    return { accessToken };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const merchantsFound = await this.db
      .select()
      .from(schema.merchants)
      .where(eq(schema.merchants.email, dto.email));

    if (merchantsFound.length === 0) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const merchant = merchantsFound[0];
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      merchant.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { sub: merchant.id, email: merchant.email };
    const accessToken = this.jwtService.sign(payload);

    await this.createSessionAuditLog(merchant.id, accessToken);

    return { accessToken };
  }

  private async createSessionAuditLog(
    merchantId: string,
    token: string,
  ): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await this.db.insert(schema.userSessions).values({
      merchantId,
      userId: merchantId,
      tokenHash,
      expiresAt,
    });
  }
}
