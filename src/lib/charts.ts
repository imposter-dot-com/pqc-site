// the charts on the simulator page, drawn with chart.js.
// chart.js does the axes, bars, titles, hover tooltips and resizing.
// we only add three small drawing extras it doesn't have: numbers on top of bars, brackets, and dashed lines.
import {
  BarController, BarElement, CategoryScale, Chart, LineController, LineElement,
  LinearScale, PointElement, SubTitle, Tooltip,
} from 'chart.js';
import type { ChartConfiguration, Plugin } from 'chart.js';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, SubTitle, Tooltip);

// the look shared by every chart
Chart.defaults.font.family = '"Helvetica Neue",Helvetica,Arial,sans-serif';
Chart.defaults.font.size = 13;
Chart.defaults.color = '#4a5468';
Chart.defaults.animation = false; // the guide jumps between steps, so no slow fade-in

export const COLORS = ['#6d5bd0', '#0e8f8a', '#c98a0b'];

// one chart per canvas. we throw the old one away before drawing a new one
const charts = new Map<HTMLCanvasElement, Chart>();

function show(canvas: HTMLCanvasElement, config: ChartConfiguration): void {
  charts.get(canvas)?.destroy();
  charts.set(canvas, new Chart(canvas, config));
}

// remove the chart from a canvas, so it is empty again
export function clearCanvas(canvas: HTMLCanvasElement): void {
  charts.get(canvas)?.destroy();
  charts.delete(canvas);
}

// ---- the bar chart ----

export interface Bar {
  v: number;        // how tall the bar is
  fill: string;     // its colour
  label?: string;   // the number written on top of the bar
  tick?: string;    // the text under the bar
  tip?: string;     // what shows up when you hover over it
}

export interface BarChart {
  yMax: number;
  xTitle: string;
  yTitle: string;
  yTicks: Array<[number, string]>;                              // [value, text] for the labels on the left
  brackets?: Array<{ from: number; to: number; text: string }>; // bars from..to get a bracket above them
  lines?: number[];                                             // dashed lines, each 0 to 1 along the x axis
  note?: string;                                                // small text in the top right corner
  keepTinyBars?: boolean;                                       // give very short bars a minimum height so they stay visible
}

export function barChart(canvas: HTMLCanvasElement, bars: Bar[], o: BarChart): void {
  // with lots of numbered bars, only write every other number so they don't overlap
  const numbered = bars.filter(b => b.tick).length;
  const every = numbered > 24 ? 2 : 1;
  const labels = bars.map((b, i) => (b.tick && i % every === 0 ? b.tick : ''));

  const yNames = new Map(o.yTicks);

  // the extras chart.js doesn't have: numbers on top of bars, brackets above them, dashed lines
  const extras: Plugin = {
    id: 'extras',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      const area = chart.chartArea;
      const slot = area.width / bars.length;
      const slotX = (i: number): number => chart.scales.x!.getPixelForValue(i);

      ctx.save();
      ctx.textAlign = 'center';

      // numbers on top of the bars (only when the bars are wide enough to fit them)
      if (slot >= 20) {
        ctx.fillStyle = '#1c2230';
        ctx.font = `${slot >= 26 ? 13 : 11}px ${Chart.defaults.font.family}`;
        bars.forEach((b, i) => {
          if (b.label) ctx.fillText(b.label, slotX(i), chart.scales.y!.getPixelForValue(b.v) - 5);
        });
      }

      // dashed lines where the spikes should be
      if (o.lines) {
        ctx.strokeStyle = 'rgba(201,138,11,.75)';
        ctx.setLineDash([4, 4]);
        for (const f of o.lines) {
          const x = area.left + f * area.width;
          ctx.beginPath();
          ctx.moveTo(x, area.top);
          ctx.lineTo(x, area.bottom);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // brackets above the bars
      for (const br of o.brackets ?? []) {
        const x1 = slotX(br.from) - slot / 2 + 4;
        const x2 = slotX(br.to) + slot / 2 - 4;
        const y = area.top - 14;
        ctx.strokeStyle = '#4a5468';
        ctx.beginPath();
        ctx.moveTo(x1, y + 6);
        ctx.lineTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.lineTo(x2, y + 6);
        ctx.stroke();
        ctx.fillStyle = '#1c2230';
        ctx.font = `13px ${Chart.defaults.font.family}`;
        ctx.fillText(br.text, (x1 + x2) / 2, y - 5);
      }
      ctx.restore();
    },
  };

  show(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: bars.map(b => b.v),
        backgroundColor: bars.map(b => b.fill),
        categoryPercentage: 1,
        barPercentage: 0.74,
        minBarLength: o.keepTinyBars ? 5 : 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: o.brackets ? 34 : 12, right: 6 } },
      scales: {
        x: {
          title: { display: true, text: o.xTitle, color: '#1c2230' },
          grid: { display: false },
          ticks: { autoSkip: false, maxRotation: 0 },
        },
        y: {
          min: 0,
          max: o.yMax,
          title: { display: true, text: o.yTitle, color: '#1c2230' },
          grid: { color: '#e6e9ef' },
          // only show the labels we asked for
          afterBuildTicks: axis => { axis.ticks = o.yTicks.map(([value]) => ({ value })); },
          ticks: { callback: value => yNames.get(Number(value)) ?? '' },
        },
      },
      plugins: {
        legend: { display: false },
        subtitle: { display: !!o.note, text: o.note ?? '', align: 'end' },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: () => '',
            label: item => bars[item.dataIndex]?.tip ?? String(item.formattedValue),
          },
        },
      },
    },
    plugins: [extras],
  });
}

// squash a long list of numbers into B blocks by adding them up
export function binned(values: ArrayLike<number>, B: number): Float64Array {
  const out = new Float64Array(B);
  const total = values.length;
  for (let i = 0; i < total; i++) out[Math.min(B - 1, Math.floor((i * B) / total))] += values[i]!;
  return out;
}

// ---- the line chart (noise sweep) ----

export interface SweepChart {
  labels: string[];     // the noise levels along the bottom, like "10%"
  rates: number[];      // how often one shot worked, from 0 to 1
  baseline: number;     // how often a totally random result still works, from 0 to 1
  xTitle: string;
}

export function lineChart(canvas: HTMLCanvasElement, o: SweepChart): void {
  const percent = (v: number): number => v * 100;
  show(canvas, {
    type: 'line',
    data: {
      labels: o.labels,
      datasets: [
        { label: 'one shot works', data: o.rates.map(percent), borderColor: '#0e8f8a', backgroundColor: '#0e8f8a', borderWidth: 2, pointRadius: 3 },
        { label: 'random guess works', data: o.rates.map(() => percent(o.baseline)), borderColor: 'rgba(201,138,11,.95)', borderDash: [5, 4], borderWidth: 2, pointRadius: 0 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: o.xTitle, color: '#1c2230' }, grid: { display: false } },
        y: {
          min: 0,
          max: 100,
          title: { display: true, text: 'shots that give a valid r', color: '#1c2230' },
          grid: { color: '#e6e9ef' },
          afterBuildTicks: axis => { axis.ticks = [0, 50, 100].map(value => ({ value })); },
          ticks: { callback: value => value + '%' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: item => `${item.dataset.label}: ${Number(item.parsed.y).toFixed(0)}%` } },
      },
    },
  });
}
