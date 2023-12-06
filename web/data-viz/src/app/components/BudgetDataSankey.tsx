import { AppContext } from "../AppContext";
import React, { useContext, useEffect, useState } from "react";
import Plot from "react-plotly.js";
import fetchSankeyData from "./SankeyPlotData";
import BudgetData from "./BudgetData";
import { SankeyPlotData } from "../models/SankeyTypes";
import Defaults from "./Defaults";

const NODE_HOVER_TEMPLATE = "%{customdata}" + "<extra></extra>";

const LINK_HOVER_TEMPLATE = "%{customdata}" + "<extra></extra>";

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
    // valuesuffix: "B",
    // valueformat: "$.0f",
  };

  const applyData = (data: SankeyPlotData): Plotly.Data => {
    const sankeyConfigWithData: Plotly.Data = {
      ...sankeyConfigBase,
      node: {
        ...sankeyConfigBase.node,
        label: data.label,
        x: data.node?.x,
        y: data.node?.y,
        customdata: data.node?.customdata,
        color: data.node?.color,
        hoverinfo: "all",
        // @ts-ignore
        hovertemplate: NODE_HOVER_TEMPLATE,
        hoverlabel: {
          align: "left",
        },
      },
      link: {
        ...data.link,
        hovertemplate: LINK_HOVER_TEMPLATE,
        hoverinfo: "all",
        hoverlabel: {
          align: "left",
        },
        customdata: data.link?.customdata,
      },
    };

    return sankeyConfigWithData;
  };

  const [plotData, setPlotData] = useState([sankeyConfigBase]);

  useEffect(() => {
    // const url = "/dash/data/sankey/sankey.v7.json";
    fetchSankeyData(Defaults.SANKEY_URL).then((data) => {
      console.log(data);
      const sankeyData = applyData(data) as Plotly.SankeyData;
      setPlotData([sankeyData]);
    });
  }, [state.key]);

  const layout = {
    font: {
      size: 12,
    },
    width: 1280,
    height: 1600,
    margin: { t: 20, b: 240, l: 0, r: 0, pad: 2 },
  };

  return <Plot data={plotData as Plotly.Data[]} layout={layout} />;
};

export default SankeyDiagram;
