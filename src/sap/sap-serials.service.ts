import { Injectable } from '@nestjs/common';
import { SapService } from './sap.service'; // sende adı farklıysa düzelt
import { PrismaService } from '../prisma/prisma.service'; // sende yol farklıysa düzelt

@Injectable()
export class SapSerialsService {
  constructor(
    private readonly sap: SapService,
    private readonly prisma: PrismaService,
  ) {}

  // senin SL’de doğru çalışan param formatı:
  // 1 param:  ItemCode='...'
  // 2 param:  ItemCode='...'&WhsCode='...'
  private escapeParam(v: string) {
    return String(v ?? '')
      .trim()
      .replace(/'/g, "''");
  }

  async getSerialWarehousesByItem(itemCode: string) {
    const code = this.escapeParam(itemCode);

    const body: any = {
      ParamList: `ItemCode='${code}'`,
      QueryOption: `$top=200&$skip=0`,
    };

    const res: any = await this.sap.post(
      `SQLQueries('SerialWarehousesByItem')/List`,
      body,
    );

    const rows: any[] = res?.value ?? [];
    rows.sort((a, b) => Number(b?.Qty ?? 0) - Number(a?.Qty ?? 0));

    // ✅ DB’den depo adlarını çek (tek sorgu)
    const whsCodes = rows.map((r) => String(r.WhsCode));
    const whs = await this.prisma.warehouse.findMany({
      where: { WhsCode: { in: whsCodes } },
      select: { WhsCode: true, WhsName: true },
    });
    const nameMap = new Map(whs.map((w) => [w.WhsCode, w.WhsName]));

    return rows.map((r) => {
      const WhsCode = String(r.WhsCode);
      return {
        WhsCode,
        WhsName: nameMap.get(WhsCode) ?? null, // yoksa null
        Qty: Number(r.Qty ?? 0),
      };
    });
  }

  async getAvailableSerialsByItemWhs(itemCode: string, whsCode: string) {
    const code = this.escapeParam(itemCode);
    const whs = this.escapeParam(whsCode);

    // ✅ kritik: ParamList ayırıcı & (senin ortamda çalıştı)
    const body: any = {
      ParamList: `ItemCode='${code}'&WhsCode='${whs}'`,
      QueryOption: `$top=200&$skip=0`,
    };

    const res: any = await this.sap.post(
      `SQLQueries('AvailableSerialsByItemWhs')/List`,
      body,
    );

    const rows: any[] = res?.value ?? [];

    return rows.map((r) => ({
      ItemCode: String(r.ItemCode ?? itemCode),
      SerialNo: String(r.SerialNo),
      WhsCode: String(r.WhsCode ?? whsCode),
      Qty: Number(r.Qty ?? 0),
    }));
  }
}
