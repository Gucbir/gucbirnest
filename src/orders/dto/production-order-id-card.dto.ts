// src/orders/dto/production-order-id-card.dto.ts
import { IsInt, Min } from 'class-validator';

export class ProductionOrderIdCardInfoRequestDto {
  @IsInt()
  @Min(1)
  DocEntry: number;
}

export class ProductionOrderIdCardInfoDto {
  ProdOrderDocEntry: number;
  SalesOrderDocEntry: number;

  U_U_SRN?: string;
  U_U_MM?: string;
  U_U_MSR?: string;
  U_U_ALM?: string;
  U_U_ALTSR?: string;
  U_U_SPN?: string;

  U_KABIN?: string;
  U_ATS?: string;
  U_TMS?: string;
  U_ACIKLAMA?: string;
  U_FB_A?: string;
  U_UPEX_Items_Text?: string;
  Text?: string;

  Description?: string;
}
