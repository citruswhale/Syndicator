import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '@/context/AnalysisContext';
import { GraphVisualization } from '@/components/GraphVisualization';
import { X, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function GraphExplorer() {
  const { analysisData } = useAnalysis();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!analysisData) { navigate('/'); return; }
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDims({ w: rect.width, h: rect.height });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [analysisData, navigate]);

  const filteredGraphData = useMemo(() => {
    if (!analysisData?.graph_data) return { nodes: [], links: [] };
    const { nodes, links } = analysisData.graph_data;

    if (filter === 'all') return { nodes, links };

    const filteredNodes = nodes.filter(n => {
      if (filter === 'suspicious') return n.suspicion_score > 0;
      if (filter === 'high-risk') return n.suspicion_score > 70;
      if (filter === 'ring-members') return n.is_suspicious;
      if (filter === 'false-positives') return n.is_false_positive;
      return true;
    });

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = links.filter(l =>
      nodeIds.has(typeof l.source === 'object' ? l.source.id : l.source) &&
      nodeIds.has(typeof l.target === 'object' ? l.target.id : l.target)
    );

    return { nodes: filteredNodes, links: filteredLinks };
  }, [analysisData, filter]);

  if (!analysisData) return null;

  return (
    <div className="h-screen flex flex-col" data-testid="graph-explorer-page">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur border-b border-zinc-800/50">
        <div className="flex items-center gap-4">
          <h2 className="font-mono text-xs tracking-widest text-zinc-400">GRAPH EXPLORER</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-600">FILTER:</span>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger
                data-testid="graph-filter-select"
                className="h-7 w-36 text-[10px] font-mono bg-zinc-900 border-zinc-800 rounded-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all" className="text-[10px] font-mono">ALL NODES</SelectItem>
                <SelectItem value="suspicious" className="text-[10px] font-mono">SUSPICIOUS ONLY</SelectItem>
                <SelectItem value="high-risk" className="text-[10px] font-mono">HIGH RISK (&gt;70)</SelectItem>
                <SelectItem value="ring-members" className="text-[10px] font-mono">RING MEMBERS</SelectItem>
                <SelectItem value="false-positives" className="text-[10px] font-mono">FALSE POSITIVES</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-[10px] font-mono text-zinc-600">
            {filteredGraphData.nodes.length} NODES / {filteredGraphData.links.length} EDGES
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
            <span className="text-[10px] font-mono text-zinc-500">HIGH RISK</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[10px] font-mono text-zinc-500">MEDIUM</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-[10px] font-mono text-zinc-500">LOW</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rotate-45 bg-teal-500" />
            <span className="text-[10px] font-mono text-zinc-500">MERCHANT (FP)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rotate-45 bg-green-500" />
            <span className="text-[10px] font-mono text-zinc-500">PAYROLL (FP)</span>
          </div>
        </div>
      </div>

      {/* Graph Canvas */}
      <div ref={containerRef} className="flex-1 relative bg-[#09090b]">
        <GraphVisualization
          graphData={filteredGraphData}
          width={dims.w}
          height={dims.h}
          onNodeClick={setSelectedNode}
        />

        {/* Node Detail Panel */}
        {selectedNode && (
          <div
            data-testid="node-detail-panel"
            className="absolute top-4 left-4 w-72 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-sm overflow-hidden z-20"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/50 bg-zinc-900/50">
              <span className="text-[10px] font-mono tracking-widest text-zinc-400">SUSPECT PROFILE</span>
              <button onClick={() => setSelectedNode(null)} className="text-zinc-600 hover:text-zinc-300">
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-[10px] font-mono text-zinc-600 tracking-widest">ACCOUNT ID</div>
                <div className="text-sm font-mono text-zinc-200 mt-0.5">{selectedNode.id}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-mono text-zinc-600 tracking-widest">SCORE</div>
                  <div className={`text-xl font-mono font-bold mt-0.5 ${selectedNode.suspicion_score > 70 ? 'text-red-400' :
                    selectedNode.suspicion_score > 40 ? 'text-amber-400' : 'text-blue-400'
                    }`}>
                    {(selectedNode.suspicion_score || 0).toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-zinc-600 tracking-widest">DEGREE (IN/OUT)</div>
                  <div className="text-sm font-mono text-zinc-300 mt-0.5">
                    {selectedNode.in_degree || 0} / {selectedNode.out_degree || 0}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-mono text-zinc-600 tracking-widest">FLOW IN</div>
                  <div className="text-xs font-mono text-emerald-400 mt-0.5">${selectedNode.total_received?.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-zinc-600 tracking-widest">FLOW OUT</div>
                  <div className="text-xs font-mono text-red-400 mt-0.5">${selectedNode.total_sent?.toLocaleString()}</div>
                </div>
              </div>

              {selectedNode.detected_patterns?.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono text-zinc-600 tracking-widest mb-1.5">DETECTED PATTERNS</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.detected_patterns.map(p => (
                      <Badge key={p} variant="outline" className="text-[9px] font-mono tracking-wider border-red-500/30 text-red-400 bg-red-500/5 rounded-sm">
                        {p.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.ring_id && (
                <div>
                  <div className="text-[10px] font-mono text-zinc-600 tracking-widest">RING ID</div>
                  <div className="text-xs font-mono text-amber-400 mt-0.5">
                    {Array.isArray(selectedNode.ring_id) ? selectedNode.ring_id.join(', ') : selectedNode.ring_id}
                  </div>
                </div>
              )}

              {/* Pattern Labels */}
              {selectedNode.pattern_labels?.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono text-zinc-600 tracking-widest mb-1">DETECTION METHOD</div>
                  {selectedNode.pattern_labels.map((label, i) => (
                    <div key={i} className="text-[10px] font-mono px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm mb-1">{label}</div>
                  ))}
                </div>
              )}

              {/* False Positive Badge */}
              {selectedNode.is_false_positive && (
                <div className={`px-2.5 py-2 rounded-sm border ${selectedNode.false_positive_type === 'merchant'
                  ? 'bg-teal-500/10 border-teal-500/20'
                  : 'bg-green-500/10 border-green-500/20'
                  }`}>
                  <div className={`text-[10px] font-mono font-bold tracking-wider ${selectedNode.false_positive_type === 'merchant' ? 'text-teal-400' : 'text-green-400'
                    }`}>
                    {selectedNode.false_positive_type?.toUpperCase()} — NOT FLAGGED
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                    {selectedNode.false_positive_explanation}
                  </p>
                </div>
              )}

              {/* Explanation */}
              {selectedNode.explanation && !selectedNode.is_false_positive && (
                <div className="border-t border-zinc-800 pt-2">
                  <div className="text-[10px] font-mono text-zinc-600 tracking-widest mb-1">ANALYSIS</div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">{selectedNode.explanation}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
