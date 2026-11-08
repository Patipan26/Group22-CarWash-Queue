import { useEffect, useRef } from 'react';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleSignInButton({ onCredential }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!clientId) return undefined;

    let timer;
    let stopped = false;
    const renderButton = () => {
      if (stopped || !buttonRef.current) return true;
      if (!window.google?.accounts?.id) return false;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: onCredential,
        auto_select: false
      });
      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: 360
      });
      return true;
    };

    if (!renderButton()) {
      timer = window.setInterval(() => {
        if (renderButton()) window.clearInterval(timer);
      }, 100);
    }

    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
    };
  }, [onCredential]);

  if (!clientId) {
    return <p className="mt-4 text-center text-xs text-slate-400">Google Login จะแสดงเมื่อใส่ Google Client ID</p>;
  }

  return <div className="mt-5 border-t border-slate-200 pt-5"><div ref={buttonRef} className="flex justify-center" /></div>;
}
