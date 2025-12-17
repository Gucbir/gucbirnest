import {
  Controller,
  Get,
  Put,
  Body,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * GET /api/settings/production-serial
   * Üretim seri no ayarını getirir
   */
  @Get('production-serial')
  async getProductionSerial() {
    return this.settingsService.getProductionSerial();
  }

  /**
   * PUT /api/settings/production-serial
   * Body: { startSerial: "GJ10050049" }
   */
  @Put('production-serial')
  async updateProductionSerial(@Body() body: any) {
    const startSerial = body?.startSerial;

    if (!startSerial || typeof startSerial !== 'string') {
      throw new BadRequestException(
        'startSerial zorunlu ve string olmalıdır. Örn: GJ10050049',
      );
    }

    return this.settingsService.updateProductionSerial(startSerial);
  }

  @Post('updatesettings')
  async updateSettings(@Body() body: any) {
    // body: { name: "productionSerial", settings: {prefix,next,pad} }
    return this.settingsService.upsertSetting(body?.name, body?.settings);
  }
}
