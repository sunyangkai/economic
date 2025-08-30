import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { MDXProvider } from '@mdx-js/react';

import BasicSyntax from '../documents/BasicSyntax.mdx';
import ChartsAndComponents from '../documents/ChartsAndComponents.mdx';

const MDXDocPage = () => {
  const { docId } = useParams();

  const mdxFiles = {
    'basic-syntax': {
      component: BasicSyntax,
      title: '📝 MDX 基础语法',
      description: '学习 MDX 的基本语法和 Markdown 功能'
    },
    'charts-and-components': {
      component: ChartsAndComponents,
      title: '📊 图表组件与高级功能',
      description: '展示图表组件和 React 交互功能'
    }
  };

  const currentDoc = mdxFiles[docId];
  
  if (!currentDoc) {
    return (
      <div className="doc-not-found">
        <h1>📄 文档未找到</h1>
        <p>您要查找的文档不存在。</p>
        <Link to="/docs">← 返回文档列表</Link>
      </div>
    );
  }

  const SelectedComponent = currentDoc.component;

  return (
    <div className="mdx-doc-page">
      <div className="doc-navigation">
        <Link to="/docs" className="back-link">← 返回文档列表</Link>
      </div>
      
      <div className="document-header">
        <h1>{currentDoc.title}</h1>
        <div className="document-path">
          📄 src/documents/{docId}.mdx
        </div>
      </div>
      
      <div className="document-content prose max-w-none">
        <MDXProvider>
          <SelectedComponent />
        </MDXProvider>
      </div>
    </div>
  );
};

export default MDXDocPage;