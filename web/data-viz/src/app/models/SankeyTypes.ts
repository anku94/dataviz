type NodeMap = { [id: string]: string };

type NodePositionAlias = {
  x: string;
  y: string;
};

type NodePosition = {
  x: number;
  y: number;
};

type NodePositionMap = { [id: string]: NodePositionAlias };

type Edge = [string, string, number];

type NodeEdge = {
  src: string;
  dest: string;
  value: number;
  color: string;
};

type SankeyJsonSection = {
  id: string;
  desc: string;
  pos: NodePositionAlias;
  nodes: NodeMap;
  edges: Edge[];
};

type SankeyJsonMetadata = {
  root: string;
  position: NodePositionAlias;
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
  context: SankeyJsonMetadata;
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
    customdata: string[];
  };
  node?: {
    x: number[];
    y: number[];
    color: string[];
    customdata: string[];
  };
};

export type {
  Edge,
  NodeEdge,
  NodeMap,
  NodePosition,
  NodePositionAlias,
  NodePositionMap,
  SankeyJson,
  SankeyJsonMetadata,
  SankeyJsonSection,
  SankeyData,
  SankeyPlotData,
};
