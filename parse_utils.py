import json
import logging
import pandas as pd
import re
import string
import sys
import numpy as np

from typing import Any, TypedDict


class SheetStructure(TypedDict):
    header: list[str]
    header_sec: dict[str, int]
    sections: list[dict[str, int]]
    amount_cols: list[str]


class BudgetHead(TypedDict):
    head: list[str]
    amount: float


class ParsedSheet(TypedDict):
    sheet_structure: SheetStructure
    list_of_heads: list[BudgetHead]


def find_candidates(sheet_strs: list[tuple[int, str]], search_str: str):
    return [item for item in sheet_strs if re.match(search_str, item[1], re.DOTALL)]


def is_valid_head(head: str) -> bool:
    valid_pool = string.ascii_lowercase + string.ascii_uppercase
    if type(head) != str:
        return False
    return len([x for x in head if x in valid_pool]) > 0


def get_valid_heads(all_heads: list[str]):
    return [h for h in all_heads if is_valid_head(h)]


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


def add_head(row: pd.Series, context: list[str], parsed_sheet: ParsedSheet) -> None:
    head_amount = row["be_cur_total"]
    if abs(head_amount) > 1e-1:
        logging.info(f"-> !! Adding {context} to tree (amount: {head_amount})")
        head_row = {"head": context, "amount": head_amount}
        parsed_sheet["list_of_heads"].append(head_row)
    else:
        logging.info(f"-> !! Skipping {context} (amount: {head_amount})")


def col_has_vals(slice: pd.DataFrame, col_names, col_idx) -> tuple[bool, bool]:
    if len(slice) == 0:
        return (False, False)

    if col_idx >= len(col_names):
        next_has_vals = False
    else:
        next_has_vals = len(slice[col_names[col_idx + 1]].dropna()) > 0

    cur_has_vals = len(slice[col_names[col_idx]].dropna()) > 0

    return (cur_has_vals, next_has_vals)


def is_valid_net_slice(
    sheet_slice: pd.DataFrame, names_cols: list[str], cur_col_idx: int
) -> bool:
    """
    The kind of net slice that has no valid heads in the rest of the columns
    """
    if len(sheet_slice) == 0:
        return False

    col_cur_rest = sheet_slice[names_cols[cur_col_idx]].iloc[1:]
    heads_cur_rest = get_valid_heads(sheet_slice[names_cols[cur_col_idx]].iloc[1:])

    if len(heads_cur_rest) != 0:
        return False

    for col in names_cols[cur_col_idx + 1 :]:
        heads_next = get_valid_heads(sheet_slice[col])
        if len(heads_next) > 0:
            return False

    return True


def is_valid_net_slice_another(
    sheet_slice: pd.DataFrame, names_cols: list[str], cur_col_idx: int
):
    if len(sheet_slice) == 0:
        return False

    col_cur_rest = sheet_slice[names_cols[cur_col_idx]].iloc[1:]
    heads_cur_rest = get_valid_heads(sheet_slice[names_cols[cur_col_idx]].iloc[1:])

    if len(heads_cur_rest) != 0:
        return False

    is_head_valid = not np.isnan(sheet_slice.iloc[0, :]["be_cur_total"])
    if is_head_valid:
        return False

    amount_col = sheet_slice["be_cur_total"].dropna()
    col_sum = amount_col.iloc[:-1].sum()
    col_net = amount_col.iloc[-1]

    logging.debug(f"-> col_sum: {col_sum}, col_net: {col_net}")
    if abs(col_sum - col_net) < 1:
        return True

    return False


def get_net_slice(
    sheet_slice: pd.DataFrame, names_cols: list[str], cur_col_idx: int
) -> None:
    has_net_slice = ("net" in sheet_slice.columns) and is_net_col(sheet_slice["net"])
    logging.debug(f"-> has_net_slice: {has_net_slice}")

    if not has_net_slice:
        return None

    slice_net = sheet_slice[sheet_slice["net"].str.casefold().str.strip() == "net"]
    net_rows = slice_net.index.tolist()
    net_row_loc = net_rows[0]
    slice_until_net = sheet_slice.loc[:net_row_loc, :]

    logging.debug(f"-> slice_until_net: \n{slice_until_net}")

    is_valid_net_heuristic_1 = is_valid_net_slice(
        slice_until_net, names_cols, cur_col_idx
    )
    is_valid_net_heuristic_2 = is_valid_net_slice_another(
        slice_until_net, names_cols, cur_col_idx
    )
    is_valid_net = is_valid_net_heuristic_1 or is_valid_net_heuristic_2

    if is_valid_net:
        return slice_until_net

    return None


