import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { submitUserFeedback } from '../../services/feedbackService';
import { useAuth } from '../../services/auth/authProvider';
import { Camera, X, Send, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface FeedbackModalProps {
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  // Capture the browser viewport
  const handleCapture = async () => {
    setCapturing(true);
    try {
      // Small delay to let modal adjust if needed
      await new Promise((r) => setTimeout(r, 100));

      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: 0.6, // scale down to optimize upload footprint
        logging: false,
        ignoreElements: (element) => {
          // Ignore feedback modal backdrop to avoid capturing it in screenshot
          return element.id === 'feedback-modal-backdrop';
        }
      });
      
      const base64 = canvas.toDataURL('image/jpeg', 0.85); // JPEG compression
      setScreenshot(base64);
    } catch (err) {
      console.error('Failed to capture viewport screenshot:', err);
      alert('Could not auto-capture screenshot. You can still submit text feedback.');
    } finally {
      setCapturing(false);
    }
  };

  // Submit feedback payload
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      alert('Please describe your feedback or bug report.');
      return;
    }
    if (!user?.email) {
      alert('User session not active.');
      return;
    }

    setSending(true);
    try {
      await submitUserFeedback(user.email, message, screenshot);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Failed to submit user feedback:', err);
      alert('Error submitting feedback: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      id="feedback-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-3xl p-6 relative shadow-2xl flex flex-col justify-between text-left">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-white/5 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500 animate-pulse" />
            <h3 className="text-title font-extrabold text-slate-900 dark:text-white">Bug Report & Feedback</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-gray-500 hover:text-slate-800 dark:hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 animate-bounce" />
            <h4 className="text-title font-extrabold text-slate-900 dark:text-white">Feedback Submitted!</h4>
            <p className="text-caption text-gray-500">Thank you for helping us improve MoneyPilot.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Description Textarea */}
            <div>
              <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">
                Describe the issue or feedback
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What occurred? How can we reproduce it? Or what improvements would you like?"
                className="w-full h-32 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none resize-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            {/* Screenshot Actions */}
            <div className="space-y-2">
              <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block">
                Attach Screenshot (Optional)
              </label>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={capturing || sending}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-bold text-caption cursor-pointer active:scale-95 transition-all"
                >
                  {capturing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Capturing...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" /> Auto-Capture Screen
                    </>
                  )}
                </button>
                {screenshot && (
                  <button
                    type="button"
                    onClick={() => setScreenshot(null)}
                    className="text-micro font-medium text-red-500 hover:underline cursor-pointer"
                  >
                    Remove attachment
                  </button>
                )}
              </div>

              {/* Viewport Capture Preview */}
              {screenshot && (
                <div className="w-full max-h-36 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 relative mt-2 bg-slate-100 dark:bg-black/20">
                  <img
                    src={screenshot}
                    alt="Viewport Capture Preview"
                    className="w-full h-full object-contain max-h-36"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-2.5">
                    <span className="text-[10px] text-white font-bold">Screenshot Attached</span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="flex-1 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-700 dark:text-gray-300 font-semibold text-caption cursor-pointer transition-all hover:bg-slate-100 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || capturing}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-caption cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Submit Report
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
