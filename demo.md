# Markdown 完整语法指南

## 1. 标题与段落

# H1 标题
## H2 标题
### H3 标题
#### H4 标题
##### H5 标题
###### H6 标题

这是普通段落文本。  
在行尾添加两个空格可以实现换行效果。

## 2. 文本样式

**粗体文本**  
__另一种粗体写法__  

*斜体文本*  
_另一种斜体写法_  

~~删除线文本~~  

***粗体+斜体组合***  

行内`代码`样式  

高亮文本：==这是高亮文本==（需要扩展支持）

## 3. 列表

### 无序列表
- 项目一
- 项目二
  - 子项目 A
  - 子项目 B
    - 嵌套子项目

### 有序列表
1. 第一项
2. 第二项
   1. 子项 A
   2. 子项 B
3. 第三项

### 任务列表
- [x] 已完成任务
- [ ] 未完成任务
- [x] 另一个任务

## 4. 链接与图片

[普通链接](https://example.com)  
[带标题链接](https://example.com "示例网站")  

引用式链接：  
[引用链接][1]  
[1]: https://example.com

图片：  
![替代文本](https://picsum.photos/200/100 "图片标题")

引用式图片：  
![替代文本][logo]  
[logo]: https://picsum.photos/200/100

## 5. 代码块

行内代码：`console.log('Hello World')`

多行代码块：
```javascript
function hello() {
  console.log('Hello Markdown!');
  return true;
}
``` 
| 左对齐 | 居中对齐 | 右对齐 |
| :---: | :---: | :---: |
| 单元格 |  单元格  | 单元格 |
| 数据A  |  数据B   |  数据C |


```vega-lite {align="center"}
{
  "title": "季度销售统计",
  "width": 600,
  "height": 400,
  "data": {
    "values": [
      {"季度":"Q1","华东区":65,"华南区":28,"华北区":45,"西南区":30},
      {"季度":"Q2","华东区":59,"华南区":48,"华北区":25,"西南区":35},
      {"季度":"Q3","华东区":80,"华南区":40,"华北区":16,"西南区":72},
      {"季度":"Q4","华东区":81,"华南区":79,"华北区":65,"西南区":92}
    ]
  },
  "transform": [{"fold": ["华东区", "华南区", "华北区", "西南区"]}],
  "mark": "line",
  "encoding": {
    "x": {"field": "季度", "type": "ordinal"},
    "y": {"field": "value", "type": "quantitative", "title": "销售额(万元)"},
    "color": {
      "field": "key",
      "type": "nominal",
      "scale": {
        "domain": ["华东区", "华南区", "华北区", "西南区"],
        "range": ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0"]
      },
      "title": "销售区域"
    },
    "tooltip": [
      {"field": "季度", "type": "ordinal"},
      {"field": "key", "type": "nominal"},
      {"field": "value", "type": "quantitative", "title": "销售额"}
    ]
  }
}
```

```vega-lite {align="center"}
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "title": "2023年季度销售额对比（万元）",
  "width": 500,
  "height": 300,
  "data": {
    "values": [
      {"区域": "华东", "季度": "Q1", "销售额": 65},
      {"区域": "华东", "季度": "Q2", "销售额": 59},
      {"区域": "华东", "季度": "Q3", "销售额": 80},
      {"区域": "华东", "季度": "Q4", "销售额": 81},
      {"区域": "华南", "季度": "Q1", "销售额": 28},
      {"区域": "华南", "季度": "Q2", "销售额": 48},
      {"区域": "华南", "季度": "Q3", "销售额": 40},
      {"区域": "华南", "季度": "Q4", "销售额": 79},
      {"区域": "西南", "季度": "Q1", "销售额": 30},
      {"区域": "西南", "季度": "Q2", "销售额": 35},
      {"区域": "西南", "季度": "Q3", "销售额": 72},
      {"区域": "西南", "季度": "Q4", "销售额": 92}
    ]
  },
  "mark": {"type": "bar", "cursor": "pointer"},
  "encoding": {
    "x": {"field": "季度", "type": "nominal", "axis": {"title": ""}},
    "y": {"field": "销售额", "type": "quantitative", "title": "销售额（万元）"},
    "color": {
      "field": "区域",
      "type": "nominal",
      "legend": {"title": "销售区域"},
      "scale": {
        "domain": ["华东", "华南", "西南"],
        "range": ["#1f77b4", "#ff7f0e", "#2ca02c"]
      }
    },
    "tooltip": [{"field": "销售额", "type": "quantitative", "title": "金额"}]
  },
  "selection": {
    "highlight": {"type": "single", "on": "mouseover", "empty": "none"}
  },
  "config": {"view": {"stroke": "transparent"}}
}
```

```vega-lite {align="center"}
{
  "title": "2023年区域销售占比",
  "width": 400,
  "height": 400,
  "data": {
    "values": [
      {"区域": "华东", "销售额": 285},
      {"区域": "华南", "销售额": 195},
      {"区域": "西南", "销售额": 229},
      {"区域": "华北", "销售额": 151}
    ]
  },
  "mark": {"type": "arc", "innerRadius": 0, "cursor": "pointer"},
  "encoding": {
    "theta": {"field": "销售额", "type": "quantitative"},
    "color": {
      "field": "区域",
      "type": "nominal",
      "scale": {
        "domain": ["华东", "华南", "西南", "华北"],
        "range": ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0"]
      },
      "legend": {"title": "销售区域", "orient": "bottom"}
    },
    "tooltip": [
      {"field": "区域", "type": "nominal"},
      {"field": "销售额", "type": "quantitative", "title": "金额", "format": ","},
      {"calculate": "round(datum.销售额/860 * 100)", "as": "占比", "type": "quantitative", "format": ".1f", "title": "百分比"}
    ]
  },
  "view": {"stroke": null}
}
```


```vega-lite {align="center"}
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "title": "2023年销售数据分析",
  "width": 600,
  "height": 400,
  "data": {
    "values": [
      {"月份": "1月", "销售额": 85, "增长率": 0.12},
      {"月份": "2月", "销售额": 76, "增长率": -0.10},
      {"月份": "3月", "销售额": 92, "增长率": 0.21},
      {"月份": "4月", "销售额": 88, "增长率": -0.04},
      {"月份": "5月", "销售额": 95, "增长率": 0.08},
      {"月份": "6月", "销售额": 105, "增长率": 0.10}
    ]
  },
  "layer": [
    {
      "mark": {"type": "bar", "color": "#36A2EB", "width": {"band": 0.6}},
      "encoding": {
        "x": {"field": "月份", "type": "ordinal"},
        "y": {
          "field": "销售额",
          "type": "quantitative",
          "title": "销售额 (万元)",
          "axis": {"grid": false}
        }
      }
    },
    {
      "mark": {
        "type": "line",
        "stroke": "#FF6384",
        "strokeWidth": 3,
        "point": {"filled": true, "size": 80}
      },
      "encoding": {
        "x": {"field": "月份", "type": "ordinal"},
        "y": {
          "field": "增长率",
          "type": "quantitative",
          "title": "环比增长率 (%)",
          "axis": {"titleColor": "#FF6384", "format": ".0%"}
        },
        "tooltip": [
          {"field": "月份", "type": "nominal"},
          {"field": "销售额", "type": "quantitative", "title": "销售额", "format": ","},
          {"field": "增长率", "type": "quantitative", "title": "增长率", "format": ".1%"}
        ]
      }
    }
  ],
  "resolve": {"scale": {"y": "independent"}},
  "config": {
    "axisY": {"titlePadding": 20},
    "legend": {"orient": "top-right"}
  }
}
```

```vega-lite {align="center"}
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "title": "2023年月度销售额（万元）",
  "width": 600,
  "height": 400,
  "data": {
    "values": [
      {"月份": "1月", "销售额": 65},
      {"月份": "2月", "销售额": 59},
      {"月份": "3月", "销售额": 80},
      {"月份": "4月", "销售额": 81},
      {"月份": "5月", "销售额": 56},
      {"月份": "6月", "销售额": 55}
    ]
  },
  "layer": [
    {
      "mark": {
        "type": "line",
        "point": true,
        "stroke": "#FF6384",
        "strokeWidth": 3
      }
    },
    {
      "mark": {
        "type": "text",
        "align": "center",
        "baseline": "bottom",
        "dy": -8,
        "fontSize": 12,
        "fontWeight": "bold"
      },
      "encoding": {
        "text": {"field": "销售额", "type": "quantitative"}
      }
    }
  ],
  "encoding": {
    "x": {"field": "月份", "type": "ordinal", "axis": {"labelAngle": 0}},
    "y": {"field": "销售额", "type": "quantitative", "title": "销售额（万元）"}
  },
  "config": {"view": {"stroke": "transparent"}}
}
```



```vega-lite {align="center"}
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "title": "2023年区域销售额趋势（万元）",
  "width": 700,
  "height": 450,
  "data": {
    "values": [
      {"月份": "1月", "华东": 65, "华南": 28, "西南": 30},
      {"月份": "2月", "华东": 59, "华南": 48, "西南": 35},
      {"月份": "3月", "华东": 80, "华南": 40, "西南": 72},
      {"月份": "4月", "华东": 81, "华南": 79, "西南": 92}
    ]
  },
  "transform": [
    {"fold": ["华东", "华南", "西南"], "as": ["区域", "销售额"]}
  ],
  "layer": [
    {
      "mark": {
        "type": "line",
        "point": false, 
        "strokeWidth": 3
      },
      "encoding": {
        "color": {
          "field": "区域",
          "type": "nominal",
          "scale": {"range": ["#FF6384", "#36A2EB", "#4BC0C0"]}
        }
      }
    },
    {
      "mark": {
        "type": "point",
        "size": 90,
        "filled": true
      },
      "encoding": {
        "color": {
          "field": "区域",
          "type": "nominal",
          "scale": {"range": ["#FF6384", "#36A2EB", "#4BC0C0"]}
        },
        "fill": {"value": "white"}
      }
    },
    {
      "mark": {
        "type": "text",
        "align": "center",
        "baseline": "middle",
        "fontSize": 12,
        "fontWeight": "bold",
        "fill": "#333"
      },
      "encoding": {
        "text": {"field": "销售额", "type": "quantitative"}
      }
    }
  ],
  "encoding": {
    "x": {"field": "月份", "type": "ordinal", "axis": {"labelAngle": 0}},
    "y": {"field": "销售额", "type": "quantitative", "title": "销售额（万元）"}
  },
  "config": {
    "view": {"stroke": "transparent"},
    "axis": {"labelFontSize": 12, "titleFontSize": 14},
    "legend": {
      "orient": "top-right",
      "titleFontSize": 14,
      "labelFontSize": 12
    }
  }
}
```
