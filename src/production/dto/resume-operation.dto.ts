// dto/resume-operation.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class ResumeOperationDto {
  @IsOptional()
  @IsString()
  note?: string;
}
