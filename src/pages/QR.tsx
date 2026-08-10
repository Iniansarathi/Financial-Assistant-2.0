import React, { useRef, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import jsQR from 'jsqr';
import { db, type Expense } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface UpiParams {
  pa: string; // payee address (UPI ID)
  pn: string; // payee name (Merchant Name)
  am?: string; // amount
  tn?: string; // transaction note
}

const SwipeButton: React.FC<{
  label: string;
  colorClass: string;
  icon: React.ReactNode;
  onConfirm: () => void;
}> = ({ label, colorClass, icon, onConfirm }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const handleWidth = 44; // px width
  const padding = 8; // px padding

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const maxRight = Math.max(containerWidth - handleWidth - padding, 0);

  return (
    <div
      ref={containerRef}
      className="w-full h-14 bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl relative flex items-center p-1 overflow-hidden select-none"
    >
      {/* Background slide hint text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none w-full">
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1.5 justify-center">
          {label}
          <motion.span
            animate={{ x: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
            className="inline-block"
          >
            →
          </motion.span>
        </span>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: maxRight }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          if (info.point.x >= rect.right - 50) {
            onConfirm();
          }
        }}
        className={`w-11 h-11 rounded-xl cursor-grab active:cursor-grabbing flex items-center justify-center text-white shadow-lg relative z-10 font-bold ${colorClass}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {icon}
      </motion.div>
    </div>
  );
};

export const QRScanner: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Video/Canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // States
  const [scanning, setScanning] = useState(true);
  const [upiData, setUpiData] = useState<UpiParams | null>(null);
  const [confirmAmount, setConfirmAmount] = useState('');
  const [confirmNote, setConfirmNote] = useState('');
  const [selectedWallet, setSelectedWallet] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('cat-miscellaneous');
  const [statusStep, setStatusStep] = useState<'scan' | 'confirm_intent' | 'payment_status'>('scan');

  // Queries
  const wallets = useLiveQuery(() => db.wallets.where('status').equals('active').toArray()) || [];
  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray()) || [];

  // Auto-select first wallet when loaded
  useEffect(() => {
    if (wallets.length > 0 && !selectedWallet) {
      setSelectedWallet(wallets[0].walletId);
    }
  }, [wallets, selectedWallet]);

  // Initialize camera stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
          animationFrameId = requestAnimationFrame(scanFrame);
        }
      } catch (err) {
        console.error('Camera access failed:', err);
        alert('Could not access device camera. Please verify permissions.');
      }
    };

    if (scanning && statusStep === 'scan') {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [scanning, statusStep]);

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code) {
        const rawUrl = code.data;
        if (rawUrl.startsWith('upi://pay')) {
          handleUpiParse(rawUrl);
          return; // Stop scanning loop
        }
      }
    }
    requestAnimationFrame(scanFrame);
  };

  const handleUpiParse = (urlStr: string) => {
    try {
      setScanning(false);
      const url = new URL(urlStr);
      const params = new URLSearchParams(url.search);
      const payAddress = params.get('pa') || '';
      const payName = params.get('pn') || 'UPI Merchant';
      const amount = params.get('am') || '';
      const note = params.get('tn') || '';

      const parsed: UpiParams = {
        pa: payAddress,
        pn: decodeURIComponent(payName),
        am: amount || undefined,
        tn: note || undefined
      };

      setUpiData(parsed);
      if (amount) {
        setConfirmAmount(amount);
      }
      if (note) {
        setConfirmNote(decodeURIComponent(note));
      }
      if (wallets.length > 0) {
        setSelectedWallet(wallets[0].walletId);
      }
      setStatusStep('confirm_intent');
    } catch (err) {
      alert('Failed to parse UPI QR code data: ' + err);
      setScanning(true);
    }
  };

  // Launch specific target app
  const launchUpiApp = (appName: string) => {
    if (!upiData || !confirmAmount || !selectedWallet) {
      if (!upiData) alert("Error: Recipient VPA payload is missing. Please scan again.");
      else if (!confirmAmount) alert("Error: Please enter a spend amount.");
      else if (!selectedWallet) alert("Error: Please select a ledger wallet.");
      return;
    }

    const query = `pa=${upiData.pa}&pn=${encodeURIComponent(upiData.pn)}&am=${confirmAmount}&cu=INR${confirmNote ? `&tn=${encodeURIComponent(confirmNote)}` : ''}`;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    let appUrl = '';

    if (isIOS) {
      if (appName === 'gpay') appUrl = `gpay://upi/pay?${query}`;
      else if (appName === 'phonepe') appUrl = `phonepe://pay?${query}`;
      else if (appName === 'paytm') appUrl = `paytmmp://pay?${query}`;
      else if (appName === 'amazonpay') appUrl = `amazon://pay?${query}`;
    } else {
      if (appName === 'gpay') {
        appUrl = `intent://pay?${query}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
      } else if (appName === 'phonepe') {
        appUrl = `intent://pay?${query}#Intent;scheme=upi;package=com.phonepe.app;end`;
      } else if (appName === 'paytm') {
        appUrl = `intent://pay?${query}#Intent;scheme=upi;package=net.one97.paytm;end`;
      } else if (appName === 'amazonpay') {
        appUrl = `intent://pay?${query}#Intent;scheme=upi;package=in.amazon.mShop.android.shopping;end`;
      }
    }

    if (appUrl) {
      window.location.href = appUrl;
      setStatusStep('payment_status');
    }
  };

  const handleConfirmPaymentResult = async (success: boolean) => {
    if (success && upiData && confirmAmount && selectedWallet) {
      const amountNum = parseFloat(confirmAmount);
      const wallet = wallets.find(w => w.walletId === selectedWallet);

      if (wallet) {
        // Deduct wallet balance
        wallet.currentBalance -= amountNum;
        wallet.updatedAt = Date.now();
        await db.wallets.put(wallet);

        // Record as confirmed Expense
        const newExpense: Expense = {
          id: `exp-${Date.now()}`,
          walletId: selectedWallet,
          categoryId: selectedCategory,
          amount: amountNum,
          currency: 'INR',
          paymentMethod: 'UPI',
          merchantName: upiData.pn,
          note: confirmNote || upiData.tn || 'UPI QR Payment transaction',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDeleted: 0,
          syncStatus: 'pending',
          tags: ['upi-qr'],
          createdBy: user?.id || 'local-user',
          date: Date.now()
        };
        await db.expenses.add(newExpense);

        // Seed merchant intelligence
        const existingMerchant = await db.merchants.get(upiData.pn);
        if (existingMerchant) {
          existingMerchant.frequency += 1;
          existingMerchant.lastUsed = Date.now();
          existingMerchant.averageSpend = (existingMerchant.averageSpend * (existingMerchant.frequency - 1) + amountNum) / existingMerchant.frequency;
          await db.merchants.put(existingMerchant);
        } else {
          await db.merchants.add({
            merchantId: `mer-${Date.now()}`,
            merchantName: upiData.pn,
            upiId: upiData.pa,
            defaultCategory: selectedCategory,
            lastUsed: Date.now(),
            frequency: 1,
            averageSpend: amountNum,
            favorite: 0
          });
        }
      }
    }
    navigate('/');
  };

  return (
    <div className="space-y-8 max-w-md mx-auto text-left">
      <div>
        <h1 className="text-heading font-extrabold tracking-tight text-white">QR payment Scanner</h1>
        <p className="text-body text-gray-400">Launch payments and auto-log transactions.</p>
      </div>

      <div className="glass-panel p-6 rounded-3xl border-white/5 relative overflow-hidden">
        
        {/* Step 1: Scan camera viewfinder */}
        {statusStep === 'scan' && (
          <div className="flex flex-col items-center">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-white/10 mb-4">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              {/* Target bracket overlays */}
              <div className="absolute inset-16 border-2 border-dashed border-blue-400/50 rounded-xl pointer-events-none" />
              <div className="absolute bottom-4 flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-full border border-white/10 text-micro text-gray-300">
                <Camera className="w-3.5 h-3.5 text-blue-400" /> Align QR code in frame
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-caption font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Step 2: Confirm extracted UPI payload */}
        {statusStep === 'confirm_intent' && upiData && (
          <div className="space-y-4">
            <h3 className="text-title font-bold text-white mb-2">Configure UPI Intent</h3>
            
            <div className="p-4 bg-white/5 border border-white/5 rounded-xl text-left">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Payee Merchant</span>
              <p className="text-caption font-bold text-white">{upiData.pn}</p>
              <span className="text-[10px] text-gray-500 uppercase font-bold block mt-2">VPA ID Address</span>
              <p className="text-micro text-gray-400 font-mono truncate">{upiData.pa}</p>
            </div>

            <div>
              <label className="text-micro text-gray-400 font-semibold block mb-1">Select Ledger Wallet</label>
              <select
                value={selectedWallet}
                onChange={(e) => setSelectedWallet(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
              >
                {wallets.map(w => (
                  <option key={w.walletId} value={w.walletId} className="bg-black text-white">
                    {w.walletName} ({w.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Confirm Amount</label>
                <input
                  type="number"
                  value={confirmAmount}
                  disabled={!!upiData.am}
                  onChange={(e) => setConfirmAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none disabled:opacity-50"
                  required
                />
              </div>
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Spends Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id} className="bg-black text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-micro text-gray-400 font-semibold block mb-1">Transaction Note (Description)</label>
              <input
                type="text"
                value={confirmNote}
                placeholder="What are you paying for? (e.g. Tea, Lunch)"
                onChange={(e) => setConfirmNote(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
              />
            </div>

            {/* Slide to Pay Sliders */}
            <div className="space-y-3 pt-2">
              <label className="text-micro text-gray-400 font-semibold block mb-1">Slide right to complete payment</label>
              
              <SwipeButton
                label="Slide to pay with GPay"
                colorClass="bg-white text-black"
                icon={
                  <svg viewBox="0 0 24 24" width="22" height="22">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                }
                onConfirm={() => launchUpiApp('gpay')}
              />

              <SwipeButton
                label="Slide to pay with PhonePe"
                colorClass="bg-[#5f259f] text-white"
                icon={
                  <svg viewBox="0 0 100 100" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Tilted mobile phone shape in white */}
                    <rect x="34" y="20" width="32" height="60" rx="5" transform="rotate(-12 50 50)" stroke="#ffffff" stroke-width="6.5" fill="none"/>
                    {/* Rupee-like logo lines inside the phone screen */}
                    <path d="M46 38 L56 36 M44 47 L54 45 M45 37 L52 54 L44 56" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
                    {/* Phone home button */}
                    <circle cx="53" cy="71" r="3.5" fill="#ffffff"/>
                  </svg>
                }
                onConfirm={() => launchUpiApp('phonepe')}
              />

              <SwipeButton
                label="Slide to pay with Paytm"
                colorClass="bg-white text-black"
                icon={
                  <svg viewBox="0 0 100 40" width="36" height="16">
                    <text x="0" y="28" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="28" fill="#00baf2">pay</text>
                    <text x="48" y="28" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="28" fill="#002E6E">tm</text>
                  </svg>
                }
                onConfirm={() => launchUpiApp('paytm')}
              />

              <SwipeButton
                label="Slide to pay with Amazon Pay"
                colorClass="bg-[#232F3E] text-white"
                icon={
                  <svg viewBox="0 0 100 100" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Amazon 'a' */}
                    <path d="M54 28c-10 0-17 5-17 14.5 0 9 5.5 13 12 13 5.5 0 9-3 11-5.5v4.5c0 4.5-2.5 7-7.5 7-4.5 0-8-2-10-3.5l-3 4.5c3.5 3.5 9.5 5.5 15 5.5 10.5 0 14.5-6 14.5-15.5V38c0-7-4-10-15-10zm4.5 17c0 4.5-2 6.5-6.5 6.5-3.5 0-5.5-2-5.5-5.5 0-3.5 2-6.5 6.5-6.5 4 0 5.5 2 5.5 5.5z" fill="#FFFFFF"/>
                    {/* Smile arrow */}
                    <path d="M22 72c18 9 40 9 56 0" stroke="#FF9900" stroke-width="6" stroke-linecap="round"/>
                    <path d="M72 65c1 3.5 4.5 7.5 6.5 8.5 1 .5 1.5 0 1-1-1.5-2-3-6.5-2.5-10" stroke="#FF9900" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                }
                onConfirm={() => launchUpiApp('amazonpay')}
              />
            </div>

            <div className="pt-4 border-t border-white/5 flex gap-2">
              <button
                type="button"
                onClick={() => setStatusStep('scan')}
                className="w-full py-3.5 rounded-xl bg-white/5 text-gray-400 hover:text-white font-semibold text-caption cursor-pointer active:scale-98 transition-all"
              >
                Scan Again
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation overlay (on return) */}
        {statusStep === 'payment_status' && upiData && (
          <div className="text-center py-6 space-y-6">
            <h3 className="text-title font-bold text-white">Confirm UPI Payment</h3>
            <p className="text-body text-gray-400 leading-relaxed max-w-sm mx-auto">
              Please confirm if the payment to <strong className="text-white">{upiData.pn}</strong> for <strong className="text-white">₹{confirmAmount}</strong> succeeded in your banking app.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={() => handleConfirmPaymentResult(true)}
                className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl cursor-pointer shadow-lg active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-5 h-5" /> YES, Payment Succeeded
              </button>
              <button
                onClick={() => handleConfirmPaymentResult(false)}
                className="w-full flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold rounded-2xl cursor-pointer active:scale-95 transition-all"
              >
                <XCircle className="w-5 h-5" /> NO, Payment Failed/Cancelled
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
