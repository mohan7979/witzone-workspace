import { cn } from '@/lib/utils';

export default function Input({ label, error, hint, className, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
      )}
      <input
        {...props}
        className={cn(
          'w-full px-3 py-2.5 text-sm bg-white text-slate-900 placeholder-slate-400',
          'border rounded-lg transition',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          error ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-slate-300',
          className
        )}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Select({ label, error, children, className, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
      )}
      <select
        {...props}
        className={cn(
          'w-full px-3 py-2.5 text-sm bg-white text-slate-900',
          'border rounded-lg transition',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          error ? 'border-red-400' : 'border-slate-200 hover:border-slate-300',
          className
        )}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
