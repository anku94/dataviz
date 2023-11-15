"use client";

import React, { useEffect, useState, useContext } from "react";
import { AppContext } from "./AppContext";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppBar, Button, IconButton, Link, Toolbar } from "@mui/material";
import { AppStateProvider } from "./AppContext";
import HomeIcon from "@mui/icons-material/Home";
import Typography from "@mui/material/Typography";

const inter = Inter({ subsets: ["latin"] });

const Dynamic = ({ children }: { children: React.ReactNode }) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, dispatch } = useContext(AppContext);

  return (
    <html lang="en">
      <body className={inter.className}>
        <Dynamic>
          <AppStateProvider>
            <AppBar position="static">
              <Toolbar>
                <IconButton
                  size="large"
                  edge="start"
                  color="inherit"
                  aria-label="go-home"
                  sx={{ mr: 2 }}
                  onClick={() => {
                    dispatch({
                      type: "RESET",
                    });
                  }}
                >
                  <HomeIcon />
                </IconButton>
                <Typography variant="h5" component="div" sx={{ flexGrow: 1 }}>
                  {state.title}
                </Typography>
                <Button
                  color="inherit"
                  size="large"
                  LinkComponent={Link}
                  href="/dash/datatree"
                >
                  DataTree
                </Button>
                <Button
                  color="inherit"
                  size="large"
                  LinkComponent={Link}
                  href="/dash/sankey"
                >
                  Sankey
                </Button>
              </Toolbar>
            </AppBar>
            {children}
          </AppStateProvider>
        </Dynamic>
      </body>
    </html>
  );
}
