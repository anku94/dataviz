import React, { useEffect, useState, useContext } from "react";
import Plot from "react-plotly.js";
import CsvReader, { BudgetEdges } from "../CsvReader";
import { AppContext } from "../AppContext";

const USD_INR = 83;
const ONE_LAKH = 100000;
const ONE_CRORE = 100 * ONE_LAKH;
const ONE_BILLION = 1e9;
const ONE_LC = ONE_LAKH * ONE_CRORE;
const BILL_USD_TO_LC_INR = (ONE_BILLION * USD_INR) / ONE_LC;
const INR_SYMBOL = "₹";

const BudgetDataTree: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BudgetEdges | null>(null);
  const { state, dispatch } = useContext(AppContext);

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
    const csv_title = data.labels[point_num];
    console.log("Changing to: ", csv_str);
    dispatch({ type: "SET_TITLE_AND_CSV", title: csv_title, csv: csv_str });
  }

  useEffect(() => {
    console.log("Reading CSV: ", state.selected_csv);
    const csv_reader = new CsvReader();
    csv_reader.get_dno_edges(state.selected_csv).then((data) => {
      console.log(data);
      setData(data);
      setLoading(false);
    });
  }, [state.selected_csv, state.key]);

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
          marker: {
            colors: data?.marker.color,
          },
          customdata: data?.values.map((v) => v * BILL_USD_TO_LC_INR),
          texttemplate:
            "%{label}<br />%{value:$.1f}B<br />" +
            INR_SYMBOL +
            "%{customdata:,.1f} Lakh Crores",
          hovertemplate:
            "%{label}<br />%{value:$.2f}B<br />" +
            INR_SYMBOL +
            "%{customdata:,.0f} Lakh Crores" +
            "<extra>Union Budget 2023-24</extra>",
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
