import Defaults from "../components/Defaults";

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

type Context = {
  levels: number[];
};

class SankeyUtils {
  static processSankeySectionExtent(
    section: SankeyJsonSection,
    context: Context
  ): NodePositionMap {
    if (!section.pos) {
      return {};
    }

    let { x, y } = section.pos;
    x = context.levels[section.level];
    // if (section.level) {
    //   x = context.levels[section.level];
    // }

    let node_pos_map: NodePositionMap = {};

    section.edges.forEach((e) => {
      const node = e[1];
      node_pos_map[node] = { x: x, y: y };
    });

    return node_pos_map;
  }

  static removeUnconnectedNodes(data: SankeyData): SankeyData {
    const data_clean: SankeyData = {
      nodes: {},
      edges: [],
      positions: {},
    };

    data_clean.edges = data.edges;
    const nodes_present = [
      ...data.edges.map((e) => e.src),
      ...data.edges.map((e) => e.dest),
    ];

    const node_map = new Map(nodes_present.map((x) => [x, true]));

    for (const [key, value] of Object.entries(data.nodes)) {
      if (node_map.has(key)) {
        data_clean.nodes[key] = value;
      }
    }

    for (const [key, value] of Object.entries(data.positions)) {
      if (node_map.has(key)) {
        data_clean.positions[key] = value;
      }
    }

    return data_clean;
  }

  static fillUnallocatedEdge(data: SankeyData): SankeyData {
    const node_map = new Map<string, number>();
    console.log("In Fill Unallocated Edge: ", data.edges);

    for (const e of data.edges) {
      const nval = node_map.get(e.src) || 0;
      node_map.set(e.src, nval - e.value);

      const nval2 = node_map.get(e.dest) || 0;
      node_map.set(e.dest, nval2 + e.value);
    }

    console.log("Node Map: ", node_map);

    const new_edges: NodeEdge[] = data.edges.map((e) => {
      if (e.value == -1) {
        console.log(e);
        e.value = node_map.get(e.src)!;
      }

      return e;
    });

    return {
      nodes: data.nodes,
      edges: new_edges,
      positions: data.positions,
    };
  }

  static processSankeySection(
    section: SankeyJsonSection,
    context: Context
  ): SankeyData {
    if (!section.active) return { nodes: {}, edges: [], positions: {} };

    let sankey_data: SankeyData = {
      nodes: section.nodes,
      edges: section.edges.map((e) => {
        return {
          src: e[0],
          dest: e[1],
          value: e[2],
          color: section.linkcolor || Defaults.SANKEY_EDGE_COLOR,
        };
      }),
      positions: SankeyUtils.processSankeySectionExtent(section, context),
    };

    sankey_data = SankeyUtils.removeUnconnectedNodes(sankey_data);
    // sankey_data = SankeyUtils.fillUnallocatedEdge(sankey_data);

    if (!section.group || (section.group && !section.group.display)) {
      return sankey_data;
    }

    const group = section.group;

    sankey_data.nodes[group.id] = group.name;
    sankey_data.positions[group.id] = group.pos;
    sankey_data.positions[group.id].x = context.levels[section.level + 1];

    let group_edges: NodeEdge[] = [];

    section.edges.forEach((edge) => {
      group_edges.push({
        src: edge[1],
        dest: group.id,
        value: edge[2],
        color: section.linkcolor || Defaults.SANKEY_EDGE_COLOR,
      });
    });

    console.log("Nodes: ", sankey_data.nodes);
    console.log("Generated edges: ", group_edges);

    sankey_data.edges = sankey_data.edges.concat(group_edges);
    return sankey_data;
  }

  static mergeGraphData(inputData: SankeyJson): SankeyData {
    const root_node = inputData.metadata.root;
    const root_pos = inputData.metadata.position;
    const context: Context = {
      levels: inputData.metadata.levels,
    };

    const mergedData: SankeyData = {
      nodes: {},
      edges: [],
      positions: {},
    };

    mergedData.positions[root_node] = root_pos;

    inputData.data.forEach((item) => {
      const { nodes, edges, positions } = SankeyUtils.processSankeySection(
        item,
        context
      );

      console.log("Processed Data: ", nodes, edges, positions);

      Object.assign(mergedData.nodes, nodes);
      Object.assign(mergedData.positions, positions);
      mergedData.edges.push(...edges);
    });

    const mergedDataUnalloc = SankeyUtils.fillUnallocatedEdge(mergedData);

    console.log("Merged Data: ", mergedData);
    console.log("Merged DataUnAlloc: ", mergedDataUnalloc);

    return mergedDataUnalloc;
  }
}

export default SankeyUtils;
