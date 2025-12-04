import { Injectable, Logger } from '@nestjs/common';
import { SapService } from '../sap/sap.service';

@Injectable()
export class OpenSalesOrdersService {
  private readonly logger = new Logger(OpenSalesOrdersService.name);

  constructor(private readonly sap: SapService) {}

  async getOpenOrders() {
    this.logger.log('SAP → OpenSalesOrders sorgusu çağırılıyor...');

    // SQLQueries('OpenSalesOrders')/List endpointine direkt istek
    const res: any = await this.sap.get(`SQLQueries('OpenSalesOrders')/List`);

    const rows = res?.value || [];

    // SAP kolon isimlerini camelCase’e çeviriyoruz (görüntü için daha güzel)
    return rows.map((x) => ({
      docDate: x.DocDate,
      docDueDate: x.DocDueDate,
      docNum: x.DocNum,
      cardCode: x.CardCode,
      cardName: x.CardName,
      docTotal: x.DocTotal,
      docTotalFC: x.DocTotalFC,
      docCur: x.DocCur,
      canceled: x.CANCELED,
      docStatus: x.DocStatus,
    }));
  }
}
