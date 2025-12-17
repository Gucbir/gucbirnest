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
    this.logger.log('SAP → Açık satış siparişleri çekiliyor...');

    const orders = await this.sap.getOpenSalesOrders();

    let created = 0;
    let updated = 0;

    for (const o of orders) {
      const exists = await this.prisma.openSalesOrder.findUnique({
        where: { docEntry: o.DocEntry },
      });

      if (exists) {
        await this.prisma.openSalesOrder.update({
          where: { docEntry: o.DocEntry },
          data: {
            docNum: o.DocNum ?? null,
            cardCode: o.CardCode ?? null,
            cardName: o.CardName ?? null,
            docDate: o.DocDate ? new Date(o.DocDate) : null,
            docDueDate: o.DocDueDate ? new Date(o.DocDueDate) : null,
            docTotal: o.DocTotal ?? null,
            docTotalFc: o.DocTotalFc ?? null,
            docCurrency: o.DocCurrency ?? null,
            comments: o.Comments ?? null,
            documentStatus: o.DocStatus ?? null,
            cancelled: o.CANCELED ?? null,
          },
        });
        updated++;
      } else {
        await this.prisma.openSalesOrder.create({
          data: {
            docEntry: o.DocEntry,
            docNum: o.DocNum ?? null,
            cardCode: o.CardCode ?? null,
            cardName: o.CardName ?? null,
            docDate: o.DocDate ? new Date(o.DocDate) : null,
            docDueDate: o.DocDueDate ? new Date(o.DocDueDate) : null,
            docTotal: o.DocTotal ?? null,
            docTotalFc: o.DocTotalFC ?? null,
            docCurrency: o.DocCurrency ?? null,
            comments: o.Comments ?? null,
            documentStatus: o.DocStatus ?? null,
            cancelled: o.CANCELED ?? null,
            serialNo: null,
          },
        });
        created++;
      }
    }

    return {
      fetched: orders.length,
      created,
      updated,
    };
  }
}
