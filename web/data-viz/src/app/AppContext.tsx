"use client";

import React, { Dispatch, ReactNode, createContext, useReducer } from "react";

type AppState = {
  key: number;
  title: string;
  selected_csv: string;
};

const InitialAppState: AppState = {
  key: 0,
  title: "GOI Budget 2023-24",
  selected_csv: "/dash/data/goi2324/goi.csv",
};

type AppAction =
  | { type: "REFRESH" }
  | { type: "RESET" }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_CSV"; csv: string }
  | { type: "SET_TITLE_AND_CSV"; title: string; csv: string };

function AppStateReducer(state: AppState, action: AppAction) {
  switch (action.type) {
    case "REFRESH":
      return { ...state, key: state.key + 1 };
    case "RESET":
      return InitialAppState;
    case "SET_TITLE":
      return { ...state, title: action.title };
    case "SET_CSV":
      return { ...state, selected_csv: action.csv };
    case "SET_TITLE_AND_CSV":
      const selected_csv = `/dash/data/goi2324/${action.csv}.csv`;
      return { ...state, title: action.title, selected_csv: selected_csv };
    default:
      return state;
  }
}

type AppContextType = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

const InitialAppContext: AppContextType = {
  state: InitialAppState,
  dispatch: () => {},
};

export const AppContext = createContext<AppContextType>(InitialAppContext);

interface IAppStateProviderProps {
  children?: ReactNode;
}

export const AppStateProvider: React.FC<IAppStateProviderProps> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(AppStateReducer, InitialAppState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};
