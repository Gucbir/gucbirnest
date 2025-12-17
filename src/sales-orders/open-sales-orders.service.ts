import { Injectable, Logger } from '@nestjs/common';
import { SapService } from '../sap/sap.service';

@Injectable()
export class OpenSalesOrdersService {
  private readonly logger = new Logger(OpenSalesOrdersService.name);

  constructor(private readonly sap: SapService) {}

  async getOpenOrders() {
    this.logger.log('SAP Service Layer → Open Orders çekiliyor...');

    const PAGE_SIZE = 100;
    let skip = 0;
    const all: any[] = [];

    while (true) {
      const res: any = await this.sap.get(
        `Orders?$select=DocEntry,DocNum,DocDate,DocDueDate,CardCode,CardName,DocTotal,DocTotalFc,DocCurrency,Comments,DocumentStatus,Cancelled` +
          `&$filter=DocumentStatus eq 'bost_Open' and Cancelled eq 'tNO'` +
          `&$orderby=DocEntry desc` +
          `&$top=${PAGE_SIZE}&$skip=${skip}`,
      );

      const rows = res?.value || [];
      if (rows.length === 0) break;

      all.push(...rows);
      skip += PAGE_SIZE;
    }

    return all.map((x) => ({
      docEntry: x.DocEntry,
      docNum: x.DocNum,
      docDate: x.DocDate,
      docDueDate: x.DocDueDate,
      cardCode: x.CardCode,
      cardName: x.CardName,
      docTotal: x.DocTotal,
      docTotalFC: x.DocTotalFc,
      docCur: x.DocCurrency, // ✅
      comments: x.Comments || '', // ✅ ORDR Comments
      docStatus: x.DocumentStatus, // ✅
      canceled: x.Cancelled, // ✅
    }));
  }

  async getOrderLines(docEntry: number) {
    const res: any = await this.sap.post(
      `SQLQueries('SalesOrderLinesByDocEntry')/List`,
      { ParamList: `docEntry=${docEntry}` },
    );

    const rows = res?.value || [];

    return rows.map((x: any) => ({
      docEntry: x.DocEntry,
      lineNum: x.LineNum,
      itemCode: x.ItemCode,
      itemName: x.ItemName,
      quantity: x.Quantity,
      uom: x.Uom,
      serialNum: x.SerialNum || '', // ✅ RDR1.SerialNum
      description: x.OrderComments || '', // ✅ ORDR.Comments
    }));
  }
}
