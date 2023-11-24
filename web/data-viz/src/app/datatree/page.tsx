"use client";

import React, { useContext } from "react";
import { CssBaseline, Container, Button } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";

import { AppContext } from "../AppContext";

import BudgetDemandTable from "../components/BudgetDataGrid";
// import BudgetDataTree from "../components/BudgetDataTree";

import dynamic from "next/dynamic";

const DynamicBudgetDataTree = dynamic(
  () => import("../components/BudgetDataTree").then((mod) => mod.default),
  { ssr: false }
);

export default function Page() {
  const { state, dispatch } = useContext(AppContext);

  return (
    <div>
      <CssBaseline />
      <Container maxWidth="xl" sx={{ mt: 1, mb: 0 }}>
        <Grid>
          <Grid item xs={12}>
            <Button
              onClick={() => {
                dispatch({ type: "RESET" });
              }}
            >
              Reset
            </Button>
            <Button
              onClick={() => {
                dispatch({ type: "REFRESH" });
              }}
            >
              Refresh
            </Button>
            (Click on a box!)
          </Grid>
        </Grid>
        <Grid container spacing={3} columnSpacing={0} sx={{ p: 0 }}>
          {/* Chart */}
          <Grid item xs={12} md={8} lg={12}>
            <Paper
              sx={{
                p: 0,
                display: "flex",
                flexDirection: "column",
                height: 720,
              }}
            >
              <DynamicBudgetDataTree />
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper sx={{ p: 2, display: "flex", flexDirection: "column" }}>
              <BudgetDemandTable />
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </div>
  );
}
