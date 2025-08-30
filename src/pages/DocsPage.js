import React from 'react';
import { Link } from 'react-router-dom';

const DocsPage = () => {
  const mdxFiles = [
    {
      path: 'basic-syntax',
      title: '📝 MDX 基础语法',
      description: '学习 MDX 的基本语法和 Markdown 功能'
    },
    {
      path: 'charts-and-components',
      title: '📊 图表组件与高级功能',
      description: '展示图表组件和 React 交互功能'
    }
  ];

  return (
    <div className="docs-page">
      <h1>📝 文档中心</h1>
      <div className="docs-list">
        {mdxFiles.map((doc) => (
          <Link 
            key={doc.path} 
            to={`/docs/${doc.path}`} 
            className="doc-card"
          >
            <h3>{doc.title}</h3>
            <p>{doc.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default DocsPage;