import Colors from "../Colors";
import Defaults from "./Defaults";

type NodeMap = { [id: string]: string };

type NodePosition = {
  x: number;
  y: number;
};

type NodePositionMap = { [id: string]: NodePosition };

type Edge = [string, string, number];

type NodeEdge = {
  src: string;
  dest: string;
  value: number;
  color: number;
};

type SankeyJsonGroup = {
  name: string;
  id: string;
  display: boolean;
  pos: NodePosition;
};

type SankeyJsonSection = {
  active: boolean;
  desc: string;
  linkcolor?: number;
  group?: SankeyJsonGroup;
  pos: NodePosition;
  nodes: NodeMap;
  edges: Edge[];
};

type SankeyJson = {
  data: SankeyJsonSection[];
};

type SankeyData = {
  nodes: NodeMap;
  edges: NodeEdge[];
  positions: NodePositionMap;
};

type SankeyPlotData = {
  label: string[];
  link: {
    source: number[];
    target: number[];
    value: number[];
    color: string[];
  };
  node?: {
    x: number[];
    y: number[];
  };
};

function processSankeySectionExtent(
  section: SankeyJsonSection
): NodePositionMap {
  if (!section.pos) {
    return {};
  }

  // unpack section.extent into two variables x and y
  const { x, y } = section.pos;
  let node_pos_map: NodePositionMap = {};

  section.edges.forEach((e) => {
    const node = e[1];
    node_pos_map[node] = { x: x, y: y };
  });

  return node_pos_map;
}

function processSankeySection(section: SankeyJsonSection): SankeyData {
  if (!section.active) return { nodes: {}, edges: [], positions: {} };

  const edges = section.edges;
  const edgesv2 = edges.map((e) => {
    return {
      src: e[0],
      dest: e[1],
      value: e[2],
      color: section.linkcolor || Defaults.SANKEY_EDGE_COLOR,
    };
  });

  const nodes_present = [...edges.map((e) => e[0]), ...edges.map((e) => e[1])];
  const node_set = new Set(nodes_present);
  let node_map_clean: NodeMap = {};
  for (const node of node_set) {
    if (section.nodes[node]) {
      node_map_clean[node] = section.nodes[node];
    }
  }

  const node_positions = processSankeySectionExtent(section);

  if (!section.group || (section.group && !section.group.display)) {
    return {
      nodes: node_map_clean,
      edges: edgesv2,
      positions: node_positions,
    };
  }

  const nodes = node_map_clean;
  const group = section.group;

  node_positions[group.id] = group.pos;

  let newEdges: Edge[] = [];
  let newEdgesv2: NodeEdge[] = [];

  section.edges.forEach((edge) => {
    newEdges.push([edge[1], group.id, edge[2]]);
    newEdgesv2.push({
      src: edge[1],
      dest: group.id,
      value: edge[2],
      color: section.linkcolor || Defaults.SANKEY_EDGE_COLOR,
    });
  });

  console.log("Nodes: ", nodes);

  console.log("Generated edges: ", newEdges);

  return {
    nodes: { ...nodes, [group.id]: group.name },
    edges: [...newEdgesv2, ...edgesv2],
    positions: node_positions,
  };
}

function mergeGraphData(inputData: SankeyJsonSection[]): SankeyData {
  const mergedData: SankeyData = {
    nodes: {},
    edges: [],
    positions: {
      g2: Defaults.SANKEY_ROOT_POSITION,
    },
  };

  inputData.forEach((item) => {
    // const processed_item = processSankeySection(item);
    const { nodes, edges: edgesv2, positions } = processSankeySection(item);

    // console.log("Processed Item: ", processed_item);
    Object.assign(mergedData.nodes, nodes);
    Object.assign(mergedData.positions, positions);
    mergedData.edges.push(...edgesv2);
  });
  console.log("Merged Data: ", mergedData);

  return mergedData;
}

function constructAbbrevIndexMap(nodes: NodeMap): Map<string, number> {
  const abbrevIndexMap = new Map<string, number>();
  let index = 0;
  Object.keys(nodes).forEach((abbrev) => {
    if (!abbrevIndexMap.has(abbrev)) {
      abbrevIndexMap.set(abbrev, index++);
    }
  });
  return abbrevIndexMap;
}

function convertGraphDataToPlotData(inputData: SankeyJson): SankeyPlotData {
  const mergedSankeyData = mergeGraphData(inputData.data);
  const nodes = mergedSankeyData.nodes;

  const abbrevIndexMap = constructAbbrevIndexMap(nodes);
  const numNodes = abbrevIndexMap.size;
  const labels: string[] = Object.values(nodes);

  const posArray: (NodePosition | undefined)[] = Array.from(
    { length: numNodes },
    () => undefined
  );

  abbrevIndexMap.forEach((value, key) => {
    posArray[value] = mergedSankeyData.positions[key];
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