def get_head_slice(
    sheet_slice: pd.DataFrame, names_cols: list[str], cur_col_idx: int
) -> pd.DataFrame:
    ncol = names_cols[cur_col_idx]
    valid_heads = sheet_slice[sheet_slice[ncol].apply(is_valid_head)][ncol]
    index_ls = valid_heads.index.tolist()
    if len(valid_heads) > 1:
        idx_next_head = index_ls[1]
        head_slice = sheet_slice.loc[: idx_next_head - 1]
        return head_slice
    return None


def add_slice_handle_net(
    slice: pd.DataFrame,
    last_name_col: str,
    net_row_loc: int,
    context: list[str],
    parsed_sheet: ParsedSheet,
) -> None:
    logging.debug(f"---> In add_slice_handle_net (context: {context})")
    net_total = slice.loc[net_row_loc, "be_cur_total"]

    slice_beg = slice.index.start
    slice_end = slice.index.stop
    slice_prev_total = slice.loc[slice_beg : net_row_loc - 1, :]["be_cur_total"].sum()
    logging.debug(f"-> net_total: {net_total}, slice_prev_total: {slice_prev_total}")
    # check if net_total and slice_prev_total are approximately equal
    if abs(net_total - slice_prev_total) > 1:
        logging.critical("!! NET TOTAL MISMATCH")
        logging.critical(slice)
        cur_context = context
        cur_head = slice[last_name_col].iloc[0]
        if is_valid_head(cur_head) and cur_head != context[-1]:
            cur_context = context + [cur_head]

        logging.critical(f"Go with: {slice_prev_total} for {cur_context}?")
        confirm = input("Confirm? (Y/n): ")
        if len(confirm.lower()) > 0 and confirm.lower[0] == "n":
            sys.exit(-1)
        else:
            add_head(slice.loc[net_row_loc, :], cur_context, parsed_sheet)
    else:
        # skip all heads except net
        logging.debug(f"-> Adding net head: {context}")
        cur_head = slice[last_name_col].iloc[0]
        if is_valid_head(cur_head) and cur_head != context[-1]:
            add_head(slice.loc[net_row_loc, :], context + [cur_head], parsed_sheet)
        else:
            add_head(slice.loc[net_row_loc, :], context, parsed_sheet)

    slice_rest = slice.loc[net_row_loc + 1 :, :]
    logging.debug(f"--> Recursing with slice_rest: \n{slice_rest}")
    if len(slice_rest) > 0:
        add_slice(slice_rest, last_name_col, context, parsed_sheet)


def add_slice(
    slice: pd.DataFrame,
    last_name_col: str,
    context: list[str],
    parsed_sheet: ParsedSheet,
) -> None:
    logging.debug(f"Adding slice: \n{slice}")
    if "net" in slice.columns and is_net_col(slice["net"]):
        logging.debug(f"-> !! NET CASE")

        slice_net = slice[slice["net"].str.casefold().str.strip() == "net"]
        net_rows = slice_net.index.tolist()
        net_row_loc = net_rows[0]
        add_slice_handle_net(slice, last_name_col, net_row_loc, context, parsed_sheet)
    else:
        for row_idx, row in slice.iterrows():
            row_head = row[last_name_col]
            # logging.debug(f"-> !! Adding {context}, {row_head} to tree")
            add_head(row, context + [row_head], parsed_sheet)


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


