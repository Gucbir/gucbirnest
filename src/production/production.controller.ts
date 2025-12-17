import {
  Body,
  Controller,
  Post,
  Param,
  Get,
  Patch,
  BadRequestException,
} from '@nestjs/common';
import { ProductionService } from './production.service';

// @UseGuards(JwtAuthGuard)
@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Post('import-from-orders')
  async importFromOrders(@Body() dto: any) {
    return this.productionService.importFromOrders(dto);
  }

  // Departman kuyruğu (AKUPLE, MOTOR_MONTAJ, TESISAT vs)
  @Get('station/:department/queue')
  async getStationQueue(@Param('department') department: string) {
    return this.productionService.getQueueForDepartment(
      (department || '').trim().toUpperCase(),
    );
  }

  // Operasyon detay (AKUPLE ekranı için items şart)
  @Get('operations/:id')
  async getOperationDetail(@Param('id') id: string) {
    return this.productionService.getOperationDetail(Number(id));
  }

  // Başla / Bitir (UI post atıyor, bu kalsın)
  @Post('operations/:operationId/start')
  async startOperation(@Param('operationId') operationId: string) {
    return this.productionService.startOperation(Number(operationId));
  }

  @Post('operations/:operationId/finish')
  async finishOperation(@Param('operationId') operationId: string) {
    return this.productionService.finishOperation(Number(operationId));
  }

  // Alternatif / orijinal seçimi
  @Patch('operations/:operationId/items/:itemId/select')
  async selectItemForOperationLine(
    @Param('operationId') operationId: string,
    @Param('itemId') itemId: string,
    @Body()
    body: {
      useAlternative: boolean;
      selectedItemCode?: string;
      selectedItemName?: string;
      selectedWarehouseCode?: string;
      selectedQuantity?: number;
    },
  ) {
    return this.productionService.selectItemForOperationLine(
      Number(operationId),
      Number(itemId),
      body,
    );
  }

  // ✅ DİNAMİK: stageCode direkt kullan (AKUPLE sabit başlayacak dedin)
  // UI: /production/operations/stage/akuple
  @Get('operations/stage/:stageCode')
  async getOperations(@Param('stageCode') stageCodeParam: string) {
    const normalized = (stageCodeParam || '').trim().toUpperCase();

    const stage =
      await this.productionService.resolveStageByCodeOrName(normalized);
    if (!stage) {
      throw new BadRequestException(`Geçersiz stageCode: ${stageCodeParam}`);
    }

    return this.productionService.getOperations(
      stage.code || stage.departmentCode,
    );
  }

  // Alias kalsın
  @Get('akuple')
  async getAkupleOperations() {
    return this.productionService.getOperations('AKUPLE');
  }
}
