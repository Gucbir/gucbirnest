import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule, // ✅ DB erişimi
  ],
  controllers: [
    SettingsController, // ✅ API endpointler
  ],
  providers: [SettingsService],
  exports: [
    SettingsService, // production tarafı kullanacak
  ],
})
export class SettingsModule {}
