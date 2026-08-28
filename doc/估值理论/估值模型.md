# 估值体系总结

## 一、设计哲学

本体系的核心原则是：

> **估值中的主观判断，尽量全部集中在利润预测中；其余因子采用统一、客观、职责清晰的规则化设定。**

这样做的目标有三点：

1. **压缩模型自由度**，避免传统 DCF 因折现率、终值、风险溢价等多重主观参数而失控。  
2. **提高公司之间的可比性**，用统一标尺衡量不同公司。  
3. **提高可复盘性**，让估值误差主要回到利润判断本身，而不是隐藏在分母或终值假设中。  

---

## 二、估值体系的核心结构

本体系将企业价值拆分为三部分：

1. **近三年预测期**：体现对企业未来三年的主观利润判断。  
2. **过渡期**：将第三年预测增速平滑过渡到统一终局增速。  
3. **终值**：反映企业进入成熟稳态后的长期价值。  

其中，**估值基础仍然是调整后利润**，而不是直接以可分配利润作为主方程变量。  
可分配利润的作用，是用于测算当前利润兑现能力，并进一步形成整体估值折价。

---

## 三、方程组

$$
\begin{cases}
V_0
=
\displaystyle \sum_{t=1}^{3}\frac{NP_{adj,t}}{(1+R)^t}
+
\displaystyle \sum_{t=4}^{N}\frac{NP_{adj,t}}{(1+R)^t}
+
\displaystyle \frac{NP_{adj,N}(1+g_{\infty})}{(R-g_{\infty})(1+R)^N}
\\[1.2em]
R = r_f + 5.5\%
\\[0.8em]
g_{\infty}=\displaystyle \frac{0.35m}{1+0.35m}\times 0.04
\\[1.0em]
DP_0 = NP_{adj,0} + DA_0 - MC_0 - \Delta WC^{norm}_0
\\[0.8em]
\theta_0 = \displaystyle \frac{DP_0}{NP_{adj,0}}
\\[1.0em]
\theta = 0.15\theta_0 + 0.85\theta_x
\\[0.8em]
V_0^* = V_0 \cdot \theta
\end{cases}
$$

### 补充说明

过渡期利润增速以第三年预测增速为起点，在过渡期内线性衰减，并于终值起点收敛至终局增速 $g_{\infty}$。

---

## 四、公式含义

### 4.1 利润基础估值

$$
V_0
=
\sum_{t=1}^{3}\frac{NP_{adj,t}}{(1+R)^t}
+
\sum_{t=4}^{N}\frac{NP_{adj,t}}{(1+R)^t}
+
\frac{NP_{adj,N}(1+g_{\infty})}{(R-g_{\infty})(1+R)^N}
$$

- 第一部分：近三年预测期的利润现值  
- 第二部分：过渡期利润现值  
- 第三部分：终值现值  

本体系中，估值主方程仍然建立在利润预测之上。

### 4.2 折现率

$$
R = r_f + 5.5\%
$$

其中：

- $r_f$：10 年期国债收益率  
- 5.5%：沪深 300 股债利差中值  

备注：当前默认取 $r_f = 1.8\%$。

含义：

- 用无风险利率反映估值底座随利率变化；
- 用固定风险补偿隔离市场情绪；
- 不再针对个股主观上调或下调折现率。  

### 4.3 终局增速

$$
g_{\infty}=\frac{0.35m}{1+0.35m}\times 0.04
$$

其中：

- $m$：名义 GDP 增速的数字输入值，例如 4 表示 4%  

备注：当前默认取 $m = 4$，即名义 GDP 增速输入为数字形式。

按当前默认参数，终局增速约为 $g_{\infty} \approx 2.33\%$。

含义：

- 成熟企业终局增长受宏观约束；
- 企业只能分享宏观增长的一部分；
- 宏观越快增长，成熟企业并不能同比例分得全部增量；
- 其中 $0.04$ 表示当前模型设定的永续最大增速上限，即当宏观增速很高时，成熟企业的终局增速也不会无限上升，而是渐近收敛到 4%。  

### 4.4 当前可分配利润

$$
DP_0 = NP_{adj,0} + DA_0 - MC_0 - \Delta WC^{norm}_0
$$

其中：

- $NP_{adj,0}$：当前调整后净利润，剔除明显一次性项目  
- $DA_0$：当前折旧摊销，属于非现金费用，加回  
- $MC_0$：当前维持性资本开支，只扣维持当前经营能力必须投入的部分  
- $\Delta WC^{norm}_0$：当前正常化营运资本新增占用，只反映常态化占用，不机械使用单年报表波动  

这一步不是估值主方程，而是用于测算当前利润兑现能力。

### 4.5 当前兑现系数

$$
\theta_0 = \frac{DP_0}{NP_{adj,0}}
$$

含义：

- $\theta_0$ 反映当前利润中有多大比例能够兑现为股东价值；
- 它由当前可分配利润与当前调整后利润之比得到；
- 该值需要结合业务分析后人工输入，不由程序自动计算。  

