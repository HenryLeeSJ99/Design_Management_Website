import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';

/**
 * StandardChart - A generic chart component standardizing the Recharts setup.
 *
 * @param {Array} data - Array of data objects
 * @param {Array} lines - Array of configuration objects for lines [{ dataKey: 'y1', name: 'Series 1', color: '#ff0000', type: 'monotone' }]
 * @param {Array} areas - Array of configuration objects for areas [{ dataKey: 'y2', name: 'Series 2', color: '#00ff00', fillOpacity: 0.3 }]
 * @param {Object} xAxis - XAxis configuration { dataKey: 'x', label: 'X Axis', tickFormatter: fn }
 * @param {Object} yAxis - YAxis configuration { label: 'Y Axis', tickFormatter: fn }
 * @param {Array} referenceLines - Array of reference lines [{ y: 10, label: 'Limit', stroke: 'red' }, { x: 50, label: 'Threshold', stroke: 'blue' }]
 * @param {Number} height - Chart height in pixels (default 400)
 */
export default function StandardChart({
  data = [],
  lines = [],
  areas = [],
  xAxis = { dataKey: 'name' },
  yAxis = {},
  referenceLines = [],
  height = 400,
  layout = 'horizontal',
}) {
  return (
    <div style={{ width: '100%', height: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          layout={layout}
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          
          <XAxis 
            dataKey={xAxis.dataKey} 
            type="number"
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickLine={{ stroke: '#cbd5e1' }}
            axisLine={{ stroke: '#cbd5e1' }}
            domain={xAxis.domain || ['dataMin', 'dataMax']}
            label={{ value: xAxis.label, position: 'bottom', offset: 0, fill: '#334155', fontSize: 13, fontWeight: 500 }}
            tickFormatter={xAxis.tickFormatter}
            {...xAxis.props}
          />
          
          <YAxis 
            dataKey={yAxis.dataKey}
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickLine={{ stroke: '#cbd5e1' }}
            axisLine={{ stroke: '#cbd5e1' }}
            domain={yAxis.domain || ['auto', 'auto']}
            label={{ value: yAxis.label, angle: -90, position: 'left', offset: 0, fill: '#334155', fontSize: 13, fontWeight: 500 }}
            tickFormatter={yAxis.tickFormatter}
            {...yAxis.props}
          />
          
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            labelStyle={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}
          />
          
          {(lines.length > 0 || areas.length > 0) && (
            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
          )}

          {referenceLines.map((ref, idx) => (
            <ReferenceLine 
              key={`ref-${idx}`}
              x={ref.x} 
              y={ref.y} 
              stroke={ref.stroke || '#94a3b8'} 
              strokeDasharray={ref.strokeDasharray || "3 3"} 
              label={{ position: 'insideTopLeft', value: ref.label, fill: ref.stroke || '#64748b', fontSize: 12 }} 
            />
          ))}
          
          {areas.map((area, idx) => (
            <Area
              key={`area-${idx}`}
              type={area.type || 'monotone'}
              dataKey={area.dataKey}
              name={area.name || area.dataKey}
              stroke={area.color || '#2563eb'}
              fill={area.color || '#2563eb'}
              fillOpacity={area.fillOpacity || 0.1}
              isAnimationActive={false}
            />
          ))}

          {lines.map((line, idx) => (
            <Line
              key={`line-${idx}`}
              type={line.type || 'monotone'}
              dataKey={line.dataKey}
              name={line.name || line.dataKey}
              stroke={line.color || '#2563eb'}
              strokeWidth={line.strokeWidth || 2}
              dot={line.dot !== undefined ? line.dot : { r: 3, fill: line.color || '#2563eb', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              {...line.props}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
