import { clsx } from 'clsx';

export function SocialButton({ icon: Icon, provider, onClick, className, loading = false, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100',
        className
      )}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
      ) : (
        <Icon className="w-5 h-5 mr-2" />
      )}
      <span>{loading ? 'Connecting...' : `Continue with ${provider}`}</span>
    </button>
  );
}