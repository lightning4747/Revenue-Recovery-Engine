import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdatePolicyDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  minRecoveryAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRetryCount?: number;

  @IsOptional()
  @IsBoolean()
  autoExecutionEnabled?: boolean;
}
