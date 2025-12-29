// src/material-check/dto/material-check.dto.ts

export class CheckOrderLineMaterialDto {
  parentItemCode: string;
  requestedQty: number;
  fallbackWhsCode: string;
}

export class MaterialShortageItemDto {
  itemCode: string;
  whsCode: string;
  required: number;
  inStock: number;
  missing: number;
  itemName?: string;
  // ✅ 5.* ise alt ürün ağacı (kısıtlı)
  subBom?: any[];
  children?: MaterialShortageItemDto[];
}

export class MaterialCheckResultDto {
  ok: boolean;
  shortages: MaterialShortageItemDto[];
}
