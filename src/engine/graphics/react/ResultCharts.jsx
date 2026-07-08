import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { buildResultChartData, buildResultChartOptions } from '../core/resultSeries.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

/**
 * Combined bending moment, shear, and deflection chart from solver analysis.
 *
 * @param {{ analysis: import('../../beam/types.js').BeamResults, className?: string, style?: object }} props
 */
export default function ResultCharts({ analysis, className, style }) {
  const chartData = useMemo(() => buildResultChartData(analysis), [analysis]);
  const chartOptions = useMemo(() => buildResultChartOptions(), []);

  return (
    <div className={className} style={style}>
      <Line data={chartData} options={chartOptions} />
    </div>
  );
}
