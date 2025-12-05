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
@Controller('Auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
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
}
