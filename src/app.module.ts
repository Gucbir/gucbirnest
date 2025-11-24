import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SapModule } from './sap/sap.module';
import { ItemsModule } from './items/items.module';
import { OrdersModule } from './orders/orders.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SapModule,     // Service Layer client
    ItemsModule,   // Örnek domain modülü
    OrdersModule,
    AuthModule,
    PrismaModule,
    // ileride: OrdersModule, StockModule, SalesModule, ...
  ],
})
export class AppModule {}
