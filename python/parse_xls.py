import glob
import os
import json
import string
import re
import pandas as pd
import sys
import logging

from budget_tree import BudgetNode, BudgetTreeUtils
from parse_utils import (
    get_meta_structure,
    parse_header,
    parse_section,
    BudgetSheet,
)

from parse_demands import parse_secondary_sheets


def reconstruct_hierarchy_from_df(df, key_column, heuristic):
    mapping = {}
    current_parent = None

    for _, row in df.iterrows():
        item = row[key_column]
        if heuristic(item):
            current_parent = item
            mapping[current_parent] = []
        else:
            if current_parent is not None:
                mapping[current_parent].append(row)
    return mapping


def parse_main_sheet(main_sheet):
    header_cols = ["Revenue", "Capital", "Total"]

    # count nas in all columns
    na_count = main_sheet.isna().sum(axis=0)
    # get all indexes where na_count is > 160
    idxes = na_count[na_count < 160].index.tolist()
    # drop rows where all values are na
    sheet_ref = main_sheet[idxes].dropna(how="all")
    sheet_ref.columns = [
        "Ministry",
        "Department",
        "Revenue",
        "Capital",
        "Total",
        "PageNo",
    ]
    sheet_ref["Department"] = sheet_ref["Department"].str.strip()
    # for rows where Department is not na, set ministry to na
    sheet_ref.loc[~sheet_ref["Department"].isna(), "Ministry"] = None
    min_df = sheet_ref[["Ministry", "Total"]]
    min_df = min_df.copy().dropna()

    sheet_ref["Ministry"] = sheet_ref["Ministry"].ffill()
    dept_df = sheet_ref.dropna()[["Ministry", "Department", "Total"]]

    return (min_df, dept_df)


def setup_main_sheet():
    xls_path = r"budget_doc/allsbe.xlsx"
    xls_file = pd.ExcelFile(xls_path, engine="openpyxl")
    xls_sheet0 = xls_file.parse(0)
    min_df, dept_df = parse_main_sheet(xls_sheet0)
    min_df
    dept_df
    print(xls_sheet0)


def parse_demands(xls_file: pd.ExcelFile):
    num_sheets = len(xls_file.sheet_names)
    all_structs = []
    for sheet_idx in range(1, num_sheets):
        logging.info(f"Parsing Sheet {sheet_idx}")
        sheet = xls_file.parse(sheet_idx)
        sheet_struct = get_meta_structure(sheet)
        if sheet_struct is not None:
            all_structs.append(sheet_struct)

    logging.info(f"Found {len(all_structs)} sheets with structure")
    demand_id_max = int(re.findall(r"\d+", all_structs[-1]["header"][1])[0])
    logging.info(f"Max demand id: {demand_id_max}")

    all_demand_ids = [sheet["header"][1] for sheet in all_structs]
    for d_id in range(1, demand_id_max + 1):
        if f"Demand No. {d_id}" not in all_demand_ids:
            logging.warning(f"Demand No. {d_id} not found!")
    else:
        logging.info("All demand ids found!")

    return


# def setup_second_sheet():
#     xls_path = r"budget_doc/allsbe.xlsx"
#     xls_file = pd.ExcelFile(xls_path, engine="openpyxl")

#     sheet_idxes_to_parse = list(range(41, 49))
#     sheet_idxes_to_parse = [46]
#     for sidx in sheet_idxes_to_parse:
#         sheet = xls_file.parse(sidx, convert_float=False)
#         sheet_struct: BudgetSheet = get_meta_structure(sheet)
#         sheet_struct["sheet_name"] = xls_file.sheet_names[sidx]

#         hsec = sheet_struct["header_sec"]
#         header_slice = sheet.loc[hsec["start"] : hsec["end"]]
#         header = parse_header(header_slice, sheet_struct["amount_cols"])
#         sheet_struct["amount_header"] = header

#         print(sheet_struct)

#         logging.info(f"Sheet structure: {json.dumps(sheet_struct, indent=4)}")

#         sheet = sheet.dropna(axis=1, how="all")

#         all_sections = sheet_struct["sections"]
#         for section in all_sections:
#             parse_section(sheet, section, sheet_struct)
#         # break
#         # logging.info(f"Sheet structure: {json.dumps(sheet_struct, indent=4)}")

#     # save_parsed_sheet(parsed_sheet, "budget_parsed")
#     return


