import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-sm bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors dark:bg-zinc-900/50 light:bg-gray-100 light:border-gray-300 light:hover:border-gray-400"
      aria-label="Toggle theme"
      data-testid="theme-toggle"
    >
      {theme === 'dark' ? (
        <Sun size={16} className="text-zinc-400 dark:text-zinc-400 light:text-gray-600" />
      ) : (
        <Moon size={16} className="text-zinc-400 dark:text-zinc-400 light:text-gray-600" />
      )}
    </button>
  );
};
