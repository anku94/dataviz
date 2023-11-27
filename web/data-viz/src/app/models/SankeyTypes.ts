type NodeMap = { [id: string]: string };

type NodePosition = {
  x: number;
  y: number;
};

type NodePositionMap = { [id: string]: NodePosition };

type Edge = [string, string, number];

type NodeEdge = {
  src: string;
  dest: string;
  value: number;
  color: number;
};

type SankeyJsonGroup = {
  name: string;
  id: string;
  display: boolean;
  pos: NodePosition;
};

type SankeyJsonSection = {
  id: string;
  desc: string;
  linkcolor?: number;
  group?: SankeyJsonGroup;
  pos: {
    x: string;
    y: string;
  };
  nodes: NodeMap;
  edges: Edge[];
};

type SankeyJsonMetadata = {
  root: string;
  position: NodePosition;
  levels: number[];
  xpos: {
    [key: string]: number;
  };
  ypos: {
    [key: string]: number;
  };
  active: string[];
};

type SankeyJson = {
  metadata: SankeyJsonMetadata;
  data: SankeyJsonSection[];
};

type SankeyData = {
  nodes: NodeMap;
  edges: NodeEdge[];
  positions: NodePositionMap;
  colors?: NodeMap;
};

type SankeyPlotData = {
  label: string[];
  link: {
    source: number[];
    target: number[];
    value: number[];
    color: string[];
  };
  node?: {
    x: number[];
    y: number[];
    color: string[];
  };
};

export type {
  Edge,
  NodeEdge,
  NodeMap,
  NodePosition,
  NodePositionMap,
  SankeyJson,
  SankeyJsonGroup,
  SankeyJsonMetadata,
  SankeyJsonSection,
  SankeyData,
  SankeyPlotData,
};
