import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChevronRight, Menu, X } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function Header() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getHashLink = (hash: string) => {
    return location.pathname === '/' ? hash : `/${hash}`;
  };

  const handleDownloadClick = () => {
    setMobileMenuOpen(false);
    if (location.pathname === '/') {
      const element = document.getElementById('download');
      element?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/#download');
      setTimeout(() => {
        const element = document.getElementById('download');
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/75 border-b border-slate-100/80 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group cursor-pointer animate-float">
            <img src={logoImg} alt="Owntrip Logo" className="h-16 sm:h-20 object-contain drop-shadow-md group-hover:scale-105 group-hover:drop-shadow-xl transition-all duration-300" />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href={getHashLink('#features')} className="hover:text-emerald-600 transition-colors">Tính năng</a>
            <a href={getHashLink('#download')} className="hover:text-emerald-600 transition-colors">Cách tải app</a>
            <a href={getHashLink('#about')} className="hover:text-emerald-600 transition-colors">Về chúng tôi</a>
            <Link to="/faq" className="hover:text-emerald-600 transition-colors">FAQ</Link>
          </nav>

          {/* Header Login / Dashboard CTA */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <button 
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
              >
                Kênh quản trị
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <Link 
                  to="/login"
                  className="px-5 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Đăng nhập đối tác
                </Link>
                <button 
                  onClick={handleDownloadClick}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl active:scale-[0.98] transition-all"
                >
                  Tải App Ngay
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-100 bg-white/95 backdrop-blur-lg animate-in slide-in-from-top-4 duration-200">
          <div className="px-4 pt-2 pb-6 space-y-3">
            <a 
              href={getHashLink('#features')}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-base font-semibold text-slate-700 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              Tính năng
            </a>
            <a 
              href={getHashLink('#download')}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-base font-semibold text-slate-700 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              Cách tải app
            </a>
            <a 
              href={getHashLink('#about')}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-base font-semibold text-slate-700 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              Về chúng tôi
            </a>
            <Link 
              to="/faq" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-base font-semibold text-slate-700 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              Hỗ trợ (FAQ)
            </Link>
            <hr className="border-slate-100 my-2" />
            {isAuthenticated ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/dashboard');
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow-md"
              >
                Kênh quản trị
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3 text-center text-slate-700 font-semibold border border-slate-200 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Đăng nhập đối tác
                </Link>
                <button
                  onClick={handleDownloadClick}
                  className="w-full py-3 text-center bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all"
                >
                  Tải App Ngay
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
