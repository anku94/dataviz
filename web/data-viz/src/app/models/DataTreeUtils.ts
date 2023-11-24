import { Record } from "./BudgetTypes";

type TreeNodeData = {
  children: Set<string>;
  level: number;
};

class DataTreeUtils {
  static buildTree(records: Record[]) {
    // Build a map to hold child-parent relationships and count vertices at each level
    const tree = new Map<string, TreeNodeData>();

    records.forEach((r) => {
      if (!tree.has(r.source_abbrev)) {
        tree.set(r.source_abbrev, { children: new Set(), level: 0 });
      }
      if (!tree.has(r.dest_abbrev)) {
        tree.set(r.dest_abbrev, { children: new Set(), level: 0 });
      }
      tree.get(r.source_abbrev)!.children.add(r.dest_abbrev);
    });

    return tree;
  }

  static setTreeLevels(
    tree: Map<string, TreeNodeData>,
    node: string,
    level: number
  ) {
    const current = tree.get(node);
    if (current) {
      current.level = level;
      current.children.forEach((child) => {
        DataTreeUtils.setTreeLevels(tree, child, level + 1);
      });
    }
  }

  static assignColors(records: Record[], color_scale: string[]) {
    const tree = DataTreeUtils.buildTree(records);

    // Assuming the root is the first source_abbrev (or you need to define it)
    const root = records[0].source_abbrev;
    DataTreeUtils.setTreeLevels(tree, root, 1);

    // Find the first level with more than one vertex
    const levelCounts = new Map<number, number>();
    tree.forEach((value, key) => {
      const level = value.level;
      if (!levelCounts.has(level)) {
        levelCounts.set(level, 0);
      }
      levelCounts.set(level, levelCounts.get(level)! + 1);
    });

    console.log("Level Counts: ", levelCounts);

    let targetLevel = 1;
    for (let [level, count] of levelCounts) {
      if (count > 1) {
        targetLevel = level;
        break;
      }
    }

    // Assign colors to each vertex in the target level and its subtree
    const vertexColors = new Map<string, string>();
    // colorIndex 0 is reserved for levels < targetLevel
    let colorIndex = 1;

    const assignColor = (node: string, parent: string, level: number) => {
      console.log("Assigning color to: ", node, level, targetLevel);
      const current = tree.get(node);
      if (!current) {
        return;
      }
      if (level < targetLevel) {
        vertexColors.set(node, color_scale[0]);
      } else if (level == targetLevel) {
        const cur_color_idx = colorIndex % color_scale.length;
        console.log("Setting color: ", cur_color_idx);
        vertexColors.set(node, color_scale[cur_color_idx]);
        colorIndex++;
      } else {
        let parent_color = vertexColors.get(parent)!;
        vertexColors.set(node, parent_color);
      }
      current.children.forEach((child) => {
        assignColor(child, node, level + 1);
      });
    };

    assignColor(root, "", 1);

    const colors = records.map((r) => vertexColors.get(r.dest_abbrev)!);
    console.log("Colors: ", colors);
    return colors;
  }
}

export default DataTreeUtils;
