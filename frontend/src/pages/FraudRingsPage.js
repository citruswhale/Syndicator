import { useEffect, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '@/context/AnalysisContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';

const patternColors = {
  circular_fund_routing: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: 'CYCLE' },
  smurfing: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: 'SMURFING' },
  layered_shell: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', label: 'SHELL' },
};

export default function FraudRingsPage() {
  const { analysisData } = useAnalysis();
  const navigate = useNavigate();
  const [expandedRing, setExpandedRing] = useState(null);

  useEffect(() => {
    if (!analysisData) navigate('/');
  }, [analysisData, navigate]);

  if (!analysisData) return null;
  const { fraud_rings } = analysisData;

  return (
    <div className="p-6 md:p-8 space-y-6 min-h-screen" data-testid="fraud-rings-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold text-zinc-100 tracking-tight">FRAUD RINGS</h1>
          <p className="text-xs font-mono text-zinc-600 tracking-wider mt-1">
            {fraud_rings?.length || 0} RINGS DETECTED ACROSS ALL PATTERN TYPES
          </p>
        </div>
        <div className="flex gap-2">
          {Object.entries(patternColors).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-sm ${val.bg.replace('/10', '')} ${val.bg}`} />
              <span className="text-[10px] font-mono text-zinc-500">{val.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rings Table */}
      <Card className="bg-zinc-950 border-zinc-800 rounded-sm">
        <CardContent className="p-0">
          <table className="w-full" data-testid="fraud-rings-table">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 tracking-widest w-8"></th>
                <th className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 tracking-widest">RING ID</th>
                <th className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 tracking-widest">PATTERN TYPE</th>
                <th className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 tracking-widest">MEMBERS</th>
                <th className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 tracking-widest">RISK SCORE</th>
              </tr>
            </thead>
            <tbody>
              {(fraud_rings || []).map(ring => {
                const isExpanded = expandedRing === ring.ring_id;
                const pc = patternColors[ring.pattern_type] || patternColors.circular_fund_routing;

                return (
                  <Fragment key={ring.ring_id}>
                    <tr
                      data-testid={`ring-row-${ring.ring_id}`}
                      onClick={() => setExpandedRing(isExpanded ? null : ring.ring_id)}
                      className="border-b border-zinc-800/30 cursor-pointer hover:bg-zinc-900/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-zinc-600">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-zinc-300">{ring.ring_id}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono tracking-wider ${pc.text} ${pc.border} ${pc.bg} rounded-sm`}
                        >
                          {ring.pattern_type.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-zinc-400">
                        {ring.member_accounts?.length || 0}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 max-w-[100px] h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                ring.risk_score > 70 ? 'bg-red-500' :
                                ring.risk_score > 40 ? 'bg-amber-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${ring.risk_score}%` }}
                            />
                          </div>
                          <span className={`text-sm font-mono font-bold ${
                            ring.risk_score > 70 ? 'text-red-400' :
                            ring.risk_score > 40 ? 'text-amber-400' : 'text-blue-400'
                          }`}>
                            {ring.risk_score}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Row */}
                    {isExpanded && (
                      <tr className="bg-zinc-900/20">
                        <td colSpan={5} className="px-8 py-4">
                          <div>
                            <div className="text-[10px] font-mono text-zinc-600 tracking-widest mb-2">MEMBER ACCOUNTS</div>
                            <div className="flex flex-wrap gap-1.5">
                              {ring.member_accounts?.map(acc => (
                                <span
                                  key={acc}
                                  className="text-[11px] font-mono px-2 py-1 bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 rounded-sm"
                                >
                                  {acc}
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {(!fraud_rings || fraud_rings.length === 0) && (
            <div className="p-12 text-center">
              <ShieldAlert className="mx-auto text-zinc-700 mb-3" size={32} strokeWidth={1.5} />
              <p className="text-xs font-mono text-zinc-600">NO FRAUD RINGS DETECTED</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
