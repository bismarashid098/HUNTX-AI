import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Briefcase } from 'lucide-react';
import useAuthStore from '../store/auth.store.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(form.email, form.password);
      navigate('/chat');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-900">
      <div className="grid grid-cols-1 lg:grid-cols-2 h-screen">
        <div className="hidden lg:flex relative items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-emerald-700/25 to-emerald-600/20" />
          <div className="relative max-w-xl px-10">
            <div className="flex items-center gap-2 mb-6">
              <Briefcase className="text-emerald-500" size={30} />
              <span className="text-2xl font-bold text-white">HuntX AI</span>
            </div>
            <h1 className="text-white font-semibold text-3xl leading-snug">
              Welcome! Let’s create your CV and discover the best job opportunities
            </h1>
            <p className="mt-4 text-gray-300 text-sm">
              Upload your CV, confirm your target role and city, and I’ll tailor your CV,
              find matching jobs, and prepare professional emails for you.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center p-6 lg:p-10 bg-gray-900">
          <div className="w-full max-w-md">
            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <Briefcase className="text-gray-400" size={24} />
                <h2 className="text-xl font-semibold text-white">Sign in to HuntX AI</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@email.com"
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 border border-gray-600 focus:border-emerald-500 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 border border-gray-600 focus:border-emerald-500 focus:outline-none text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors mt-2"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
              <p className="text-center text-gray-500 text-sm mt-5">
                Don't have an account?{' '}
                <Link to="/register" className="text-emerald-400 hover:text-emerald-300">
                  Create one
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
