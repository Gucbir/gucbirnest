import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SapModule } from './sap/sap.module';
import { ItemsModule } from './items/items.module';
import { OrdersModule } from './orders/orders.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppService } from './app.service';
import { AuthController } from './auth/auth.controller';
import { PrismaService } from './prisma/prisma.service';
import { SapService } from './sap/sap.service';
import { UsersService } from './users/users.service';
import { ItemsSyncModule } from './items-sync/items-sync.module';
import { WarehouseModule } from './items-sync/warehouse.module';
import { UserModule } from './items-sync/users.module';
import { OpenSalesOrdersModule } from './sales-orders/open-sales-orders.module';
import { PurchaseRequestsModule } from './purchases/purchase-requests.module';
import { SapUsersModule } from './sap-users/sap-users.module';
import { ProductionModule } from './production/production.module';
import { SettingsService } from './settings/settings.service';
import { FormsService } from './forms/forms.service';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SapModule, // Service Layer client
    ItemsModule, // Örnek domain modülü
    OrdersModule,
    AuthModule,
    PrismaModule,
    ItemsModule,
    ItemsSyncModule,
    WarehouseModule,
    UserModule,
    OpenSalesOrdersModule,
    PurchaseRequestsModule,
    SapUsersModule,
    ProductionModule,
    // ileride: OrdersModule, StockModule, SalesModule, ...
  ],
  controllers: [AuthController],
  providers: [
    AppService,
    PrismaService,
    SapService,
    UsersService,
    SettingsService,
    FormsService,
  ],
})
export class AppModule {}
