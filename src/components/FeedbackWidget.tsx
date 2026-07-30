// Global feedback widget (platform standard): a floating launcher that files
// reports into the CGOPS-owned platform_feedback table. Identity is stamped
// server-side by a DB trigger; the app only attaches context (app, screen,
// device, user agent).
//
// Only rendered when a real Supabase session exists (the CGOPS SSO cohort).
// PIN-login chef users have no Supabase session, and the table's RLS only
// accepts authenticated inserts — hiding the button beats a failing submit.

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const APP_NAME = 'weekly-summary';

const TYPES = [
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idea' },
  { value: 'question', label: 'Question' },
] as const;

type FeedbackType = (typeof TYPES)[number]['value'];

function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function FeedbackWidget({ screen }: { screen: string }) {
  const [hasSession, setHasSession] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<FeedbackType | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setHasSession(data.session !== null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(session !== null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  if (!hasSession) return null;

  const submit = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    setError(null);
    const { error: insertError } = await supabase.from('platform_feedback').insert({
      app_module: APP_NAME,
      screen,
      device: detectDevice(),
      user_agent: navigator.userAgent,
      message: message.trim(),
      type,
    });
    setSending(false);
    if (insertError) {
      setError('Could not send feedback. Please try again.');
      return;
    }
    setOpen(false);
    setMessage('');
    setType(null);
    setSent(true);
    toastTimer.current = window.setTimeout(() => setSent(false), 3500);
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-36 md:bottom-20 right-4 z-[60] w-[calc(100vw-2rem)] max-w-sm bg-white rounded-xl border border-cg-border shadow-cg-md">
          <div className="flex items-center justify-between px-4 py-3 border-b border-cg-border">
            <p className="text-sm font-semibold text-cg-text">Send feedback</p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close feedback form"
              className="p-1 rounded text-cg-muted hover:text-cg-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(type === t.value ? null : t.value)}
                  className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
                    type === t.value
                      ? 'border-cg-accent bg-cg-accentSoft text-cg-accent'
                      : 'border-cg-border text-cg-muted hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              rows={4}
              placeholder="What's working? What's broken? What's missing?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-cg-border px-3 py-2 text-sm text-cg-text placeholder:text-cg-muted focus:outline-none focus:ring-2 focus:ring-cg-accent/40"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end">
              <button
                onClick={() => void submit()}
                disabled={!message.trim() || sending}
                className="px-4 py-2 rounded-lg bg-cg-accent text-white text-sm font-medium hover:bg-cg-accentHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sent && (
        <div className="fixed bottom-36 md:bottom-20 right-4 z-[60] rounded-lg bg-cg-text px-4 py-2 text-sm text-white shadow-cg-md">
          Thanks — your feedback was sent.
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Send feedback"
        className="fixed bottom-20 md:bottom-4 right-4 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-cg-accent text-white shadow-cg-md hover:bg-cg-accentHover transition-colors"
      >
        <MessageCircle className="w-5 h-5" />
      </button>
    </>
  );
}