### 4.6 整体兑现折价

$$
\theta = 0.15\theta_0 + 0.85\theta_x
$$

其中：

- $\theta_0$：当前兑现系数  
- $\theta_x$：成熟阶段或长期阶段兑现系数  

含义：

- 前三年利润现值占比通常较低，经验上约为 15%；
- 过渡期与终值占比通常较高，经验上约为 85%；
- 因此整体估值折价，采用当前兑现系数与长期兑现系数的加权平均。  

### 4.7 成熟阶段兑现系数参考取值

$\theta_x$ 的取值不追求精确，而追求稳定、保守、可比较。建议按以下顺序确定：

1. **优先取公司自身成熟年份中枢值**：选取公司经营稳定、无明显扩张扰动的年份，计算  
   $$
   \theta = \frac{DP}{NP_{adj}}
   $$
   再取 3—5 年中枢水平作为 $\theta_x$。  

2. **若公司自身样本不足，则取成熟同行中枢值**：选择商业模式接近、资本开支和营运资本特征相近的成熟公司，取其正常年份的 $DP / NP_{adj}$ 中枢。  

3. **若两者都不充分，则用保守经验值**：  
   - 轻资产、高现金转化行业：$\theta_x \approx 0.85 \sim 0.95$  
   - 一般制造业：$\theta_x \approx 0.70 \sim 0.85$  
   - 重资产、强营运资本占用行业：$\theta_x \approx 0.50 \sim 0.70$  

核心原则是：**$\theta_x$ 反映成熟阶段利润兑现为股东价值的长期中枢比例，应取正常经营状态下的保守值，而非某一年的高点值。**

### 4.8 股东估值

$$
V_0^* = V_0 \cdot \theta
$$

其中：

- $V_0$：基于利润路径计算得到的基础价值  
- $\theta$：整体兑现折价系数  
- $V_0^*$：折价后的股东估值  

---

## 五、体系的核心原则

### 1. 主观判断主要放在利润预测中

企业之间的差异，主要通过以下变量表达：

- 未来三年利润增速  
- 利润率变化  
- 景气和竞争格局变化  
- 高增长持续时间  

而不是通过折现率自由调整表达。

### 2. 折现率与终局增速统一规则化

- 折现率统一由无风险利率加固定风险补偿决定；
- 终局增速统一由名义 GDP 增速公式决定；
- 分母和终局不再成为随意调节估值的旋钮。  

### 3. 可分配利润不直接进入主方程，而用于测算兑现能力

账面利润并不等于真正属于股东的价值。  
因此，本体系先根据当前可分配利润测算当前兑现系数，再结合长期兑现系数，对利润基础估值进行整体折价。

### 4. 营运资本只扣常态占用，不扣阶段性波动

例如：

- 备货  
- 大客户延迟一个季度回款  
- 季度性项目节奏  

这类时点因素只影响当期现金，不直接影响长期利润兑现能力。  
可分配利润计算中扣除的是：

> **正常经营和正常增长所需的常态化营运资本新增占用。**

---

## 六、程序实现说明

### 说明

- 函数参数拆分为两个对象：`company` 与 `macro`；
- `company.growthForecasts` 为**未来三年利润增速预测数组**，格式为 `[g1, g2, g3]`；
- 函数内部默认当前利润 `np0 = 1`，因此最终直接返回 **PE**；
- 程序**不负责**自动计算当前可分配利润 $DP_0$；
- `company.theta0` 由外部分析得到，对应公式：$	heta_0 = DP_0 / NP_{adj,0}$；
- `company.thetaX` 为成熟阶段或长期阶段兑现系数，由分析后输入；
- 当前宏观参数默认取值可为：`macro.rf = 0.018`，`macro.nominalGdpGrowth = 4`；
- 程序只负责：
  - 根据三年利润增速预测生成前三年利润路径；
  - 根据第三年增长率生成过渡期；
  - 根据统一终局增速计算终值；
  - 根据 $	heta = 0.15	heta_0 + 0.85	heta_x$ 计算整体折价；
  - 最终只返回 **PE**。  

---

## 七、JavaScript 实现(这是给AI计算调用的程序)

