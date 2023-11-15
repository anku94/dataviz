type NodeMap = { [id: string]: string };
type Edge = [string, string, number];
type GraphData = {
  nodes: NodeMap;
  edges_inrcr: Edge[];
  //   edges_usdb: Edge[];
};

function convertGraphDataToPlotData(graphData: GraphData) {
  const nodes = graphData["nodes"];
  const edges_inrcr = graphData["edges_inrcr"];
  //   const edges_usdb = graphData["edges_usdb"];
  const edges = [
    // ...edges_usdb,
    ...edges_inrcr.map((e): Edge => [e[0], e[1], e[2] / 8500.0]),
  ];

  const abbrevNameMap = new Map<string, string>(Object.entries(nodes));
  const abbrevIndexMap = new Map<string, number>();
  let index = 0;
  abbrevNameMap.forEach((_, abbrev) => {
    if (!abbrevIndexMap.has(abbrev)) {
      abbrevIndexMap.set(abbrev, index++);
    }
  });

  // Create the arrays needed for the Sankey diagram
  const source = edges.map((e) => abbrevIndexMap.get(e[0]));
  const target = edges.map((e) => abbrevIndexMap.get(e[1]));
  const values = edges.map((e) => e[2]);
  const labels = Array.from(abbrevNameMap.values());

  const SankeyPlotData = [
    {
      type: "sankey",
      orientation: "h",
      node: {
        pad: 15,
        thickness: 30,
        line: {
          color: "black",
          width: 0.5,
        },
        label: labels,
      },
      link: {
        source: source,
        target: target,
        value: values,
      },
    },
  ];

  return SankeyPlotData as Plotly.Data[];
}

// Function to fetch the data
export async function fetchGraphData(url: string): Promise<Plotly.Data[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data: GraphData = await response.json();
    return convertGraphDataToPlotData(data);
  } catch (error) {
    console.error("Failed to fetch graph data:", error);
    throw error;
  }
}

export default fetchGraphData;
