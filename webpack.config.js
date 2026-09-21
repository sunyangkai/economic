import path from 'node:path';
import { fileURLToPath } from 'node:url';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (env = {}, argv = {}) => {
  const isProd = argv.mode === 'production';

  return {
    entry: './src/index.jsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProd ? '[name].[contenthash:8].js' : '[name].js',
      publicPath: 'auto',
      clean: true,
    },
    resolve: {
      extensions: ['.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              presets: [
                ['@babel/preset-env', { targets: 'defaults' }],
                ['@babel/preset-react', { runtime: 'automatic' }],
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        title: 'K 线行情',
        // favicon 交给插件处理：它会负责把文件拷进 dist（手写 <link> 只会得到 404）
        favicon: './public/favicon.svg',
        minify: isProd && { collapseWhitespace: true, removeComments: true },
      }),
    ],
    devServer: {
      port: 5180,
      host: '127.0.0.1',
      hot: true,
      open: false,
      // 取数走腾讯行情，实测响应头带 access-control-allow-origin: *，
      // 浏览器可直连，因此无需配置 proxy；若将来改用东财接口（无 CORS 头），
      // 在此处按 /api 前缀转发即可。
    },
    devtool: isProd ? false : 'eval-cheap-module-source-map',
    // ECharts（按需引入后）+ React 的单包体积约 800KB，属该技术栈的合理量级；
    // 阈值设在此之上，超过则视为回归告警。
    performance: { hints: isProd ? 'warning' : false, maxAssetSize: 900 * 1024, maxEntrypointSize: 900 * 1024 },
    stats: 'minimal',
  };
};
