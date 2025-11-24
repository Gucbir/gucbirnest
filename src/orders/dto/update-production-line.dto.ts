// src/orders/dto/update-production-line.dto.ts
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateProductionLineDto {
  @IsInt()
  @Min(1)
  DocEntry: number;

  @IsString()
  @IsNotEmpty()
  ProductionLine: string;

  @IsOptional()
  @IsString()
  UserName?: string;
}
