import { ShieldAlert, Network, Activity } from 'lucide-react';
import { FileUploader } from '@/components/FileUploader';
import { useAnalysis } from '@/context/AnalysisContext';

const features = [
  {
    icon: Network,
    title: 'CYCLE DETECTION',
    desc: 'Bounded simple cycle enumeration (3-5 hops) to identify circular fund routing with O(V+E) complexity.',
    color: 'blue'
  },
  {
    icon: ShieldAlert,
    title: 'SMURFING ANALYSIS',
    desc: 'SMoTeF-inspired fan-in/fan-out detection with 72h temporal windows and false-positive filtering.',
    color: 'amber'
  },
  {
    icon: Activity,
    title: 'SHELL NETWORKS',
    desc: 'Constrained DFS through low-degree intermediaries to uncover layered laundering chains.',
    color: 'emerald'
  }
];

const colorMap = {
  blue: { border: 'border-blue-500/20', text: 'text-blue-400', bg: 'bg-blue-500/5', icon: 'text-blue-500' },
  amber: { border: 'border-amber-500/20', text: 'text-amber-400', bg: 'bg-amber-500/5', icon: 'text-amber-500' },
  emerald: { border: 'border-emerald-500/20', text: 'text-emerald-400', bg: 'bg-emerald-500/5', icon: 'text-emerald-500' },
};

export default function LandingPage() {
  const { analysisData } = useAnalysis();

  return (
    <div className="min-h-screen grid-bg relative" data-testid="landing-page">
      <div className="absolute inset-0 scanline-overlay" />

      <div className="relative z-10 flex flex-col items-center justify-center px-6 py-16 min-h-screen">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900/80 border border-zinc-800 rounded-sm mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-mono text-zinc-500 tracking-widest">SYSTEM ONLINE</span>
          </div>

          <h1 className="font-mono text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-100 mb-4">
            <span className="text-blue-400">$yndicato₹</span>
          </h1>
          <p className="text-base text-zinc-500 max-w-xl mx-auto leading-relaxed">
            Graph-based financial crime detection. Upload transaction data to identify
            circular fund routing, smurfing patterns, and shell networks.
          </p>
        </div>

        {/* Upload Zone */}
        <div className="w-full max-w-2xl animate-fade-in-up animate-delay-100">
          <FileUploader />
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 w-full max-w-4xl animate-fade-in-up animate-delay-300">
          {features.map((f) => {
            const c = colorMap[f.color];
            return (
              <div
                key={f.title}
                data-testid={`feature-${f.color}`}
                className={`${c.bg} border ${c.border} rounded-sm p-5 transition-all hover:border-opacity-50`}
              >
                <f.icon className={`${c.icon} mb-3`} size={20} strokeWidth={1.5} />
                <h3 className={`font-mono text-xs tracking-widest ${c.text} mb-2`}>{f.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Version / Footer */}
        <div className="mt-16 text-center animate-fade-in-up animate-delay-400">
          <p className="text-[10px] font-mono text-zinc-700 tracking-widest">
            RIFT v1.0 // GRAPH-BASED FINANCIAL CRIME DETECTION // HACKATHON 2026
          </p>
        </div>
      </div>
    </div>
  );
}
