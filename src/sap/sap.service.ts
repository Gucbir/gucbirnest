// @ts-nocheck

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as https from 'https';
import crypto from 'crypto';

export interface SapUser {
  InternalKey: number;
  UserCode: string;
  UserName: string;
  E_Mail?: string;
  MobilePhoneNumber?: string;
  Department?: string;
  Branch?: number;
  Locked?: 'tNO' | 'tYES';
  // ihtiyaca göre diğer alanlar da eklenebilir
}

@Injectable()
export class SapService {
  private readonly logger = new Logger(SapService.name);
  private readonly client: AxiosInstance;
  private cookieHeader: string | null = null;
  private loggingIn = false;

  constructor() {
    const baseURL = process.env.SAP_BASE_URL;
    if (!baseURL) {
      throw new Error('SAP_BASE_URL is not defined');
    }

    this.client = axios.create({
      baseURL: baseURL.replace(/\/$/, '') + '/',
      timeout: 30000,
      validateStatus: (status) => status >= 200 && status < 500, // 4xx'ü biz handle edeceğiz
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // ⛔ sadece dev ortamı için
      }),
    });
    this.logger.log(
      `SAP Service Layer baseURL: ${this.client.defaults.baseURL}`,
    );
  }

  // async getUsers(): Promise<any[]> {
  //   const data = await this.get<{ value: any[] }>('Users');
  //   return data.value;
  // }

  async getSapUsers(): Promise<SapUser[]> {
    const query =
      'Users?$select=InternalKey,UserCode,UserName,Department,Branch,Locked';
    const data = await this.get<{ value: any[] }>(query);
    return data.value;
  }

  async getDepartments() {
    const data = await this.get<{ value: any[] }>('Departments');
    return data.value; // { Code, Name, ... }
  }

  async getWarehouses() {
    const query = 'Warehouses?$select=WarehouseCode,WarehouseName';
    const data = await this.get<{ value: any[] }>(query);
    return data.value; // { Code, Name, ... }
  }

  // sap.service.ts içinde
  async getWarehouseStocks(warehouseCode, pageSize = 100, maxPages = 100) {
    const stocks = [];
    let skip = 0;

    for (let page = 0; page < maxPages; page++) {
      const data = await this.get('Items', {
        params: {
          $select: 'ItemCode,ItemWarehouseInfoCollection',
          $top: pageSize,
          $skip: skip,
        },
      });

      const items = data?.value ?? [];

      // Bu sayfada hiç kayıt yoksa çık
      if (items.length === 0) break;

      // Bu sayfadaki kayıtları işle
      for (const item of items) {
        const wh = item.ItemWarehouseInfoCollection?.find(
          (w) => w.WarehouseCode == warehouseCode,
        );

        if (!wh) continue;

        const inStock = wh.InStock ?? 0;

        if (inStock > 0) {
          stocks.push({
            ItemCode: item.ItemCode,
            WarehouseCode: wh.WarehouseCode,
            InStock: inStock,
          });
        }
      }

      // Son sayfa mı? (page size’dan az geldiyse)
      if (items.length < pageSize) break;

      // Bir sonraki sayfa için skip artır
      skip += pageSize;
    }

    return stocks;
  }

  async getWarehouseStocks(whsCode: string) {
    const res: any = await this.get('B1_ItemWarehouseStock', {
      params: {
        $filter: `WhsCode eq '${whsCode}'`,
        $top: 10000, // depo başına max kaç satır bekliyorsan
      },
    });

    return res?.value || [];
  }

  async getItemsPage(top: number, skip: number) {
    return this.get('Items', {
      params: {
        $select:
          'ItemCode,ItemName,ForeignName,ItemType,ItemsGroupCode,InventoryItem,SalesItem,PurchaseItem,InventoryUOM,SalesUnit,PurchaseUnit,MinInventory,MaxInventory,Valid,Frozen,AssetItem,AvgPrice,LastPurPrc,LastPurCur',
        $top: top,
        $skip: skip,
      },
    });
  }

  async getWarehouseStockFromSapByItemCode(itemCode: any) {
    const safeItemCode = String(itemCode).replace(/'/g, "''"); // tek tırnak escape

    const body = {
      ParamList: `itemCode='${safeItemCode}'`,
    };

    // SQLQueries('StockByItem')/List endpoint’ine POST
    const data = await this.post(`SQLQueries('StockByItem')/List`, body);

    // Burada direkt SAP raw data dönüyoruz
    return data.value || [];
  }

  private async login(force = false): Promise<void> {
    if (this.loggingIn && !force) {
      // Aynı anda birden fazla login denemesini engellemek için
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (this.cookieHeader) return;
    }

    this.loggingIn = true;
    try {
      const CompanyDB = process.env.SAP_COMPANY_DB;
      const UserName = process.env.SAP_USERNAME;
      const Password = process.env.SAP_PASSWORD;

      if (!CompanyDB || !UserName || !Password) {
        throw new Error('SAP credentials are not fully defined in env');
      }

      const res = await this.client.post(
        'Login',
        { CompanyDB, UserName, Password },
        { headers: { 'Content-Type': 'application/json' } },
      );

      if (res.status >= 400) {
        this.logger.error(
          `Service Layer login failed [${res.status}]: ${JSON.stringify(
            res.data,
          )}`,
        );
        throw new Error(
          `Service Layer login failed [${res.status}]: ${JSON.stringify(
            res.data,
          )}`,
        );
      }

      const setCookie = res.headers['set-cookie'];
      if (!setCookie || setCookie.length === 0) {
        throw new Error('Service Layer did not return any cookies on login');
      }
      console.log(res.status, '--------------', res.data);
      // B1SESSION, ROUTEID vs hepsini tek header’da birleştir:
      this.cookieHeader = setCookie.map((c) => c.split(';')[0]).join('; ');
      this.logger.log('Service Layer login successful');
    } finally {
      this.loggingIn = false;
    }
  }

  private async ensureLoggedIn() {
    if (!this.cookieHeader) {
      await this.login();
    }
  }

  async getOrderMainItemByDocNum(docNum: number) {
    this.logger.log(
      `[SapService] getOrderMainItemByDocNum (Orders): docNum=${docNum}`,
    );

    // Daha önce Items için yaptığımız gibi, sadece endpoint 'Orders'
    const data = await this.get<any>('Orders', {
      params: {
        $select: 'DocEntry,DocNum,DocumentLines',
        $filter: `DocNum eq ${docNum}`,
      },
    });

    const order = (data?.value || [])[0];

    if (!order) {
      this.logger.warn(
        `[SapService] Orders: no order found for DocNum=${docNum}`,
      );
      return null;
    }

    const line = (order.DocumentLines || [])[0];
    if (!line) {
      this.logger.warn(
        `[SapService] Orders: order ${docNum} has no document lines`,
      );
      return null;
    }

    const header = {
      sapDocEntry: order.DocEntry,
      sapDocNum: order.DocNum,
      itemCode: line.ItemCode,
      itemName: line.ItemDescription,
      quantity: Number(line.Quantity ?? 0),
    };

    this.logger.log(
      `[SapService] Orders header for DocNum=${docNum}: ${JSON.stringify(
        header,
      )}`,
    );

    return header;
  }

  // async getBomByItemCode(itemCode) {
  //   const sqlResult: any = await this.post(
  //     `/SQLQueries('BomByItemCode')/List`,
  //     {
  //       ItemCode: itemCode,
  //     },
  //   );

  //   const rows: any[] = sqlResult.value || [];

  //   return rows.map((r) => ({
  //     bomItemCode: r.BomItemCode,
  //     fatherItemCode: r.FatherItemCode,
  //     itemCode: r.ItemCode,
  //     itemName: r.ItemName,
  //     quantity: Number(r.Quantity ?? 0),
  //     warehouseCode: r.WhsCode,
  //     uomName: r.UomName,
  //     issueMethod: r.IssueMethod,
  //     lineNo: r.LineNo,
  //     stageId: r.StageId,
  //   }));
  // }

  async getBomByItemCode(itemCode) {
    console.log(itemCode, '23423424234234234');
    this.logger.log(`[SapService] getBomByItemCode: itemCode=${itemCode}`);
    const body = {
      ParamList: `ItemCode='${itemCode}'`,
    };
    const res = await this.post(`SQLQueries('BomByItemCode')/List`, body);

    // Service Layer SQLQueries her zaman { value: [...] } döner
    return res;
  }

  async getRoutingStages() {
    const res = await this.post(`/SQLQueries('RoutingStages')/List`, {});
    const rows = res.value || [];

    return rows.map((r) => ({
      stageId: r.AbsEntry, // ITT1.StageID ile eşleşecek
      code: r.Code, // "AKUPLE"
      name: r.Desc, // "AKUPLE"
    }));
  }

  /**
   * Ürün kodundan üretim yapısı (rota aşamaları + kalemler)
   * BomByItemCode + RoutingStages sonuçlarını birleştirir.
   */
  async buildProductionStructureFromSap(itemCode: string) {
    // 1) BOM satırları + stage master
    const [bomResult, routingStages] = await Promise.all([
      this.getBomByItemCode(itemCode), // SQLQueries('BomByItemCode')
      this.getRoutingStages(), // ORST (AbsEntry, Name, Code vs.)
    ]);
    console.log(bomResult, 'bommmmmm', routingStages);
    const bomLines: any[] = bomResult?.value ?? [];

    // 2) ORST stage map (StageId -> {code,name,sequenceNo,departmentCode})
    const stageMap = new Map<number, any>();

    for (const s of routingStages ?? []) {
      const sid = Number(s.AbsEntry ?? s.stageId ?? s.StageId ?? 0);
      if (!sid) continue;

      const code = (s.Code ?? s.code ?? '').toString().trim();
      const name = (s.Name ?? s.name ?? '').toString().trim();

      // Bazı sistemlerde Sequence / Sort alanı farklı olabilir
      const sequenceNo = Number(s.SequenceNo ?? s.sequenceNo ?? sid * 10);

      stageMap.set(sid, {
        stageId: sid,
        code: code || name || `STAGE_${sid}`,
        name: name || code || `STAGE_${sid}`,
        departmentCode: code || name || `STAGE_${sid}`,
        sequenceNo: sequenceNo || sid * 10,
      });
    }
    console.log(stageMap);
    // 3) StageId’ye göre grupla
    const stagesMap = new Map<number, any>();

    for (const line of bomLines) {
      console.log(line);
      const sid = Number(line.StageId ?? line.stageId ?? 0) || 0;

      // Eğer SQLQuery’ye StageName eklediysen önce onu kullan
      const lineStageName = (line.StageName ?? line.stageName ?? '')
        .toString()
        .trim();
      console.log(lineStageName, '111111111');
      const base = stageMap.get(sid);

      const stageInfo = (lineStageName
        ? {
            stageId: sid,
            code: base?.code || lineStageName,
            name: lineStageName,
            departmentCode: base?.departmentCode || base?.code || lineStageName,
            sequenceNo: base?.sequenceNo || sid * 10 || 999,
          }
        : base) || {
        stageId: sid,
        code: 'GENEL',
        name: 'GENEL',
        departmentCode: 'GENEL',
        sequenceNo: 999,
      };

      if (!stagesMap.has(sid)) {
        stagesMap.set(sid, {
          stageId: stageInfo.stageId,
          code: stageInfo.code,
          name: stageInfo.name,
          departmentCode: stageInfo.departmentCode,
          sequenceNo: stageInfo.sequenceNo,
          lines: [],
        });
      }

      const stage = stagesMap.get(sid);

      stage.lines.push({
        itemCode: line.ItemCode ?? line.itemCode ?? '',
        itemName: line.ItemName ?? line.itemName ?? '',
        quantity: Number(line.Quantity ?? line.quantity ?? 0),
        uomName: line.UomName ?? line.uomName ?? '',
        warehouseCode: line.WhsCode ?? line.whsCode ?? line.warehouseCode ?? '',
        issueMethod: line.IssueMethod ?? line.issueMethod ?? '',
        lineNo: Number(line.VisOrder ?? line.visOrder ?? line.lineNo ?? 0),
      });
    }

    // 4) Stage’leri sırala + satırları VisOrder’a göre sırala
    const stages = Array.from(stagesMap.values())
      .map((s) => ({
        ...s,
        lines: (s.lines || []).sort(
          (a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0),
        ),
      }))
      .sort((a, b) => (a.sequenceNo ?? 999) - (b.sequenceNo ?? 999));

    return { itemCode, stages };
  }

  private async request<T = any>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    await this.ensureLoggedIn();

    const finalConfig: AxiosRequestConfig = {
      method,
      url,
      data,
      ...config,
      headers: {
        ...(config?.headers || {}),
        'Content-Type': 'application/json',
        Cookie: this.cookieHeader ?? '',
      },
    };

    let res = await this.client.request(finalConfig);

    // Session expired ise tekrar login dene
    if (res.status === 401 || this.isSessionExpired(res.data)) {
      this.logger.warn('Service Layer session expired, re-logging in...');
      this.cookieHeader = null;
      await this.login(true);

      finalConfig.headers = {
        ...(finalConfig.headers || {}),
        Cookie: this.cookieHeader ?? '',
      };
      res = await this.client.request(finalConfig);
    }

    if (res.status >= 400) {
      this.logger.error(
        `Service Layer request failed [${res.status}] ${method} ${url}: ${JSON.stringify(
          res.data,
        )}`,
      );
      throw new Error(
        `Service Layer request failed [${res.status}] ${method} ${url}: ${JSON.stringify(
          res.data,
        )}`,
      );
    }

    return res.data as T;
  }

  private isSessionExpired(data: any): boolean {
    if (!data) return false;
    const msg = JSON.stringify(data).toLowerCase();
    return (
      msg.includes('session') &&
      (msg.includes('expired') ||
        msg.includes('invalid') ||
        msg.includes('not found'))
    );
  }

  async getProductionStructureByOrderId(docNum: number) {
    // 1) Sipariş başlığı (Orders + DocumentLines)
    const header = await this.getOrderMainItemByDocNum(docNum);

    if (!header) {
      throw new Error(
        `SAP'te bu numaraya ait satış siparişi bulunamadı veya satırı yok. (DocNum=${docNum})`,
      );
    }

    // 2) Ürün ağacı + rota (hala BomByItemCode + RoutingStages)
    const structureByItem = await this.getProductionStructureByItemCode(
      header.itemCode,
    );

    return {
      header,
      stages: structureByItem.stages,
    };
  }

  // sap.service.ts
  async getItemsBatchSerialFlags(itemCodes: string[]) {
    const uniqueCodes = Array.from(new Set(itemCodes.filter(Boolean)));

    if (uniqueCodes.length === 0) return {};

    // SQLQuery veya Items endpoint kullanabilirsin; ben SQLQuery örneği yazıyorum:
    const res = await this.get('SQLQueries', {
      params: {
        // OITM'den ManBtchNum / ManSerNum getiren kendi query'ni koy
        // Örn: SqlCode = 'ItemBatchFlags'
        // Param olarak itemCode listesi vs.
      },
    });

    // burada res.value -> [{ ItemCode, ManBtchNum, ManSerNum }, ...]
    const map: Record<string, { batch: boolean; serial: boolean }> = {};
    for (const row of res.value ?? []) {
      map[row.ItemCode] = {
        batch: row.ManBtchNum === 'Y',
        serial: row.ManSerNum === 'Y',
      };
    }
    return map;
  }

  // async getOpenSalesOrders() {
  //   const result: any[] = [];
  //   let skip = 0;
  //   const top = 200;

  //   while (true) {
  //     const res = await this.get('Orders', {
  //       params: {
  //         $select:
  //           'DocEntry,DocNum,CardCode,CardName,DocDate,DocDueDate,DocTotal,DocTotalFC,DocCurrency,Comments,DocStatus,CANCELED',
  //         $filter: "DocStatus eq 'O' and CANCELED eq 'N'",
  //         $top: top,
  //         $skip: skip,
  //       },
  //     });

  //     const rows = res?.value ?? [];
  //     if (rows.length === 0) break;

  //     result.push(...rows);
  //     skip += top;
  //   }

  //   return result;
  // }

  // sap.service.ts
  async getOpenSalesOrdersWithLines(top = 50, skip = 0) {
    return this.get('Orders', {
      params: {
        $select:
          'DocEntry,DocNum,CardCode,CardName,DocDate,DocDueDate,DocTotal,DocTotalFc,DocCurrency,Comments,DocumentStatus,Cancelled',
        $filter: "DocumentStatus eq 'bost_Open' and Cancelled eq 'tNO'",
        $orderby: 'DocEntry asc',
        $top: top,
        $skip: skip,
        $expand:
          'DocumentLines($select=LineNum,ItemCode,ItemDescription,Quantity,Price,Currency,Rate,WarehouseCode,LineTotal,RowTotalFC,RowTotalSC,LineStatus,ShipDate)',
      },
    });
  }

  async getAllOpenSalesOrdersWithLines(pageSize = 50, maxPages = 200) {
    const all: any[] = [];
    let skip = 0;

    for (let page = 0; page < maxPages; page++) {
      const res = await this.getOpenSalesOrdersWithLines(pageSize, skip);
      const rows = res?.value ?? [];
      if (rows.length === 0) break;

      all.push(...rows);
      skip += pageSize;
    }

    return all;
  }

  // Public helper metotlar:
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('GET', url, undefined, config);
  }

  async post<T = any>(
    url: string,
    body: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.request<T>('POST', url, body, config);
  }

  async patch<T = any>(
    url: string,
    body: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.request<T>('PATCH', url, body, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('DELETE', url, undefined, config);
  }

  async postAll<T = any>(
    path: string,
    body: any,
    pageSize = 1000,
  ): Promise<T[]> {
    const all: T[] = [];

    // 1) ilk sayfa: POST
    let data: any = await this.post(path, body, {
      headers: { Prefer: `odata.maxpagesize=${pageSize}` },
    });

    all.push(...(data?.value ?? []));

    // 2) varsa nextLink → GET ile devam
    let nextLink: string | undefined =
      data?.['@odata.nextLink'] ?? data?.['odata.nextLink'];

    while (nextLink) {
      const normalized = nextLink.includes('/b1s/v1/')
        ? nextLink.split('/b1s/v1/')[1]
        : nextLink.startsWith('/')
          ? nextLink.slice(1)
          : nextLink;

      data = await this.get(normalized, {
        headers: { Prefer: `odata.maxpagesize=${pageSize}` },
      });

      all.push(...(data?.value ?? []));
      nextLink = data?.['@odata.nextLink'] ?? data?.['odata.nextLink'];
    }

    return all;
  }
}
