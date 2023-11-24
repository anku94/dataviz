
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
  marker: {
    color: string[];
  };
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