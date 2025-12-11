import { Injectable, Logger } from '@nestjs/common';
import { SapService } from '../sap/sap.service';

@Injectable()
export class SapUsersService {
  private readonly logger = new Logger(SapUsersService.name);

  constructor(private readonly sap: SapService) {}

  // options: { search?: string; onlyActive?: boolean } bekliyoruz ama tip yazmıyoruz
  async findAll(options?) {
    const search = options && options.search;
    const onlyActive =
      options && Object.prototype.hasOwnProperty.call(options, 'onlyActive')
        ? options.onlyActive
        : true; // default: sadece aktifler

    const baseParams: any = {
      $select: 'InternalKey,UserCode,UserName,eMail,Locked',
      $orderby: 'UserCode asc',
    };

    const filters: string[] = [];

    if (onlyActive) {
      // OUSR.Locked: 'tNO' => aktif, 'tYES' => kilitli/pasif
      filters.push(`Locked eq 'tNO'`);
    }

    if (search) {
      const safe = String(search).replace(/'/g, "''");
      filters.push(
        `(contains(UserCode, '${safe}') or contains(UserName, '${safe}') or contains(eMail, '${safe}'))`,
      );
    }

    if (filters.length > 0) {
      baseParams.$filter = filters.join(' and ');
    }

    const allRows: any[] = [];

    let resource: string | null = 'Users';
    let params: any | undefined = baseParams;

    while (resource) {
      const slResponse: any = await this.sap.get(
        resource,
        params ? { params } : undefined,
      );

      const rows = Array.isArray(slResponse && slResponse.value)
        ? slResponse.value
        : Array.isArray(slResponse)
          ? slResponse
          : [];

      this.logger.log(`Fetched ${rows.length} SAP users from "${resource}"`);

      allRows.push(...rows);

      const nextLink = slResponse && slResponse['odata.nextLink'];

      if (nextLink) {
        this.logger.log(`Next link: ${nextLink}`);
        resource = nextLink;
        params = undefined;
      } else {
        resource = null;
      }
    }

    this.logger.log(`TOTAL SAP LOGIN USERS (OUSR): ${allRows.length}`);

    return allRows.map((u: any) => ({
      internalKey: u.InternalKey,
      userCode: u.UserCode,
      userName: u.UserName,
      email: u.eMail,
      active: u.Locked === 'tNO',
    }));
  }
}
