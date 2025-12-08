import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Yeni kullanıcı oluştur
   */
  async createUser(
    fullName: string,
    email: string,
    password: string,
  ): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
      },
    });
  }

  /**
   * Login vs işlemler için email ile kullanıcı bul
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * ID ile kullanıcı bul
   */
  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Tüm kullanıcıları listele → /auth/users endpoint’i burayı kullanıyor
   */
  // users.service.ts
  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async update(values: any): Promise<User> {
    return this.prisma.user.update({
      where: {
        id: values.id, // Güncellenecek kullanıcının ID'si
      },
      data: {
        ...values, // id dışındaki tüm alanları günceller
      },
    });
  }
  /**
   * Login doğrulama için email+şifre kontrolü
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return null;

    return user;
  }
}
