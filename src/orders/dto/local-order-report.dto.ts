export class LocalOrderReportDto {
  docEntry: number | null;
  itemCode: string | null;
  prodName: string | null;
  u_u_spn: string | null;
  u_u_srn: string | null;
  u_u_durum: string | null;
  u_u_rota: string | null;
  u_u_bant: string | null;
  createDate: string | null; // ISO string olarak tutacağız
  rotaName: string | null;
  lastStatusTime: number | null;   // HHmm formatındaki int
  lastStatusDate: string | null;   // tarih string
  elapsedSeconds: number | null;
  lastUser: string | null;
  startProcessTime: number | null;
  startProcessDate: string | null;
  elapsedSinceStart: number | null;
  lastDurdurmaNedeni: string | null;
}
