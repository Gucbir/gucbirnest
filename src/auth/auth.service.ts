import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private buildUserResponse(user: User, token: string) {
    return {
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        vkn: user.vkn,
        email: user.email,
        role: user.role,
      },
    };
  }

  private async signToken(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      vkn: user.vkn,
      role: user.role,
    };
    return this.jwtService.signAsync(payload);
  }

  async register(dto: RegisterDto) {
    const exists = await this.usersService.findByVkn(dto.vkn);
    if (exists) {
      throw new ConflictException('Bu VKN  zaten kayıtlı.');
    }

    const user = await this.usersService.createUser(
      dto.fullName,
      dto.vkn,
      dto.phone,
      dto.password,
      dto.email,
      dto.department,
    );

    const token = await this.signToken(user);
    return this.buildUserResponse(user, token);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.validateUser(dto.vkn, dto.password);
    if (!user) {
      throw new UnauthorizedException('Geçersiz VKN veya şifre.');
    }
    const token = await this.signToken(user);
    return this.buildUserResponse(user, token);
  }

  async validateUserById(userId: number): Promise<User | null> {
    return this.usersService.findById(userId);
  }
}
