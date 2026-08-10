import React, { useRef, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import jsQR from 'jsqr';
import { db, type Expense } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, XCircle } from 'lucide-react';

interface UpiParams {
  pa: string; // payee address (UPI ID)
  pn: string; // payee name (Merchant Name)
  am?: string; // amount
  tn?: string; // transaction note
}

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
  const [selectedUpiApp, setSelectedUpiApp] = useState('default');
  const [selectedWallet, setSelectedWallet] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('cat-miscellaneous');
  const [statusStep, setStatusStep] = useState<'scan' | 'confirm_intent' | 'payment_status'>('scan');

  // Queries
  const wallets = useLiveQuery(() => db.wallets.where('status').equals('active').toArray()) || [];
  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray()) || [];

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

  const handleLaunchIntent = () => {
    if (!upiData || !confirmAmount || !selectedWallet) return;
    
    // Construct query parameters
    const query = `pa=${upiData.pa}&pn=${encodeURIComponent(upiData.pn)}&am=${confirmAmount}&cu=INR${confirmNote ? `&tn=${encodeURIComponent(confirmNote)}` : ''}`;
    
    // Detect OS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    const defaultUpiUrl = `upi://pay?${query}`;
    let targetUrl = defaultUpiUrl;
    
    if (selectedUpiApp !== 'default') {
      if (isIOS) {
        // iOS custom scheme triggers
        if (selectedUpiApp === 'gpay') targetUrl = `gpay://upi/pay?${query}`;
        else if (selectedUpiApp === 'phonepe') targetUrl = `phonepe://pay?${query}`;
        else if (selectedUpiApp === 'paytm') targetUrl = `paytmmp://pay?${query}`;
        else if (selectedUpiApp === 'amazonpay') targetUrl = `amazon://pay?${query}`;
      } else {
        // Android Intent redirection wrapper (bypasses chooser directly to specified app package)
        if (selectedUpiApp === 'gpay') {
          targetUrl = `intent://pay?${query}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
        } else if (selectedUpiApp === 'phonepe') {
          targetUrl = `intent://pay?${query}#Intent;scheme=upi;package=com.phonepe.app;end`;
        } else if (selectedUpiApp === 'paytm') {
          targetUrl = `intent://pay?${query}#Intent;scheme=upi;package=net.one97.paytm;end`;
        } else if (selectedUpiApp === 'amazonpay') {
          targetUrl = `intent://pay?${query}#Intent;scheme=upi;package=in.amazon.mShop.android.shopping;end`;
        }
      }
    }
    
    // Launch deep link using an anchor tag wrapper (bypasses browser PWA sandbox constraints)
    const link = document.createElement('a');
    link.href = targetUrl;
    link.target = '_self';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Fallback to default chooser if target app isn't installed / fails to respond
    if (selectedUpiApp !== 'default') {
      setTimeout(() => {
        const fallbackLink = document.createElement('a');
        fallbackLink.href = defaultUpiUrl;
        fallbackLink.target = '_self';
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        document.body.removeChild(fallbackLink);
      }, 1500);
    }
    
    // Move to payment checking status
    setStatusStep('payment_status');
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

            <div>
              <label className="text-micro text-gray-400 font-semibold block mb-1">Select Target UPI App</label>
              <select
                value={selectedUpiApp}
                onChange={(e) => setSelectedUpiApp(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
              >
                <option value="default" className="bg-black text-white">System Default Chooser</option>
                <option value="gpay" className="bg-black text-white">Google Pay (GPay)</option>
                <option value="phonepe" className="bg-black text-white">PhonePe</option>
                <option value="paytm" className="bg-black text-white">Paytm</option>
                <option value="amazonpay" className="bg-black text-white">Amazon Pay</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusStep('scan')}
                className="flex-1 py-3.5 rounded-xl bg-white/5 text-gray-400 hover:text-white font-semibold text-caption cursor-pointer"
              >
                Scan Again
              </button>
              <button
                onClick={handleLaunchIntent}
                className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption cursor-pointer active:scale-98 transition-all"
              >
                Pay & Launch App
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
