// src/sales-orders/dto/open-sales-order.dto.ts

export interface OpenSalesOrderSlRow {
  DocDate: string;
  DocDueDate: string;
  DocNum: number;
  CardCode: string;
  CardName: string;
  DocTotal: number;
  DocTotalFc: number;
  DocCur: string;
  Cancelled: string;
  DocumentStatus: string;
}

export interface SqlQueryResponse<T> {
  value: T[];
}

// Frontend'e daha okunur camelCase gönderelim istersen:
export interface OpenSalesOrderDto {
  docDate: string;
  docDueDate: string;
  docNum: number;
  cardCode: string;
  cardName: string;
  docTotal: number;
  docTotalFC: number;
  docCur: string;
  canceled: string;
  docStatus: string;
}
