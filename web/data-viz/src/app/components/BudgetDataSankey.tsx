import { AppContext } from "../AppContext";
import React, { useContext, useEffect, useState } from "react";
import Plot from "react-plotly.js";
import CsvReader from "../CsvReader";
import fetchGraphData from "./SankeyPlotData";

const InitialSankeyPlotData: Plotly.Data[] = [
  {
    type: "sankey",
    orientation: "h",
    node: {
      pad: 15,
      thickness: 30,
      line: {
        color: "black",
        width: 0.5,
      },
      label: [],
    },
    link: {
      source: [],
      target: [],
      value: [],
    },
  },
];

const SankeyDiagram: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const { state, dispatch } = useContext(AppContext);
  const [plotData, setPlotData] = useState(InitialSankeyPlotData);

  useEffect(() => {
    const url = "/dash/data/goi2324/sankey.json";
    fetchGraphData(url).then((data) => {
      setPlotData(data);
    });
  }, [state.key]);

  const layout = {
    font: {
      size: 10,
    },
    width: 1280,
    height: 720,
    margin: { t: 10, b: 0, l: 0, r: 0, pad: 4 },
  };

  return <Plot data={plotData as Plotly.Data[]} layout={layout} />;
};

export default SankeyDiagram;
