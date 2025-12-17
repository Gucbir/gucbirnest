import {
  IsNotEmpty,
  MinLength,
  Matches,
  IsOptional,
  IsString,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  fullName: string;

  @Matches(/^\d{11}$/, {
    message: 'VKN 11 haneli olmalıdır',
  })
  vkn: string;

  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @MinLength(6)
  password: string;
}
