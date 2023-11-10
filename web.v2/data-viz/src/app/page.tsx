import React from "react";
import {
  Drawer,
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemText,
  Collapse,
  CssBaseline,
  Container,
} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { ExpandLess, ExpandMore, Home } from "@mui/icons-material";
import HomeIcon from "@mui/icons-material/Home";

const resetCsv = () => {};

export default function HomePage() {
  return (
    <div>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="go-home"
            sx={{ mr: 2 }}
          >
            <HomeIcon />
          </IconButton>
          <Typography variant="h5" component="div" sx={{ flexGrow: 1 }}>
            DataTree: Something
          </Typography>
        </Toolbar>
      </AppBar>
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
            ></Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper
              sx={{ p: 2, display: "flex", flexDirection: "column" }}
            ></Paper>
          </Grid>
        </Grid>
      </Container>
    </div>
  );
}
