import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { RACE_TYPE_COLOURS, RACE_TYPE_NAMES } from '../../queries/CompetitorHistory';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-neutral-200 rounded-lg shadow-lg">
        <p className="font-medium text-neutral-900">
          {RACE_TYPE_NAMES[data.raceType] || data.raceType}
        </p>
        <div className="mt-2 space-y-1">
          <p className="text-sm text-neutral-600">
            Average: <span className="font-bold text-primary-700">{data.avgPoints.toFixed(2)} pts</span>
          </p>
          <p className="text-sm text-neutral-600">
            Best: <span className="font-bold text-green-600">{data.bestPoints.toFixed(2)} pts</span>
          </p>
          <p className="text-sm text-neutral-600">
            Races: <span className="font-medium">{data.count}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export default function PerformanceChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-500">
        No race data available for charting
      </div>
    );
  }

  const validData = data.filter(
    (race) => race.calculated_seed_points != null && race.calculated_seed_points >= 0
  );

  if (validData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-500">
        No completed races with seed points to display
      </div>
    );
  }

  const aggregatedByType = validData.reduce((acc, race) => {
    const type = race.race_type;
    if (!acc[type]) {
      acc[type] = {
        raceType: type,
        total: 0,
        count: 0,
        best: Infinity,
      };
    }
    acc[type].total += race.calculated_seed_points;
    acc[type].count += 1;
    acc[type].best = Math.min(acc[type].best, race.calculated_seed_points);
    return acc;
  }, {});

  const chartData = Object.values(aggregatedByType)
    .map((item) => ({
      raceType: item.raceType,
      displayName: RACE_TYPE_NAMES[item.raceType] || item.raceType,
      avgPoints: item.total / item.count,
      bestPoints: item.best,
      count: item.count,
    }))
    .sort((a, b) => a.avgPoints - b.avgPoints);

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#d1d5db' }}
            label={{
              value: 'Average Seed Points',
              position: 'insideBottom',
              offset: -10,
              style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 12 },
            }}
          />
          <YAxis
            type="category"
            dataKey="displayName"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#d1d5db' }}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="avgPoints" name="Average" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={RACE_TYPE_COLOURS[entry.raceType] || '#6b7280'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
