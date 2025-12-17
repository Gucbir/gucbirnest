import { IsString, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^\d{11}$/, {
    message: 'VKN / TC No 11 haneli olmalıdır',
  })
  vkn: string;

  @MinLength(6)
  password: string;
}
