import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowLeft, Loader2, Sparkles, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

// ── Password strength helpers ─────────────────────────────────────────────────
const getStrength = (pwd) => {
  if (!pwd) return 0;
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return s;
};
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', '#f87171', '#fbbf24', '#34d399', '#4ade80'];

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const strength = getStrength(pwd);
  const strengthColor = STRENGTH_COLORS[strength];
  const strengthLabel = STRENGTH_LABELS[strength];

  const REQUIREMENTS = [
    { label: '8+ characters',    met: pwd.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(pwd) },
    { label: 'Number',           met: /[0-9]/.test(pwd) },
    { label: 'Special character',met: /[^A-Za-z0-9]/.test(pwd) },
  ];

  const invalidLink = !token || !email;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (pwd.length < 8)          { setError('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(pwd))      { setError('Password must contain an uppercase letter'); return; }
    if (!/[0-9]/.test(pwd))      { setError('Password must contain a number'); return; }
    if (pwd !== confirm)          { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, email, pwd);
      setDone(true);
      toast.success('Password reset! Please sign in.');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to reset password. Try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .rp-root {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: #020c07; padding: 2rem 1rem;
          font-family: 'Inter', system-ui, sans-serif;
          position: relative; overflow: hidden;
        }
        .rp-orb {
          position: fixed; border-radius: 50%; pointer-events: none;
          filter: blur(80px); z-index: 0;
        }
        .rp-orb-1 {
          width: 480px; height: 480px;
          background: radial-gradient(circle,rgba(34,197,94,0.10) 0%,transparent 70%);
          top: -120px; right: -120px;
          animation: rpOrb 9s ease-in-out infinite;
        }
        .rp-orb-2 {
          width: 360px; height: 360px;
          background: radial-gradient(circle,rgba(52,211,153,0.07) 0%,transparent 70%);
          bottom: -80px; left: -80px;
          animation: rpOrb 11s ease-in-out infinite reverse;
        }
        @keyframes rpOrb { 0%,100%{transform:translate(0,0)} 50%{transform:translate(15px,15px)} }

        .rp-card {
          position: relative; z-index: 1;
          width: 100%; max-width: 420px;
          animation: rpUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes rpUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }

        .rp-brand {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 2rem;
          animation: rpUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both;
        }
        .rp-brand-icon {
          width: 36px; height: 36px;
          background: linear-gradient(135deg,#22c55e,#34d399);
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 20px rgba(34,197,94,0.32);
        }
        .rp-brand-name { color: #ecfdf5; font-weight: 800; font-size: 1rem; }

        .rp-box {
          background: #0b1d15;
          border: 1px solid rgba(34,197,94,0.12);
          border-radius: 20px; padding: 2.25rem 2rem;
          box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,197,94,0.05);
          animation: rpUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.08s both;
        }

        .rp-icon-circle {
          width: 56px; height: 56px;
          background: linear-gradient(135deg,rgba(34,197,94,0.12),rgba(52,211,153,0.10));
          border: 1px solid rgba(34,197,94,0.22);
          border-radius: 16px; display: flex; align-items: center; justify-content: center;
          margin-bottom: 1.25rem;
        }
        .rp-title { color: #ecfdf5; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 6px; }
        .rp-subtitle { color: #4d7c6b; font-size: 0.84rem; line-height: 1.6; margin: 0 0 1.75rem; }
        .rp-email-chip {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(34,197,94,0.10); border: 1px solid rgba(34,197,94,0.22);
          border-radius: 6px; padding: 3px 10px;
          color: #4ade80; font-size: 0.78rem; font-family: 'JetBrains Mono', monospace;
          margin-bottom: 1.5rem;
        }

        .rp-fields { display: flex; flex-direction: column; gap: 14px; }
        .rp-field { animation: rpUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.12s both; }

        .rp-label { display: block; font-size: 0.62rem; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; font-family: 'JetBrains Mono', monospace; }
        .rp-wrap { position: relative; }
        .rp-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #4d7c6b; pointer-events: none; transition: color 0.2s; }
        .rp-wrap:focus-within .rp-icon { color: #4ade80; }
        .rp-input {
          width: 100%; background: #102819;
          border: 1px solid rgba(34,197,94,0.14); border-radius: 11px;
          padding: 12px 44px; font-size: 0.875rem; color: #ecfdf5;
          outline: none; font-family: inherit; transition: all 0.2s;
        }
        .rp-input::placeholder { color: #4d7c6b; }
        .rp-input:focus { border-color: rgba(34,197,94,0.52); background: #163522; box-shadow: 0 0 0 3px rgba(34,197,94,0.12); }
        .rp-input.err { border-color: rgba(248,113,113,0.45); background: rgba(248,113,113,0.04); animation: rpShake 0.35s ease; }
        @keyframes rpShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
        .rp-eye { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 0; color: #4d7c6b; transition: color 0.2s; }
        .rp-eye:hover { color: #4ade80; }
        .rp-err { font-size: 0.71rem; color: #f87171; margin-top: 5px; display: flex; align-items: center; gap: 4px; }

        .rp-strength-bars { display: flex; gap: 4px; margin-top: 8px; }
        .rp-strength-bar { height: 3px; flex: 1; border-radius: 2px; background: rgba(34,197,94,0.10); transition: background 0.25s; }
        .rp-strength-row { display: flex; align-items: center; justify-content: flex-end; margin-top: 4px; }
        .rp-strength-label { font-size: 0.67rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
        .rp-reqs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; padding: 8px 10px; background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid rgba(34,197,94,0.10); margin-top: 7px; }
        .rp-req { display: flex; align-items: center; gap: 5px; font-size: 0.69rem; transition: color 0.2s; }
        .rp-req.met   { color: #4ade80; }
        .rp-req.unmet { color: #4d7c6b; }

        .rp-btn {
          width: 100%; margin-top: 0.5rem;
          background: linear-gradient(135deg,#22c55e,#34d399);
          color: #052e16; font-weight: 800; font-family: inherit; font-size: 0.88rem;
          border: none; border-radius: 11px; padding: 13px;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 2px 14px rgba(34,197,94,0.38); transition: all 0.2s;
          position: relative; overflow: hidden;
          animation: rpUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both;
        }
        .rp-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(34,197,94,0.55); }
        .rp-btn:active:not(:disabled) { transform: translateY(0); }
        .rp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .rp-spin { animation: rpSpin 1s linear infinite; }
        @keyframes rpSpin { to{transform:rotate(360deg)} }

        .rp-back {
          display: flex; align-items: center; gap: 6px;
          color: #4d7c6b; font-size: 0.8rem; font-weight: 500;
          text-decoration: none; margin-top: 1.25rem; justify-content: center;
          transition: color 0.2s;
        }
        .rp-back:hover { color: #4ade80; }

        .rp-success {
          display: flex; flex-direction: column; align-items: center; text-align: center;
          animation: rpSuccessIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes rpSuccessIn { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
        .rp-success-ring {
          width: 72px; height: 72px; border-radius: 50%;
          background: linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.08));
          border: 1px solid rgba(34,197,94,0.30);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1.25rem;
          box-shadow: 0 0 32px rgba(34,197,94,0.15);
          animation: successPulse 2s ease-in-out infinite;
        }
        @keyframes successPulse { 0%,100%{box-shadow:0 0 32px rgba(34,197,94,0.15)} 50%{box-shadow:0 0 48px rgba(34,197,94,0.28)} }
        .rp-success-title { color: #ecfdf5; font-size: 1.3rem; font-weight: 800; margin: 0 0 8px; letter-spacing: -0.02em; }
        .rp-success-msg { color: #4d7c6b; font-size: 0.84rem; line-height: 1.65; margin: 0 0 1.5rem; }

        .rp-signin-btn {
          width: 100%;
          background: linear-gradient(135deg,#22c55e,#34d399);
          color: #052e16; font-weight: 800; font-family: inherit; font-size: 0.88rem;
          border: none; border-radius: 11px; padding: 13px;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 2px 14px rgba(34,197,94,0.38); transition: all 0.2s;
        }
        .rp-signin-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(34,197,94,0.55); }

        .rp-invalid {
          display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0;
        }
        .rp-invalid-icon {
          width: 56px; height: 56px; border-radius: 16px;
          background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.25);
          display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;
        }
      `}</style>

      <div className="rp-root">
        <div className="rp-orb rp-orb-1" />
        <div className="rp-orb rp-orb-2" />

        <div className="rp-card">
          <div className="rp-brand">
            <div className="rp-brand-icon"><Sparkles size={18} color="white" /></div>
            <span className="rp-brand-name">Talvion AI</span>
          </div>

          <div className="rp-box">
            {invalidLink && (
              <div className="rp-invalid">
                <div className="rp-invalid-icon"><XCircle size={26} color="#ef4444" /></div>
                <h2 className="rp-title" style={{marginBottom:8}}>Invalid link</h2>
                <p style={{color:'#4d7c6b',fontSize:'0.84rem',lineHeight:1.6,marginBottom:'1.5rem'}}>
                  This reset link is missing required info. Please request a new one.
                </p>
                <Link to="/forgot-password" className="rp-back" style={{margin:0}}>
                  <ArrowLeft size={14} /> Request new link
                </Link>
              </div>
            )}

            {!invalidLink && done && (
              <div className="rp-success">
                <div className="rp-success-ring"><CheckCircle size={32} color="#4ade80" /></div>
                <h2 className="rp-success-title">Password updated!</h2>
                <p className="rp-success-msg">Your password has been reset successfully. You can now sign in with your new password.</p>
                <button className="rp-signin-btn" onClick={() => navigate('/login')}>
                  <ShieldCheck size={15} /> Sign in now
                </button>
              </div>
            )}

            {!invalidLink && !done && (
              <>
                <div className="rp-icon-circle">
                  <Lock size={24} color="#4ade80" />
                </div>
                <h1 className="rp-title">Set new password</h1>
                <p className="rp-subtitle">Create a strong new password for your account.</p>

                {email && (
                  <div className="rp-email-chip">
                    <Lock size={12} /> {decodeURIComponent(email)}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="rp-fields">
                  <div className="rp-field">
                    <label className="rp-label">New Password</label>
                    <div className="rp-wrap">
                      <Lock className="rp-icon" size={15} />
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={pwd}
                        onChange={e => { setPwd(e.target.value); setError(''); }}
                        placeholder="Min. 8 characters"
                        autoComplete="new-password"
                        autoFocus
                        className={`rp-input${error && !confirm ? ' err' : ''}`}
                      />
                      <button type="button" className="rp-eye" onClick={() => setShowPwd(s => !s)}>
                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {pwd.length > 0 && (
                      <>
                        <div className="rp-strength-bars">
                          {[1,2,3,4].map(n => (
                            <div key={n} className="rp-strength-bar"
                              style={{ background: strength >= n ? strengthColor : undefined }} />
                          ))}
                        </div>
                        <div className="rp-strength-row">
                          <span className="rp-strength-label" style={{ color: strengthColor }}>
                            {strengthLabel}
                          </span>
                        </div>
                        <div className="rp-reqs">
                          {REQUIREMENTS.map((r, i) => (
                            <div key={i} className={`rp-req ${r.met ? 'met' : 'unmet'}`}>
                              {r.met ? <CheckCircle size={11} /> : <XCircle size={11} />}
                              {r.label}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="rp-field" style={{animationDelay:'0.16s'}}>
                    <label className="rp-label">Confirm Password</label>
                    <div className="rp-wrap">
                      <Lock className="rp-icon" size={15} />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirm}
                        onChange={e => { setConfirm(e.target.value); setError(''); }}
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                        className={`rp-input${error && confirm ? ' err' : ''}`}
                      />
                      <button type="button" className="rp-eye" onClick={() => setShowConfirm(s => !s)}>
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {confirm && pwd && confirm !== pwd && (
                      <p className="rp-err">⚠ Passwords do not match</p>
                    )}
                  </div>

                  {error && <p className="rp-err" style={{margin:0}}>⚠ {error}</p>}

                  <button type="submit" disabled={loading} className="rp-btn">
                    {loading
                      ? <><Loader2 size={15} className="rp-spin" /> Resetting...</>
                      : <><ShieldCheck size={15} /> Reset password</>}
                  </button>
                </form>

                <Link to="/login" className="rp-back">
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

export default ResetPassword;
