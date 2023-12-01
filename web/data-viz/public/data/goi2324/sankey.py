import os
import pandas as pd
import json
from typing import Dict, List, Tuple, Set, TypedDict

# Type aliases for clarity
NodeMap = Dict[str, str]
NodeEdge = Tuple[str, str, int]
SankeyData = Dict[str, any]


# define named class called sankey_section
class SankeySection(TypedDict):
    id: str
    desc: str
    linkcolor: int
    nodes: dict[str, str]
    edges: list[Tuple[str, str, int]]
    pos: list[str, str]


def add_prefix_to_dest_in_section(edges, nodes):
    # Map each destination node to its source node
    dest_map = {dest: src for src, dest, _ in edges}

    # Add prefix to destination nodes in edges
    new_edges = [
        (src, f"{src}_{dest}" if dest in dest_map else dest, value)
        for src, dest, value in edges
    ]

    # Rename nodes in the nodes map according to dest_map
    new_nodes = {
        node_id if node_id not in dest_map else f"{dest_map[node_id]}_{node_id}": label
        for node_id, label in nodes.items()
    }

    return new_edges, new_nodes


def create_sankey_section(fname: str) -> None:
    df = pd.read_csv(fname)
    node_keys = df["dest_abbrev"].tolist()
    node_labels = df["dest_name"].tolist()
    node_dict = dict(zip(node_keys, node_labels))
    df = df.dropna()
    src = df["source_abbrev"].tolist()
    dest = df["dest_abbrev"].tolist()
    amount = df["amount"].astype(int).tolist()
    edges = list(zip(src, dest, amount))

    sec_id = fname.replace(".csv", "")
    sec_xpos_map = {
        "goi": "l1",
    }

    if sec_id in sec_xpos_map:
        xpos = sec_xpos_map[sec_id]
    else:
        xpos = "l2"
    ypos = f"y{sec_id}"

    edges = sorted(edges, key=lambda x: x[2], reverse=True)
    if sec_id == "goi":
        node_tuples = list(node_dict.items())
        node_tuples = map(lambda x: (x[0].replace("g2_", ""), x[1]), node_tuples)
        node_dict = dict(node_tuples)
        edges = map(lambda x: (x[0], x[1].replace("g2_", ""), x[2]), edges)

    sankey_section: SankeySection = {
        "id": sec_id,
        "desc": f"{sec_id} section",
        "linkcolor": 0,  # Default link color, can be adjusted as needed
        "nodes": node_dict,
        "edges": edges,
        "pos": {"x": xpos, "y": ypos},
    }

    print(sankey_section)

    return sankey_section


def merge_sankey_sections(
    sections: List[SankeySection],
) -> Tuple[NodeMap, List[NodeEdge]]:
    """Merge all nodes and edges from all sections into one common data structure."""
    merged_nodes = {}
    merged_edges = []
    for section_idx, section in enumerate(sections):
        new_nodes = section["nodes"]
        new_edges = section["edges"]
        # if section_idx == 0:
        #     merged_nodes.update(section["nodes"])
        #     merged_edges.extend(section["edges"])
        #     continue

        # new_edges, new_nodes = add_prefix_to_dest_in_section(
        #     section["edges"], section["nodes"]
        # )

        merged_nodes.update(new_nodes)
        merged_edges.extend(new_edges)
    return merged_nodes, merged_edges


def dfs_emit_sections(
    start_node: str, edges: List[NodeEdge], nodes: NodeMap
) -> List[SankeySection]:
    """Do a DFS on the edges starting from root and emit a separate section for each intermediate node."""
    visited = set()
    sections = []

    def dfs(node: str, parent_section: SankeySection):
        visited.add(node)
        # Create a new section for the current node
        current_section = {
            "id": parent_section["id"] + "_" + node,
            "desc": f"{nodes[node]} section",
            "linkcolor": parent_section["linkcolor"],
            "nodes": {node: nodes[node]},
            "edges": [],
        }

        for edge in edges:
            src, dest, value = edge
            if src == node and dest not in visited:
                current_section["edges"].append(edge)
                current_section["nodes"][dest] = nodes[dest]
                # Recursive DFS call
                if "g2" in src:
                    dfs(dest, current_section)
        sections.append(current_section)

    # Start DFS from the root node
    root_section = {
        "id": "root",
        "desc": "Root section",
        "linkcolor": 0,  # Default link color, can be adjusted as needed
        "nodes": {start_node: nodes[start_node]},
        "edges": [],
    }
    dfs(start_node, root_section)
    return sections


def do_section_postprocess(section: dict) -> dict:
    section["edges"] = sorted(section["edges"], key=lambda x: x[2], reverse=True)
    yposkey = section["id"].split("_")[-1]
    sec_x = "l2"
    if section["id"] == "root_g2":
        sec_x = "l1"
    section["pos"] = {"x": sec_x, "y": f"y{yposkey}"}
    return section


def do_merge(sankey_json: dict, file_path_out: str):
    # Merge all nodes and edges into one common data structure
    merged_nodes, merged_edges = merge_sankey_sections(sankey_json["data"])

    # Perform DFS and emit sections
    sankey_sections = dfs_emit_sections(
        sankey_json["metadata"]["root"], merged_edges, merged_nodes
    )

    sankey_sections = sorted(sankey_sections, key=lambda x: x["id"])
    sankey_sections[0] = create_sankey_section("goi.csv")

    sankey_sections = list(map(do_section_postprocess, sankey_sections))
    for section in sankey_sections:
        sec_id = section["id"]
        # print(f'"{sec_id}",')
        print(f'"{sec_id}": 0.01,')
        # print(section["id"] + ",")

    sankey_sec_ids = [section["id"] for section in sankey_sections]
    sankey_sec_ypos = [section["pos"]["y"] for section in sankey_sections]
    metadata = sankey_json["metadata"]
    metadata["all"] = sankey_sec_ids
    metadata["active"] = sankey_sec_ids
    metadata["ypos"] = {ypos: 0.01 for ypos in sankey_sec_ypos}

    new_json = sankey_json
    new_json["metadata"] = metadata
    new_json["data"] = sankey_sections

    # Print or return the new sections
    new_json = json.dumps(new_json, indent=2)
    # print(new_json)
    with open(file_path_out, "w") as file_out:
        file_out.write(new_json)
    pass


def run():
    # Load your JSON data
    dir_path = os.path.dirname(os.path.realpath(__file__))
    file_name_in = "sankey.v4.json"
    file_path_in = f"{dir_path}/{file_name_in}"
    file_name_out = "sankey.v5.json"
    file_path_out = f"{dir_path}/{file_name_out}"

    with open(file_path_in, "r") as file:
        sankey_json = json.load(file)
        do_merge(sankey_json, file_path_out)


if __name__ == "__main__":
    run()
