import {
  Body,
  Controller,
  Post,
  UseGuards,
  Param,
  Get,
  Patch,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ProductionService, ProductionStageCode } from './production.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const STAGE_CODE_MAP: Record<string, ProductionStageCode> = {
  AKUPLE: 'AKUPLE',
  MOTOR_MONTAJ: 'MOTOR_MONTAJ',
  PANO_TESISAT: 'PANO_TESISAT',
  TEST: 'TEST',
  KABIN_GIYDIRME: 'KABIN_GIYDIRME',
};
//@UseGuards(JwtAuthGuard)
@Controller('production')
export class ProductionController {
  // Nest tarzı: constructor parametresinden field tanımı
  constructor(private readonly productionService: ProductionService) {}

  @Post('import-from-orders')
  async importFromOrders(@Body() dto: any) {
    // dto = { orderIds: [...] }
    return this.productionService.importFromOrders(dto);
  }

  // Departman kuyruğu (AKUPLE, MOTOR, TESISAT vs)
  @Get('station/:department/queue')
  async getStationQueue(@Param('department') department: string) {
    return this.productionService.getQueueForDepartment(
      department.toUpperCase(),
    );
  }

  // Operasyon detay
  @Get('operations/:id')
  async getOperationDetail(@Param('id') id: string) {
    console.log(id, '\n\n\n\n');
    return this.productionService.getOperationDetail(Number(id));
  }

  // production.controller.ts
  @Post('operations/:operationId/start')
  async startOperation(@Param('operationId') operationId: string) {
    return this.productionService.startOperation(Number(operationId));
  }

  @Post('operations/:operationId/finish')
  async finishOperation(@Param('operationId') operationId: string) {
    return this.productionService.finishOperation(Number(operationId));
  }

  // 🔥 Belirli bir satır için alternatif / seçilen ürünü kaydet + stok düş
  @Patch('operations/:operationId/items/:itemId/select')
  async selectItemForOperationLine(
    @Param('operationId') operationId: string,
    @Param('itemId') itemId: string,
    @Body()
    body: {
      useAlternative: boolean;
      selectedItemCode?: string;
      selectedWarehouseCode?: string;
      selectedQuantity?: number;
    },
  ) {
    // body: { selectedItemCode, selectedItemName, warehouseCode, quantity }
    return this.productionService.selectItemForOperationLine(
      Number(operationId),
      Number(itemId),
      body,
    );
  }

  // 🔥 DİNAMİK ENDPOINT
  @Get('operations/stage/:stageCode')
  async getOperations(@Param('stageCode') stageCodeParam: string) {
    const normalized = stageCodeParam.toUpperCase();
    console.log('➡ getOperations stageCodeParam =', stageCodeParam);

    if (!STAGE_CODE_MAP[normalized]) {
      throw new BadRequestException(
        `Geçersiz stageCode: ${stageCodeParam}. Geçerli değerler: ${Object.keys(
          STAGE_CODE_MAP,
        ).join(', ')}`,
      );
    }

    const stageCode = STAGE_CODE_MAP[normalized];

    return this.productionService.getOperations(stageCode);
  }

  // İstersen eski /akuple endpointini de alias olarak bırakabilirsin:
  @Get('akuple')
  async getAkupleOperations() {
    return this.productionService.getOperations('AKUPLE');
  }
}
