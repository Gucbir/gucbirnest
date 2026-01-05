import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SapService } from '../sap/sap.service';

@Injectable()
export class OpenSalesOrderSyncService {
  private readonly logger = new Logger(OpenSalesOrderSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sap: SapService,
  ) {}

  async syncOpenSalesOrders() {
    this.logger.log('🚀 SAP → Açık siparişler (header+lines) çekiliyor...');
    const orders = await this.sap.getAllOpenSalesOrdersWithLines(50);

    let created = 0;
    let updated = 0;
    let linesUpserted = 0;
    let linesDeleted = 0;

    for (const o of orders) {
      const docEntry = Number(o.DocEntry);
      if (!docEntry || Number.isNaN(docEntry)) continue;

      // 1) Header upsert
      const existing = await this.prisma.openSalesOrder.findUnique({
        where: { docEntry },
        select: { id: true },
      });

      const headerData = {
        docNum: o.DocNum ?? null,
        cardCode: o.CardCode ?? null,
        cardName: o.CardName ?? null,
        docDate: o.DocDate ? new Date(o.DocDate) : null,
        docDueDate: o.DocDueDate ? new Date(o.DocDueDate) : null,
        docTotal: o.DocTotal ?? null,
        docTotalFc: o.DocTotalFc ?? null,
        docCurrency: o.DocCurrency ?? null,
        comments: o.Comments ?? null,
        documentStatus: o.DocumentStatus ?? null,
        cancelled: o.Cancelled ?? null,
        // serialNo'ya dokunmuyoruz
      };

      const saved = await this.prisma.openSalesOrder.upsert({
        where: { docEntry },
        create: {
          docEntry,
          ...headerData,
          serialNo: null,
        },
        update: headerData,
        select: { id: true },
      });

      if (existing) updated++;
      else created++;

      // 2) Lines upsert
      const lines = o.DocumentLines ?? [];
      const seenLineNums: number[] = [];

      for (const ln of lines) {
        const lineNum = Number(ln.LineNum);
        if (Number.isNaN(lineNum)) continue;

        seenLineNums.push(lineNum);

        await this.prisma.openSalesOrderLine.upsert({
          where: {
            orderId_lineNum: {
              orderId: saved.id,
              lineNum,
            },
          },
          create: {
            orderId: saved.id,
            docEntry,
            lineNum,

            itemCode: ln.ItemCode ?? null,
            itemDescription: ln.ItemDescription ?? null,

            quantity: ln.Quantity ?? null,
            unitPrice: ln.Price ?? null,
            currency: ln.Currency ?? null,
            rate: ln.Rate ?? null,

            warehouseCode: ln.WarehouseCode ?? null,

            lineTotal: ln.LineTotal ?? null,
            rowTotalFC: ln.RowTotalFC ?? null,
            rowTotalSC: ln.RowTotalSC ?? null,

            lineStatus: ln.LineStatus ?? null,
            shipDate: ln.ShipDate ? new Date(ln.ShipDate) : null,
          },
          update: {
            itemCode: ln.ItemCode ?? null,
            itemDescription: ln.ItemDescription ?? null,

            quantity: ln.Quantity ?? null,
            unitPrice: ln.Price ?? null,
            currency: ln.Currency ?? null,
            rate: ln.Rate ?? null,

            warehouseCode: ln.WarehouseCode ?? null,

            lineTotal: ln.LineTotal ?? null,
            rowTotalFC: ln.RowTotalFC ?? null,
            rowTotalSC: ln.RowTotalSC ?? null,

            lineStatus: ln.LineStatus ?? null,
            shipDate: ln.ShipDate ? new Date(ln.ShipDate) : null,
            docEntry,
          },
        });

        linesUpserted++;
      }

      // 3) (Opsiyon ama sağlam) SAP’te artık olmayan satırları DB’den sil
      const del = await this.prisma.openSalesOrderLine.deleteMany({
        where: {
          orderId: saved.id,
          lineNum: { notIn: seenLineNums.length ? seenLineNums : [-1] },
        },
      });
      linesDeleted += del.count;
    }

    const result = {
      fetched: orders.length,
      created,
      updated,
      linesUpserted,
      linesDeleted,
    };

    this.logger.log(`✔️ Sync bitti: ${JSON.stringify(result)}`);
    return result;
  }
}
