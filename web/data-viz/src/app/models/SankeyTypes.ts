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
  active: boolean;
  desc: string;
  linkcolor?: number;
  group?: SankeyJsonGroup;
  pos: NodePosition;
  nodes: NodeMap;
  edges: Edge[];
  level: number;
};

type SankeyJson = {
  metadata: {
    root: string;
    position: NodePosition;
    levels: number[];
  };
  data: SankeyJsonSection[];
};

type SankeyData = {
  nodes: NodeMap;
  edges: NodeEdge[];
  positions: NodePositionMap;
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
  };
};

export type {
  Edge,
  NodeEdge,
  NodeMap,
  NodePosition,
  NodePositionMap,
  SankeyJson,
  SankeyJsonSection,
  SankeyData,
  SankeyPlotData,
};
