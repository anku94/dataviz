import json
import logging
import pandas as pd
import re
import string

from typing import Any


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


def is_net_col(col: pd.Series) -> bool:
    # mixed col, get strs only
    col = col.dropna()
    col = col.astype(str)
    col = col.str.strip()
    col = col.str.casefold()
    return "net" in col.tolist()


def get_row_idx(col: pd.Series, val: str):
    matches = col[col == val].index.tolist()
    if len(matches) == 0:
        logging.warning(f"No matches found for val: {val}!")
        return -1
    else:
        if len(matches) > 1:
            logging.warning(f"Multiple matches found for val: {val}!")
        return matches[0]


def normalize_head(head: Any) -> str:
    if not head or type(head) != str:
        return head

    head = head.strip()
    if re.match(r"^Total\s*-\s*.*", head):
        # a regex that matches 0 or 1 spaces

        head = re.sub(r"Total\s*-\s*", "Total - ", head)

    return head


def normalize_col(col: pd.Series):
    col = col.apply(lambda x: normalize_head(x))
    return col


def add_head(row: pd.Series, context: list[str]) -> None:
    head_amount = row["be_cur_total"]
    if abs(head_amount) > 1e-1:
        logging.debug(f"-> !! Adding {context} to tree")
    # else:
    #     logging.debug(f"-> ++ Ignoring {context} for tree (amount: {head_amount}))")
    #     print(row)
    pass


def get_num_pct(series: pd.Series) -> float:
    total_count = len(series)
    float_count = series.dropna().apply(lambda x: isinstance(x, float)).sum()
    int_count = series.dropna().apply(lambda x: isinstance(x, int)).sum()
    num_count = float_count + int_count
    return num_count * 100 if total_count > 0 else 0.0


def get_str_pct(series: pd.Series) -> float:
    total_count = len(series)
    str_count = (
        series.dropna()
        .apply(
            lambda x: isinstance(x, str)
            and set(x.lower()).issubset(set(string.ascii_lowercase))
            and len(x) >= 2
        )
        .sum()
    )
    return (str_count / total_count) * 100 if total_count > 0 else 0.0


def get_slice_columns(df: pd.DataFrame) -> tuple[list[str], list[str]]:
    col_key = lambda x: int(re.findall(r"\d+", x)[0])

    scores_num = list(map(lambda x: (get_num_pct(df[x]), x), df.columns))
    scores_num = sorted(scores_num, reverse=True)
    scores_num = [x for x in scores_num if x[0] > 0]
    scores_num = sorted(scores_num, key=lambda x: col_key(x[1]), reverse=True)
    amount_cols = list(map(lambda x: x[1], scores_num[:12]))
    amount_cols = sorted(amount_cols, key=col_key)

    amount_col_min = min(amount_cols, key=col_key)
    name_cols = [x for x in df.columns if col_key(x) < col_key(amount_col_min)]
    name_cols = df[name_cols].dropna(axis=1, how="all").columns.tolist()

    return name_cols, amount_cols


def get_meta_structure(dfg_sheet):
    """Parse sections in the sheet. Section ranges are (a, b]"""
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
    revenue_row = dfg_sheet.iloc[revenue_lid, :]
    amount_cols = revenue_row[
        revenue_row.isin(["Revenue", "Capital", "Total"])
    ].index.tolist()

    assert len(amount_cols) == 12
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
                all_sections[-1]["end"] = cur_sec_beg
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
        "amount_cols": amount_cols,
    }

    logging.info(f"Sheet structure: {json.dumps(sheet_structure, indent=4)}")
    return sheet_structure


def parse_recursive(
    sheet_slice, names_cols: list[str], cur_col_idx: int, context: list
) -> None:
    if len(sheet_slice) == 0:
        return

    if cur_col_idx == len(names_cols) - 1:
        for row_idx, row in sheet_slice.iterrows():
            row_head = row[names_cols[cur_col_idx]]
            # logging.debug(f"-> !! Adding {context}, {row_head} to tree")
            add_head(row, context + [row_head])
        return

    heads_cur = sheet_slice[names_cols[cur_col_idx]]
    valid_heads = get_valid_heads(heads_cur)

    if len(valid_heads) == 0:
        # print(sheet_slice)
        # add_head(sheet_slice.iloc[0, :], context)
        logging.debug("Recursing ...")
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
            # Add the total head
            add_head(sheet_slice.loc[end_idx, :], context + [head_open])
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

            # Add the start head
            add_head(sheet_slice.loc[beg_idx, :], context + [head_open])

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


def parse_section(sheet: pd.DataFrame, section_spec: dict) -> None:
    logging.info(f"Parsing section: {section_spec['name']}")

    sbeg, send = section_spec["start"], section_spec["end"]
    sec_slice = sheet.iloc[sbeg:send, :].copy()
    # sec_slice = sheet.iloc[sbeg:send, :].dropna(axis=1, how="all")
    # sec_slice = sheet.iloc[sbeg:send, :].copy().dropna(axis=1, how="all")

    maj_heads = ["actual_prev2", "be_prev", "re_prev", "be_cur"]
    sub_heads = ["revenue", "capital", "total"]
    amount_heads = []
    for mh in maj_heads:
        for sh in sub_heads:
            amount_heads.append(f"{mh}_{sh}")

    name_cols, amount_cols = get_slice_columns(sec_slice)

    # rename all columns in amount_cols to amount_heads
    sec_slice = sec_slice.rename(columns=dict(zip(amount_cols, amount_heads)))

    name_cols_renamed = [f"name{idx}" for idx in range(len(name_cols))]
    sec_slice = sec_slice.rename(columns=dict(zip(name_cols, name_cols_renamed)))

    valid_cols = [col for col in sec_slice.columns if "Unnamed: " not in col]
    sec_slice = sec_slice[valid_cols]

    for col in name_cols_renamed:
        sec_slice[col] = normalize_col(sec_slice[col])

    sec_row_beg = sec_slice.index.start
    sec_row_end = sec_slice.index.stop

    sec_header = sec_slice.iloc[0][0]
    assert re.match(r"^[A-Z].\ .*", sec_header)

    # Skip section header from parsing

    sec_row_beg += 1
    grand_total_row = get_row_idx(sec_slice[name_cols_renamed[0]], "Grand Total")
    if grand_total_row != -1:
        sec_row_end = grand_total_row - 1

    sec_slice = sec_slice.loc[sec_row_beg:sec_row_end, :]
    sec_slice = sec_slice.dropna(axis=1, how="all")

    name_cols = [c for c in name_cols_renamed if c in sec_slice.columns]

    if is_net_col(sec_slice[name_cols[-1]]):
        net_col = name_cols[-1]
        name_cols = name_cols[:-1]
        sec_slice = sec_slice.rename(columns={net_col: "net"})

    parse_recursive(sec_slice, name_cols, 0, [sec_header])
