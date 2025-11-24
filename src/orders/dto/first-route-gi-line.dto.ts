// src/orders/dto/first-route-gi-line.dto.ts
export interface FirstRouteGiLine {
  DocEntry: number;
  LineNum: number;
  ItemCode: string;
  Quantity: number;
  WarehouseCode: string;

  IsSerialManaged: string | boolean; // 'Y' / 'N' ya da bool
  ItemName: string;

  MotorOrAlternType?: 'MOTOR' | 'ALTERN' | null;

  // Seri ürünler için:
  SerialNumber?: string | null;
  SysSerialNumber?: number | null;
}
