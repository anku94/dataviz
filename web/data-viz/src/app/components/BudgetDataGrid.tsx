import React, { useContext } from "react";
import CsvReader, { BudgetCSVRow, DirRecord } from "../CsvReader";
import {
  DataGrid,
  GridRowsProp,
  GridColDef,
  GridValidRowModel,
  GridLogicOperator,
  GridToolbar,
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarQuickFilter,
  GridRowParams,
  GridValueFormatterParams,
} from "@mui/x-data-grid";
import { AppContext } from "../app_context";

const rows: GridRowsProp = [{ id: 1, col1: "Hello", col2: "World" }];

const columns: GridColDef[] = [
  { field: "demand_id", headerName: "Demand ID", width: 150 },
  { field: "ministry", headerName: "Ministry", width: 450 },
  { field: "department", headerName: "Department", width: 450 },
  { field: "csv_name", headerName: "CSV Name", width: 150 },
];

const cols2: GridColDef[] = [
  { field: "id", headerName: "ID", width: 150 },
  { field: "source_abbrev", headerName: "srckey", width: 150 },
  { field: "source_name", headerName: "srcname", width: 150 },
  { field: "dest_abbrev", headerName: "destkey", width: 150 },
  { field: "dest_name", headerName: "Ministry/Department", width: 450 },
  { field: "amount", headerName: "Amount", width: 150 },
  { field: "amount_inr", headerName: "Amount_INR", width: 150 },
  {
    field: "amount_usd",
    type: "number",
    headerName: "Amount (USD, $)",
    width: 150,
    valueFormatter: (params: GridValueFormatterParams<Number>) => {
      if (params.value == null) {
        return "";
      }
      // convert to a formatted float with two decimal strings
      const val_b = (params.value as number) / 1e9;
      const formatted = val_b.toFixed(2);
      return `\$${formatted}B`;
    },
  },
];

function CustomGridToolbar() {
  return (
    <GridToolbarContainer>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport />
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );
}

const BudgetDemandTable: React.FC = () => {
  const [data, setData] = React.useState<GridRowsProp>([]);
  const { state, dispatch } = useContext(AppContext);

  React.useEffect(() => {
    // fetchData().then((fetchedData) => setData(fetchedData));
    const csv_reader = new CsvReader();
    csv_reader.read(state.selected_csv).then((data) => {
      const data_wid: GridValidRowModel[] = data.map((record, index) => {
        const rec_wid = record as GridValidRowModel;
        rec_wid.id = index;
        return rec_wid;
      });

      setData(data_wid);
    });
  }, []);

  const handleRowClick = (params: GridRowParams) => {
    const min_abbrev = (params.row as BudgetCSVRow).dest_abbrev;
    const min_name = (params.row as BudgetCSVRow).dest_name;
    const csv_name = min_abbrev.replace("g2_", "");
    // setCsvName(csv_name);
    console.log("Changing to: ", csv_name);
    dispatch({
      type: "SET_TITLE_AND_CSV",
      title: min_name,
      csv: csv_name,
    });
  };

  if (data.length == 0) {
    return <div>Loading...</div>;
  } else {
    return (
      <div style={{ height: 400 }}>
        <DataGrid
          filterMode="client"
          initialState={{
            columns: {
              columnVisibilityModel: {
                id: false,
                source_abbrev: false,
                dest_abbrev: false,
                amount: false,
                amount_inr: false,
              },
            },
            sorting: {
              sortModel: [
                {
                  field: "amount_usd",
                  sort: "desc",
                },
              ],
            },
            filter: {
              filterModel: {
                items: [],
                quickFilterValues: [""],
              },
            },
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          slots={{
            toolbar: CustomGridToolbar,
          }}
          rows={data}
          columns={cols2}
          onRowClick={handleRowClick}
        ></DataGrid>
      </div>
    );
  }
};

export default BudgetDemandTable;
