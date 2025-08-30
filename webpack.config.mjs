// webpack.config.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import remarkGfm from 'remark-gfm';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';

const webpackConfig = {
  entry: './src/index.js', // 如果是 index.jsx 就改这里
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'static/js/[name].[contenthash:8].js',
    publicPath: '/',
    clean: true,
  },
  mode: isProd ? 'production' : 'development',
  devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map',
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mdx', '.md'],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: 'defaults' }],
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        },
      },
      {
        test: /\.mdx?$/,
        include: path.resolve(__dirname, 'src'),
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: 'defaults' }],
                ['@babel/preset-react', { runtime: 'automatic' }],
              ],
            },
          },
          {
            loader: '@mdx-js/loader',
            options: {
              outputFormat: 'program',
              providerImportSource: '@mdx-js/react',
              remarkPlugins: [
                remarkGfm, // 表格/任务列表/删除线
                [remarkToc, { heading: '目录', maxDepth: 3, tight: true, ordered: false }], // 在“## 目录”处注入 TOC，深度到 h3
              ], 
              rehypePlugins: [
                rehypeSlug,
                [rehypeAutolinkHeadings, { behavior: 'wrap' }], // 标题可点击
              ],
            },
          },
        ],
      },
      { 
        test: /\.css$/, 
        use: ['style-loader', 'css-loader', 'postcss-loader']
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource',
        generator: { filename: 'static/media/[name].[hash:8][ext]' },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      inject: true,
    }),
  ],
  devServer: {
    static: { 
      directory: path.join(__dirname, 'public'),
      serveIndex: false, // 禁用目录列表，避免 URI malformed 错误
    },
    port: 3000,
    hot: true,
    open: true,
    historyApiFallback: true,
  },
  optimization: { splitChunks: { chunks: 'all' } },
};


export default webpackConfig;