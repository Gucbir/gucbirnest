// src/purchase-requests/purchase-requests.controller.ts
import { Body, Controller, Get, Query, Post } from '@nestjs/common';
import { PurchaseRequestsService } from './purchase-requests.service';

@Controller('purchase-requests')
export class PurchaseRequestsController {
  constructor(private readonly prService: PurchaseRequestsService) {}

  @Get()
  async findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('includeClosed') includeClosed?: string,
    @Query('requester') requester?: string,
    @Query('docNum') docNum?: string,
  ) {
    let fromDate = from;
    let toDate = to;

    // Default: son 1 ay
    if (!fromDate && !toDate) {
      const now = new Date();
      const toISO = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const past = new Date();
      past.setMonth(past.getMonth() - 1);
      const fromISO = past.toISOString().slice(0, 10);

      fromDate = fromISO;
      toDate = toISO;
    }

    const data = await this.prService.findAll({
      from: fromDate,
      to: toDate,
      includeClosed: includeClosed === 'true',
      requester,
      docNum,
    });

    return {
      data,
      from: fromDate,
      to: toDate,
      includeClosed: includeClosed === 'true',
      count: data.length,
    };
  }

  @Post()
  async create(@Body() body: any) {
    const result = await this.prService.create(body);

    // Service Layer genelde DocEntry & DocNum döndürüyor
    const docEntry = result?.DocEntry ?? result?.DocEntryInternalID;
    const docNum = result?.DocNum;

    return {
      message: 'Satın alma talebi başarıyla oluşturuldu',
      docEntry,
      docNum,
      sapResult: result,
    };
  }
}
