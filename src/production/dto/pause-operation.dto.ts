import { IsOptional, IsString, MinLength } from 'class-validator';

export class PauseOperationDto {
  @IsString()
  @MinLength(1)
  reason: string;

  @IsOptional()
  @IsString()
  note?: string | null;
}
