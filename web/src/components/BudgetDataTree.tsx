import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import CsvReader, { BudgetEdges } from "../CsvReader";

const labels = ["A1", "A2", "A3", "A4", "A5", "B1", "B2"];
const parents = ["", "A1", "A2", "A3", "A4", "A1", "B1"];

type BudgetDataTreeProps = {
  csvName: string;
  setCsvName: (csvName: string) => void;
  setCsvTitle: (csvName: string) => void;
};

const BudgetDataTree: React.FC<BudgetDataTreeProps> = ({
  csvName,
  setCsvName,
  setCsvTitle,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BudgetEdges | null>(null);

  function handleClick(e: Plotly.PlotMouseEvent) {
    console.log(e);
    // e.preventDefault();
    const point_num = e.points[0].pointNumber;
    console.log(point_num);
    e.event.preventDefault();
    e.event.stopPropagation();
    e.event.stopImmediatePropagation();
    const data = e.points[0].data as BudgetEdges;
    const csv_str = data.ids[point_num].replace("g2_", "");
    console.log("Changing to: ", csv_str);
    setCsvName(csv_str);
    setCsvTitle(data.labels[point_num]);
  }

  useEffect(() => {
    console.log("Reading CSV: ", csvName);
    const csv_reader = new CsvReader("/data/goi2324.v3");
    csv_reader.get_dno_edges(csvName).then((data) => {
      console.log(data);
      setData(data);
      setLoading(false);
    });
  }, [csvName]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Plot
      data={[
        {
          type: "treemap",
          ids: data?.ids,
          parents: data?.parents,
          labels: data?.labels,
          values: data?.values,
          texttemplate: "%{label}<br />%{value:$.2f}B",
          hovertemplate: "%{label}<br />%{value:$.2f}B",
          branchvalues: "total",
        },
      ]}
      layout={{
        width: 1280,
        height: 720,
        margin: { t: 10, b: 0, l: 0, r: 0, pad: 4 },
      }}
      onClick={handleClick}
    />
  );
};

export default BudgetDataTree;
