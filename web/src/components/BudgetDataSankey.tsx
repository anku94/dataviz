import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import CsvReader from '../CsvReader';

export type Record = {
  source_name: string;
  dest_name: string;
  source_abbrev: string;
  dest_abbrev: string;
  amount: number;
  amount_inr: number;
  amount_usd: number;
};

interface SankeyProps {
  records: Record[];
}

const SankeyDiagram: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<Record[] | null>(null);

  useEffect(() => {
    const csvName = "goi";
    console.log("Reading CSV: ", csvName);
    const csv_reader = new CsvReader("/data/goi2324.v3");
    csv_reader.read("/data/goi2324.v3/sankey.csv").then((data) => {
      console.log(data);
      setRecords(data);
      setLoading(false);
    });
  }, []);

  if (records == null || loading) {
    return <div>Loading...</div>;
  }


  const abbrevNameMap = new Map<string, string>();
  records.forEach(record => {
    abbrevNameMap.set(record.source_abbrev, record.source_name);
    abbrevNameMap.set(record.dest_abbrev, record.dest_name);
  });

  // Create a mapping for source and target abbreviations to indices
  const abbrevIndexMap = new Map<string, number>();
  let index = 0;
  abbrevNameMap.forEach((_, abbrev) => {
    if (!abbrevIndexMap.has(abbrev)) {
      abbrevIndexMap.set(abbrev, index++);
    }
  });

  // Create the arrays needed for the Sankey diagram
  const source = records.map(record => abbrevIndexMap.get(record.source_abbrev)!);
  const target = records.map(record => abbrevIndexMap.get(record.dest_abbrev)!);
  const values = records.map(record => record.amount_usd);
  const labels = Array.from(abbrevNameMap.values());

  console.log(labels);

  const plotData = [{
    type: 'sankey',
    orientation: 'h',
    node: {
      pad: 15,
      thickness: 30,
      line: {
        color: 'black',
        width: 0.5
      },
      label: labels
    },
    link: {
      source: source,
      target: target,
      value: values
    }
  }];

  const layout = {
    font: {
      size: 10
    },
    width: 1280,
    height: 720,
    margin: { t: 10, b: 0, l: 0, r: 0, pad: 4 },
  };

  return <Plot data={plotData as Plotly.Data[]} layout={layout} />;
}

export default SankeyDiagram;