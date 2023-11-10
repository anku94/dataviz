import re
import os
import json
import logging

import pandas as pd

from budget_tree import BudgetNode, BudgetTreeUtils
from parse_utils import (
    get_meta_structure,
    parse_header,
    parse_section,
    BudgetSheet,
    BudgetSheet,
)


def save_parsed_sheet(parsed_sheet: BudgetSheet, output_dir: str) -> None:
    os.makedirs(output_dir, exist_ok=True)
    header = parsed_sheet["header"]
    h0 = BudgetTreeUtils.get_key_abbrev(header[0])
    h2 = BudgetTreeUtils.get_key_abbrev(header[2])
    h1_int = re.findall(r"\d+", header[1])[0]

    fname = f"{output_dir}/dno_{h1_int}_{h0}_{h2}.json"
    logging.info(f"Saving sheet to {fname}")
    with open(fname, "w") as f:
        f.write(json.dumps(parsed_sheet, indent=2))


def parse_sheet_inner(sheet_name: str, sheet):
    sheet_struct: BudgetSheet = get_meta_structure(sheet)

    if sheet_struct is None or "sections" not in sheet_struct:
        logging.critical(f"No sections found in sheet")
        return

    sheet_struct["sheet_name"] = sheet_name

    hsec = sheet_struct["header_sec"]
    header_slice = sheet.loc[hsec["start"] : hsec["end"]]
    header = parse_header(header_slice, sheet_struct["amount_cols"])
    sheet_struct["amount_header"] = header

    logging.info(f"Sheet structure: {json.dumps(sheet_struct, indent=4)}")

    sheet = sheet.dropna(axis=1, how="all")

    all_sections = sheet_struct["sections"]

    for section in all_sections:
        parse_section(sheet, section, sheet_struct)

    save_parsed_sheet(sheet_struct, "budget_parsed")


def parse_secondary_sheets():
    xls_path = r"budget_doc/allsbe.xlsx"
    xls_file = pd.ExcelFile(xls_path, engine="openpyxl")

    for sidx, sheet_name in enumerate(xls_file.sheet_names):
        if sidx == 0:
            continue

        logging.info(f"Parsing sheet {sidx}: {sheet_name}")
        # input(". Press ENTER. ")
        sheet = xls_file.parse(sidx, convert_float=False)
        parse_sheet_inner(sheet_name, sheet)
