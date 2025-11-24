// src/orders/orders.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderUpdateDto } from './dto/order-update.dto';
import { UpdateProductionLineDto } from './dto/update-production-line.dto';
import {
  ProductionOrderIdCardInfoRequestDto,
  ProductionOrderIdCardInfoDto,
} from './dto/production-order-id-card.dto';
import { FirstRouteIssueRequestDto } from './dto/first-route-issue.dto';
import { GoodsIssueResultDto } from './dto/first-route-issue.dto';

@Controller('api/SAP/Order')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // C#: [HttpPost("update")]
  @Post('update')
  @HttpCode(HttpStatus.OK)
  async update(@Body() dto: OrderUpdateDto) {
    return this.ordersService.updateOrderBySerial(dto);
  }

  // C#: [HttpPost("update-production-line")]
  @Post('update-production-line')
  async updateProductionLine(@Body() dto: UpdateProductionLineDto) {
    return this.ordersService.updateProductionLine(dto);
  }

  // C#: [HttpPost("id-card-info")]
  @Post('id-card-info')
  async getProductionOrderIdCardInfo(
    @Body() dto: ProductionOrderIdCardInfoRequestDto,
  ): Promise<ProductionOrderIdCardInfoDto> {
    return this.ordersService.getProductionOrderIdCardInfo(dto);
  }

  // --- Diğer endpointler için skeleton ---

  @Get('stage-status-report')
  async getStageStatusReport() {
    // C#'taki SELECT query:
    // SELECT ... FROM OWOR W INNER JOIN [@STAGESTATUS] S ...
    // Service Layer tarafında:
    //  - ya SQLQueries ile aynı SQL'i çalıştıracağız
    //  - ya da view/UDT üzerinden OData ile alacağız
    return this.ordersService.getStageStatusReport();
  }

  @Get('with-elapsed-report')
  async getWithElapsedReport() {
    return this.ordersService.getWithElapsedReport();
  }

  @Get('with-elapsed')
  async getWithElapsed() {
    return this.ordersService.getWithElapsed();
  }

  @Post('materials-list-order-with-stock')
  async getMaterialsListOrderWithStock(@Body() body: any) {
    return this.ordersService.getMaterialsListOrderWithStock(body);
  }

  @Post('send-material-change-request-mail')
  async sendMaterialChangeRequestMail(@Body() body: any) {
    return this.ordersService.sendMaterialChangeRequestMail(body);
  }

  @Get('with-first-stage')
  async getOrdersWithFirstStage() {
    return this.ordersService.getOrdersWithFirstStage();
  }

 @Post('first-route-issue')
  async postFirstRouteIssue(
    @Body() dto: FirstRouteIssueRequestDto,
  ): Promise<GoodsIssueResultDto> {
    return this.ordersService.postFirstRouteIssue(dto);
  }

 //POST /b1s/v1/SQLQueries('FIRST_ROUTE_GI_LINES')/List
 //Body: { "Parameters": [ { "Name": "ProdDocEntry", "Value": "12345" } ] }

  @Post('first-stage-availability')
  async postFirstStageAvailability(@Body() body: any) {
    return this.ordersService.postFirstStageAvailability(body);
  }
}
