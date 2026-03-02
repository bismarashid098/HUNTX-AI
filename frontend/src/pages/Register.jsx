import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight, Loader2, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const PERKS = [
  'Automated job search across 100+ boards',
  'AI-tailored CV for every application',
  'Smart HR email finding & verification',
  'Full session history & interview prep',
];

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

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const nameRef = useRef(null);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  const pwdVal = watch('password', '');
  const strength = getStrength(pwdVal);
  const strengthColor = STRENGTH_COLORS[strength];
  const strengthLabel = STRENGTH_LABELS[strength];

  const REQUIREMENTS = [
    { label: '8+ characters', met: pwdVal.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(pwdVal) },
    { label: 'Number', met: /[0-9]/.test(pwdVal) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(pwdVal) },
  ];

  useEffect(() => { nameRef.current?.focus(); }, []);

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const result = await registerUser({ name: data.name, email: data.email, password: data.password });
      if (result.success) {
        toast.success('Account created! Welcome aboard!');
        navigate('/chat');
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');
        .auth-reg-root * { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; }
        .auth-reg-root { min-height: 100vh; display: flex; background: #020c07; }

        .rg-left {
          display: none; width: 42%;
          background: #061410;
          border-right: 1px solid rgba(34,197,94,0.10);
          flex-direction: column; justify-content: space-between;
          padding: 2.5rem 3rem; position: relative; overflow: hidden;
        }
        @media (min-width: 1024px) { .rg-left { display: flex; } }

        .rg-glow  { position: absolute; width: 450px; height: 450px; background: radial-gradient(circle, rgba(34,197,94,0.10) 0%, transparent 65%); border-radius: 50%; top: -80px; right: -80px; pointer-events: none; }
        .rg-glow2 { top: auto; right: auto; bottom: -100px; left: -80px; background: radial-gradient(circle, rgba(52,211,153,0.07) 0%, transparent 65%); }

        .rg-brand { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
        .rg-brand-icon { width: 40px; height: 40px; background: linear-gradient(135deg,#22c55e,#34d399); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(34,197,94,0.32); }
        .rg-brand-name { color: #ecfdf5; font-weight: 800; font-size: 1.05rem; letter-spacing: -0.02em; }
        .rg-brand-badge { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.06em; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.30); color: #4ade80; border-radius: 5px; padding: 2px 7px; text-transform: uppercase; }

        .rg-hero { position: relative; z-index: 1; }
        .rg-headline { color: #ecfdf5; font-size: 1.9rem; font-weight: 800; line-height: 1.18; margin-bottom: 10px; letter-spacing: -0.03em; }
        .rg-accent { background: linear-gradient(90deg,#22c55e,#4ade80); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .rg-sub { color: #4d7c6b; font-size: 0.83rem; line-height: 1.65; margin-bottom: 2rem; }
        .rg-perk { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .rg-perk-text { color: #4d7c6b; font-size: 0.83rem; }
        .rg-footer { color: #4d7c6b; font-size: 0.68rem; position: relative; z-index: 1; }

        .rg-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem 1.5rem; background: #020c07; overflow-y: auto; }
        .rg-card { width: 100%; max-width: 400px; animation: rgFadeUp 0.42s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes rgFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .rg-mobile-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 1.5rem; }
        .rg-mobile-icon { width: 34px; height: 34px; background: linear-gradient(135deg,#22c55e,#34d399); border-radius: 9px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px rgba(34,197,94,0.35); }
        @media (min-width: 1024px) { .rg-mobile-brand { display: none; } }

        .rg-form-box { background: #0b1d15; border: 1px solid rgba(34,197,94,0.12); border-radius: 18px; padding: 1.75rem; box-shadow: 0 8px 40px rgba(0,0,0,0.55); }
        .rg-title { color: #ecfdf5; font-size: 1.45rem; font-weight: 800; margin: 0 0 4px; letter-spacing: -0.02em; }
        .rg-sub-link { color: #4d7c6b; font-size: 0.83rem; margin: 0 0 1.25rem; }
        .rg-sub-link a { color: #4ade80; font-weight: 600; text-decoration: none; }
        .rg-sub-link a:hover { color: #86efac; }

        .rg-label { display: block; font-size: 0.62rem; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; font-family: 'JetBrains Mono', monospace; }
        .rg-wrap  { position: relative; }
        .rg-icon  { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #4d7c6b; }
        .rg-input {
          width: 100%; background: #102819; border: 1px solid rgba(34,197,94,0.14); border-radius: 10px;
          padding: 10px 44px; font-size: 0.875rem; color: #ecfdf5; outline: none;
          transition: all 0.15s; font-family: inherit;
        }
        .rg-input::placeholder { color: #4d7c6b; }
        .rg-input:focus { border-color: rgba(34,197,94,0.52); background: #163522; box-shadow: 0 0 0 3px rgba(34,197,94,0.12); }
        .rg-input.err { border-color: rgba(248,113,113,0.45); background: rgba(248,113,113,0.04); }
        .rg-eye { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 0; color: #4d7c6b; transition: color 0.2s; }
        .rg-eye:hover { color: #4ade80; }
        .rg-err { font-size: 0.71rem; color: #f87171; margin-top: 4px; display: flex; align-items: center; gap: 4px; }

        /* Password strength meter */
        .rg-strength-bars { display: flex; gap: 4px; margin-top: 8px; }
        .rg-strength-bar { height: 3px; flex: 1; border-radius: 2px; background: rgba(34,197,94,0.10); transition: background 0.25s; }
        .rg-strength-info { display: flex; align-items: center; justify-content: space-between; margin-top: 5px; margin-bottom: 6px; }
        .rg-strength-label { font-size: 0.68rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }

        /* Requirements checklist */
        .rg-reqs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; padding: 8px 10px; background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid rgba(34,197,94,0.10); }
        .rg-req { display: flex; align-items: center; gap: 5px; font-size: 0.69rem; transition: color 0.2s; }
        .rg-req.met { color: #4ade80; }
        .rg-req.unmet { color: #4d7c6b; }

        .rg-btn {
          width: 100%; background: linear-gradient(135deg,#22c55e,#34d399);
          color: #052e16; font-weight: 800; font-family: inherit; font-size: 0.875rem;
          border: none; border-radius: 10px; padding: 11px;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 2px 14px rgba(34,197,94,0.38); transition: all 0.2s; margin-top: 4px;
        }
        .rg-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 24px rgba(34,197,94,0.55); }
        .rg-btn:active:not(:disabled) { transform: translateY(0); }
        .rg-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

        .rg-spin { animation: rgSpin 1s linear infinite; }
        @keyframes rgSpin { to { transform: rotate(360deg); } }
        .rg-form-footer { margin-top: 1rem; text-align: center; color: #4d7c6b; font-size: 0.67rem; line-height: 1.5; }
        .rg-fields { display: flex; flex-direction: column; gap: 13px; }
        .rg-divider { height: 1px; background: rgba(34,197,94,0.08); margin: 2px 0 12px; }
      `}</style>

      <div className="auth-reg-root">

        {/* Left panel */}
        <div className="rg-left">
          <div className="rg-glow" /><div className="rg-glow rg-glow2" />
          <div className="rg-brand">
            <div className="rg-brand-icon"><Sparkles size={20} color="white" /></div>
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              <div className="rg-brand-name">Talvion AI</div>
              <div className="rg-brand-badge">Beta</div>
            </div>
          </div>

          <div className="rg-hero">
            <h2 className="rg-headline">Land your dream job<br /><span className="rg-accent">on autopilot</span></h2>
            <p className="rg-sub">Create a free account and let your AI agent handle the entire job application process from start to finish.</p>
            {PERKS.map((perk, i) => (
              <div key={i} className="rg-perk">
                <CheckCircle size={16} color="#4ade80" style={{flexShrink:0}} />
                <span className="rg-perk-text">{perk}</span>
              </div>
            ))}
          </div>

          <p className="rg-footer">© {new Date().getFullYear()} Talvion AI · All rights reserved</p>
        </div>

        {/* Right — form */}
        <div className="rg-right">
          <div className="rg-card">
            <div className="rg-mobile-brand">
              <div className="rg-mobile-icon"><Sparkles size={17} color="white" /></div>
              <span style={{color:'#f1f5f9',fontWeight:800,fontSize:'1rem'}}>Talvion AI</span>
            </div>

            <div className="rg-form-box">
              <h1 className="rg-title">Create your account</h1>
              <p className="rg-sub-link">Already have one? <Link to="/login">Sign in</Link></p>
              <div className="rg-divider" />

              <form onSubmit={handleSubmit(onSubmit)} className="rg-fields">

                {/* Full Name */}
                <div>
                  <label className="rg-label">Full Name</label>
                  <div className="rg-wrap">
                    <User className="rg-icon" size={15} />
                    <input
                      {...register('name', {
                        required: 'Full name is required',
                        minLength: { value: 2, message: 'Minimum 2 characters' }
                      })}
                      ref={(e) => { register('name').ref(e); nameRef.current = e; }}
                      type="text"
                      placeholder="John Doe"
                      autoComplete="name"
                      className={`rg-input${errors.name ? ' err' : ''}`}
                    />
                  </div>
                  {errors.name && <p className="rg-err">⚠ {errors.name.message}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="rg-label">Email address</label>
                  <div className="rg-wrap">
                    <Mail className="rg-icon" size={15} />
                    <input
                      {...register('email', {
                        required: 'Email is required',
                        pattern: { value: /^\S+@\S+$/i, message: 'Enter a valid email' }
                      })}
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={`rg-input${errors.email ? ' err' : ''}`}
                    />
                  </div>
                  {errors.email && <p className="rg-err">⚠ {errors.email.message}</p>}
                </div>

                {/* Password + strength meter */}
                <div>
                  <label className="rg-label">Password</label>
                  <div className="rg-wrap">
                    <Lock className="rg-icon" size={15} />
                    <input
                      {...register('password', {
                        required: 'Password is required',
                        minLength: { value: 8, message: 'Minimum 8 characters' },
                      })}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      className={`rg-input${errors.password ? ' err' : ''}`}
                    />
                    <button type="button" className="rg-eye" onClick={() => setShowPassword(s => !s)}>
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.password && <p className="rg-err">⚠ {errors.password.message}</p>}

                  {/* Strength bars */}
                  {pwdVal.length > 0 && (
                    <>
                      <div className="rg-strength-bars">
                        {[1,2,3,4].map(n => (
                          <div
                            key={n}
                            className="rg-strength-bar"
                            style={{ background: strength >= n ? strengthColor : undefined }}
                          />
                        ))}
                      </div>
                      <div className="rg-strength-info">
                        <span className="rg-strength-label" style={{ color: strengthColor }}>
                          {strengthLabel}
                        </span>
                      </div>

                      {/* Requirements */}
                      <div className="rg-reqs">
                        {REQUIREMENTS.map((r, i) => (
                          <div key={i} className={`rg-req ${r.met ? 'met' : 'unmet'}`}>
                            {r.met
                              ? <CheckCircle size={11} />
                              : <XCircle size={11} />}
                            {r.label}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="rg-label">Confirm Password</label>
                  <div className="rg-wrap">
                    <Lock className="rg-icon" size={15} />
                    <input
                      {...register('confirmPassword', {
                        required: 'Please confirm your password',
                        validate: v => v === watch('password') || 'Passwords do not match'
                      })}
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      className={`rg-input${errors.confirmPassword ? ' err' : ''}`}
                    />
                    <button type="button" className="rg-eye" onClick={() => setShowConfirm(s => !s)}>
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="rg-err">⚠ {errors.confirmPassword.message}</p>}
                </div>

                <button type="submit" disabled={isLoading} className="rg-btn">
                  {isLoading
                    ? <><Loader2 size={15} className="rg-spin" /> Creating account...</>
                    : <><span>Create free account</span><ArrowRight size={15} /></>}
                </button>
              </form>

              <p className="rg-form-footer">By creating an account you agree to our Terms of Service and Privacy Policy</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
