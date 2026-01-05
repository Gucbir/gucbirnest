// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
// import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SettingsModule } from '../settings/settings.module';
import { FormsModule } from '../forms/forms.module';

@Module({
  // imports: [
  //   ConfigModule,
  //   JwtModule.registerAsync({
  //     imports: [ConfigModule],
  //     inject: [ConfigService],
  //     useFactory: (config: ConfigService) => ({
  //       secret: config.get<string>('JWT_KEY'),
  //       signOptions: {
  //         issuer: config.get<string>('JWT_ISSUER'),
  //         audience: config.get<string>('JWT_AUDIENCE'),
  //         expiresIn: config.get('JWT_EXPIRES') ?? '2h',
  //       },
  //     }),
  //   }),
  // ],
  imports: [
    FormsModule,
    SettingsModule,
    UsersModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: {
        expiresIn: '365d', // ✅ 1 yıl
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
