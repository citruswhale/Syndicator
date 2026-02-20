import { NavLink, useLocation } from 'react-router-dom';
import { Upload, LayoutDashboard, Network, ShieldAlert, Users, FileJson } from 'lucide-react';
import { useAnalysis } from '@/context/AnalysisContext';
import { ThemeToggle } from '@/components/ThemeToggle';

const navItems = [
  { path: '/', icon: Upload, label: 'UPLOAD', always: true },
  { path: '/dashboard', icon: LayoutDashboard, label: 'DASHBOARD' },
  { path: '/graph', icon: Network, label: 'GRAPH' },
  { path: '/rings', icon: ShieldAlert, label: 'FRAUD RINGS' },
  { path: '/accounts', icon: Users, label: 'SUSPECTS' },
  { path: '/json', icon: FileJson, label: 'JSON OUTPUT' },
];

export const Sidebar = () => {
  const location = useLocation();
  const { analysisData } = useAnalysis();

  return (
    <aside
      data-testid="sidebar-navigation"
      className="w-56 min-w-[224px] bg-black/60 backdrop-blur-xl border-r border-zinc-800/80 flex flex-col"
    >
      <div className="p-5 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 glow-blue" />
          <h1 className="font-mono text-xl font-bold tracking-tight text-blue-400">$yndicato₹</h1>
        </div>
        <p className="text-[10px] text-zinc-600 tracking-[0.25em] uppercase mt-1.5 font-mono">
          Crime Detection Engine
        </p>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 mt-2">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          const isDisabled = !item.always && !analysisData;

          return (
            <NavLink
              key={item.path}
              to={isDisabled ? '#' : item.path}
              data-testid={`nav-${item.path === '/' ? 'upload' : item.path.slice(1)}`}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs font-mono tracking-wider transition-all duration-200 ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                  : isDisabled
                    ? 'text-zinc-700 cursor-not-allowed'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
              }`}
              onClick={e => isDisabled && e.preventDefault()}
            >
              <item.icon size={14} strokeWidth={1.5} />
              <span>{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1 h-1 rounded-full bg-blue-400" />
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800/50 space-y-3">
        <ThemeToggle />
        <div className="text-[9px] text-zinc-700 font-mono tracking-wider">
          {analysisData ? (
            <>
              <div className="text-zinc-500">ACTIVE SESSION</div>
              <div className="text-blue-500/60 mt-0.5 truncate">{analysisData.id?.slice(0, 8)}</div>
            </>
          ) : (
            <div>NO ACTIVE SESSION</div>
          )}
        </div>
      </div>
    </aside>
  );
};
