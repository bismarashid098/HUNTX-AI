import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, Sparkles, CheckCircle, Send } from 'lucide-react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your email address'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Please enter a valid email'); return; }

    setLoading(true);
    try {
      await authAPI.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .fp-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #020c07;
          padding: 2rem 1rem;
          font-family: 'Inter', system-ui, sans-serif;
          position: relative;
          overflow: hidden;
        }

        .fp-orb {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(80px);
          z-index: 0;
        }
        .fp-orb-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(34,197,94,0.10) 0%, transparent 70%);
          top: -150px; left: -150px;
          animation: orbFloat 8s ease-in-out infinite;
        }
        .fp-orb-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(52,211,153,0.07) 0%, transparent 70%);
          bottom: -100px; right: -100px;
          animation: orbFloat 10s ease-in-out infinite reverse;
        }
        @keyframes orbFloat {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(20px,20px) scale(1.05); }
        }

        .fp-card {
          position: relative; z-index: 1;
          width: 100%; max-width: 420px;
          animation: fpSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes fpSlideUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .fp-brand {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 2rem;
          animation: fpSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both;
        }
        .fp-brand-icon {
          width: 36px; height: 36px;
          background: linear-gradient(135deg,#22c55e,#34d399);
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 20px rgba(34,197,94,0.32);
        }
        .fp-brand-name { color: #ecfdf5; font-weight: 800; font-size: 1rem; }

        .fp-box {
          background: #0b1d15;
          border: 1px solid rgba(34,197,94,0.12);
          border-radius: 20px;
          padding: 2.25rem 2rem;
          box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,197,94,0.05);
          animation: fpSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.08s both;
        }

        .fp-icon-circle {
          width: 56px; height: 56px;
          background: linear-gradient(135deg,rgba(34,197,94,0.12),rgba(52,211,153,0.10));
          border: 1px solid rgba(34,197,94,0.22);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1.25rem;
          animation: fpSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both;
        }

        .fp-title {
          color: #ecfdf5; font-size: 1.4rem; font-weight: 800;
          letter-spacing: -0.02em; margin: 0 0 6px;
          animation: fpSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.12s both;
        }
        .fp-subtitle {
          color: #4d7c6b; font-size: 0.84rem; line-height: 1.6;
          margin: 0 0 1.75rem;
          animation: fpSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.14s both;
        }

        .fp-field {
          animation: fpSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.16s both;
        }
        .fp-label {
          display: block; font-size: 0.62rem; font-weight: 700;
          color: #4ade80; text-transform: uppercase; letter-spacing: 0.08em;
          margin-bottom: 6px; font-family: 'JetBrains Mono', monospace;
        }
        .fp-wrap { position: relative; }
        .fp-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #4d7c6b; transition: color 0.2s; pointer-events: none; }
        .fp-input {
          width: 100%; background: #102819;
          border: 1px solid rgba(34,197,94,0.14); border-radius: 11px;
          padding: 12px 44px; font-size: 0.875rem; color: #ecfdf5;
          outline: none; font-family: inherit; transition: all 0.2s;
        }
        .fp-input::placeholder { color: #4d7c6b; }
        .fp-input:focus { border-color: rgba(34,197,94,0.52); background: #163522; box-shadow: 0 0 0 3px rgba(34,197,94,0.12); }
        .fp-input.err { border-color: rgba(248,113,113,0.45); background: rgba(248,113,113,0.04); animation: fpShake 0.35s ease; }
        .fp-wrap:focus-within .fp-icon { color: #4ade80; }
        @keyframes fpShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }

        .fp-err { font-size: 0.71rem; color: #f87171; margin-top: 5px; display: flex; align-items: center; gap: 4px; }

        .fp-btn {
          width: 100%; margin-top: 1.25rem;
          background: linear-gradient(135deg,#22c55e,#34d399);
          color: #052e16; font-weight: 800; font-family: inherit; font-size: 0.88rem;
          border: none; border-radius: 11px; padding: 13px;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 2px 14px rgba(34,197,94,0.38);
          transition: all 0.2s;
          animation: fpSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.18s both;
          position: relative; overflow: hidden;
        }
        .fp-btn::after {
          content: ''; position: absolute; inset: 0;
          background: rgba(255,255,255,0);
          transition: background 0.2s;
        }
        .fp-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(34,197,94,0.55); }
        .fp-btn:hover:not(:disabled)::after { background: rgba(255,255,255,0.06); }
        .fp-btn:active:not(:disabled) { transform: translateY(0); box-shadow: 0 2px 12px rgba(34,197,94,0.30); }
        .fp-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .fp-spin { animation: fpSpin 1s linear infinite; }
        @keyframes fpSpin { to { transform: rotate(360deg); } }

        .fp-back {
          display: flex; align-items: center; gap: 6px;
          color: #4d7c6b; font-size: 0.8rem; font-weight: 500;
          text-decoration: none; margin-top: 1.25rem;
          justify-content: center;
          transition: color 0.2s;
          animation: fpSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both;
        }
        .fp-back:hover { color: #4ade80; }

        .fp-success {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: 0;
          animation: fpSuccessIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes fpSuccessIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        .fp-success-ring {
          width: 72px; height: 72px;
          border-radius: 50%;
          background: linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.08));
          border: 1px solid rgba(34,197,94,0.30);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1.25rem;
          box-shadow: 0 0 32px rgba(34,197,94,0.15);
          animation: successPulse 2s ease-in-out infinite;
        }
        @keyframes successPulse {
          0%,100% { box-shadow: 0 0 32px rgba(34,197,94,0.15); }
          50%      { box-shadow: 0 0 48px rgba(34,197,94,0.28); }
        }
        .fp-success-title { color: #ecfdf5; font-size: 1.3rem; font-weight: 800; margin: 0 0 10px; letter-spacing: -0.02em; }
        .fp-success-msg { color: #4d7c6b; font-size: 0.84rem; line-height: 1.65; margin: 0 0 1.5rem; }
        .fp-success-email { color: #4ade80; font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; }
        .fp-success-hint { color: #4d7c6b; font-size: 0.72rem; margin-top: 1rem; line-height: 1.5; }
      `}</style>

      <div className="fp-root">
        <div className="fp-orb fp-orb-1" />
        <div className="fp-orb fp-orb-2" />

        <div className="fp-card">
          <div className="fp-brand">
            <div className="fp-brand-icon"><Sparkles size={18} color="white" /></div>
            <span className="fp-brand-name">Talvion AI</span>
          </div>

          <div className="fp-box">
            {sent ? (
              <div className="fp-success">
                <div className="fp-success-ring">
                  <CheckCircle size={32} color="#4ade80" />
                </div>
                <h2 className="fp-success-title">Check your inbox</h2>
                <p className="fp-success-msg">
                  We've sent a password reset link to<br />
                  <span className="fp-success-email">{email}</span>
                </p>
                <Link to="/login" className="fp-back" style={{marginTop:0}}>
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
                <p className="fp-success-hint">
                  Didn't receive it? Check spam, or{' '}
                  <button
                    onClick={() => { setSent(false); setError(''); }}
                    style={{background:'none',border:'none',color:'#4ade80',cursor:'pointer',fontFamily:'inherit',fontSize:'inherit',fontWeight:600,padding:0}}
                  >
                    try again
                  </button>
                </p>
              </div>
            ) : (
              <>
                <div className="fp-icon-circle">
                  <Mail size={24} color="#4ade80" />
                </div>
                <h1 className="fp-title">Forgot password?</h1>
                <p className="fp-subtitle">
                  Enter your account email and we'll send you a secure link to reset your password.
                </p>

                <form onSubmit={handleSubmit}>
                  <div className="fp-field">
                    <label className="fp-label">Email address</label>
                    <div className="fp-wrap">
                      <Mail className="fp-icon" size={15} />
                      <input
                        ref={inputRef}
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError(''); }}
                        placeholder="you@example.com"
                        autoComplete="email"
                        className={`fp-input${error ? ' err' : ''}`}
                      />
                    </div>
                    {error && <p className="fp-err">⚠ {error}</p>}
                  </div>

                  <button type="submit" disabled={loading} className="fp-btn">
                    {loading
                      ? <><Loader2 size={15} className="fp-spin" /> Sending link...</>
                      : <><Send size={14} /> Send reset link</>}
                  </button>
                </form>

                <Link to="/login" className="fp-back">
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;
