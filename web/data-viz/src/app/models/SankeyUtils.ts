import Defaults from "../components/Defaults";

import {
  Edge,
  NodeEdge,
  NodeMap,
  NodePosition,
  NodePositionAlias,
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
    let node_pos_map: NodePositionMap = {};

    section.edges.forEach((e) => {
      const node = e[1];
      node_pos_map[node] = section.pos;
    });

    return node_pos_map;
  }

  static removeUnconnectedNodes(data: SankeyData): SankeyData {
    const data_clean: SankeyData = {
      context: data.context,
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
      context: data.context,
      nodes: data.nodes,
      edges: new_edges,
      positions: data.positions,
    };
  }

  static getXposNext(xpos: string) {
    const xpos_num = parseInt(xpos.substring(1));
    const xpos_num_next = xpos_num + 1;
    const xpos_key_next = "l" + xpos_num_next.toString();
    return xpos_key_next;
  }

  static getPosNext(posCur: NodePositionAlias): NodePositionAlias {
    console.log("In pos_next: ", posCur);
    const posNext: NodePositionAlias = { x: posCur.x, y: posCur.y };
    posNext.x = SankeyUtils.getXposNext(posCur.x);
    return posNext;
  }

  static resolveNodePosition(
    posAlias: NodePositionAlias,
    context: SankeyJsonMetadata
  ): NodePosition {
    const pos: NodePosition = { x: 0, y: 0 };
    pos.x = context.xpos[posAlias.x];
    pos.y = context.ypos[posAlias.y];
    return pos;
  }

  static getGroupPosition(
    section: SankeyJsonSection,
    context: SankeyJsonMetadata
  ): NodePosition {
    const group = section.group;
    if (!group) {
      return { x: 0, y: 0 };
    }

    return this.resolveNodePosition(group.pos, context);
  }

  static foldEdges(data: SankeyData, threshold: number): SankeyData {
    const edgesToRemove: NodeEdge[] = [];
    const edgesToAdd: { [key: string]: NodeEdge } = {};

    const nodesToAdd: NodeMap = {};
    const posToAdd: NodePositionMap = {};

    // Identify edges below the threshold and prepare to remove them.
    data.edges.forEach((edge) => {
      if (edge.value < threshold) {
        edgesToRemove.push(edge);
        // Sum values of the removed edges for each unique source node.
        if (edgesToAdd[edge.src]) {
          edgesToAdd[edge.src].value += edge.value;
        } else {
          edgesToAdd[edge.src] = {
            src: edge.src,
            dest: edge.src + "_others",
            value: edge.value,
            color: edge.color,
          };

          const parent_label = data.nodes[edge.src];
          // get first letter of each word in parent label as a string
          const parent_abbrev = parent_label
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toLocaleUpperCase();

          nodesToAdd[edge.src + "_others"] = `${parent_abbrev} (Others)`;
          console.log("Parent node: ", edge.src, "Pos map: ", data.positions);
          // posToAdd[edge.src + "_others"] = this.getPosNext(
          //   data.positions[edge.dest]
          // );
          posToAdd[edge.src + "_others"] = data.positions[edge.dest];
        }
      }
    });

    // Remove edges that are below the threshold.
    const filteredEdges = data.edges.filter(
      (edge) => !edgesToRemove.includes(edge)
    );

    // Add the new "others" edges.
    Object.values(edgesToAdd).forEach((edge) => {
      filteredEdges.push(edge);
    });

    // Return the new SankeyData with the updated edges.
    return {
      ...data,
      nodes: { ...data.nodes, ...nodesToAdd },
      edges: filteredEdges,
      positions: { ...data.positions, ...posToAdd },
    };
  }

  static sortSankeyData(data: SankeyData, root: string): SankeyData {
    const sortedEdges: NodeEdge[] = [];
    const visited = new Set<string>();

    function dfs(currentId: string) {
      // Mark the current node as visited
      visited.add(currentId);

      // Get all edges starting from the current node, not visited, and sort them in descending order
      const childEdges = data.edges
        .filter((edge) => edge.src === currentId && !visited.has(edge.dest))
        .sort((a, b) => b.value - a.value);

      // Add sorted edges to the sortedEdges array
      for (const edge of childEdges) {
        sortedEdges.push(edge);
        // Recursively apply DFS on the destination nodes (children)
        dfs(edge.dest);
      }
    }

    // Start DFS from the root node
    dfs(root);

    // Return the new SankeyData with edges sorted
    return {
      ...data,
      edges: sortedEdges,
    };
  }

  static processSankeySection(
    section: SankeyJsonSection,
    context: SankeyJsonMetadata
  ): SankeyData {
    const active_sections = context.active;
    // check if section.id is in active_sections
    if (!(section.id && active_sections.includes(section.id))) {
      return { context, nodes: {}, edges: [], positions: {} };
    }
    // if (!section.active) return { nodes: {}, edges: [], positions: {} };

    let sankey_data: SankeyData = {
      context,
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
    sankey_data.positions[group.id] = section.group.pos;

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

    const data_merged: SankeyData = {
      context: context,
      nodes: {},
      edges: [],
      positions: {},
    };

    data_merged.positions[root_node] = root_pos;

    inputData.data.forEach((item) => {
      const { nodes, edges, positions } = SankeyUtils.processSankeySection(
        item,
        context
      );

      console.log("Processed Data: ", nodes, edges, positions);

      Object.assign(data_merged.nodes, nodes);
      Object.assign(data_merged.positions, positions);
      data_merged.edges.push(...edges);
    });

    const data_wunalloc = SankeyUtils.fillUnallocatedEdge(data_merged);
    const node_colors = SankeyUtils.colorSankeyNodes(data_wunalloc, root_node);

    data_wunalloc.colors = Object.fromEntries(node_colors);
    const data_folded = SankeyUtils.foldEdges(data_wunalloc, 10000);

    const data_sorted = SankeyUtils.sortSankeyData(data_folded, root_node);

    console.log("Merged Data: ", data_merged);
    console.log("Data W/ Unalloc", data_wunalloc);
    console.log("Data folded: ", data_folded);
    console.log("Data sorted: ", data_sorted);

    return data_sorted;
  }
}

export default SankeyUtils;
