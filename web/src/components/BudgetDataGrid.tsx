import React from "react";
import CsvReader, { Record  } from "../CsvReader";
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

type IBudgetDemandTableProps = {
  csvName: string;
  setCsvName: (csvName: string) => void;
};

const BudgetDemandTable: React.FC<IBudgetDemandTableProps> = ({
  csvName,
  setCsvName,
}) => {
  const [data, setData] = React.useState<GridRowsProp>([]);

  React.useEffect(() => {
    // fetchData().then((fetchedData) => setData(fetchedData));
    const csv_reader = new CsvReader("/data/budget_edges");
    csv_reader.read("/data/goi2324.v2/goi.csv").then((data) => {
      const data_wid: GridValidRowModel[] = data.map((record, index) => {
        const rec_wid = record as GridValidRowModel;
        rec_wid.id = index;
        return rec_wid;
      });

      setData(data_wid);
    });
  }, []);

  const handleRowClick = (params: GridRowParams) => {
    const min_name = (params.row as Record).dest_abbrev;
    console.log("min_name", min_name);
    const csv_name = min_name.replace("g2_", "");
    setCsvName(csv_name);
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
