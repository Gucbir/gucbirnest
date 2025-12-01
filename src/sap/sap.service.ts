// @ts-nocheck

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as https from 'https';

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
  // async getWarehouseStocks(warehouseCode, pageSize = 100, maxPages = 100) {
  //   const stocks = [];
  //   let skip = 0;

  //   for (let page = 0; page < maxPages; page++) {
  //     const data = await this.get('Items', {
  //       params: {
  //         $select: 'ItemCode,ItemWarehouseInfoCollection',
  //         $top: pageSize,
  //         $skip: skip,
  //       },
  //     });

  //     const items = data?.value ?? [];

  //     // Bu sayfada hiç kayıt yoksa çık
  //     if (items.length === 0) break;

  //     // Bu sayfadaki kayıtları işle
  //     for (const item of items) {
  //       const wh = item.ItemWarehouseInfoCollection?.find(
  //         (w) => w.WarehouseCode == warehouseCode,
  //       );

  //       if (!wh) continue;

  //       const inStock = wh.InStock ?? 0;

  //       if (inStock > 0) {
  //         stocks.push({
  //           ItemCode: item.ItemCode,
  //           WarehouseCode: wh.WarehouseCode,
  //           InStock: inStock,
  //         });
  //       }
  //     }

  //     // Son sayfa mı? (page size’dan az geldiyse)
  //     if (items.length < pageSize) break;

  //     // Bir sonraki sayfa için skip artır
  //     skip += pageSize;
  //   }

  //   return stocks;
  // }
  async getWarehouseStocks(
    warehouseCode: string | number,
    pageSize = 100,
    maxPages = 100,
  ) {
    const allItems: any[] = [];
    let skip = 0;

    const targetWh = Number(warehouseCode);

    for (let page = 0; page < maxPages; page++) {
      const data = await this.get('Items', {
        params: {
          $select: 'ItemCode,ItemName,ItemWarehouseInfoCollection',
          $top: pageSize,
          $skip: skip,
        },
      });

      const items = data?.value ?? [];

      console.log(`PAGE ${page + 1}, skip=${skip}, itemCount=${items.length}`);

      if (items.length === 0) break;

      allItems.push(...items);

      if (items.length < pageSize) break;

      skip += pageSize;
    }

    console.log('TOTAL ITEMS FROM SL:', allItems.length);

    let withWhCount = 0;
    let withWhAndStockCount = 0;

    const stocks: {
      ItemCode: string;
      ItemName?: string;
      WarehouseCode: string;
      InStock: number;
    }[] = [];

    for (const item of allItems) {
      const wh = item.ItemWarehouseInfoCollection?.find(
        (w: any) => Number(w.WarehouseCode) === targetWh,
      );

      if (!wh) {
        continue;
      }

      withWhCount++;

      const inStock = Number(wh.InStock ?? 0);

      if (inStock > 0) {
        withWhAndStockCount++;

        stocks.push({
          ItemCode: item.ItemCode,
          ItemName: item.ItemName,
          WarehouseCode: String(wh.WarehouseCode),
          InStock: inStock,
        });
      }
    }

    console.log('Deposu aynı olan ürün sayısı   :', withWhCount);
    console.log('Depo + stok > 0 olan ürün sayısı:', withWhAndStockCount);

    return stocks;
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
}
