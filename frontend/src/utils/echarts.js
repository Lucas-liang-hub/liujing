/**
 * ECharts 按需引入：只注册用到的图表与组件，控制打包体积（技术方案 3.2 第 4 条）。
 */
import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, HeatmapChart, PieChart, GridComponent, TooltipComponent, VisualMapComponent, LegendComponent, CanvasRenderer]);

export const CHART_TEXT = 'rgba(233,238,244,0.62)';
export const CHART_LINE = 'rgba(255,255,255,0.08)';

export const tooltipStyle = {
  backgroundColor: 'rgba(10,14,20,0.92)',
  borderColor: 'rgba(255,255,255,0.14)',
  borderWidth: 1,
  textStyle: { color: '#e9eef4', fontSize: 12 },
  extraCssText: 'backdrop-filter: blur(8px); border-radius: 10px;',
};

export default echarts;
