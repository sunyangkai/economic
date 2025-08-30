import React from 'react';

const DataTable = ({ data }) => {
  if (!data || data.length === 0) {
    return <div>暂无数据</div>;
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="data-table">
      <h3>数据表格</h3>
      <table>
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column}>
                {column === 'id' ? 'ID' : 
                 column === 'name' ? '姓名' :
                 column === 'age' ? '年龄' :
                 column === 'city' ? '城市' :
                 column === 'salary' ? '薪资' : column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.id}>
              {columns.map(column => (
                <td key={column}>
                  {column === 'salary' ? `¥${row[column].toLocaleString()}` : row[column]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;