import { TurnedIn } from "@mui/icons-material";
import Papa from "papaparse";
import { arrayBuffer } from "stream/consumers";
import AllColors from "./Colors";

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

function generateColorPalette(numColors: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < 360; i += 360 / numColors) {
    const hue = i;
    const saturation = 100; // constant saturation
    const lightness = 50; // constant lightness
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }
  return colors;
}

const discrete40 = generateColorPalette(40);

// const ColorScale = [
//   "#1f77b4",
//   "#ff7f0e",
//   "#2ca02c",
//   "#d62728",
//   "#9467bd",
//   "#8c564b",
//   "#e377c2",
//   "#7f7f7f",
//   "#bcbd22",
//   "#17becf",
// ];

const new40 = [
  "#a94056",
  "#3a7d1d",
  "#641a8a",
  "#2c7f45",
  "#983fae",
  "#2f5f1b",
  "#b62b93",
  "#656e18",
  "#5b5aca",
  "#83641b",
  "#3a3090",
  "#b13e1c",
  "#4061ac",
  "#ce2a38",
  "#5d438c",
  "#9b5321",
  "#652475",
  "#782315",
  "#9d4f9a",
  "#ab3b3c",
  "#752063",
  "#c92756",
  "#5e0b40",
  "#c02873",
  "#5e0b40",
  "#ae4b75",
  "#5e0b40",
  "#8a234a",
  "#5e0b40",
  "#6e1532",
  "#8c2a61",
  "#5e0b40",
  "#722251",
  "#5e0b40",
  "#5e0b40",
  "#5e0b40",
  "#5e0b40",
  "#5e0b40",
  "#5e0b40",
  "#5e0b40",
];

// Function to build the tree from records and assign colors
function assignColors(records: Record[], color_scale: string[]) {
  // Build a map to hold child-parent relationships and count vertices at each level
  const tree = new Map<string, { children: Set<string>; level: number }>();
  records.forEach((r) => {
    if (!tree.has(r.source_abbrev)) {
      tree.set(r.source_abbrev, { children: new Set(), level: 0 });
    }
    if (!tree.has(r.dest_abbrev)) {
      tree.set(r.dest_abbrev, { children: new Set(), level: 0 });
    }
    tree.get(r.source_abbrev)!.children.add(r.dest_abbrev);
  });

  // Function to set levels in the tree
  const setLevels = (node: string, level: number) => {
    const current = tree.get(node);
    if (current) {
      current.level = level;
      current.children.forEach((child) => {
        setLevels(child, level + 1);
      });
    }
  };

  // Assuming the root is the first source_abbrev (or you need to define it)
  const root = records[0].source_abbrev;
  setLevels(root, 1);

  // Find the first level with more than one vertex
  const levelCounts = new Map<number, number>();
  tree.forEach((value, key) => {
    const level = value.level;
    if (!levelCounts.has(level)) {
      levelCounts.set(level, 0);
    }
    levelCounts.set(level, levelCounts.get(level)! + 1);
  });

  console.log("Level Counts: ", levelCounts);

  let targetLevel = 1;
  for (let [level, count] of levelCounts) {
    if (count > 1) {
      targetLevel = level;
      break;
    }
  }

  // Assign colors to each vertex in the target level and its subtree
  const vertexColors = new Map<string, string>();
  // colorIndex 0 is reserved for levels < targetLevel
  let colorIndex = 1;

  const assignColor = (node: string, parent: string, level: number) => {
    console.log("Assigning color to: ", node, level, targetLevel);
    const current = tree.get(node);
    if (!current) {
      return;
    }
    if (level < targetLevel) {
      vertexColors.set(node, color_scale[0]);
    } else if (level == targetLevel) {
      const cur_color_idx = colorIndex % color_scale.length;
      console.log("Setting color: ", cur_color_idx);
      vertexColors.set(node, color_scale[cur_color_idx]);
      colorIndex++;
    } else {
      let parent_color = vertexColors.get(parent)!;
      vertexColors.set(node, parent_color);
    }
    current.children.forEach((child) => {
      assignColor(child, node, level + 1);
    });
  };

  assignColor(root, "", 1);

  const colors = records.map((r) => vertexColors.get(r.dest_abbrev)!);
  console.log("Colors: ", colors);
  return colors;
}

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
      marker: {
        color: assignColors(records_filtered, AllColors.default40),
      },
    };

    return edges;
  }

  async read_dir(): Promise<DirRecord[]> {
    const records: DirRecord[] = [];
    return records;
  }
}

export default CsvReader;
