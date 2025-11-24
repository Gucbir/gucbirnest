import { Injectable } from '@nestjs/common';
import { SapService } from '../sap/sap.service';
import { ItemGroupDto } from './dto/item-group.dto';
import { WarehouseDto } from './dto/warehouse.dto';

@Injectable()
export class ItemsService {
  constructor(private readonly sap: SapService) {}

  async getItemGroups(): Promise<ItemGroupDto[]> {
    // Service Layer entity adı ortamına göre değişebilir, genelde "ItemGroups"
    const res = await this.sap.get<any>('ItemGroups?$select=Number,GroupName');

    // Service Layer standart OData response: { value: [ ... ] }
    const value = res.value ?? res;
    return value.map((g: any) => ({
      code: g.Number,
      name: g.GroupName,
    }));
  }

  async getWarehouses(): Promise<WarehouseDto[]> {
    const res = await this.sap.get<any>(
      'Warehouses?$select=WarehouseCode,WarehouseName',
    );
    const value = res.value ?? res;
    return value.map((w: any) => ({
      code: w.WarehouseCode,
      name: w.WarehouseName,
    }));
  }

  // Örneğin, eski ItemController’deki form-options endpoint’ini burada birleştirebilirsin:
  async getFormOptions() {
    const [groups, warehouses] = await Promise.all([
      this.getItemGroups(),
      this.getWarehouses(),
    ]);

    return {
      itemGroups: groups,
      warehouses: warehouses,
      // gerekirse diğer listeler: UDF’ler, serial/batch tipleri vs.
    };
  }
}
