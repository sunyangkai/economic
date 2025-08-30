// 模拟API服务层
const API_BASE_URL = 'https://api.example.com';

// 模拟网络延迟
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 模拟数据
const mockData = {
  lineChart: {
    labels: ['一月', '二月', '三月', '四月', '五月', '六月'],
    datasets: [{
      label: '销售额',
      data: [12, 19, 3, 5, 2, 3],
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
    }]
  },
  multiLineChart: {
    labels: ['一月', '二月', '三月', '四月', '五月', '六月'],
    datasets: [
      {
        label: '销售额',
        data: [12, 19, 3, 5, 2, 3],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      },
      {
        label: '利润',
        data: [8, 12, 2, 3, 1, 2],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
      },
      {
        label: '成本',
        data: [4, 7, 1, 2, 1, 1],
        borderColor: 'rgb(255, 205, 86)',
        backgroundColor: 'rgba(255, 205, 86, 0.2)',
      }
    ]
  },
  barChart: {
    labels: ['产品A', '产品B', '产品C', '产品D', '产品E'],
    datasets: [{
      label: '销量',
      data: [65, 59, 80, 81, 56],
      backgroundColor: [
        'rgba(255, 99, 132, 0.2)',
        'rgba(54, 162, 235, 0.2)',
        'rgba(255, 205, 86, 0.2)',
        'rgba(75, 192, 192, 0.2)',
        'rgba(153, 102, 255, 0.2)',
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 205, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
      ],
      borderWidth: 1
    }]
  },
  multiBarChart: {
    labels: ['2021年', '2022年', '2023年', '2024年'],
    datasets: [
      {
        label: 'Q1 (第一季度)',
        data: [120, 140, 150, 160],
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
      },
      {
        label: 'Q2 (第二季度)',
        data: [150, 170, 180, 190],
        backgroundColor: 'rgba(255, 99, 132, 0.8)',
      },
      {
        label: 'Q3 (第三季度)',
        data: [130, 160, 170, 180],
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
      },
      {
        label: 'Q4 (第四季度)',
        data: [180, 200, 220, 240],
        backgroundColor: 'rgba(255, 205, 86, 0.8)',
      }
    ]
  },
  mixedChart: {
    labels: ['一月', '二月', '三月', '四月', '五月', '六月'],
    datasets: [
      {
        type: 'bar',
        label: '销量',
        data: [65, 59, 80, 81, 56, 70],
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
      {
        type: 'line',
        label: '增长率 %',
        data: [10, -5, 35, 1, -30, 25],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        yAxisID: 'y1',
      }
    ]
  },
  pieChart: {
    labels: ['桌面', '移动端', '平板'],
    datasets: [{
      data: [300, 50, 100],
      backgroundColor: [
        '#FF6384',
        '#36A2EB',
        '#FFCE56'
      ]
    }]
  },
  tableData: [
    { id: 1, name: '张三', age: 28, city: '北京', salary: 8000 },
    { id: 2, name: '李四', age: 32, city: '上海', salary: 12000 },
    { id: 3, name: '王五', age: 25, city: '广州', salary: 7000 },
    { id: 4, name: '赵六', age: 35, city: '深圳', salary: 15000 },
    { id: 5, name: '孙七', age: 29, city: '杭州', salary: 9000 }
  ]
};

// API函数
export const apiService = {
  // 获取折线图数据
  async getLineChartData() {
    await delay(500);
    return { data: mockData.lineChart };
  },

  // 获取多折线图数据
  async getMultiLineChartData() {
    await delay(600);
    return { data: mockData.multiLineChart };
  },

  // 获取柱状图数据
  async getBarChartData() {
    await delay(400);
    return { data: mockData.barChart };
  },

  // 获取多柱状图数据
  async getMultiBarChartData() {
    await delay(700);
    return { data: mockData.multiBarChart };
  },

  // 获取混合图表数据
  async getMixedChartData() {
    await delay(550);
    return { data: mockData.mixedChart };
  },

  // 获取饼图数据
  async getPieChartData() {
    await delay(450);
    return { data: mockData.pieChart };
  },

  // 获取表格数据
  async getTableData() {
    await delay(300);
    return { data: mockData.tableData };
  },

  // 通用请求方法
  async fetchData(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      // 模拟网络请求
      await delay(Math.random() * 1000 + 300);
      
      // 模拟随机错误
      if (Math.random() < 0.1) {
        throw new Error('网络请求失败');
      }
      
      console.log(`模拟请求: ${url}`);
      
      // 根据endpoint返回对应数据
      switch (endpoint) {
        case '/charts/line':
          return mockData.lineChart;
        case '/charts/multi-line':
          return mockData.multiLineChart;
        case '/charts/bar':
          return mockData.barChart;
        case '/charts/multi-bar':
          return mockData.multiBarChart;
        case '/charts/mixed':
          return mockData.mixedChart;
        case '/charts/pie':
          return mockData.pieChart;
        case '/data/table':
          return mockData.tableData;
        default:
          throw new Error('未知的API端点');
      }
    } catch (error) {
      console.error('API请求错误:', error);
      throw error;
    }
  }
};