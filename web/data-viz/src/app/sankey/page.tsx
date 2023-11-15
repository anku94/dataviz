"use client";

import React, { useContext } from "react";
import { Button, CssBaseline, Container } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";

import { AppContext } from "../AppContext";

import BudgetDemandTable from "../components/BudgetDataGrid";
// import BudgetDataTree from "../components/BudgetDataTree";
import BudgetDataSankey from "../components/BudgetDataSankey";

import dynamic from "next/dynamic";

const DynamicBudgetDataSankey = dynamic(
  () => import("../components/BudgetDataSankey").then((mod) => mod.default),
  { ssr: false }
);

export default function Page() {
  const { state, dispatch } = useContext(AppContext);

  return (
    <div>
      <CssBaseline />
      <Container maxWidth="xl" sx={{ mt: 1, mb: 0 }}>
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
              <DynamicBudgetDataSankey />
            </Paper>
          </Grid>
        </Grid>
        <Grid>
          <Grid item xs={12}>
            <Button
              onClick={() => {
                dispatch({ type: "REFRESH" });
              }}
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
      </Container>
    </div>
  );
}
