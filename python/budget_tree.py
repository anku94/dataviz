import logging
import re
from typing import TypedDict
import numpy as np
import pandas as pd
import os


class Edge(TypedDict):
    source_name: str
    dest_name: str
    source_abbrev: str
    dest_abbrev: str
    amount_init: str
    amount_unalloc: str


class BudgetNode:
    USD_TO_INR = 85
    INR_ONE_LAKH = 100000
    INR_ONE_CRORE = INR_ONE_LAKH * 100
    INR_ONE_LAKH_CRORE = INR_ONE_CRORE * INR_ONE_LAKH

    def __init__(self, name: str, total_init: float) -> None:
        self.name = name.strip()
        if "Demand No." in self.name:
            logging.warn("Demand No. found in name. Removing.")
            self.name = self.name.split("\n")[2]

        self.key = self.sanitize_str(name)
        self.total_init = total_init
        self.total_children = 0
        self.children: list["BudgetNode"] = []
        self.child_index: dict[str, int] = {}

    def sanitize_str(self, s: str) -> str:
        s = s.strip()
        s = re.sub(r"\s+", "", s)
        s = s.lower()
        return s

    def add_child(self, child_str: str, child_total: float) -> None:
        child_check = self.get_child(child_str)
        if child_check is not None:
            logging.warn("Child already exists. Updating total.")
            child_check.total_init += child_total
        else:
            self.children.append(BudgetNode(child_str, child_total))

        self.total_children += child_total

        self.children = sorted(self.children, key=lambda x: x.total_init, reverse=True)
        child_keys = [child.key for child in self.children]
        child_idxes = list(range(len(self.children)))
        self.child_index = dict(zip(child_keys, child_idxes))

    def add_child_node(self, child_node: "BudgetNode") -> None:
        self.children.append(child_node)
        self.total_children += child_node.get_total()
        self.children = sorted(self.children, key=lambda x: x.get_total(), reverse=True)
        child_keys = [child.key for child in self.children]
        child_idxes = list(range(len(self.children)))
        self.child_index = dict(zip(child_keys, child_idxes))

    def add_child_ls(self, child_ls: list[str], child_total: float) -> None:
        if len(child_ls) == 0:
            logging.warn(f"Empty child list for {self.name}")
            return

        cur_child = self.get_child(child_ls[0])
        cur_child_total = child_total if len(child_ls) == 1 else 0

        if cur_child is None:
            self.add_child(child_ls[0], cur_child_total)
            cur_child = self.get_child(child_ls[0])
            assert cur_child is not None

        if len(child_ls) == 1:
            return cur_child
        else:
            leaf_child = cur_child.add_child_ls(child_ls[1:], child_total)
            if leaf_child is not None:
                self._update_total_children(child_total)
            return leaf_child

    def get_total(self) -> float:
        if self.total_init > 0:
            return self.total_init

        return self.total_children

    def _update_total_children(self, amount: float) -> None:
        self.total_children = self.get_total_children_recursive()
        self.children = sorted(
            self.children,
            key=lambda x: max(x.total_init, x.total_children),
            reverse=True,
        )
        child_keys = [child.key for child in self.children]
        child_idxes = list(range(len(self.children)))
        self.child_index = dict(zip(child_keys, child_idxes))

    def get_total_children_recursive(self) -> float:
        if self.total_init > 0:
            return self.total_init

        total_children = 0
        for child in self.children:
            total_children += child.get_total_children_recursive()

        return total_children

    def get_child(self, child_str: str) -> "BudgetNode":
        child_key = self.sanitize_str(child_str)
        if child_key in self.child_index:
            return self.children[self.child_index[child_key]]
        else:
            logging.warn(f'Child "{child_str}" not found in "{self.name}"')
            return None

    def get_child_ls(self, path: list[str]) -> "BudgetNode":
        if len(path) == 0:
            return self

        child = self.get_child(path[0])
        return child.get_child_ls(path[1:])

    def __str__(self) -> str:
        return self.serialize(recursive=True)

    def serialize(self, recursive: bool = False, prefix="", max_depth=-1) -> str:
        if max_depth >= 0 and len(prefix) > max_depth:
            return ""

        total_init_str = self.serialize_amount(self.total_init)
        total_str = self.serialize_amount(self.total_children)
        unalloc_amount = self.total_init - self.total_children
        unalloc_str = self.serialize_amount(unalloc_amount)

        label = f"{prefix}[BudgetNode] {self.name}"
        # label += f"\n{prefix} - [Key] {self.key}"
        if self.total_init > 0:
            label += f"\n{prefix} - [Total, Initialized] {total_init_str}"
            if unalloc_amount / self.total_init > 0.01:
                label += f"\n{prefix} - [Unallocated] {unalloc_str}"
        else:
            label += f"\n{prefix} - [Total] {total_str}"

        label += f"\n{prefix}- {len(self.children)} children\n"

        if recursive:
            for child in self.children:
                label += child.serialize(
                    recursive=True, prefix=prefix + "\t", max_depth=max_depth
                )

        return label

    @classmethod
    def serialize_amount(cls, amount: float) -> str:
        usd = f"{cls.format_usd(amount)}"
        inr = f"{cls.format_inr(amount)}"
        return f"({usd}, {inr})"

    @classmethod
    def format_inr(cls, value: float) -> str:
        """Value is assumped to be in INR crores."""
        val_fmt = "₹ {:.1f}{}"
        value = value * cls.INR_ONE_CRORE

        if value < cls.INR_ONE_CRORE:
            return val_fmt.format(value / cls.INR_ONE_LAKH, "L")
        elif value < cls.INR_ONE_CRORE * cls.INR_ONE_LAKH:
            return val_fmt.format(value / cls.INR_ONE_CRORE, "Cr")
        else:
            return val_fmt.format(value / (cls.INR_ONE_CRORE * cls.INR_ONE_LAKH), "LCr")

    @classmethod
    def format_usd(cls, value: float) -> str:
        value = value * cls.INR_ONE_CRORE
        value = value / cls.USD_TO_INR

        val_fmt_1 = "${:-.1f}"
        val_fmt_2 = "${:.1f}"

        if value < 1e6:
            return val_fmt_1.format(value)
        elif value < 1e9:
            return val_fmt_2.format(value / 1e6) + "M"
        else:
            return val_fmt_2.format(value / 1e9) + "B"

    def _serialize_rows_inner(self, context: list, all_rows: list) -> None:
        if len(self.children) == 0:
            all_rows.append([context, self.total_init])
            return
        else:
            for child in self.children:
                child._serialize_rows_inner(context + [child.name], all_rows)

    def serialize_rows(self) -> pd.DataFrame:
        all_rows = []
        self._serialize_rows_inner([self.name], all_rows)
        max_len = max([len(row[0]) for row in all_rows])
        rows, amounts = zip(*all_rows)
        amounts = np.array(amounts)
        df = pd.DataFrame.from_records(rows)
        df["amounts_inrcr"] = amounts
        df["amounts_usdb"] = (
            amounts * BudgetNode.INR_ONE_CRORE / BudgetNode.USD_TO_INR / 1e9
        )
        df.columns = [f"name{i}" for i in range(max_len)] + [
            "amounts_inrcr",
            "amounts_usdb",
        ]
        return df

    def adjust_totals_with_children(self) -> None:
        for child in self.children:
            child.adjust_totals_with_children()

        self.total_children = sum([child.get_total() for child in self.children])

        if self.total_init == 0 or self.total_children == 0:
            return

        diff_children = self.total_init - self.total_children
        if self.total_init < self.total_children:
            logging.warn(
                f"{self.name}: Total init is {self.total_init} but total children is {self.total_children}!!"
            )
            self.total_init = self.total_children

    def get_root_edge(self) -> Edge:
        self_abbrev = BudgetTreeUtils.get_key_abbrev(self.name)
        edge_dict = {
            "source_name": "",
            "dest_name": self.name,
            "source_abbrev": "",
            "dest_abbrev": self_abbrev,
            "amount": self.get_total(),
        }

        return edge_dict


