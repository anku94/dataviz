import Defaults from "./Defaults";

import {
  Edge,
  NodeEdge,
  NodeMap,
  NodePosition,
  NodePositionMap,
  SankeyData,
  SankeyJson,
  SankeyJsonMetadata,
  SankeyJsonSection,
  SankeyPlotData,
} from "../models/SankeyTypes";

import SankeyUtils from "../models/SankeyUtils";

function serializeNodes(edges: NodeEdge[]): string[] {
  const abbrevIndexMap = new Map<string, number>();
  let nodes: string[] = [];
  let index = 0;
  edges.forEach((edge) => {
    if (!abbrevIndexMap.has(edge.src)) {
      abbrevIndexMap.set(edge.src, index++);
      nodes.push(edge.src);
    }
    if (!abbrevIndexMap.has(edge.dest)) {
      abbrevIndexMap.set(edge.dest, index++);
      nodes.push(edge.dest);
    }
  });

  return nodes;
}

function convertGraphDataToPlotData(inputData: SankeyJson): SankeyPlotData {
  const mergedSankeyData = SankeyUtils.mergeGraphData(inputData);
  const custom_data = SankeyUtils.computeCustomData(mergedSankeyData);
  const nodes = mergedSankeyData.nodes;

  // const abbrevIndexMap = serializeNodes(mergedSankeyData.edges);
  const serialized_nodes = serializeNodes(mergedSankeyData.edges);

  const abbrevIndexMap = new Map<string, number>();
  // construct a map from node abbreviations to indices
  serializeNodes(mergedSankeyData.edges).forEach((node, index) => {
    abbrevIndexMap.set(node, index);
  });

  const node_positions = serialized_nodes.map((n) =>
    SankeyUtils.resolveNodePosition(
      mergedSankeyData.positions[n],
      mergedSankeyData.context
    )
  );

  const edges = mergedSankeyData.edges;

  const plot_data = {
    label: serialized_nodes.map((e) => nodes[e]),
    link: {
      source: edges.map((e) => abbrevIndexMap.get(e.src)!),
      target: edges.map((e) => abbrevIndexMap.get(e.dest)!),
      value: edges.map((e) => e.value),
      color: edges.map((e) => e.color),
      customdata: custom_data.edge_labels,
    },
    node: {
      x: node_positions.map((p) => p.x || 0),
      y: node_positions.map((p) => p.y || 0),
      color: serialized_nodes.map(
        (e) => mergedSankeyData.colors?.[e] || Defaults.SANKEY_NODE_COLOR
      ),
      customdata: serialized_nodes.map(
        (e) => custom_data.node_labels.get(e) || ""
      ),
    },
  };

  console.log("Plot Data: ", plot_data);
  return plot_data;
}

// Function to fetch the data
export async function fetchSankeyDataOld(url: string): Promise<SankeyPlotData> {
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

async function fetchJsonArray<T>(files: string[]): Promise<T[]> {
  try {
    const responses = await Promise.all(
      files.map((url) => fetch(Defaults.SANKEY_FILE_PREFIX + "/" + url))
    );
    responses.forEach((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
    });

    const jsonPromises = responses.map(
      (response) => response.json() as Promise<T>
    );
    return await Promise.all(jsonPromises);
  } catch (error) {
    console.error("Error fetching URLs:", error);
    throw error; // Rethrow the error for caller to handle
  }
}

export async function fetchSankeyData(url: string): Promise<SankeyPlotData> {
  const metadata_url = Defaults.SANKEY_FILE_PREFIX + "/metadata.json";
  const metadata_req = await fetch(metadata_url);
  const metadata: SankeyJsonMetadata = await metadata_req.json();

  const data: SankeyJsonSection[] = await fetchJsonArray(Defaults.SANKEY_FILES);
  const all_data: SankeyJson = {
    metadata: metadata,
    data: data,
  };

  return convertGraphDataToPlotData(all_data);
}

export default fetchSankeyData;
