import React, { useState, useEffect } from 'react';
import { Wrench, Clock, Mail, RefreshCw } from 'lucide-react';

const MaintenancePage = () => {
  const [dots, setDots] = useState('');
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    const pulseInterval = setInterval(() => {
      setPulse(prev => !prev);
    }, 2000);

    return () => {
      clearInterval(dotInterval);
      clearInterval(pulseInterval);
    };
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating circles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/3 rounded-full blur-3xl animate-pulse delay-500" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-blue-400/30 rounded-full animate-float"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${4 + i * 0.5}s`
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-lg w-full">
        {/* Card */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-12 shadow-2xl shadow-black/20">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              {/* Outer glow ring */}
              <div className={`absolute inset-0 rounded-2xl bg-amber-500/20 blur-xl transition-all duration-1000 ${pulse ? 'scale-150 opacity-100' : 'scale-100 opacity-50'}`} />

              {/* Icon container */}
              <div className="relative w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/25 animate-float">
                <Wrench className="w-10 h-10 text-white" strokeWidth={1.5} />

                {/* Spinning gear overlay */}
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md animate-spin-slow">
                  <RefreshCw className="w-3 h-3 text-white" strokeWidth={2} />
                </div>
              </div>
            </div>
          </div>

          {/* Text content */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Sedang Maintenance
            </h1>

            <div className="space-y-2">
              <p className="text-blue-200/80 text-base sm:text-lg leading-relaxed">
                Sistem sedang dalam pemeliharaan untuk perbaikan dan peningkatan.
              </p>
              <p className="text-blue-300/60 text-sm">
                Silakan coba lagi nanti{dots}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400/30" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* Info items */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">Estimasi Waktu</p>
                <p className="text-xs text-blue-300/50">Segera kembali normal</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">Butuh Bantuan?</p>
                <p className="text-xs text-blue-300/50">Hubungi administrator sistem</p>
              </div>
            </div>
          </div>

          {/* Refresh button */}
          <div className="mt-8">
            <button
              onClick={handleRefresh}
              className="w-full group relative px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-medium transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                Coba Lagi
              </span>
            </button>
          </div>
        </div>

        {/* Footer text */}
        <p className="text-center mt-6 text-xs text-blue-300/30">
          Finance Prasasti Group &copy; {new Date().getFullYear()}
        </p>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 6s linear infinite;
        }
        .delay-500 { animation-delay: 0.5s; }
        .delay-1000 { animation-delay: 1s; }
      `}</style>
    </div>
  );
};

export default MaintenancePage;
