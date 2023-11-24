import Papa from "papaparse";
import AllColors from "./Colors";

import { BudgetEdges, Record } from "./BudgetTypes";
import DataTreeUtils from "./DataTreeUtils";

class CsvReader {
  constructor() {}

  async read(url: string): Promise<Record[]> {
    const response = await fetch(url);
    const csvData = await response.text();
    const parsedData = Papa.parse(csvData, { header: true });
    const records: Record[] = [];

    for (const row of parsedData.data as any) {
      console.log(row);
      if (!row.amount) continue;
      records.push({
        source_name: row.source_name,
        dest_name: row.dest_name,
        source_abbrev: row.source_abbrev,
        dest_abbrev: row.dest_abbrev,
        amount: row.amount,
        amount_inr: row.amount_inr,
        amount_usd: row.amount_usd,
      });
    }

    return records;
  }

  async get_dno_edges(csv_url: string): Promise<BudgetEdges> {
    console.log("Loading URL: ", csv_url);
    const records = await this.read(csv_url);

    let aggregatedData: { [key: string]: number } = {};

    for (const e of records) {
      const u = e.source_abbrev;
      const v = e.dest_abbrev;
      const val = e.amount_usd;
      aggregatedData[u] = (aggregatedData[u] || 0) + Number(val);
      aggregatedData[v] = (aggregatedData[v] || 0) + Number(val);
    }

    let records_filtered = records.filter((r) => {
      let u = r.source_abbrev;
      let v = r.dest_abbrev;
      let par_val = aggregatedData[u];
      let child_val = aggregatedData[v];
      return child_val > 4e8;
    });

    if (records_filtered.length < 8) {
      records_filtered = records;
    }

    let edges = {
      parents: records_filtered.map((r) => r.source_abbrev),
      ids: records_filtered.map((r) => r.dest_abbrev),
      labels: records_filtered.map((r) => r.dest_name),
      values: records_filtered.map((r) => r.amount_usd / 1e9),
      marker: {
        color: DataTreeUtils.assignColors(
          records_filtered,
          AllColors.default40
        ),
      },
    };

    return edges;
  }
}

export default CsvReader;
