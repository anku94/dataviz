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

export type DirRecord = {
  demand_id: string;
  ministry: string;
  department: string;
  csv_name: string;
};

export type BudgetEdges = {
  parents: string[];
  labels: string[];
  values: number[];
  ids: string[];
};

export type BudgetCSVRow = {
  source_name: string;
  dest_name: string;
  source_abbrev: string;
  dest_abbrev: string;
  amount: number;
  amount_inr: number;
  amount_usd: number;
};

export type BudgetCSVFile = {
  name: string;
  rows: BudgetCSVRow[];
};

function acronym(input: string): string {
  if (input.length == 0) {
    return "";
  }

  return (
    input
      // Remove punctuation using regex
      .replace(/[^\w\s]|_/g, "")
      // Split the string into words
      .split(/\s+/)
      // Take the first character of each word and transform it to lowercase
      .map((word) => word[0].toLowerCase())
      // Join the first characters to form the acronym
      .join("")
  );
}

class CsvReader {
  constructor() {}

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
      // console.log(val, aggregatedData[u], aggregatedData[v]);
    }

    let records_filtered = records.filter((r) => {
      let u = r.source_abbrev;
      let v = r.dest_abbrev;
      let par_val = aggregatedData[u];
      let child_val = aggregatedData[v];
      // console.log(u, v);
      // console.log(par_val, child_val);
      // console.log(child_val / par_val > 0.05);
      // return child_val / par_val > 0.05;
      return child_val > 4e8;
      // return true;
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

  async read_dir(): Promise<DirRecord[]> {
    // const response = await fetch(this.url_dir);
    // const csvData = await response.text();
    // const parsedData = Papa.parse(csvData, { header: true });

    const records: DirRecord[] = [];

    // for (const row of parsedData.data as any) {
    //   records.push({
    //     demand_id: row.demand_id,
    //     ministry: row.ministry,
    //     department: row.department,
    //     csv_name: row.csv_name,
    //   });
    // }
    return records;
  }
}

export default CsvReader;
