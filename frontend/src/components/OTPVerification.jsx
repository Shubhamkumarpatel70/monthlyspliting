import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth as authApi } from '../api';
import { useAuth } from '../context/AuthContext';

export default function OTPVerification({ email, mobile, purpose = 'signup', type = 'email', whatsappLink, onVerified, onCancel }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const loginWithOTP = auth?.loginWithOTP;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    // Start countdown timer (60 seconds)
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Automatically open WhatsApp when component mounts with mobile type and link
  // Only if WhatsApp link is provided (not needed if SMS was sent automatically)
  useEffect(() => {
    if (type === 'mobile' && whatsappLink) {
      // Small delay to ensure component is rendered, then open WhatsApp
      const timer = setTimeout(() => {
        // Open WhatsApp in new tab/window (works on both mobile and desktop)
        // On mobile, this will open the WhatsApp app directly
        const whatsappWindow = window.open(whatsappLink, '_blank');
        // If popup blocked, try direct navigation (for mobile)
        if (!whatsappWindow || whatsappWindow.closed || typeof whatsappWindow.closed === 'undefined') {
          // Fallback: try direct navigation (works better on mobile)
          window.location.href = whatsappLink;
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [type, whatsappLink]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits
    
    const newCode = [...code];
    newCode[index] = value.slice(-1); // Only take last character
    
    setCode(newCode);
    setError('');
    
    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const newCode = pastedData.split('');
      setCode(newCode);
      // Focus last input
      const lastInput = document.getElementById('otp-5');
      if (lastInput) lastInput.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = code.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const result = await authApi.verifyOTP(email, mobile, otpCode, purpose, type);
      
      // If purpose is 'login' and we got token/user data, log them in
      if (purpose === 'login' && result.token && result.user) {
        if (loginWithOTP) {
          await loginWithOTP(result.token, result.user);
        }
        // Navigation will be handled by the parent component or AuthContext
        if (onVerified) {
          onVerified(result);
        }
        return;
      }
      
      // For signup or other purposes, call the onVerified callback
      if (onVerified) {
        onVerified(otpCode);
      }
    } catch (err) {
      // Handle "account not found login" error - redirect to signup
      const errorMessage = err.message || '';
      if (errorMessage.toLowerCase().includes('account not found') || errorMessage === 'account not found login') {
        const signupParams = new URLSearchParams();
        if (mobile) signupParams.set('mobile', mobile);
        if (email) signupParams.set('email', email);
        const returnUrl = window.location.pathname + window.location.search;
        if (returnUrl !== '/') signupParams.set('returnUrl', returnUrl);
        navigate(`/signup?${signupParams.toString()}`, { replace: true });
        return;
      }
      
      setError(errorMessage || 'Invalid verification code');
      // Clear code on error
      setCode(['', '', '', '', '', '']);
      const firstInput = document.getElementById('otp-0');
      if (firstInput) firstInput.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setError('');
    setResendLoading(true);
    try {
      const result = await authApi.resendOTP(email, mobile, purpose, type);
      // Automatically open WhatsApp if mobile type
      if (result.whatsappLink && type === 'mobile') {
        const whatsappWindow = window.open(result.whatsappLink, '_blank');
        // Fallback for mobile if popup blocked
        if (!whatsappWindow || whatsappWindow.closed || typeof whatsappWindow.closed === 'undefined') {
          window.location.href = result.whatsappLink;
        }
      }
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setCode(['', '', '', '', '', '']);
      const firstInput = document.getElementById('otp-0');
      if (firstInput) firstInput.focus();
    } catch (err) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResendLoading(false);
    }
  };

  const isComplete = code.every((digit) => digit !== '');

  return (
    <div className="bg-surface rounded-2xl border border-white/5 p-6 shadow-xl">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-textPrimary mb-2">
          {type === 'mobile' ? 'Verify your mobile number' : 'Verify your email'}
        </h2>
        {type === 'mobile' && whatsappLink ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-green-500 mb-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <span className="text-sm font-medium">WhatsApp opened automatically</span>
            </div>
            <p className="text-textSecondary text-sm">
              Check your WhatsApp for the verification code sent to{' '}
              <span className="text-primary font-medium">{mobile}</span>
            </p>
            <p className="text-textSecondary text-xs">
              If WhatsApp didn't open,{' '}
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                click here to open manually
              </a>
            </p>
          </div>
        ) : (
          <p className="text-textSecondary text-sm">
            We've sent a 6-digit code to{' '}
            <span className="text-primary font-medium">
              {type === 'mobile' ? mobile : email}
            </span>
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-center mb-6">
        {code.map((digit, index) => (
          <input
            key={index}
            id={`otp-${index}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={index === 0 ? handlePaste : undefined}
            className="w-12 h-14 text-center text-xl font-semibold rounded-lg bg-darkBg border border-white/10 text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
            autoFocus={index === 0}
          />
        ))}
      </div>

      <button
        onClick={handleVerify}
        disabled={!isComplete || loading}
        className="w-full py-3 rounded-lg bg-primary text-darkBg font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-darkBg disabled:opacity-50 transition mb-4"
      >
        {loading ? 'Verifying...' : 'Verify'}
      </button>

      <div className="text-center">
        <p className="text-textSecondary text-sm mb-2">
          Didn't receive the code?
        </p>
        <button
          onClick={handleResend}
          disabled={countdown > 0 || resendLoading}
          className="text-primary font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {resendLoading
            ? 'Sending...'
            : countdown > 0
            ? `Resend in ${countdown}s`
            : 'Resend code'}
        </button>
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full mt-4 py-2 text-textSecondary hover:text-textPrimary text-sm transition"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
