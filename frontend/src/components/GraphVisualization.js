import { useRef, useMemo, useCallback, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// Ring colors: AVOID red, orange, blue, teal, green (used in legend)
// Maximally distinct palette using purple, pink, yellow, violet, rose, indigo, fuchsia, lime, sky, magenta
const RING_COLORS = [
  { fill: '#a855f7', glow: 'rgba(168,85,247,0.7)', outer: 'rgba(168,85,247,0.15)', label: '#d8b4fe', edge: 'rgba(168,85,247,0.55)' },  // Purple
  { fill: '#ec4899', glow: 'rgba(236,72,153,0.7)', outer: 'rgba(236,72,153,0.15)', label: '#f9a8d4', edge: 'rgba(236,72,153,0.55)' },  // Pink
  { fill: '#eab308', glow: 'rgba(234,179,8,0.7)', outer: 'rgba(234,179,8,0.15)', label: '#fde68a', edge: 'rgba(234,179,8,0.55)' },   // Yellow
  { fill: '#8b5cf6', glow: 'rgba(139,92,246,0.7)', outer: 'rgba(139,92,246,0.15)', label: '#c4b5fd', edge: 'rgba(139,92,246,0.55)' },  // Violet
  { fill: '#f43f5e', glow: 'rgba(244,63,94,0.7)', outer: 'rgba(244,63,94,0.15)', label: '#fda4af', edge: 'rgba(244,63,94,0.55)' },   // Rose
  { fill: '#6366f1', glow: 'rgba(99,102,241,0.7)', outer: 'rgba(99,102,241,0.15)', label: '#a5b4fc', edge: 'rgba(99,102,241,0.55)' },  // Indigo
  { fill: '#d946ef', glow: 'rgba(217,70,239,0.7)', outer: 'rgba(217,70,239,0.15)', label: '#f0abfc', edge: 'rgba(217,70,239,0.55)' },  // Fuchsia
  { fill: '#84cc16', glow: 'rgba(132,204,22,0.7)', outer: 'rgba(132,204,22,0.15)', label: '#bef264', edge: 'rgba(132,204,22,0.55)' },  // Lime
  { fill: '#0ea5e9', glow: 'rgba(14,165,233,0.7)', outer: 'rgba(14,165,233,0.15)', label: '#7dd3fc', edge: 'rgba(14,165,233,0.55)' },  // Sky
  { fill: '#e11d48', glow: 'rgba(225,29,72,0.7)', outer: 'rgba(225,29,72,0.15)', label: '#fb7185', edge: 'rgba(225,29,72,0.55)' },   // Magenta-Rose
  { fill: '#7c3aed', glow: 'rgba(124,58,237,0.7)', outer: 'rgba(124,58,237,0.15)', label: '#a78bfa', edge: 'rgba(124,58,237,0.55)' },  // Deep Violet
  { fill: '#ca8a04', glow: 'rgba(202,138,4,0.7)', outer: 'rgba(202,138,4,0.15)', label: '#fbbf24', edge: 'rgba(202,138,4,0.55)' },   // Dark Yellow
];

const DIM_COLOR = '#18181b';

export const GraphVisualization = ({ graphData, onNodeClick, width, height }) => {
  const fgRef = useRef();
  const [hoveredNode, setHoveredNode] = useState(null);
  const [focusedRingId, setFocusedRingId] = useState(null);

  // === PRE-COMPUTE EVERYTHING in useMemo ===
  // This is the key optimization: all color/size/ring lookups happen ONCE when data changes,
  // not on every frame render. The callbacks become pure O(1) property reads.
  const { processedData, ringColorMap } = useMemo(() => {
    if (!graphData?.nodes?.length) return { processedData: { nodes: [], links: [] }, ringColorMap: {} };

    // Build ring_id → color index
    const rcMap = {};
    let idx = 0;
    graphData.nodes.forEach(n => {
      if (n.ring_id && !(n.ring_id in rcMap)) {
        rcMap[n.ring_id] = idx % RING_COLORS.length;
        idx++;
      }
    });

    // Build node ID → ring_id lookup
    const nodeRingLookup = {};
    graphData.nodes.forEach(n => {
      if (n.ring_id) nodeRingLookup[n.id] = n.ring_id;
    });

    // Pre-compute node visual properties
    const nodes = graphData.nodes.map(n => {
      const score = n.suspicion_score || 0;
      const ringIdx = n.ring_id ? (rcMap[n.ring_id] ?? -1) : -1;
      const rc = ringIdx >= 0 ? RING_COLORS[ringIdx] : null;

      let fillColor, size;
      if (n.is_false_positive) {
        fillColor = n.false_positive_type === 'merchant' ? '#14b8a6' : '#22c55e';
        size = 4.5;
      } else if (rc) {
        fillColor = rc.fill;
        size = score > 70 ? 5.5 : 4;
      } else if (score > 70) { fillColor = '#ef4444'; size = 3.5; }
      else if (score > 40) { fillColor = '#f59e0b'; size = 3; }
      else if (score > 0) { fillColor = '#60a5fa'; size = 2.5; }
      else { fillColor = '#27272a'; size = 2; }

      return {
        ...n,
        _fill: fillColor,
        _size: size,
        _rc: rc,         // ring color object (null if not a ring member)
        _ringIdx: ringIdx,
      };
    });

    // Pre-compute edge visual properties
    const links = graphData.links.map(l => {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source;
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
      const srcRing = nodeRingLookup[srcId];
      const tgtRing = nodeRingLookup[tgtId];
      const sameRing = srcRing && srcRing === tgtRing;
      const ringIdx = sameRing ? (rcMap[srcRing] ?? -1) : -1;

      return {
        ...l,
        _sameRing: sameRing,
        _ringId: sameRing ? srcRing : null,
        _ringEdgeColor: ringIdx >= 0 ? RING_COLORS[ringIdx].edge : null,
      };
    });

    return { processedData: { nodes, links }, ringColorMap: rcMap };
  }, [graphData]);

  // Handle node click: toggle ring focus
  const handleNodeClick = useCallback((node) => {
    if (node.ring_id) {
      setFocusedRingId(prev => prev === node.ring_id ? null : node.ring_id);
    } else {
      setFocusedRingId(null);
    }
    onNodeClick?.(node);
  }, [onNodeClick]);

  // Canvas node render — pure property reads, zero lookups
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const isDimmed = focusedRingId && node.ring_id !== focusedRingId;

    // Dimmed: tiny grey dot
    if (isDimmed) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 1.5, 0, 2 * Math.PI);
      ctx.fillStyle = DIM_COLOR;
      ctx.fill();
      return;
    }

    const size = node._size;
    const rc = node._rc;

    // False positive: diamond
    if (node.is_false_positive) {
      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-size / 1.4, -size / 1.4, size * 1.4, size * 1.4);
      ctx.fillStyle = node._fill;
      ctx.fill();
      ctx.restore();
      return;
    }

    // Circle fill
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = node._fill;
    ctx.fill();

    // Glow ring for ring members only
    if (rc) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 2.5, 0, 2 * Math.PI);
      ctx.strokeStyle = rc.glow;
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    // Labels only when zoomed in enough (skip at low zoom for perf)
    if (rc && globalScale > 1.5 && node.pattern_labels?.length > 0) {
      const fontSize = Math.max(8 / globalScale, 1.2);
      ctx.font = `bold ${fontSize}px JetBrains Mono`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = rc.label;
      ctx.fillText(node.pattern_labels[0], node.x, node.y + size + 3);
    }
  }, [focusedRingId]);

  // Edge color — pre-computed, O(1)
  const linkColorFn = useCallback((link) => {
    if (focusedRingId) {
      return link._ringId === focusedRingId ? link._ringEdgeColor : 'rgba(24,24,27,0.04)';
    }
    return link._ringEdgeColor || '#1e1e22';
  }, [focusedRingId]);

  // Edge width — pre-computed
  const linkWidthFn = useCallback((link) => {
    if (link._sameRing) {
      return focusedRingId === link._ringId ? 2.5 : 1.5;
    }
    return focusedRingId ? 0.1 : 0.3;
  }, [focusedRingId]);

  const nodePointerAreaPaint = useCallback((node, color, ctx) => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  const getScoreColor = (score) => {
    if (score > 70) return 'text-red-400';
    if (score > 40) return 'text-amber-400';
    return 'text-blue-400';
  };

  return (
    <div className="relative" data-testid="graph-visualization">
      <ForceGraph2D
        ref={fgRef}
        graphData={processedData}
        width={width}
        height={height}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkColor={linkColorFn}
        linkWidth={linkWidthFn}
        linkDirectionalParticles={link => {
          if (focusedRingId && link._ringId === focusedRingId) return 2;
          return 0; // Disable particles in normal mode for perf
        }}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={(link) =>
          link._ringEdgeColor || '#3b82f6'
        }
        backgroundColor="transparent"
        onNodeClick={handleNodeClick}
        onNodeHover={(node) => setHoveredNode(node || null)}
        onBackgroundClick={() => setFocusedRingId(null)}
        cooldownTicks={100}
        warmupTicks={30}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.4}
        enableNodeDrag={true}
        minZoom={0.3}
        maxZoom={8}
      />

      {/* Focused ring indicator */}
      {focusedRingId && (
        <div className="absolute top-4 left-4 bg-zinc-950/90 backdrop-blur border border-zinc-700 rounded-sm px-3 py-2 z-20">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: RING_COLORS[ringColorMap[focusedRingId] ?? 0].fill }}
            />
            <span className="text-[11px] font-mono text-zinc-300 tracking-wider">{focusedRingId}</span>
            <button
              onClick={() => setFocusedRingId(null)}
              className="text-[10px] font-mono text-zinc-500 hover:text-zinc-200 ml-2 border border-zinc-700 px-1.5 py-0.5 rounded-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredNode && (
        <div
          data-testid="graph-node-tooltip"
          className="absolute top-4 right-4 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-sm w-80 pointer-events-none z-10 overflow-hidden"
        >
          <div className={`px-4 py-2 border-b flex items-center justify-between ${hoveredNode.is_false_positive ? 'border-teal-500/30 bg-teal-500/5' :
            hoveredNode.is_suspicious ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-800 bg-zinc-900/50'
            }`}>
            <span className="text-[10px] font-mono tracking-[0.2em] text-zinc-500">
              {hoveredNode.is_false_positive ? 'FALSE POSITIVE' :
                hoveredNode.is_suspicious ? 'SUSPECT NODE' : 'NODE INFO'}
            </span>
            <div className="flex items-center gap-2">
              {hoveredNode.ring_id && (
                <span className="text-[9px] font-mono text-zinc-400">{hoveredNode.ring_id}</span>
              )}
              <div className={`w-2 h-2 rounded-full ${hoveredNode.is_false_positive ? 'bg-teal-400' :
                hoveredNode.is_suspicious ? 'bg-red-400 animate-pulse' : 'bg-zinc-600'
                }`} />
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="text-sm font-mono text-zinc-100 truncate">{hoveredNode.id}</div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-[9px] text-zinc-600 tracking-widest font-mono">SCORE</div>
                <div className={`text-lg font-mono font-bold ${getScoreColor(hoveredNode.suspicion_score || 0)}`}>
                  {(hoveredNode.suspicion_score || 0).toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-600 tracking-widest font-mono">IN / OUT</div>
                <div className="text-sm font-mono text-zinc-300">
                  {hoveredNode.in_degree || 0} / {hoveredNode.out_degree || 0}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-600 tracking-widest font-mono">FLOW</div>
                <div className="text-xs font-mono text-zinc-300">
                  ${((hoveredNode.total_received || 0) / 1000).toFixed(0)}K
                </div>
              </div>
            </div>

            {hoveredNode.pattern_labels?.length > 0 && (
              <div>
                <div className="text-[9px] text-zinc-600 tracking-widest font-mono mb-1">DETECTED PATTERNS</div>
                <div className="flex flex-wrap gap-1">
                  {hoveredNode.pattern_labels.map((label, i) => (
                    <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hoveredNode.is_false_positive && (
              <div className={`px-2.5 py-2 rounded-sm border ${hoveredNode.false_positive_type === 'merchant'
                ? 'bg-teal-500/10 border-teal-500/20'
                : 'bg-green-500/10 border-green-500/20'
                }`}>
                <div className={`text-[10px] font-mono font-bold tracking-wider mb-1 ${hoveredNode.false_positive_type === 'merchant' ? 'text-teal-400' : 'text-green-400'
                  }`}>
                  {hoveredNode.false_positive_type?.toUpperCase()} — NOT FLAGGED
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  {hoveredNode.false_positive_explanation}
                </p>
              </div>
            )}

            {hoveredNode.explanation && !hoveredNode.is_false_positive && (
              <div className="border-t border-zinc-800/50 pt-2">
                <div className="text-[9px] text-zinc-600 tracking-widest font-mono mb-1">WHY FLAGGED</div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">{hoveredNode.explanation}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