def construct_tree(main_sheet) -> BudgetNode:
    tree_root = BudgetNode("GOI2023-24", 0)

    min_df, dept_df = parse_main_sheet(main_sheet)
    print(min_df)
    for ministry, amount in min_df.values:
        # print(ministry, amount)
        tree_root.add_child(ministry, amount)

    for ministry, dept, amount in dept_df.values:
        min_node = tree_root.get_child(ministry)
        if min_node is None:
            logging.warn(f"Ministry {ministry} not found")
            continue
        min_node.add_child(dept, amount)

    return tree_root


# def test_tree():
#     name = "Ministry of Defence"
#     total = 593537.64
#     b = BudgetNode(name, total)
#     print(b)
#     pass


# def add_heads():
#     tree_root: BudgetNode = None
#     heads: list[dict] = None
#     pass


# def visualize_node(node: BudgetNode):
#     df = node.serialize_rows()
#     name_cols = [c for c in df.columns if "name" in c]
#     import plotly.express as px

#     fig = px.treemap(df, path=name_cols, values="amounts_usdb")
#     fig.show()


def clean_str(s: str) -> str:
    s = "".join([c if c in string.printable else " " for c in s])
    s = re.sub(r"\s+", " ", s)
    return s


def read_budget_json(json_path: str) -> BudgetSheet:
    fdata = json.loads(open(json_path).read())
    fheader = fdata["header"]

    if len(fheader) > 3:
        fheader[2] = "".join(fheader[2:])
        fdata_header = fheader[:3]
    elif len(fheader) == 3:
        fdata_header = fheader
    else:
        logging.error(f"Invalid header: {fheader}")
        sys.exit(-1)

        # print(fdata_header)
    fdata["header"] = list(map(clean_str, fdata_header))

    return fdata


def get_all_jsons(json_dir: str) -> list[BudgetSheet]:
    all_files = glob.glob(f"{json_dir}/*.json")
    logging.info(f"Found {len(all_files)} json files")

    f = all_files[0]
    all_headers = []
    all_data = []

    get_int = lambda x: int(re.findall(r"\d+", x)[0])
    all_fdata: dict[int, BudgetSheet] = {}

    for f in all_files:
        fdata = read_budget_json(f)
        fheader = fdata["header"]
        all_headers.append(fheader)
        dno = get_int(fheader[1])
        all_fdata[dno] = fdata

    all_headers = sorted(all_headers, key=lambda x: get_int(x[1]))
    all_mins = list(zip(*all_headers))[0]
    all_mins_uniq = set(all_mins)

    logging.info(f"Found {len(all_mins_uniq)} ministries (Total: {len(all_mins)})")
    return all_fdata


def get_all_jsons_min(json_dir: str) -> tuple[list[list[str]], list[BudgetSheet]]:
    all_files = glob.glob(f"{json_dir}/*.json")
    logging.info(f"Found {len(all_files)} json files")

    f = all_files[0]
    all_headers = []
    all_data = []

    get_int = lambda x: int(re.findall(r"\d+", x)[0])
    all_fdata: dict[int, BudgetSheet] = {}

    for f in all_files:
        fdata = read_budget_json(f)
        fheader = fdata["header"]
        all_headers.append(fheader)
        dno = get_int(fheader[1])
        all_fdata[dno] = fdata

    all_headers = sorted(all_headers, key=lambda x: get_int(x[1]))
    all_mins = list(zip(*all_headers))[0]
    all_mins_uniq = set(all_mins)

    headers_minwise = {}
    for h in all_headers:
        ministry, dno_str, dept = h
        if ministry in headers_minwise:
            headers_minwise[ministry].append(h)
        else:
            headers_minwise[ministry] = [h]

    print(headers_minwise)
    trees_minwise = []
    for mname, mdepts in headers_minwise.items():
        mroot = BudgetNode(mname, 0)
        for dhead in mdepts:
            if dhead[2] == "Repayment of Debt":
                continue

            ddno = get_int(dhead[1])
            print(ddno)
            print(dhead)
            droot = make_json_tree(all_fdata[ddno])
            mroot.add_child_node(droot)
        trees_minwise.append(mroot)

    goi_root = BudgetNode("GOI2023-24", 0)
    for mroot in trees_minwise:
        goi_root.add_child_node(mroot)

    goi_root.adjust_totals_with_children()
    print(goi_root.serialize(recursive=True, max_depth=1))
    print(goi_root.children[0].serialize(recursive=True, max_depth=1))
    #  goi_root.children[0].adjust_totals_with_children()
    #  print(goi_root.children[0].serialize(recursive=True))

    BudgetTreeUtils.serialize_full_goi(goi_root, "goi2324.v3")

    logging.info(f"Found {len(all_mins_uniq)} ministries (Total: {len(all_mins)})")
    return all_headers, all_fdata


