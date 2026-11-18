import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { TestReport } from '../../types';

interface ReportChartsProps {
  report: TestReport;
}

const PASS_FAIL_COLORS = ['#22c55e', '#ef4444', '#64748b'];

export const ReportCharts: React.FC<ReportChartsProps> = ({ report }) => {
  const passFailData = [
    { name: 'Passed', value: report.summary.passedAssertions || report.summary.passedRequests },
    { name: 'Failed', value: report.summary.failedAssertions || report.summary.failedRequests },
    ...(report.summary.skippedAssertions > 0
      ? [{ name: 'Skipped', value: report.summary.skippedAssertions }]
      : []),
  ].filter((d) => d.value > 0);

  const responseTimeData = report.results.slice(0, 20).map((r, idx) => ({
    label: `#${idx + 1} ${r.requestName.slice(0, 14)}`,
    timeMs: r.responseTimeMs,
    status: r.status,
  }));

  const statusData = report.statusDistribution;

  const timelineData = report.results.map((r, idx) => ({
    step: `${r.iteration}.${r.order}`,
    index: idx + 1,
    latencyMs: r.responseTimeMs,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
      {/* 1. Passed / Failed Breakdown */}
      <div className="p-4 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50">
        <div className="font-semibold mb-3 text-slate-200 dark:text-slate-200 light:text-slate-800">
          Pass / Fail Distribution
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={passFailData.length > 0 ? passFailData : [{ name: 'None', value: 1 }]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
              >
                {(passFailData.length > 0 ? passFailData : [{ name: 'None', value: 1 }]).map(
                  (_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PASS_FAIL_COLORS[index % PASS_FAIL_COLORS.length]}
                    />
                  )
                )}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  fontSize: '12px',
                  color: '#e2e8f0',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Status Code Distribution */}
      <div className="p-4 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50">
        <div className="font-semibold mb-3 text-slate-200 dark:text-slate-200 light:text-slate-800">
          HTTP Status Distribution
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="bucket" stroke="#94a3b8" fontSize={11} />
              <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  fontSize: '12px',
                  color: '#e2e8f0',
                }}
              />
              <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Request Response Times */}
      <div className="p-4 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50">
        <div className="font-semibold mb-3 text-slate-200 dark:text-slate-200 light:text-slate-800">
          Request Response Times (ms)
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  fontSize: '12px',
                  color: '#e2e8f0',
                }}
              />
              <Bar dataKey="timeMs" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Execution Timeline */}
      <div className="p-4 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-50">
        <div className="font-semibold mb-3 text-slate-200 dark:text-slate-200 light:text-slate-800">
          Execution Latency Timeline
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="step" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  fontSize: '12px',
                  color: '#e2e8f0',
                }}
              />
              <Line
                type="monotone"
                dataKey="latencyMs"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
