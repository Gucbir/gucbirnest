// src/sap-users/sap-users.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { SapUsersService } from './sap-users.service';

@Controller('sap-users')
export class SapUsersController {
  constructor(private readonly svc: SapUsersService) {}

  @Get()
  @Get()
  async findAll(@Query('q') q?: string) {
    const data = await this.svc.findAll({ search: q });
    return { data, count: data.length };
  }
}
