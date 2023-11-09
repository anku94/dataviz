import React, { FC, useEffect, useState } from "react";
import CsvReader, { DirRecord } from "./CsvReader";

type DropdownProps = {
  options: string[];
  selected_option: string | null;
  propWasSelected: (selected: string) => void;
};

class Dropdown extends React.Component<DropdownProps> {
  constructor(props: DropdownProps) {
    super(props);
  }

  render() {
    return (
      <select
        onChange={(e) => {
          console.log(e.target.value);
          this.props.propWasSelected(e.target.value);
        }}
        value={this.props.selected_option || ""}
      >
        <option value="" disabled>
          Select an option
        </option>
        {this.props.options.map((option, index) => (
          <option key={index} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
}

type DirData = {
  records: DirRecord[];
  ministries: string[];
  departments: string[];
};

type DropdownWidgetState = {
  dir_data: DirData | null;
  dropdown1_options: string[];
  dropdown1_selected: string | null;
  dropdown2_options: string[];
  dropdown2_selected: string | null;
};

class DropdownWidget extends React.Component<{}, DropdownWidgetState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      dir_data: null,
      dropdown1_options: [],
      dropdown1_selected: null,
      dropdown2_options: [],
      dropdown2_selected: null,
    };
  }

  async fetchData() {
    const csv_table = new CsvReader("/data/budget_edges");
    return await csv_table.read_dir();
  }

  componentDidMount(): void {
    this.fetchData().then((fetchedData) => {
      const records = fetchedData;
      const ministries = Array.from(
        new Set(records.map((record) => record.ministry))
      ).sort();
      const departments = Array.from(
        new Set(records.map((record) => record.department))
      ).sort();
      this.setState({
        dir_data: {
          records: fetchedData,
          ministries: ministries,
          departments: departments,
        },
      });
    });
  }

  getMatchingDepartments(ministry: string): string[] {
    const records = this.state.dir_data?.records;
    const records_filtered = records?.filter((record) => {
      return record.ministry == ministry;
    });
    return records_filtered?.map((record) => record.department) || [];
  }

  firstDropdownOptionSelected(selected: string) {
    console.log("Dropdown1 selected: " + selected);
    const matching_departments = this.getMatchingDepartments(selected);

    let first_match: string | null = null;
    if (matching_departments.length > 0) {
      first_match = matching_departments[0];
    }

    this.setState({
      dropdown1_selected: selected,
      dropdown2_options: this.getMatchingDepartments(selected),
      dropdown2_selected: first_match,
    });
  }

  secondDropdownOptionSelected(selected: string) {
    console.log("Dropdown2 selected: " + selected);
    this.setState({
      dropdown2_selected: selected,
    });
  }

  getDropdownProps(): DropdownProps {
    if (this.state.dir_data == null) {
      return {
        options: [],
        selected_option: null,
        propWasSelected: this.firstDropdownOptionSelected.bind(this),
      };
    }

    return {
      options: this.state.dir_data.ministries,
      selected_option: this.state.dropdown1_selected,
      propWasSelected: this.firstDropdownOptionSelected.bind(this),
    };
  }

  getDropdown2Props(): DropdownProps {
    if (this.state.dropdown1_selected == null) {
      return {
        options: [],
        selected_option: null,
        propWasSelected: this.firstDropdownOptionSelected.bind(this),
      };
    } else {
      return {
        options: this.state.dropdown2_options,
        selected_option: this.state.dropdown2_selected,
        propWasSelected: this.secondDropdownOptionSelected.bind(this),
      };
    }
  }

  render() {
    if (this.state.dir_data == null) {
      return <div> Loading ... </div>;
    }

    return (
      <div>
        <Dropdown {...this.getDropdownProps()} />
        <Dropdown {...this.getDropdown2Props()} />
      </div>
    );
  }
}

export default DropdownWidget;
