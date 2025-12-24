import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ArrowLeft, Search, RefreshCw } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState(15);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (countdown > 0 && !isHovering) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      navigate('/');
    }
  }, [countdown, isHovering, navigate]);

  const glitchText = "404";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      ></div>

      {/* Floating particles */}
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-white/30 rounded-full animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${3 + Math.random() * 4}s`
          }}
        ></div>
      ))}

      <div 
        className="relative z-10 text-center max-w-2xl mx-auto"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Glitch 404 Text */}
        <div className="relative mb-8">
          <h1 
            className="text-[150px] sm:text-[200px] font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 leading-none select-none glitch-text"
            data-text={glitchText}
          >
            {glitchText}
          </h1>
          {/* Glitch layers */}
          <h1 
            className="absolute inset-0 text-[150px] sm:text-[200px] font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 leading-none select-none opacity-50 animate-glitch-1"
            aria-hidden="true"
          >
            {glitchText}
          </h1>
          <h1 
            className="absolute inset-0 text-[150px] sm:text-[200px] font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-500 leading-none select-none opacity-50 animate-glitch-2"
            aria-hidden="true"
          >
            {glitchText}
          </h1>
        </div>

        {/* Error message */}
        <div className="space-y-4 mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Halaman Tidak Ditemukan
          </h2>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
          </p>
          <div className="inline-flex items-center px-4 py-2 bg-white/5 border border-white/10 rounded-full text-gray-500 text-sm">
            <Search className="w-4 h-4 mr-2" />
            <span className="font-mono">{location.pathname}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
          >
            <ArrowLeft className="w-5 h-5 mr-2 transition-transform group-hover:-translate-x-1" />
            Kembali
          </button>
          <button
            onClick={() => navigate('/')}
            className="group flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/50"
          >
            <Home className="w-5 h-5 mr-2 transition-transform group-hover:scale-110" />
            Ke Dashboard
          </button>
          <button
            onClick={() => window.location.reload()}
            className="group flex items-center px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
          >
            <RefreshCw className="w-5 h-5 mr-2 transition-transform group-hover:rotate-180 duration-500" />
            Refresh
          </button>
        </div>

        {/* Auto redirect countdown */}
        <div className="text-gray-500 text-sm">
          {isHovering ? (
            <span className="text-purple-400">Redirect dijeda...</span>
          ) : (
            <span>
              Redirect otomatis dalam{' '}
              <span className="inline-flex items-center justify-center w-8 h-8 bg-white/10 rounded-lg text-white font-mono font-bold">
                {countdown}
              </span>
              {' '}detik
            </span>
          )}
        </div>

        {/* Quick links */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-gray-500 text-sm mb-4">Atau kunjungi halaman populer:</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { name: 'Payment Request', path: '/payment-request' },
              { name: 'Kasbon', path: '/kasbon' },
              { name: 'Klaim', path: '/klaim' },
              { name: 'Laporan', path: '/laporan' },
            ].map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-gray-400 hover:text-white text-sm transition-all duration-300"
              >
                {link.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom styles */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
        }
        
        @keyframes glitch-1 {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(-2px, -2px); }
          60% { transform: translate(2px, 2px); }
          80% { transform: translate(2px, -2px); }
        }
        
        @keyframes glitch-2 {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(2px, -2px); }
          40% { transform: translate(2px, 2px); }
          60% { transform: translate(-2px, -2px); }
          80% { transform: translate(-2px, 2px); }
        }
        
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        
        .animate-glitch-1 {
          animation: glitch-1 0.3s ease-in-out infinite;
        }
        
        .animate-glitch-2 {
          animation: glitch-2 0.3s ease-in-out infinite;
          animation-delay: 0.1s;
        }
      `}</style>
    </div>
  );
};

export default NotFound;
