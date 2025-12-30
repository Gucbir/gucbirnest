import { Injectable, Logger } from '@nestjs/common';
import { SapService } from '../sap/sap.service';

@Injectable()
export class SapBomService {
  private readonly logger = new Logger(SapBomService.name);

  constructor(private readonly sap: SapService) {}
  async getBomExploded(rootItemCode: string) {
    const root = String(rootItemCode ?? '').trim();
    if (!root) return [];

    const visited = new Set<string>();
    const cache = new Map<string, { items: any[]; routeStages: any[] }>();

    const queue: Array<{ code: string; level: number; parent: string | null }> =
      [{ code: root, level: 0, parent: null }];

    const allLines: any[] = [];

    while (queue.length) {
      const cur = queue.shift()!;
      const code = String(cur.code ?? '').trim();
      if (!code || visited.has(code)) continue;

      visited.add(code);

      // ✅ BOM + RouteStages (cache’li)
      let data = cache.get(code);
      if (!data) {
        data = await this.getBomByItemCode(code); // artık { items, routeStages }
        cache.set(code, data);
      }

      const { items, routeStages } = data;

      // ✅ stageId -> stage meta map (ITT2)
      const stageByStageId = new Map<number, any>();
      for (const s of routeStages ?? []) {
        const sid = Number(s.stageId ?? 0);
        if (sid) stageByStageId.set(sid, s);
      }

      // ✅ exploded lines: sadece items üzerinden
      for (const it of items ?? []) {
        const child = String(it.itemCode ?? it.ItemCode ?? '').trim();
        const sid = Number(it.stageId ?? it.StageId ?? 0) || null;
        const st = sid ? stageByStageId.get(sid) : null;

        allLines.push({
          // orijinal item satırı
          ...it,

          // stage bilgisi (opsiyonel ama çok işe yarar)
          stageName: st?.stageName ?? st?.StageName ?? it.stageName ?? null,
          stageCode: st?.stageCodeRaw ?? st?.StageCode ?? it.stageCode ?? null,
          stageSeq: st?.seqNum ?? st?.SeqNum ?? null,

          // exploded meta
          _root: root,
          _father: code, // bu BOM’un sahibi (parent item)
          _parent: cur.parent, // bir üst zincirdeki parent
          _level: cur.level,
        });

        // ✅ derinleştir: child varsa kuyruğa at
        // (İstersen burada “child’ın BOM’u var mı” kontrolünü ayrıca yapabilirsin)
        if (child) {
          queue.push({ code: child, level: cur.level + 1, parent: code });
        }
      }
    }

    return allLines;
  }

  // SQLQueries('BomByItemCode')/List kullanıyoruz (senin mevcut yaklaşım)
  // async getBomByItemCode(itemCode: string) {
  //   const code = String(itemCode ?? '').trim();
  //   if (!code) return [];

  //   this.logger.log(`SAP → BOM çekiliyor: ${code}`);

  //   const PAGE_SIZE = 200;
  //   const MAX_PAGES = 50;

  //   const all: any[] = [];

  //   for (let page = 0; page < MAX_PAGES; page++) {
  //     const skip = page * PAGE_SIZE;

  //     const body: any = {
  //       ParamList: `ItemCode='${code.replace(/'/g, "''")}'`,
  //       QueryOption: `$top=${PAGE_SIZE}&$skip=${skip}`, // ✅ asıl olay bu
  //     };

  //     const res: any = await this.sap.post(
  //       `SQLQueries('BomByItemCode')/List`,
  //       body,
  //     );
  //     const rows: any[] = res?.value ?? [];

  //     all.push(...rows);

  //     // son sayfa
  //     if (rows.length < PAGE_SIZE) break;
  //   }

  //   this.logger.log(
  //     `[getBomByItemCode] itemCode=${code} totalLines=${all.length}`,
  //   );
  //   this.logger.log(
  //     'distinct StageId: ' +
  //       JSON.stringify(Array.from(new Set(all.map((x) => x.StageId))).sort()),
  //   );

  //   this.logger.log(
  //     'sample ItemCodes: ' +
  //       JSON.stringify(all.slice(0, 10).map((x) => x.ItemCode)),
  //   );

  //   return all;
  // }

  // SapBomService.ts

  private async runSqlQueryPaged(queryName: string, itemCode: string) {
    const code = String(itemCode ?? '').trim();
    if (!code) return [];

    const PAGE_SIZE = 50;
    const MAX_PAGES = 200;

    const all: any[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const skip = page * PAGE_SIZE;

      const body: any = {
        ParamList: `ItemCode='${code.replace(/'/g, "''")}'`,
        QueryOption: `$top=${PAGE_SIZE}&$skip=${skip}`,
      };

      const res: any = await this.sap.post(
        `SQLQueries('${queryName}')/List`,
        body,
      );
      const rows: any[] = res?.value ?? [];

      all.push(...rows);

      this.logger.log(
        `[runSqlQueryPaged] ${queryName} page=${page} rows=${rows.length} skip=${skip}`,
      );

      if (rows.length < PAGE_SIZE) break;
    }

    this.logger.log(`[runSqlQueryPaged] ${queryName} total=${all.length}`);
    return all;
  }

  async getBomByItemCode(itemCode: string) {
    const code = String(itemCode ?? '').trim();
    if (!code) return { items: [], routeStages: [] };

    const [itemsRaw, stagesRaw] = await Promise.all([
      this.runSqlQueryPaged('BomByItemCode', code), // ITT1
      this.runSqlQueryPaged('BomRouteStagesByItemCode', code), // ITT2
    ]);

    const routeStages = stagesRaw
      .map((x) => ({
        // ITT2.StageId (1..7)
        stageId: Number(x.StageId ?? 0) || null,
        // ORST.AbsEntry
        stgEntry: Number(x.StgEntry ?? 0) || null,
        // order
        seqNum: Number(x.SeqNum ?? 0) || 0,
        stageName: String(x.StageName ?? '').trim(),
        stageCodeRaw: String(x.StageCode ?? '').trim(), // ORST.Code (AKUPLE vb)
      }))
      .filter((s) => s.stageId && (s.stageName || s.stageCodeRaw))
      .sort((a, b) => a.seqNum - b.seqNum);

    const items = itemsRaw
      .map((x) => ({
        lineType: Number(x.LineType ?? 0) || null, // ITT1.Type
        itemCode: String(x.ItemCode ?? '').trim(),
        itemName: String(x.ItemName ?? '').trim() || null,
        quantity: Number(x.Quantity ?? 0) || 0,
        whsCode: String(x.WhsCode ?? '').trim() || null,
        uomName: String(x.UomName ?? '').trim() || null,
        issueMethod: String(x.IssueMethod ?? '').trim() || null,
        // ITT1.StageID = ORST.AbsEntry = ITT2.StgEntry ile eşleşir
        stageId: Number(x.StageId ?? 0) || null,
        visOrder: Number(x.VisOrder ?? 0) || 0,
      }))
      .filter((it) => it.itemCode && it.quantity > 0);

    return { items, routeStages };
  }
}
