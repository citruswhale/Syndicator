import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '@/context/AnalysisContext';
import { GraphVisualization } from '@/components/GraphVisualization';
import TimelineVisualization from '@/components/TimelineVisualization';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ShieldAlert, Network, Clock, ArrowRight, Activity, ShieldCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const StatCard = ({ icon: Icon, label, value, color, testId }) => (
  <div data-testid={testId} className="bg-zinc-950 border border-zinc-800 rounded-sm p-4 relative group hover:border-zinc-700 transition-colors">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] font-mono text-zinc-600 tracking-widest uppercase">{label}</p>
        <p className={`text-2xl font-mono font-bold mt-1 ${color}`}>{value}</p>
      </div>
      <Icon size={16} className="text-zinc-700" strokeWidth={1.5} />
    </div>
  </div>
);

export default function DashboardPage() {
  const { analysisData } = useAnalysis();
  const navigate = useNavigate();
  const graphContainerRef = useRef(null);
  const [graphDims, setGraphDims] = useState({ w: 600, h: 350 });

  useEffect(() => {
    if (!analysisData) { navigate('/'); return; }
    const el = graphContainerRef.current;
    if (el) {
      const obs = new ResizeObserver(entries => {
        for (const e of entries) {
          setGraphDims({ w: e.contentRect.width, h: 350 });
        }
      });
      obs.observe(el);
      return () => obs.disconnect();
    }
  }, [analysisData, navigate]);

  if (!analysisData) return null;
  const { summary, suspicious_accounts, fraud_rings, graph_data, false_positives } = analysisData;

  const patternCounts = {};
  (fraud_rings || []).forEach(r => {
    patternCounts[r.pattern_type] = (patternCounts[r.pattern_type] || 0) + 1;
  });

  const chartData = Object.entries(patternCounts).map(([k, v]) => ({
    name: k.replace(/_/g, ' ').toUpperCase().slice(0, 15),
    count: v,
    color: { circular_fund_routing: '#ef4444', smurfing: '#f59e0b', layered_shell: '#3b82f6' }[k] || '#8b5cf6'
  }));

  const topSuspects = (suspicious_accounts || []).slice(0, 8);

  return (
    <div className="p-6 md:p-8 space-y-6 min-h-screen" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold text-zinc-100 tracking-tight">ANALYSIS DASHBOARD</h1>
          <p className="text-xs font-mono text-zinc-600 tracking-wider mt-1">
            {analysisData.filename} // {summary?.processing_time_seconds}s
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono tracking-wider border-green-500/30 text-green-400">
          COMPLETE
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Users} label="ACCOUNTS" value={summary?.total_accounts_analyzed?.toLocaleString()} color="text-zinc-100" testId="stat-accounts" />
        <StatCard icon={ShieldAlert} label="FLAGGED" value={summary?.suspicious_accounts_flagged} color="text-red-400" testId="stat-flagged" />
        <StatCard icon={Network} label="FRAUD RINGS" value={summary?.fraud_rings_detected} color="text-amber-400" testId="stat-rings" />
        <StatCard icon={ShieldCheck} label="FALSE POS." value={summary?.false_positives_detected || false_positives?.length || 0} color="text-teal-400" testId="stat-fp" />
        <StatCard icon={Clock} label="TIME (SEC)" value={summary?.processing_time_seconds} color="text-blue-400" testId="stat-time" />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Graph Preview */}
        <div className="lg:col-span-8" ref={graphContainerRef}>
          <Card className="bg-zinc-950 border-zinc-800 rounded-sm overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-zinc-800/50 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-mono tracking-widest text-zinc-500">NETWORK GRAPH</CardTitle>
              <button
                data-testid="graph-expand-btn"
                onClick={() => navigate('/graph')}
                className="text-[10px] font-mono text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
              >
                EXPAND <ArrowRight size={10} />
              </button>
            </CardHeader>
            <CardContent className="p-0 h-[350px]">
              <GraphVisualization
                graphData={graph_data}
                width={graphDims.w}
                height={350}
                onNodeClick={(node) => node.is_suspicious && navigate('/accounts')}
              />
            </CardContent>
          </Card>
        </div>

        {/* Pattern Breakdown */}
        <div className="lg:col-span-4">
          <Card className="bg-zinc-950 border-zinc-800 rounded-sm h-full">
            <CardHeader className="py-3 px-4 border-b border-zinc-800/50">
              <CardTitle className="text-xs font-mono tracking-widest text-zinc-500">PATTERN BREAKDOWN</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} layout="vertical">
                    <XAxis type="number" tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#71717a', fontSize: 9, fontFamily: 'JetBrains Mono' }} width={100} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 2, fontFamily: 'JetBrains Mono', fontSize: 11 }}
                      labelStyle={{ color: '#a1a1aa' }}
                    />
                    <Bar dataKey="count" radius={[0, 2, 2, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-zinc-600 font-mono text-center py-8">NO PATTERNS DETECTED</p>
              )}

              {/* Quick links */}
              <div className="mt-4 space-y-2">
                <button
                  data-testid="view-rings-btn"
                  onClick={() => navigate('/rings')}
                  className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/50 border border-zinc-800/50 rounded-sm text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all"
                >
                  <span>VIEW FRAUD RINGS</span>
                  <ArrowRight size={12} />
                </button>
                <button
                  data-testid="view-suspects-btn"
                  onClick={() => navigate('/accounts')}
                  className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/50 border border-zinc-800/50 rounded-sm text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all"
                >
                  <span>VIEW SUSPECTS</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Timeline Visualization */}
      {analysisData.timeline_data && analysisData.timeline_data.length > 0 && (
        <TimelineVisualization timelineData={analysisData.timeline_data} />
      )}

      {/* Top Suspects Table */}
      <Card className="bg-zinc-950 border-zinc-800 rounded-sm">
        <CardHeader className="py-3 px-4 border-b border-zinc-800/50 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-mono tracking-widest text-zinc-500">TOP SUSPECTS</CardTitle>
          <button
            data-testid="view-all-suspects-btn"
            onClick={() => navigate('/accounts')}
            className="text-[10px] font-mono text-blue-500 hover:text-blue-400 flex items-center gap-1"
          >
            VIEW ALL <ArrowRight size={10} />
          </button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="top-suspects-table">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  <th className="px-4 py-2.5 text-left text-[10px] font-mono text-zinc-600 tracking-widest">ACCOUNT</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-mono text-zinc-600 tracking-widest">SCORE</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-mono text-zinc-600 tracking-widest">PATTERNS</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-mono text-zinc-600 tracking-widest">METHOD</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-mono text-zinc-600 tracking-widest">FLOW IN</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-mono text-zinc-600 tracking-widest">FLOW OUT</th>
                </tr>
              </thead>
              <tbody>
                {topSuspects.map(a => (
                  <tr key={a.account_id} className="border-b border-zinc-800/30 hover:bg-zinc-900/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-mono text-zinc-300">{a.account_id}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-sm font-mono font-bold ${a.suspicion_score > 70 ? 'text-red-400' :
                          a.suspicion_score > 40 ? 'text-amber-400' : 'text-blue-400'
                        }`}>
                        {a.suspicion_score}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {a.detected_patterns?.map(p => (
                          <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm">
                            {p.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {a.pattern_labels?.map((l, i) => (
                          <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-sm">
                            {l}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-zinc-400">${a.total_received?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-zinc-400">${a.total_sent?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
