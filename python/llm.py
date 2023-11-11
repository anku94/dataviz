import pandas as pd
import re
import json
import openai

last_table = -1
cur_chap = 1


def get_tables():
    fpath = "budget_doc/booklet.txt"
    with open(fpath, "r", encoding="latin-1") as f:
        fdata = f.read()

    fdata.encode("utf-8")
    lines = fdata.split("\n")
    lines = [l.strip() for l in lines if len(l.strip()) > 0]
    lines

    tables = [l for l in range(len(lines)) if lines[l].startswith("Table ")]
    tables

    tbeg = tables[2]
    tend_max = tbeg + 100
    tend = -1

    all_tables = []
    for tbeg in tables:
        table_beg = lines[tbeg]
        if not re.match(r"^Table \d: .*$", table_beg):
            continue
        print(table_beg)
        table_id, table_desc = table_beg.split(":")

        table_struct = {"id": table_id, "desc": table_desc, "data": None}

        tend_max = tbeg + 200
        tend = -1
        for idx in range(tbeg, tend_max):
            cur_line = lines[idx]
            if cur_line.startswith("Note: ") or cur_line.startswith("Sources: "):
                print(tbeg, idx, cur_line)
                tend = idx
                break

        if tend != -1:
            table_struct["data"] = "\n".join(lines[tbeg:tend])
            all_tables.append(table_struct)

    all_tables
    fout = "all_tables.json"
    with open(fout, "w+") as f:
        f.write(json.dumps(all_tables))

    pass


def make_request(input_data: str) -> str:
    query = open("budget_doc/query3.txt").read()

    #  openai.api_key = "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"

    messages = [
        {"role": "system", "content": query},
        {"role": "user", "content": input_data},
    ]

    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo-16k", messages=messages, temperature=0, max_tokens=6000
    )

    generated_texts = [
        choice.message["content"].strip() for choice in response["choices"]
    ]
    output_data = "\n".join(generated_texts)
    return output_data


def confirm_yes(prompt: str) -> bool:
    send_flag = input(prompt)
    if send_flag == "":
        send_flag = "y"

    send_flag = send_flag[0].lower()
    if send_flag != "y":
        return False

    return True


def run_sequence():
    all_tables = json.loads(open("all_tables.json").read())

    table_desc = {}

    for tidx, table in enumerate(all_tables):
        print(table)
        table_fname = get_table_name(table["id"])
        table_desc[table_fname] = table["desc"]

        if tidx < 74: continue

        if not confirm_yes(f"\n\n{tidx} Writing to {table_fname}. Send? "):
            continue

        with open("tables.desc", "a+") as desc_out:
            desc_out.write(json.dumps(table_desc))

        table_parsed = make_request(table["data"])
        table_parsed_out = f"out/{table_fname}.csv"

        with open(table_parsed_out, "w+") as fout:
            fout.write(table_parsed)

        table_df = pd.read_csv(table_parsed_out)
        print(table_df)
        if not confirm_yes(f"\n\n{tidx} Continue? "):
            break
    pass


def parse_data():
    with open("budget_doc/output.txt") as f:
        output_data = json.loads(f.read())

    table_id = output_data["id"]
    table_desc = output_data["desc"]
    table_content = output_data["data"]

    fname = f"budget_doc/table{table_id}.csv"
    with open(fname, "w+") as fout:
        fout.write(table_content)
    pass


def get_table_name(table_str: str) -> str:
    global last_table
    global cur_chap

    match_obj = re.match(r"^Table (\d)$", table_str)
    table_id = int(match_obj[1])
    if table_id <= last_table:
        cur_chap += 1

    last_table = table_id

    table_name = f"table_{cur_chap}_{table_id}"
    return table_name


def run():
    # parse_data()
    get_tables()
    run_sequence()


if __name__ == "__main__":
    run()
