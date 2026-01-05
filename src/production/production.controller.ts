import {
  Body,
  Controller,
  Post,
  Param,
  Req,
  Get,
  Query,
  UseGuards,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  // Batch import (varsa)
  @Post('import-from-orders')
  importFromOrders(@Body() dto: ImportFromOrdersDto) {
    return this.productionService.importFromOrders(dto);
  }

  // Tek satırdan üretime aktar (Akuple test için en kritik)

  @UseGuards(JwtAuthGuard)
  @Post('import-from-order-line')
  importFromOrderLine(
    @Req() req: Request,
    @Body() dto: ImportFromOrderLineDto,
  ) {
    console.log('AUTH:', req.headers['authorization']);
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

  @UseGuards(JwtAuthGuard)
  @Patch('operations/:operationId/units/:unitId/items/:itemId/select')
  async selectItemForOperationUnitLine(
    @Param('operationId') operationId: string,
    @Param('unitId') unitId: string,
    @Param('itemId') itemId: string,
    @Body()
    body: {
      useAlternative: boolean;
      selectedItemCode?: string;
      selectedItemName?: string;
      selectedWarehouseCode?: string;
      selectedQuantity?: number;
      isAlternative?: boolean; // opsiyonel
    },
  ) {
    return this.productionService.selectItemForOperationUnitLine(
      Number(operationId),
      Number(unitId),
      Number(itemId),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('operations-as-units')
  async getOperationsAsUnits(
    @Query('orderId') orderId?: string,
    @Query('stageCode') stageCode?: string,
  ) {
    let oid: number | undefined = undefined;
    const rawOrderId = String(orderId ?? '').trim();
    if (rawOrderId) {
      if (!/^\d+$/.test(rawOrderId)) {
        throw new BadRequestException('orderId geçersiz');
      }
      oid = Number(rawOrderId);
    }

    const normalizedStageCode = stageCode
      ? String(stageCode).trim().toUpperCase().replace(/\s+/g, '_')
      : undefined;

    return this.productionService.getStageOperationsAsUnits({
      orderId: oid,
      stageCode: normalizedStageCode,
    });
  }

  @Get('operations/order/:orderId/stage/:stageCode/units')
  async getStageOperationsAsUnits(
    @Param('orderId') orderId: string,
    @Param('stageCode') stageCode: string,
  ) {
    const normalizedStageCode = String(stageCode ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');

    return this.productionService.getStageOperationsAsUnits({
      orderId: Number(orderId),
      stageCode: normalizedStageCode,
    });
  }

  @Get('operations/order/:orderId/units')
  async getAllStageOperationsAsUnits(@Param('orderId') orderId: string) {
    return this.productionService.getStageOperationsAsUnits({
      orderId: Number(orderId),
    });
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

  //@UseGuards(JwtAuthGuard)
  @Post('operations/:operationId/units/:unitId/start')
  startOperationUnit(
    @Param('operationId') operationId: string,
    @Param('unitId') unitId: string,
    @CurrentUser() user: any,
  ) {
    console.log(`dfsfsdf`);
    return this.productionService.startOperationUnit(
      Number(operationId),
      Number(unitId),
      user?.id,
    );
  }

  //@UseGuards(JwtAuthGuard)
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

  // @UseGuards(JwtAuthGuard)
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

  // @UseGuards(JwtAuthGuard)
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
