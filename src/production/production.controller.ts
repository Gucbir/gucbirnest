import {
  Body,
  Controller,
  Post,
  Param,
  Req,
  Get,
  Query,
  Patch,
  BadRequestException,
} from '@nestjs/common';
import { ProductionService } from './production.service';
import { ImportFromOrdersDto } from './dto/import-from-orders.dto';
import { ImportFromOrderLineDto } from './dto/import-from-order-line.dto';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { PauseOperationDto } from './dto/pause-operation.dto';
import { ResumeOperationDto } from './dto/resume-operation.dto';
import { CurrentUser } from '../decorators/current-user.decorator';
@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  // Batch import (varsa)
  @Post('import-from-orders')
  importFromOrders(@Body() dto: ImportFromOrdersDto) {
    return this.productionService.importFromOrders(dto);
  }

  // Tek satırdan üretime aktar (Akuple test için en kritik)
  @Post('import-from-order-line')
  importFromOrderLine(@Body() dto: ImportFromOrderLineDto) {
    return this.productionService.importFromOrderLine(dto);
  }

  @Get('station/:department/queue')
  async getStationQueue(@Param('department') department: string) {
    return this.productionService.getQueueForDepartment(
      (department || '').trim().toUpperCase(),
    );
  }

  @Get('operations/:id')
  async getOperationDetail(@Param('id') id: string) {
    return this.productionService.getOperationDetail(Number(id));
  }

  @Post('operations/:operationId/start')
  async startOperation(@Param('operationId') operationId: string) {
    return this.productionService.startOperation(Number(operationId));
  }

  @Post('operations/:operationId/finish')
  async finishOperation(@Param('operationId') operationId: string) {
    return this.productionService.finishOperation(Number(operationId));
  }

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

  @Get('operations/stage/:stageCode/units')
  async getStageOperationsAsUnits(@Param('stageCode') stageCode: string) {
    return this.productionService.getStageOperationsAsUnits(stageCode);
  }

  @Post('orders/:id/backfill-units')
  async backfillUnits(@Param('id') id: string) {
    return this.productionService.backfillUnitsForOrder(Number(id));
  }

  // @Post('operations/:id/pause')
  // async pauseOperation(
  //   @Param('id') id: string,
  //   @Body() dto: PauseOperationDto,
  // ) {
  //   return this.productionService.pauseOperation(Number(id), dto);
  // }

  // @Post('operations/:id/resume')
  // async resumeOperation(
  //   @Param('id') id: string,
  //   @Body() dto: ResumeOperationDto,
  // ) {
  //   return this.productionService.resumeOperation(Number(id), dto);
  // }

  @Post('operations/:operationId/units/:unitId/start')
  startOperationUnit(
    @Param('operationId') operationId: string,
    @Param('unitId') unitId: string,
    @CurrentUser() user: any,
  ) {
    return this.productionService.startOperationUnit(
      Number(operationId),
      Number(unitId),
      user?.id,
    );
  }

  @Post('operations/:opId/units/:unitId/pause')
  pauseUnit(
    @Param('opId') opId: string,
    @Param('unitId') unitId: string,
    @Body() dto: { reason: string; note?: string },
    @CurrentUser() user: any,
  ) {
    return this.productionService.pauseOperationUnit(
      Number(opId),
      Number(unitId),
      dto,
      user?.id,
    );
  }

  @Post('operations/:opId/units/:unitId/resume')
  resumeUnit(
    @Param('opId') opId: string,
    @Param('unitId') unitId: string,
    @CurrentUser() user: any,
  ) {
    return this.productionService.resumeOperationUnit(
      Number(opId),
      Number(unitId),
      user?.id,
    );
  }

  @Post('operations/:opId/units/:unitId/finish')
  finishOperationUnit(
    @Param('opId') opId: string,
    @Param('unitId') unitId: string,
    @CurrentUser() user: any,
  ) {
    return this.productionService.finishOperationUnit(
      Number(opId),
      Number(unitId),
      user?.id,
    );
  }

  @Get('report/units')
  getProductionReportUnits(
    @Query('includeFinished') includeFinished?: string,
    @Query('search') search?: string,
  ) {
    return this.productionService.getProductionReportUnits({
      includeFinished,
      search,
    });
  }
}
