import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '@/context/AnalysisContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Users, Search, ArrowUpDown } from 'lucide-react';

export default function SuspiciousAccountsPage() {
  const { analysisData } = useAnalysis();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [patternFilter, setPatternFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score_desc');

  useEffect(() => {
    if (!analysisData) navigate('/');
  }, [analysisData, navigate]);

  if (!analysisData) return null;

  let accounts = [...(analysisData.suspicious_accounts || [])];

  // Filter by search
  if (search) {
    accounts = accounts.filter(a =>
      a.account_id.toLowerCase().includes(search.toLowerCase())
    );
  }

  // Filter by pattern
  if (patternFilter !== 'all') {
    accounts = accounts.filter(a =>
      a.detected_patterns?.includes(patternFilter)
    );
  }

  // Sort
  accounts.sort((a, b) => {
    switch (sortBy) {
      case 'score_asc': return a.suspicion_score - b.suspicion_score;
      case 'flow_desc': return (b.total_received + b.total_sent) - (a.total_received + a.total_sent);
      default: return b.suspicion_score - a.suspicion_score;
    }
  });

  return (
    <div className="p-6 md:p-8 space-y-6 min-h-screen" data-testid="suspicious-accounts-page">
      <div>
        <h1 className="font-mono text-2xl font-bold text-zinc-100 tracking-tight">SUSPICIOUS ACCOUNTS</h1>
        <p className="text-xs font-mono text-zinc-600 tracking-wider mt-1">
          {accounts.length} ACCOUNTS FLAGGED
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
          <Input
            data-testid="account-search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search account ID..."
            className="pl-9 h-8 text-xs font-mono bg-zinc-900 border-zinc-800 rounded-sm placeholder:text-zinc-700"
          />
        </div>

        <Select value={patternFilter} onValueChange={setPatternFilter}>
          <SelectTrigger data-testid="pattern-filter" className="h-8 w-44 text-[10px] font-mono bg-zinc-900 border-zinc-800 rounded-sm">
            <SelectValue placeholder="Pattern" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all" className="text-[10px] font-mono">ALL PATTERNS</SelectItem>
            <SelectItem value="circular_fund_routing" className="text-[10px] font-mono">CYCLES</SelectItem>
            <SelectItem value="smurfing" className="text-[10px] font-mono">SMURFING</SelectItem>
            <SelectItem value="layered_shell" className="text-[10px] font-mono">SHELL NETWORKS</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger data-testid="sort-select" className="h-8 w-44 text-[10px] font-mono bg-zinc-900 border-zinc-800 rounded-sm">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="score_desc" className="text-[10px] font-mono">SCORE (HIGH-LOW)</SelectItem>
            <SelectItem value="score_asc" className="text-[10px] font-mono">SCORE (LOW-HIGH)</SelectItem>
            <SelectItem value="flow_desc" className="text-[10px] font-mono">FLOW (HIGH-LOW)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Accounts Table */}
      <Card className="bg-zinc-950 border-zinc-800 rounded-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="suspects-table">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 tracking-widest">ACCOUNT ID</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 tracking-widest">SCORE</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 tracking-widest">PATTERNS</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 tracking-widest">METHOD</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 tracking-widest">RING ID</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 tracking-widest">FLOW IN</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 tracking-widest">FLOW OUT</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 tracking-widest">FLOW RATIO</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr
                    key={a.account_id}
                    data-testid={`suspect-row-${a.account_id}`}
                    className="border-b border-zinc-800/30 hover:bg-zinc-900/30 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-xs font-mono text-zinc-300">{a.account_id}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${a.suspicion_score > 70 ? 'bg-red-500' :
                                a.suspicion_score > 40 ? 'bg-amber-500' : 'bg-blue-500'
                              }`}
                            style={{ width: `${a.suspicion_score}%` }}
                          />
                        </div>
                        <span className={`text-sm font-mono font-bold min-w-[40px] ${a.suspicion_score > 70 ? 'text-red-400' :
                            a.suspicion_score > 40 ? 'text-amber-400' : 'text-blue-400'
                          }`}>
                          {a.suspicion_score}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {a.detected_patterns?.map(p => (
                          <Badge key={p} variant="outline" className="text-[8px] font-mono tracking-wider border-red-500/20 text-red-400 bg-red-500/5 rounded-sm px-1">
                            {({ circular_fund_routing: 'CYCLE', smurfing: 'SMURF', layered_shell: 'SHELL' }[p] || p.replace(/_/g, ' ').toUpperCase())}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {a.pattern_labels?.map((l, i) => (
                          <span key={i} className="text-[8px] font-mono px-1 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-sm">
                            {l}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-mono text-amber-400/80">
                      {Array.isArray(a.ring_id) ? a.ring_id.join(', ') : a.ring_id || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-emerald-400/80">${a.total_received?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-red-400/80">${a.total_sent?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-zinc-400">{a.metrics?.flow_imbalance_ratio?.toFixed(4) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {accounts.length === 0 && (
            <div className="p-12 text-center">
              <Users className="mx-auto text-zinc-700 mb-3" size={32} strokeWidth={1.5} />
              <p className="text-xs font-mono text-zinc-600">NO MATCHING ACCOUNTS</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* False Positives Section */}
      {analysisData.false_positives?.length > 0 && (
        <Card className="bg-zinc-950 border-zinc-800 rounded-sm" data-testid="false-positives-section">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
            <div className="w-2 h-2 rotate-45 bg-teal-500" />
            <span className="text-xs font-mono tracking-widest text-teal-400">FALSE POSITIVES DETECTED</span>
            <span className="text-[10px] font-mono text-zinc-600 ml-2">{analysisData.false_positives.length} accounts correctly excluded</span>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="false-positives-table">
                <thead>
                  <tr className="border-b border-zinc-800/50">
                    <th className="px-4 py-2.5 text-left text-[10px] font-mono text-zinc-600 tracking-widest">ACCOUNT</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-mono text-zinc-600 tracking-widest">TYPE</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-mono text-zinc-600 tracking-widest">EXPLANATION</th>
                  </tr>
                </thead>
                <tbody>
                  {analysisData.false_positives.map(fp => (
                    <tr key={fp.account_id} className="border-b border-zinc-800/30 hover:bg-zinc-900/20">
                      <td className="px-4 py-2.5 text-xs font-mono text-zinc-300">{fp.account_id}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={`text-[9px] font-mono tracking-wider rounded-sm ${fp.type === 'merchant'
                            ? 'border-teal-500/30 text-teal-400 bg-teal-500/5'
                            : 'border-green-500/30 text-green-400 bg-green-500/5'
                          }`}>
                          {fp.type?.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-zinc-500 max-w-md">{fp.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