```js
/**
 * 三段式利润估值 + 整体兑现折价
 *
 * 约定：
 * 1. company.growthForecasts 为未来三年利润增速预测 [g1, g2, g3]
 * 2. 函数内部默认当前利润 np0 = 1，因此最终直接返回 PE
 * 3. 程序不负责计算 DP0 = NP_adj,0 + DA0 - MC0 - ΔWC^norm,0
 * 4. company.theta0 由外部分析得到：theta0 = DP0 / NP_adj,0
 * 5. company.thetaX 为成熟阶段或长期阶段兑现系数
 * 6. 过渡期按“第三年增长率线性衰减，终值起点收敛到终局增速”处理
 *
 * @param {Object} params
 * @param {Object} params.company - 公司层面参数
 * @param {number[]} params.company.growthForecasts - 三年利润增速预测 [g1, g2, g3]
 * @param {number} params.company.theta0 - 当前兑现系数
 * @param {number} params.company.thetaX - 长期兑现系数
 * @param {number} [params.company.transitionYears=3] - 过渡期年数，默认 3 年
 * @param {number} [params.company.nearTermWeight=0.15] - 前三年权重，默认 15%
 * @param {number} [params.company.longTermWeight=0.85] - 长期权重，默认 85%
 *
 * @param {Object} params.macro - 宏观层面参数
 * @param {number} params.macro.rf - 无风险利率，例如 0.018
 * @param {number} params.macro.nominalGdpGrowth - 名义 GDP 增速 m 的数字输入，例如 4 表示 4%
 * @param {number} [params.macro.equityRiskPremium=0.055] - 固定股权风险补偿，默认 5.5%
 *
 * @returns {number} finalPe
 */
function calculateIntrinsicPe({ company, macro }) {
  const {
    growthForecasts,
    theta0,
    thetaX,
    transitionYears = 3,
    nearTermWeight = 0.15,
    longTermWeight = 0.85,
  } = company || {};

  const {
    rf,
    nominalGdpGrowth,
    equityRiskPremium = 0.055,
  } = macro || {};

  if (!Array.isArray(growthForecasts) || growthForecasts.length !== 3) {
    throw new Error("company.growthForecasts 必须是长度为 3 的数组，例如 [0.12, 0.10, 0.08]");
  }

  const [g1, g2, g3] = growthForecasts;

  const nums = {
    g1,
    g2,
    g3,
    theta0,
    thetaX,
    transitionYears,
    nearTermWeight,
    longTermWeight,
    rf,
    nominalGdpGrowth,
    equityRiskPremium,
  };

  for (const [key, value] of Object.entries(nums)) {
    if (!Number.isFinite(value)) {
      throw new Error(`${key} 必须是有限数字`);
    }
  }

  if (!Number.isInteger(transitionYears) || transitionYears < 0) {
    throw new Error("transitionYears 必须是大于等于 0 的整数");
  }

  if (Math.abs(nearTermWeight + longTermWeight - 1) > 1e-8) {
    throw new Error("nearTermWeight 与 longTermWeight 之和必须等于 1");
  }

  if (g1 <= -1 || g2 <= -1 || g3 <= -1) {
    throw new Error("growthForecasts 中每个增速都必须大于 -1；当前版本不考虑亏损情形");
  }

  const R = rf + equityRiskPremium;
  const gInfinity = (0.35 * nominalGdpGrowth / (1 + 0.35 * nominalGdpGrowth)) * 0.04;

  if (R <= gInfinity) {
    throw new Error("折现率 R 必须大于终局增速 g∞");
  }

  // 内部标准化：np0 = 1
  const np0 = 1;
  const np1 = np0 * (1 + g1);
  const np2 = np1 * (1 + g2);
  const np3 = np2 * (1 + g3);

  const pvFirst3 =
    np1 / Math.pow(1 + R, 1) +
    np2 / Math.pow(1 + R, 2) +
    np3 / Math.pow(1 + R, 3);

  const profitSeries = [np1, np2, np3];
  let pvTransition = 0;
  const N = 3 + transitionYears;

  for (let t = 4; t <= N; t++) {
    const step = (t - 3) / (transitionYears + 1);
    const gt = g3 + step * (gInfinity - g3);

    const prevProfit = profitSeries[profitSeries.length - 1];
    const currentProfit = prevProfit * (1 + gt);

    if (currentProfit <= 0) {
      throw new Error("过渡期利润小于等于 0；当前版本不考虑亏损情形");
    }

    profitSeries.push(currentProfit);
    pvTransition += currentProfit / Math.pow(1 + R, t);
  }

  const npN = profitSeries[profitSeries.length - 1];
  const npN1 = npN * (1 + gInfinity);

  const terminalValue = npN1 / (R - gInfinity);
  const pvTerminal = terminalValue / Math.pow(1 + R, N);

  const basePe = pvFirst3 + pvTransition + pvTerminal;
  const theta = nearTermWeight * theta0 + longTermWeight * thetaX;

  return basePe * theta;
}
```

---

## 八、调用示例

```js
const finalPe = calculateIntrinsicPe({
  company: {
    growthForecasts: [0.12, 0.12, 0.12],
    theta0: 0.9,
    thetaX: 0.9,
    transitionYears: 3,
  },
  macro: {
    rf: 0.018,
    nominalGdpGrowth: 4,
  },
});

console.log(finalPe);
```

---

## 九、一句话总纲

> **本体系以未来利润现值为估值基础，采用统一折现率与统一终局增速，将主观判断主要集中于利润预测；同时通过当前兑现系数与长期兑现系数的加权，对利润基础估值进行整体折价，从而将账面利润修正为更接近股东价值的估值结果。**
