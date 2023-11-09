import logo from "./logo.svg";
import "./App.css";
// import { BarChart } from './components/BarChart';
import BarChart from "./components.old/BarChart";
import MyResponsiveSankey from "./components.old/MyResponsiveSankey";
import MyChart from "./components.old/MyChart";
import SankeyData from "./components.old/data";
import Bar from "./components.old/BarThing";

import CsvReader from "./CsvReader";
import CsvTable from "./CsvTable";
import React, { useEffect, useState } from "react";
import DropdownWidget from "./DropdownWidget";
import Button from "@mui/material/Button";
import BudgetDemandTable from "./components/BudgetDataGrid";

import Page from "./pages/Page";

// function Button() {
//   return <button>button</button>;
// }

function App() {
  useEffect(() => {
    const reader = new CsvReader("/data/budget_edges/");
    reader.read_dir().then((data) => console.log(data));
  }, []);

  return (
    // <div style={{ width: 1200 }}>
    //   <DropdownWidget />
    //   <Button variant="contained">Hello World</Button>
    //   <SomeDataGrid />
    // </div>
    <Page />
  );
}

export default App;
