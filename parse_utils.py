import json
import logging
import pandas as pd
import re
import string


def find_candidates(sheet_strs: list[tuple[int, str]], search_str: str):
    return [item for item in sheet_strs if re.match(search_str, item[1], re.DOTALL)]


def get_valid_heads(all_heads: list[str]):
    valid_pool = string.ascii_lowercase + string.ascii_uppercase
    valid_heads = [head for head in all_heads if type(head) == str]
    valid_heads = [k for k in valid_heads if len([x for x in k if x in valid_pool]) > 0]
    return valid_heads


def is_mostly_caps(s: str):
    if not s or type(s) != str or len(str(s)) < 2:
        return False

    s_upper = "".join([x for x in s if x in string.ascii_uppercase])
    s_all = "".join([x for x in s if x in string.ascii_letters])

    # logging.debug(f"{s} => len({s_upper}) / len({s_all})")
    if len(s_all) < 2:
        return False

    ratio = len(s_upper) / len(s_all)
    return ratio > 0.8


def get_row_idx(col: pd.Series, val: str):
    matches = col[col == val].index.tolist()
    if len(matches) == 0:
        logging.warning(f"No matches found for val: {val}!")
        return -1
    else:
        if len(matches) > 1:
            logging.warning(f"Multiple matches found for val: {val}!")
        return matches[0]


def get_meta_structure(dfg_sheet):
    sheet_strs = []
    for row_idx, row in dfg_sheet.iterrows():
        row_clean = row.dropna()
        row_str = "".join([x for x in row_clean if type(x) == str])
        row_str = row_str.strip()
        if len(row_str) > 0:
            sheet_strs.append((row_idx, row_str))

    results = find_candidates(sheet_strs, ".*Demand No.*")
    if len(results) < 1:
        logging.warning("WARN: Cannot parse sheet!")
        return None

    demand_lid, demand_line = results[0]

    results = find_candidates(sheet_strs, ".*Budget Estimates.*")
    budget_lid, budget_line = results[0]

    results = find_candidates(sheet_strs, "RevenueCapitalTotal")
    revenue_lid, revenue_line = results[0]

    assert revenue_lid > budget_lid

    revenue_lidx = sheet_strs.index((revenue_lid, revenue_line))
    header_actual = sheet_strs[revenue_lidx + 1 : revenue_lidx + 5]
    header_sec_expected = ["Gross", "Recoveries", "Receipts", "Net"]
    for sec_actual, sec_expected in zip(header_actual, header_sec_expected):
        assert sec_expected in sec_actual[1]

    header_sec = {"start": revenue_lidx + 1, "end": revenue_lidx + 5}

    find_candidates(sheet_strs, "^A. ")
    find_candidates(sheet_strs, "^D. ")

    all_sections = []

    logging.info("Discovering sections...")
    section_candidates = ["A", "B", "C", "D", "E", "F"]
    for sec in section_candidates:
        candidates = find_candidates(sheet_strs, f"^{sec}. ")
        if len(candidates) > 0:
            logging.info(f"Found section {sec}")
            cur_sec_beg = candidates[0][0]
            if len(all_sections) > 0:
                all_sections[-1]["end"] = cur_sec_beg - 1
            section = {"name": sec, "start": cur_sec_beg, "end": -1}
            all_sections.append(section)
        else:
            break

    logging.info(f"Found {len(all_sections)} sections")

    if len(all_sections) > 0:
        all_sections[-1]["end"] = sheet_strs[-1][0]

    sheet_structure = {
        "header": demand_line.split("\n"),
        "header_sec": header_sec,
        "sections": all_sections,
    }

    logging.info(f"Sheet structure: {json.dumps(sheet_structure, indent=4)}")
    return sheet_structure


def parse_recursive(
    sheet_slice, names_cols: list[str], cur_col_idx: int, context: list
) -> None:
    if cur_col_idx == len(names_cols) - 1:
        for row_idx, row in sheet_slice.iterrows():
            row_head = row[names_cols[cur_col_idx]]
            logging.debug(f"-> !! Adding {context}, {row_head} to tree")
        return

    heads_cur = sheet_slice[names_cols[cur_col_idx]]
    valid_heads = get_valid_heads(heads_cur)

    if len(valid_heads) == 0:
        logging.debug("No valid heads found in slice. Recursing.")
        parse_recursive(sheet_slice, names_cols, cur_col_idx + 1, context)
        return

    heads_all_caps = [h for h in valid_heads if is_mostly_caps(h)]
    if len(heads_all_caps) > 0:
        valid_heads = heads_all_caps

    # TODO: Handle Grand Total case
    # WARN: All caps heads may not have a matching close?

    heads_beg = [h for h in valid_heads if "Total - " not in h]
    cur_max_end_idx = sheet_slice.index.start
    all_max_end_idx = sheet_slice.index.stop
    for head_idx, head_open in enumerate(heads_beg):
        head_close = f"Total - {head_open}"
        if head_close in valid_heads:
            beg_idx = get_row_idx(heads_cur, head_open)
            end_idx = get_row_idx(heads_cur, head_close)
            logging.debug(f"Found open-close pair: {head_open} ({beg_idx} - {end_idx})")
        else:
            logging.debug(f"Cannot find close for {head_open}")
            beg_idx = get_row_idx(heads_cur, head_open)
            if head_idx + 1 == len(heads_beg):
                end_idx = all_max_end_idx
            else:
                end_idx = get_row_idx(heads_cur, heads_beg[head_idx + 1])

            logging.debug(
                f"Constructed open-close pair: {head_open} ({beg_idx} - {end_idx})"
            )

        if beg_idx < cur_max_end_idx:
            # recursive heads
            logging.debug(
                f"Skipped {beg_idx} (cur_max: {cur_max_end_idx}). Must be nested."
            )
            continue

        # print(sheet_slice.loc[beg_idx + 1 : end_idx - 1, :])
        # print(f"Cur end: {cur_max_end_idx}, New beg: {beg_idx}")
        if beg_idx > cur_max_end_idx + 1:
            logging.debug("Recursing for slice skipped by current head")
            parse_recursive(
                sheet_slice.loc[cur_max_end_idx : beg_idx - 1, :],
                names_cols,
                cur_col_idx,
                context,
            )
        parse_recursive(
            sheet_slice.loc[beg_idx + 1 : end_idx - 1, :],
            names_cols,
            cur_col_idx,
            context + [head_open],
        )

        cur_max_end_idx = end_idx

    pass
