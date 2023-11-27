import Defaults from "../components/Defaults";

import {
  Edge,
  NodeEdge,
  NodeMap,
  NodePosition,
  NodePositionMap,
  SankeyData,
  SankeyJson,
  SankeyJsonGroup,
  SankeyJsonMetadata,
  SankeyJsonSection,
  SankeyPlotData,
} from "../models/SankeyTypes";

import iwanthue from "iwanthue";

class SankeyUtils {
  static colorSankeyNodes(data: SankeyData, root: string): Map<string, string> {
    const sankey_graph = new Map<string, string[]>();
    data.edges.forEach((e) => {
      if (!sankey_graph.has(e.src)) {
        sankey_graph.set(e.src, []);
      }
      sankey_graph.get(e.src)!.push(e.dest);
    });

    const sankey_levels = new Map<number, string[]>();
    const dfs = (node: string, level: number) => {
      if (!sankey_levels.has(level)) {
        sankey_levels.set(level, []);
      }
      sankey_levels.get(level)!.push(node);

      if (sankey_graph.has(node)) {
        sankey_graph.get(node)!.forEach((child) => {
          dfs(child, level + 1);
        });
      }
    };

    const color_map = new Map<string, string>();

    dfs(root, 0);
    const palette = iwanthue(40);
    let color_idx = 1;
    color_map.set(root, palette[0]);

    for (let [level, nodes] of sankey_levels) {
      if (level == 0 || level == 2) {
        continue;
      }

      const node_set = new Set(nodes);
      node_set.forEach((node) => {
        color_map.set(node, palette[color_idx]);
        const node_children = sankey_graph.get(node);
        node_children?.forEach((child) => {
          color_map.set(child, palette[color_idx]);
        });
        color_idx++;
      });
    }

    console.log("Sankey levels: ", sankey_levels);
    console.log("Color map: ", color_map);

    return color_map;
  }
  static processSankeySectionExtent(
    section: SankeyJsonSection,
    context: SankeyJsonMetadata
  ): NodePositionMap {
    if (!section.pos) {
      return {};
    }

    // let { x, y } = section.pos;
    const x = context.xpos[section.pos.x];
    const y = context.ypos[section.pos.y];
    // x = context.levels[section.level];
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

  static getGroupPosition(
    section: SankeyJsonSection,
    context: SankeyJsonMetadata
  ): NodePosition {
    const group = section.group;
    if (!group) {
      return { x: 0, y: 0 };
    }

    let x = -1;
    const y = context.ypos[group.pos.y];

    const xpos_key = section.pos.x;
    // xpos_key is in the format "l0" - get the number from the string
    const xpos_num = parseInt(xpos_key.substring(1));
    const xpos_num_next = xpos_num + 1;
    const xpos_key_next = "l" + xpos_num_next.toString();
    if (context.xpos[xpos_key_next]) {
      x = context.xpos[xpos_key_next];
    } else if (context.xpos[group.pos.x]) {
      x = context.xpos[group.pos.x];
    }

    return { x: x, y: y };
  }

  static processSankeySection(
    section: SankeyJsonSection,
    context: SankeyJsonMetadata
  ): SankeyData {
    const active_sections = context.active;
    // check if section.id is in active_sections
    if (!(section.id && active_sections.includes(section.id))) {
      return { nodes: {}, edges: [], positions: {} };
    }
    // if (!section.active) return { nodes: {}, edges: [], positions: {} };

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
    // sankey_data.positions[group.id].x = context.levels[section.level + 1];
    sankey_data.positions[group.id] = SankeyUtils.getGroupPosition(
      section,
      context
    );

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
    const context = inputData.metadata;

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
    const node_colors = SankeyUtils.colorSankeyNodes(
      mergedDataUnalloc,
      root_node
    );

    mergedDataUnalloc.colors = Object.fromEntries(node_colors);

    console.log("Merged Data: ", mergedData);
    console.log("Merged DataUnAlloc: ", mergedDataUnalloc);

    return mergedDataUnalloc;
  }
}

export default SankeyUtils;
