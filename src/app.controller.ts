// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth/auth.service';
import { UsersService } from './users/users.service';
import { LoginDto } from './auth/dto/login.dto';
import { RegisterDto } from './auth/dto/register.dto';
import { SettingsService } from './settings/settings.service';
import { FormsService } from './forms/forms.service';

@Controller('auth') // --> /auth/login, /auth/register, /auth/me, /auth/users
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
    private readonly formsService: FormsService,
  ) {}

  /**
   * POST /auth/register
   * Body: { fullName, email, password }
   * Response: { token, user }
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    // AuthService içinde register(dto) => { token, user } dönecek şekilde implemente etmiştik
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login
   * Body: { email, password }
   * Response: { token, user }
   */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    // AuthService içinde login(dto) => { token, user } dönecek
    return this.authService.login(dto);
  }

  /**
   * GET /auth/me
   * Header: Authorization: Bearer <token>
   * Response: request.user (JwtStrategy.validate içinden gelen obje)
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@Req() req: any) {
    // JwtStrategy.validate return ettiği obje burada req.user
    // Örn: { id, fullName, email, role }
    return req.user;
  }

  /**
   * GET /auth/users
   * Şimdilik sadece login olan herkes görebiliyor.
   * İleride RolesGuard eklersek Admin'e kısıtlarız.
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('users')
  async getAllUsers() {
    const users = await this.usersService.findAll(); // sende getAll ise burayı değiştir
    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
    }));
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('oneuser')
  async getOneUser(@Query('id') userId: string) {
    const id = Number(userId);
    const user = await this.usersService.findById(id);
    return user;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('updateuser')
  async updateUser(@Body() body: any) {
    const update = this.usersService.update(body);
    return update;
  }
  @UseGuards(AuthGuard('jwt'))
  @Get('getsettings')
  async getSettings(@Query('name') name: string) {
    const settings = await this.settingsService.getSettings(name);
    return settings;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('setsettings')
  async setSettings(@Body() body: { name: string; settings: any[] }) {
    return this.settingsService.updateSetting(body.name, body.settings);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('setforms')
  async setForms(@Body() body: { name: string; values: any; orderNo: number }) {
    return this.formsService.setForms(body.name, body.values, body.orderNo);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('getforms')
  async getForms() {
    const forms = await this.formsService.getForms();
    return forms;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('getoneform')
  async getOneForm(@Query('name') name: string) {
    const forms = await this.formsService.getOneForm(name);
    return forms;
  }
}
