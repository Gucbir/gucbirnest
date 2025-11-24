// src/orders/dto/order-update.dto.ts
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OrderUpdateDto {
  @IsString()
  @IsNotEmpty()
  U_U_SRN: string;

  @IsOptional()
  @IsString()
  U_U_DURUM?: string;

  @IsOptional()
  @IsString()
  U_U_ROTA?: string;
}