def add_json_to_tree_root(tree_root: BudgetNode, json_path: str) -> BudgetNode:
    data = json.loads(open(json_path).read())
    heads = [h for h in data["amount_heads"] if h["head"][0].startswith("A. ")]

    min, dept = data["header"][0], data["header"][2]
    json_root = tree_root.get_child_ls([min, dept])
    for h in heads:
        json_root.add_child_ls(h["head"][1:], h["amount"])

    return json_root


def make_json_tree(data: BudgetSheet) -> BudgetNode:
    json_root_str = "\n".join(data["header"])
    json_root = BudgetNode(json_root_str, 0)
    heads = [h for h in data["amount_heads"] if h["head"][0].startswith("A. ")]

    for h in heads:
        json_root.add_child_ls(h["head"][1:], h["amount"])

    return json_root


def gen_demands_dir(all_data: list[BudgetSheet], out_dir: str):
    os.makedirs(out_dir, exist_ok=True)

    demands_dir = []
    for demand_id in all_data:
        df_path = f"{out_dir}/dno_{demand_id}.csv"
        df_name = os.path.basename(df_path)
        data = all_data[demand_id]
        demands_dir_entry = [demand_id, data["header"][0], data["header"][2], df_name]
        demands_dir.append(demands_dir_entry)

    demands_dir_df = pd.DataFrame(
        demands_dir, columns=["demand_id", "ministry", "department", "csv_name"]
    )

    demands_dir_df.sort_values(["demand_id", "ministry", "department"], inplace=True)

    demands_dir_df.to_csv(f"{out_dir}/demands_dir.csv", index=False)


def gen_serialized_dfs(json_dir: str, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)

    all_data = get_all_jsons(json_dir)
    gen_demands_dir(all_data, out_dir)

    for demand_id, data in all_data.items():
        tree = make_json_tree(data)
        df = tree.serialize_rows()
        df_path = f"{out_dir}/dno_{demand_id}.csv"
        df.to_csv(df_path, index=False)

    return


def gen_edge_dfs(json_dir: str, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)

    all_data = get_all_jsons(json_dir)
    gen_demands_dir(all_data, out_dir)

    for demand_id, data in all_data.items():
        tree = make_json_tree(data)
        df = BudgetTreeUtils.serialize(tree)
        df_path = f"{out_dir}/dno_{demand_id}.csv"
        df.to_csv(df_path, index=False)

    return


def gen_min_edge_dfs(json_dir: str, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)

    all_headers, all_data = get_all_jsons_min(json_dir)
    #  print(all_headers)
    return
    gen_demands_dir(all_data, out_dir)

    for demand_id, data in all_data.items():
        tree = make_json_tree(data)
        df = BudgetTreeUtils.serialize(tree)
        df_path = f"{out_dir}/dno_{demand_id}.csv"
        df.to_csv(df_path, index=False)

    return


# def run_construct():
#     xls_path = r"../data/budget_doc/allsbe.xlsx"
#     xls_file = pd.ExcelFile(xls_path, engine="openpyxl")
#     main_sheet = xls_file.parse(0, convert_float=False)
#     tree_root = construct_tree(main_sheet)
#     print(tree_root)
#     visualize_node(tree_root)

#     dno_ids = list(range(1, 3))
#     for did in dno_ids:
#         dname = f"budget_parsed/dno_{did}_*.json"
#         demand_fname = glob.glob(dname)[0]
#         add_json_to_tree_root(tree_root, demand_fname)

#     # dno1 = glob.glob("budget_parsed/dno_1_*.json")[0]
#     # dno1_root = add_json_to_tree_root(tree_root, dno1)
#     # visualize_node(dno1_root)
#     visualize_node(tree_root)


def run():
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)
    # parse_secondary_sheets()
    #  gen_serialized_dfs("budget_parsed", "budget_treemap")
    #  gen_edge_dfs("budget_parsed", "budget_edges")
    gen_min_edge_dfs("budget_parsed", "budget_edges_min")


if __name__ == "__main__":
    run()
