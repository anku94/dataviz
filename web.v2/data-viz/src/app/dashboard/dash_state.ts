type DashState = {
  title: string;
};

type DashAction = {};

const InitialState: DashState = {
  title: "Dashboard",
};

const DashReducer = (state: DashState, action: DashAction): DashState => {
  return InitialState;
};