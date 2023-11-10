import { TurnedIn } from "@mui/icons-material";
import Papa from "papaparse";

export type Record = {
  source_name: string;
  dest_name: string;
  source_abbrev: string;
  dest_abbrev: string;
  amount: number;
  amount_inr: number;
  amount_usd: number;
};

export type BudgetEdges = {
  parents: string[];
  labels: string[];
  values: number[];
  ids: string[];
};

class CsvReader {
  url_base: string;

  constructor(url_base: string) {
    this.url_base = url_base;
  }

  async read(url: string): Promise<Record[]> {
    const response = await fetch(url);
    const csvData = await response.text();
    const parsedData = Papa.parse(csvData, { header: true });
    const records: Record[] = [];

    for (const row of parsedData.data as any) {
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

  async get_dno_edges(csv_name: string): Promise<BudgetEdges> {
    const url = this.url_base + "/" + csv_name + ".csv";
    console.log("Loading URL: ", url);
    const records = await this.read(url);

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
    };

    return edges;
  }
}

export default CsvReader;
