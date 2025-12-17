import {
  Body,
  Controller,
  Logger,
  Post,
  Req,
  UseGuards,
  Get,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { SettingsService } from '../settings/settings.service';
import { FormsService } from '../forms/forms.service';
@Controller('Auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
    private readonly formsService: FormsService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    return (req as any).user;
  }

  @UseGuards(JwtAuthGuard) // istersen sonra sadece Admin'e kısıtlarsın
  @Get('users')
  async getAllUsers() {
    const users = await this.usersService.findAll();
    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
    }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('oneuser')
  async getOneUser(@Query('id') userId: string) {
    const id = Number(userId);
    const user = await this.usersService.findById(id);
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('updateuser')
  async updateUser(@Body() body: any) {
    const update = this.usersService.update(body);
    return update;
  }

  @UseGuards(JwtAuthGuard)
  @Get('getsettings')
  async getSettings(@Query('name') name: string) {
    const settings = await this.settingsService.getSettings(name);
    return settings;
  }

  @UseGuards(JwtAuthGuard)
  @Post('setsettings')
  async setSettings(@Body() body: { name: string; settings: any[] }) {
    console.log(body);
    return this.settingsService.updateSetting(body.name, body.settings);
  }

  @UseGuards(JwtAuthGuard)
  @Post('setforms')
  async setForms(@Body() body: { name: string; values: any; orderNo: number }) {
    return this.formsService.setForms(body.name, body.values, body.orderNo);
  }

  @UseGuards(JwtAuthGuard)
  @Get('getforms')
  async getForms(@Query('name') name: string) {
    const forms = await this.formsService.getForms(name);
    return forms;
  }
}
