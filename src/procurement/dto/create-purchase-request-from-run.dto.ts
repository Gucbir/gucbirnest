import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreatePurchaseRequestFromRunDto {
  @Type(() => Number)
  @IsInt()
  runId: number;

  @IsOptional()
  @IsBoolean()
  includeChildren?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
