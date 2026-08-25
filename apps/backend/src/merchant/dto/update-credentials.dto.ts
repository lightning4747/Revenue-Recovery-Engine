import { IsString, Matches, MinLength } from 'class-validator';

export class UpdateCredentialsDto {
  @IsString()
  @Matches(/^rzp_(test|live)_[a-zA-Z0-9_-]+$/, {
    message: 'keyId must start with rzp_test_ or rzp_live_',
  })
  keyId!: string;

  @IsString()
  @MinLength(8)
  keySecret!: string;

  @IsString()
  @MinLength(8)
  webhookSecret!: string;
}
