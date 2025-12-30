import { Type } from 'class-transformer';
import { ArrayMinSize, ValidateNested } from 'class-validator';
import { ImportFromOrderLineDto } from './import-from-order-line.dto';
export class ImportFromOrdersDto {
  @ValidateNested({ each: true })
  @Type(() => ImportFromOrderLineDto)
  @ArrayMinSize(1)
  lines: ImportFromOrderLineDto[];
}
