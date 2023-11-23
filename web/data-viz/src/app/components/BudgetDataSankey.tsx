import { AppContext } from "../AppContext";
import React, { useContext, useEffect, useState } from "react";
import Plot from "react-plotly.js";
import fetchSankeyData from "./SankeyPlotData";

const SankeyDiagram: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);

  const sankeyConfigBase: Plotly.Data = {
    type: "sankey",
    orientation: "h",
    arrangement: "snap",
    domain: {
      x: [0, 1],
      y: [0, 1],
    },
    node: {
      pad: 15,
      thickness: 30,
      line: {
        color: "black",
        width: 0.5,
      },
    },
    valuesuffix: "B",
    valueformat: "$.0f",
  };

  const [plotData, setPlotData] = useState([sankeyConfigBase]);

  useEffect(() => {
    const url = "/dash/data/goi2324/sankey.v2.json";
    fetchSankeyData(url).then((data) => {
      setPlotData([
        {
          ...sankeyConfigBase,
          node: {
            ...sankeyConfigBase.node,
            label: data.label,
            x: data.node?.x,
            y: data.node?.y,
          },
          link: data.link,
        },
      ]);
    });
  }, [state.key]);

  const layout = {
    font: {
      size: 12,
    },
    width: 1280,
    height: 840,
    margin: { t: 20, b: 240, l: 0, r: 0, pad: 2 },
  };

  return <Plot data={plotData as Plotly.Data[]} layout={layout} />;
};

export default SankeyDiagram;
