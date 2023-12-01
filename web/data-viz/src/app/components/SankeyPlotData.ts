import Colors from "../models/Colors";
import Defaults from "./Defaults";

import {
  Edge,
  NodeEdge,
  NodeMap,
  NodePosition,
  NodePositionMap,
  SankeyData,
  SankeyJson,
  SankeyJsonSection,
  SankeyPlotData,
} from "../models/SankeyTypes";

import SankeyUtils from "../models/SankeyUtils";

function constructAbrevIndexMap(edges: NodeEdge[]): Map<string, number> {
  const abbrevIndexMap = new Map<string, number>();
  let index = 0;
  edges.forEach((edge) => {
    if (!abbrevIndexMap.has(edge.src)) {
      abbrevIndexMap.set(edge.src, index++);
    }
    if (!abbrevIndexMap.has(edge.dest)) {
      abbrevIndexMap.set(edge.dest, index++);
    }
  });
  return abbrevIndexMap;
}

function convertGraphDataToPlotData(inputData: SankeyJson): SankeyPlotData {
  const mergedSankeyData = SankeyUtils.mergeGraphData(inputData);
  const nodes = mergedSankeyData.nodes;

  const abbrevIndexMap = constructAbrevIndexMap(mergedSankeyData.edges);
  const numNodes = abbrevIndexMap.size;
  const keys = Array.from(abbrevIndexMap.keys());
  const labels: string[] = keys.map((key) => nodes[key]);

  const posArray: (NodePosition | undefined)[] = Array.from(
    { length: numNodes },
    () => undefined
  );

  const colorArray: (string | undefined)[] = Array.from(
    { length: numNodes },
    () => undefined
  );

  abbrevIndexMap.forEach((value, key) => {
    // console.log("key: ", key, "pos: ", mergedSankeyData.positions[key]);
    posArray[value] = SankeyUtils.resolveNodePosition(
      mergedSankeyData.positions[key],
      mergedSankeyData.context
    );
    colorArray[value] = mergedSankeyData.colors?.[key];
  });

  const edges = mergedSankeyData.edges;
  const color_scale = Colors["light5v3"];

  const plot_data = {
    label: labels,
    link: {
      source: edges.map((e) => abbrevIndexMap.get(e.src)!),
      target: edges.map((e) => abbrevIndexMap.get(e.dest)!),
      value: edges.map((e) => e.value / 8500.0),
      color: edges.map((e) => color_scale[e.color]),
    },
    node: {
      x: posArray.map((e) => e?.x || 0),
      y: posArray.map((e) => e?.y || 0),
      color: colorArray.map((e) => e || Defaults.SANKEY_NODE_COLOR),
    },
  };

  console.log("Plot Data: ", plot_data);
  return plot_data;
}

// Function to fetch the data
export async function fetchSankeyData(url: string): Promise<SankeyPlotData> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data: SankeyJson = await response.json();
    return convertGraphDataToPlotData(data);
  } catch (error) {
    console.error("Failed to fetch graph data:", error);
    throw error;
  }
}

export default fetchSankeyData;
