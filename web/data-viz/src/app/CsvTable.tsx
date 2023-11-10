import React, { useEffect, useState } from "react";
import CsvReader, { DirRecord } from "./CsvReader";

const fetchData = async () => {
  const csv_table = new CsvReader("/data/budget_edges");
  return await csv_table.read_dir();
};

const CsvTable: React.FC = () => {
  const [data, setData] = useState<DirRecord[] | null>(null);

  useEffect(() => {
    fetchData().then((fetchedData) => setData(fetchedData));
  }, []);

  if (data === null) {
    return <div>Loading...</div>;
  }

  const headers = Object.keys(data[0]) as (keyof DirRecord)[];

  return (
    <table>
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th key={index}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {headers.map((header, cellIndex) => (
              <td key={cellIndex}>{row[header]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default CsvTable;