class BudgetTreeUtils:
    def __init__(self):
        pass

    @staticmethod
    def get_key_abbrev(key: str) -> str:
        ret = re.findall(r"\b\w", key)
        ret = "".join(ret).lower()
        return ret

    # @staticmethod
    # def get_list_abbrev(l: list[str]) -> str:
    #     ret = "_".join([BudgetTreeUtils.get_key_abbrev(s) for s in l])
    #     return ret

    @staticmethod
    def get_edge(context: list[BudgetNode]) -> Edge:
        parent = context[-2]
        child = context[-1]
        context_abbrev = [BudgetTreeUtils.get_key_abbrev(node.name) for node in context]

        total = child.get_total()

        edge_dict = {
            "source_name": parent.name,
            "dest_name": child.name,
            "source_abbrev": "_".join(context_abbrev[:-1]),
            "dest_abbrev": "_".join(context_abbrev),
            "amount": total,
        }

        return edge_dict

    @staticmethod
    def tree_dfs_inner(
        context: list[BudgetNode], all_edges: list[Edge], max_depth: int = -1
    ):
        if max_depth >= 0 and len(context) >= max_depth:
            return

        cur_node = context[-1]

        tot_init = cur_node.total_init
        tot_ch = cur_node.total_children

        if tot_init > 0:
            frac_unalloc = (tot_init - tot_ch) / tot_init
        else:
            frac_unalloc = 0

        if frac_unalloc > 0.02:
            mock_unalloc_node = BudgetNode(
                "Unallocated", cur_node.total_init - cur_node.total_children
            )
        else:
            mock_unalloc_node = None

        if len(cur_node.children) > 0:
            children = cur_node.children
            if mock_unalloc_node is not None:
                children = children + [mock_unalloc_node]

            for child in children:
                all_edges.append(BudgetTreeUtils.get_edge(context + [child]))
                BudgetTreeUtils.tree_dfs_inner(
                    context + [child], all_edges, max_depth=max_depth
                )

    @staticmethod
    def serialize(root: BudgetNode) -> pd.DataFrame:
        all_edges = []
        mock_root = BudgetNode("ROOT", 0)
        mock_root.add_child_node(root)
        BudgetTreeUtils.tree_dfs_inner([mock_root], all_edges)
        if len(all_edges) == 0:
            return pd.DataFrame()

        df = pd.DataFrame.from_records(all_edges)
        df.sort_values(["source_abbrev", "dest_abbrev"], inplace=True)
        df["amount_inr"] = df["amount"] * BudgetNode.INR_ONE_CRORE
        df["amount_usd"] = df["amount_inr"] / BudgetNode.USD_TO_INR
        return df

    @staticmethod
    def get_nodes_and_edges(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
        src_pairs = df[["source_abbrev", "source_name"]]
        dest_pairs = df[["dest_abbrev", "dest_name"]]
        all_pairs = pd.DataFrame(
            np.vstack([dest_pairs, src_pairs]), columns=["key", "name"]
        )

        nodes = all_pairs.drop_duplicates(subset=["key"])
        edges = df[["source_abbrev", "dest_abbrev", "amount_inr", "amount_usd"]]

        return (nodes, edges)

    @staticmethod
    def _get_edges_df(all_edges: list) -> pd.DataFrame:
        df = pd.DataFrame.from_records(all_edges)
        df.sort_values(["source_abbrev", "dest_abbrev"], inplace=True)
        df["amount_inr"] = df["amount"] * BudgetNode.INR_ONE_CRORE
        df["amount_usd"] = df["amount_inr"] / BudgetNode.USD_TO_INR
        df = df.reset_index(drop=True)
        print(df)
        return df

    @staticmethod
    def serialize_full_goi(root: BudgetNode, output_dir: str) -> None:
        os.makedirs(output_dir, exist_ok=True)

        all_edges = [root.get_root_edge()]
        BudgetTreeUtils.tree_dfs_inner([root], all_edges, max_depth=2)
        root_df = BudgetTreeUtils._get_edges_df(all_edges)
        df_out_path = f"{output_dir}/goi.csv"
        logging.info(f"Writing to {df_out_path}")
        root_df.to_csv(df_out_path, index=True, index_label="id")

        for mroot in root.children:
            all_edges = [mroot.get_root_edge()]
            BudgetTreeUtils.tree_dfs_inner([mroot], all_edges)
            min_df = BudgetTreeUtils._get_edges_df(all_edges)
            min_abbrev = BudgetTreeUtils.get_key_abbrev(mroot.name)
            df_out_path = f"{output_dir}/{min_abbrev}.csv"
            logging.info(f"Writing to {df_out_path}")
            min_df.to_csv(df_out_path, index=True, index_label="id")