def get_meta_structure(dfg_sheet) -> SheetStructure:
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
    sheet_slice,
    names_cols: list[str],
    cur_col_idx: int,
    context: list,
    parsed_sheet: ParsedSheet,
) -> None:
    if len(sheet_slice) == 0:
        return

    if len(sheet_slice) == 1:
        head = sheet_slice.iloc[0, :][names_cols[cur_col_idx]]
        logging.debug(f"--> Single row: {head}")
        if is_valid_head(head):
            add_head(sheet_slice.iloc[0, :], context + [head], parsed_sheet)
        elif len(names_cols) > cur_col_idx + 1:
            if is_valid_head(head):
                parse_recursive(
                    sheet_slice, names_cols, cur_col_idx + 1, context + [head]
                )
            else:
                parse_recursive(
                    sheet_slice, names_cols, cur_col_idx + 1, context, parsed_sheet
                )
        return

    logging.debug(f"In parse_recursive (context: {context})\n{sheet_slice}")

    if cur_col_idx == len(names_cols) - 1:
        last_name_col = names_cols[cur_col_idx]
        add_slice(sheet_slice, last_name_col, context, parsed_sheet)
        # for row_idx, row in sheet_slice.iterrows():
        #     row_head = row[names_cols[cur_col_idx]]
        #     # logging.debug(f"-> !! Adding {context}, {row_head} to tree")
        #     add_head(row, context + [row_head])
        return

    heads_cur = sheet_slice[names_cols[cur_col_idx]]
    valid_heads = get_valid_heads(heads_cur)

    if len(valid_heads) == 0:
        # print(sheet_slice)
        # add_head(sheet_slice.iloc[0, :], context)
        logging.debug("Recursing ...")
        parse_recursive(sheet_slice, names_cols, cur_col_idx + 1, context, parsed_sheet)
        return

    heads_all_caps = [h for h in valid_heads if is_mostly_caps(h)]
    if len(heads_all_caps) > 0:
        valid_heads = heads_all_caps

    logging.debug(f"Valid heads: {valid_heads}")

    # TODO: Handle Grand Total case
    # WARN: All caps heads may not have a matching close?

    heads_beg = [h for h in valid_heads if "Total - " not in h]
    cur_max_end_idx = sheet_slice.index.start
    all_max_end_idx = sheet_slice.index.stop
    for head_idx, head_open in enumerate(heads_beg):
        head_close = f"Total - {head_open}"
        head_close_found = True
        if head_close in valid_heads:
            beg_idx = get_row_idx(heads_cur, head_open)
            end_idx = get_row_idx(heads_cur, head_close)
            logging.debug(f"Found open-close pair: {head_open} ({beg_idx} - {end_idx})")
            # Add the total head
            # add_head(sheet_slice.loc[end_idx, :], context + [head_open])
        else:
            head_close_found = False
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
            # add_head(sheet_slice.loc[beg_idx, :], context + [head_open])

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
                sheet_slice.loc[cur_max_end_idx + 1 : beg_idx - 1, :],
                names_cols,
                cur_col_idx,
                context,
                parsed_sheet,
            )

        if head_close_found:
            add_head(sheet_slice.loc[end_idx, :], context + [head_open], parsed_sheet)
            parse_recursive(
                sheet_slice.loc[beg_idx + 1 : end_idx - 1],
                names_cols,
                cur_col_idx,
                context + [head_open],
                parsed_sheet,
            )
        elif is_mostly_caps(head_open):
            parse_recursive(
                sheet_slice.loc[beg_idx + 1 : end_idx],
                names_cols,
                cur_col_idx,
                context + [head_open],
                parsed_sheet,
            )
        else:
            # consume head, either as individual entity, or as part of a net
            # we have no right to consume past current head_open
            # that is handled by recursion
            net_slice = get_net_slice(
                sheet_slice.loc[beg_idx:, :], names_cols, cur_col_idx
            )
            logging.debug(f"net slice: {net_slice}")
            head_slice = get_head_slice(
                sheet_slice.loc[beg_idx:, :], names_cols, cur_col_idx
            )
            logging.debug(f"head slice: {head_slice}")
            if net_slice is not None:
                logging.debug("Found net slice!!")
                add_slice(
                    net_slice,
                    names_cols[cur_col_idx],
                    context + [head_open],
                    parsed_sheet,
                )
            else:
                logging.debug("Found head slice!!")
                head_is_valid = not np.isnan(sheet_slice.loc[beg_idx, "be_cur_total"])
                if head_is_valid:
                    add_head(
                        sheet_slice.loc[beg_idx, :], context + [head_open], parsed_sheet
                    )
                if head_slice is not None:
                    parse_recursive(
                        head_slice.iloc[1:],
                        names_cols,
                        cur_col_idx,
                        context + [head_open],
                        parsed_sheet,
                    )

        cur_max_end_idx = end_idx

    if cur_max_end_idx < all_max_end_idx:
        parse_recursive(
            sheet_slice.loc[cur_max_end_idx + 1 :, :],
            names_cols,
            cur_col_idx + 1,
            context,
            parsed_sheet,
        )

    pass


def parse_section(
    sheet: pd.DataFrame, section_spec: dict, parsed_sheet: ParsedSheet
) -> None:
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

    parse_recursive(sec_slice, name_cols, 0, [sec_header], parsed_sheet)
