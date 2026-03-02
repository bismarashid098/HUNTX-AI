import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, Search, FileText, Sparkles, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = [
  { icon: <FileText size={15} />, title: 'Upload your CV', desc: 'Drop your PDF — we parse it instantly.' },
  { icon: <Search size={15} />, title: 'Auto Job Search', desc: 'AI scours Google Jobs for matching roles.' },
  { icon: <Sparkles size={15} />, title: 'AI-Tailored CVs', desc: 'Every application gets an optimised CV.' },
  { icon: <Send size={15} />, title: 'Automated Emails', desc: 'HR emails sent with your approval.' },
];

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [shakeKey, setShakeKey] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();
  const emailRef = useRef(null);
  const { register, handleSubmit, formState: { errors } } = useForm();

  useEffect(() => { emailRef.current?.focus(); }, []);

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const result = await login(data.email, data.password);
      if (result.success) {
        toast.success('Welcome back!');
        navigate('/chat');
      } else {
        setShakeKey(k => k + 1);
        toast.error(result.error);
      }
    } catch {
      setShakeKey(k => k + 1);
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => navigate('/forgot-password');

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');
        .auth-root * { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; }
        .auth-root { min-height: 100vh; display: flex; background: #020c07; }

        .auth-left {
          display: none; width: 44%;
          background: #061410;
          border-right: 1px solid rgba(34,197,94,0.10);
          flex-direction: column; justify-content: space-between;
          padding: 2.5rem 3rem; position: relative; overflow: hidden;
        }
        @media (min-width: 1024px) { .auth-left { display: flex; } }

        .auth-glow  { position: absolute; width: 500px; height: 500px; background: radial-gradient(circle, rgba(34,197,94,0.10) 0%, transparent 65%); border-radius: 50%; top: -100px; left: -100px; pointer-events: none; }
        .auth-glow2 { top: auto; left: auto; bottom: -150px; right: -100px; background: radial-gradient(circle, rgba(52,211,153,0.07) 0%, transparent 65%); }

        .auth-brand { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
        .auth-brand-icon { width: 40px; height: 40px; background: linear-gradient(135deg,#22c55e,#34d399); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(34,197,94,0.32); }
        .auth-brand-name { color: #ecfdf5; font-weight: 800; font-size: 1.05rem; letter-spacing: -0.02em; }
        .auth-brand-badge { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.06em; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.30); color: #4ade80; border-radius: 5px; padding: 2px 7px; text-transform: uppercase; }

        .auth-hero { position: relative; z-index: 1; }
        .auth-headline { color: #ecfdf5; font-size: 2rem; font-weight: 800; line-height: 1.15; margin-bottom: 12px; letter-spacing: -0.03em; }
        .auth-accent { background: linear-gradient(90deg,#22c55e,#4ade80); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .auth-sub { color: #4d7c6b; font-size: 0.83rem; line-height: 1.65; margin-bottom: 2.5rem; }

        .auth-step { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px; }
        .auth-step-icon { width: 36px; height: 36px; flex-shrink: 0; background: rgba(34,197,94,0.10); border: 1px solid rgba(34,197,94,0.22); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #4ade80; }
        .auth-step-title { color: #d1fae5; font-weight: 600; font-size: 0.83rem; }
        .auth-step-desc  { color: #4d7c6b; font-size: 0.73rem; margin-top: 2px; }
        .auth-footer { color: #4d7c6b; font-size: 0.68rem; position: relative; z-index: 1; font-weight: 500; }

        .auth-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2.5rem 1.5rem; background: #020c07; }
        .auth-card { width: 100%; max-width: 400px; animation: authFadeUp 0.42s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes authFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .auth-mobile-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 2rem; }
        .auth-mobile-icon { width: 34px; height: 34px; background: linear-gradient(135deg,#22c55e,#34d399); border-radius: 9px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px rgba(34,197,94,0.35); }
        @media (min-width: 1024px) { .auth-mobile-brand { display: none; } }

        .auth-form-box { background: #0b1d15; border: 1px solid rgba(34,197,94,0.12); border-radius: 18px; padding: 2rem; box-shadow: 0 8px 40px rgba(0,0,0,0.55); }
        .auth-title    { color: #ecfdf5; font-size: 1.5rem; font-weight: 800; margin: 0 0 4px; letter-spacing: -0.02em; }
        .auth-subtitle { color: #4d7c6b; font-size: 0.83rem; margin: 0 0 1.5rem; }
        .auth-subtitle a { color: #4ade80; font-weight: 600; text-decoration: none; }
        .auth-subtitle a:hover { color: #86efac; }

        .auth-label { display: block; font-size: 0.62rem; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; font-family: 'JetBrains Mono', monospace; }
        .auth-wrap  { position: relative; }
        .auth-icon  { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #4d7c6b; }
        .auth-input {
          width: 100%; background: #102819; border: 1px solid rgba(34,197,94,0.14); border-radius: 10px;
          padding: 11px 44px; font-size: 0.875rem; color: #ecfdf5; outline: none;
          transition: all 0.15s; font-family: inherit;
        }
        .auth-input::placeholder { color: #4d7c6b; }
        .auth-input:focus { border-color: rgba(34,197,94,0.52); background: #163522; box-shadow: 0 0 0 3px rgba(34,197,94,0.12); }
        .auth-input.err { border-color: rgba(248,113,113,0.45); background: rgba(248,113,113,0.04); }
        .auth-eye { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 0; color: #4d7c6b; transition: color 0.2s; }
        .auth-eye:hover { color: #4ade80; }
        .auth-err { font-size: 0.71rem; color: #f87171; margin-top: 5px; display: flex; align-items: center; gap: 4px; }

        .auth-btn {
          width: 100%; background: linear-gradient(135deg,#22c55e,#34d399);
          color: #052e16; font-weight: 800; font-family: inherit; font-size: 0.875rem;
          border: none; border-radius: 10px; padding: 12px;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 2px 14px rgba(34,197,94,0.38); transition: all 0.2s; margin-top: 4px;
        }
        .auth-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 24px rgba(34,197,94,0.55); }
        .auth-btn:active:not(:disabled) { transform: translateY(0); }
        .auth-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

        .auth-spin { animation: authSpin 1s linear infinite; }
        @keyframes authSpin { to { transform: rotate(360deg); } }
        @keyframes authShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
        .auth-form-footer { margin-top: 1.25rem; text-align: center; color: #4d7c6b; font-size: 0.68rem; line-height: 1.55; }
        .auth-fields { display: flex; flex-direction: column; gap: 16px; }
        .auth-divider { height: 1px; background: rgba(34,197,94,0.08); margin: 4px 0 16px; }

        /* Remember me + Forgot password row */
        .auth-row { display: flex; align-items: center; justify-content: space-between; }
        .auth-remember { display: flex; align-items: center; gap: 7px; cursor: pointer; user-select: none; }
        .auth-remember input[type=checkbox] { accent-color: #22c55e; width: 14px; height: 14px; cursor: pointer; border-radius: 3px; }
        .auth-remember span { color: #4d7c6b; font-size: 0.78rem; }
        .auth-forgot { background: none; border: none; color: #4ade80; font-size: 0.78rem; font-weight: 600; cursor: pointer; font-family: inherit; padding: 0; transition: color 0.15s; }
        .auth-forgot:hover { color: #86efac; text-decoration: underline; }

        /* Shake wrapper */
        .auth-shake { animation: authShake 0.35s ease; }
      `}</style>

      <div className="auth-root">
        <div className="auth-left">
          <div className="auth-glow" /><div className="auth-glow auth-glow2" />
          <div className="auth-brand">
            <div className="auth-brand-icon"><Sparkles size={20} color="white" /></div>
            <div>
              <div className="auth-brand-name">Talvion AI</div>
              <div className="auth-brand-badge">Beta</div>
            </div>
          </div>

          <div className="auth-hero">
            <h2 className="auth-headline">Your personal<br /><span className="auth-accent">job hunting agent</span></h2>
            <p className="auth-sub">Upload your CV once. We handle the rest — automatically searching, applying, and following up.</p>
            {STEPS.map((step, i) => (
              <div key={i} className="auth-step">
                <div className="auth-step-icon">{step.icon}</div>
                <div>
                  <p className="auth-step-title">{step.title}</p>
                  <p className="auth-step-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="auth-footer">© {new Date().getFullYear()} Talvion AI · All rights reserved</p>
        </div>

        <div className="auth-right">
          <div className="auth-card">
            <div className="auth-mobile-brand">
              <div className="auth-mobile-icon"><Sparkles size={17} color="white" /></div>
              <span style={{color:'#f1f5f9',fontWeight:800,fontSize:'1rem'}}>Talvion AI</span>
            </div>

            <div className="auth-form-box">
              <h1 className="auth-title">Welcome back</h1>
              <p className="auth-subtitle">No account? <Link to="/register">Create one free</Link></p>
              <div className="auth-divider" />

              <form
                key={shakeKey}
                onSubmit={handleSubmit(onSubmit)}
                className={`auth-fields${shakeKey > 0 && (errors.email || errors.password) ? ' auth-shake' : ''}`}
              >
                <div>
                  <label className="auth-label">Email address</label>
                  <div className="auth-wrap">
                    <Mail className="auth-icon" size={15} />
                    <input
                      {...register('email', {
                        required: 'Email is required',
                        pattern: { value: /^\S+@\S+$/i, message: 'Enter a valid email' }
                      })}
                      ref={(e) => { register('email').ref(e); emailRef.current = e; }}
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={`auth-input${errors.email ? ' err' : ''}`}
                    />
                  </div>
                  {errors.email && <p className="auth-err">⚠ {errors.email.message}</p>}
                </div>

                <div>
                  <label className="auth-label">Password</label>
                  <div className="auth-wrap">
                    <Lock className="auth-icon" size={15} />
                    <input
                      {...register('password', {
                        required: 'Password is required',
                        minLength: { value: 6, message: 'Minimum 6 characters' }
                      })}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className={`auth-input${errors.password ? ' err' : ''}`}
                    />
                    <button type="button" className="auth-eye" onClick={() => setShowPassword(s => !s)}>
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.password && <p className="auth-err">⚠ {errors.password.message}</p>}
                </div>

                {/* Remember me + Forgot password */}
                <div className="auth-row">
                  <label className="auth-remember">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
                  <button type="button" className="auth-forgot" onClick={handleForgotPassword}>
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={isLoading} className="auth-btn">
                  {isLoading
                    ? <><Loader2 size={15} className="auth-spin" /> Signing in...</>
                    : <><span>Sign in</span><ArrowRight size={15} /></>}
                </button>
              </form>

              <p className="auth-form-footer">By signing in you agree to our Terms of Service</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
