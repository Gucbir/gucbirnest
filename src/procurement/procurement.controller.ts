import {
  Body,
  Controller,
  Get,
  Param,
  Query,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { CreatePurchaseRequestFromRunDto } from './dto/create-purchase-request-from-run.dto';

@Controller('procurement')
export class ProcurementController {
  constructor(private readonly procurement: ProcurementService) {}

  @Post('purchase-requests/from-shortage-run')
  async createFromShortageRun(@Body() dto: CreatePurchaseRequestFromRunDto) {
    const runId = Number(dto.runId);

    if (!runId || Number.isNaN(runId)) {
      throw new BadRequestException('runId zorunlu');
    }
    console.log('DTO:', dto);

    return this.procurement.createPurchaseRequestFromShortageRun({
      runId,
      includeChildren: Boolean(dto.includeChildren),
      note: dto.note,
    });
  }

  @Get('purchase-requests')
  async list(@Query() q: any) {
    return this.procurement.listPurchaseRequestsWithItems({
      status: q.status,
      take: q.take,
      skip: q.skip,
    });
  }

  @Get('purchase-requests/:id')
  async detail(@Param('id') id: string) {
    const num = Number(id);
    if (!num || Number.isNaN(num)) throw new BadRequestException('id zorunlu');
    const pr = await this.procurement.getPurchaseRequestById(num);
    if (!pr) throw new BadRequestException('Kayıt bulunamadı');
    return { ok: true, item: pr };
  }
}
