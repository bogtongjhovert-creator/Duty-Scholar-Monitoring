import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { AttendanceScanResult } from '../../types/index.ts';
import { playSuccessChime, playErrorTone } from '../../lib/audio.ts';
import { formatManilaFull, SYSTEM_TIMEZONE } from '../../lib/constants.ts';

export default function ScannerView() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<AttendanceScanResult | null>(null);
  const [autoResumeSeconds, setAutoResumeSeconds] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Manual ID entry state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualIdInput, setManualIdInput] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [allowManualIdEntry, setAllowManualIdEntry] = useState(true);

  // Live Manila clock
  useEffect(() => {
    const updateClock = () => {
      setCurrentTime(formatManilaFull(new Date()));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch public settings and listen for real-time config updates
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await api.getPublicConfig();
        setAllowManualIdEntry(config.allowManualIdEntry);
      } catch (err) {
        // fallback
      }
    };
    loadConfig();

    const unsubscribe = api.subscribeToRealtimeSync(() => {
      loadConfig();
    });
    return () => unsubscribe();
  }, []);

  // Auto-start camera when page loads
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  // Auto-resume countdown after confirmation card is shown
  useEffect(() => {
    if (!scanResult) {
      setAutoResumeSeconds(null);
      return;
    }

    setAutoResumeSeconds(6);
    const timer = setInterval(() => {
      setAutoResumeSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          setScanResult(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [scanResult]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsScanning(true);
        setHasPermission(true);
        requestAnimationFrame(tick);
      }
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      setIsScanning(false);
      setHasPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. Please allow camera permissions in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. You can use the manual ID entry below.');
      } else {
        setCameraError('Unable to access device camera. Please check camera connections or try manual entry.');
      }
    }
  };

  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const toggleCamera = () => {
    if (isScanning) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const tick = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameId.current = requestAnimationFrame(tick);
      return;
    }

    if (isProcessing || scanResult) {
      // Don't scan while currently displaying a confirmation or processing
      animationFrameId.current = requestAnimationFrame(tick);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameId.current = requestAnimationFrame(tick);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animationFrameId.current = requestAnimationFrame(tick);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data && code.data.trim().length > 0) {
      handleQrDetected(code.data.trim());
    } else {
      animationFrameId.current = requestAnimationFrame(tick);
    }
  };

  const handleQrDetected = async (qrData: string) => {
    setIsProcessing(true);
    try {
      const result = await api.scanAttendance({
        qrToken: qrData,
        recordingMethod: 'QR_SCAN',
      });

      if (result.success) {
        playSuccessChime();
      } else {
        playErrorTone();
      }
      setScanResult(result);
    } catch (err: any) {
      playErrorTone();
      setScanResult({
        success: false,
        message: 'Network error communicating with attendance server. Please try again.',
      });
    } finally {
      setIsProcessing(false);
      // Resume scanning loop
      animationFrameId.current = requestAnimationFrame(tick);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIdInput.trim()) return;

    setManualSubmitting(true);
    try {
      const result = await api.scanAttendance({
        scholarIdInput: manualIdInput.trim(),
        recordingMethod: 'MANUAL_ENTRY',
      });

      if (result.success) {
        playSuccessChime();
      } else {
        playErrorTone();
      }
      setScanResult(result);
      setShowManualModal(false);
      setManualIdInput('');
    } catch (err) {
      playErrorTone();
      setScanResult({
        success: false,
        message: 'Failed to record attendance. Please check network connection.',
      });
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-100">
      {/* Header - Text-based branding only, NO LOGO as specified */}
      <header className="border-b border-slate-200 bg-white shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                OSC Duty Scholars Attendance Checking System
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live QR Code Attendance Terminal • Office of Student Affairs
            </p>
          </div>
          <div className="bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-mono text-slate-700 flex items-center gap-1.5 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{currentTime || 'Loading Manila Time...'}</span>
          </div>
        </div>
      </header>

      {/* Main Scanner Section */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col items-center justify-center">
        {/* Confirmation Modal / Card */}
        {scanResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div
              className={`w-full max-w-md bg-white rounded-2xl shadow-2xl border-2 overflow-hidden ${
                scanResult.success
                  ? 'border-emerald-500 shadow-emerald-500/20'
                  : 'border-rose-500 shadow-rose-500/20'
              }`}
            >
              {/* Header banner */}
              <div
                className={`p-4 text-center ${
                  scanResult.success
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
                    : 'bg-gradient-to-r from-rose-600 to-red-600 text-white'
                }`}
              >
                <div className="flex justify-center mb-1">
                  {scanResult.success ? (
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <CheckCircle2 className="w-7 h-7 text-white" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <AlertCircle className="w-7 h-7 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-bold">
                  {scanResult.success ? 'Attendance Recorded Successfully!' : 'Unable to Record Attendance'}
                </h3>
                <p className="text-xs text-white/90 mt-0.5">{scanResult.message}</p>
              </div>

              {/* Scholar Details Card */}
              {scanResult.scholar ? (
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {scanResult.scholar.profilePhoto ? (
                      <img
                        src={scanResult.scholar.profilePhoto}
                        alt={scanResult.scholar.fullName}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                        <User className="w-8 h-8" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-bold text-slate-900 truncate">
                        {scanResult.scholar.fullName}
                      </h4>
                      <p className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 inline-block px-2 py-0.5 rounded border border-emerald-200 mt-0.5">
                        {scanResult.scholar.scholarId}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 truncate">
                        {scanResult.scholar.department}
                      </p>
                    </div>
                  </div>

                  {/* Attendance Event Badge */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Action Recorded
                      </span>
                      <span
                        className={`text-base font-black uppercase mt-0.5 inline-block px-3 py-1 rounded-md ${
                          scanResult.action === 'TIME_IN'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-teal-700 text-white'
                        }`}
                      >
                        {scanResult.action === 'TIME_IN' ? 'TIME IN' : 'TIME OUT'}
                      </span>
                    </div>

                    <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Duty Duration
                      </span>
                      <span className="text-base font-bold text-slate-800 mt-0.5 block">
                        {scanResult.durationHours !== undefined && scanResult.durationHours > 0
                          ? `${scanResult.durationHours} hrs`
                          : 'Duty Started'}
                      </span>
                    </div>
                  </div>

                  <div className="text-center text-xs text-slate-500 space-y-0.5">
                    <p>Recorded at: <span className="font-medium text-slate-700">{formatManilaFull(new Date())}</span></p>
                    <p className="text-[11px] text-slate-400">Server Timezone: Asia/Manila (PHT)</p>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center space-y-3">
                  <p className="text-sm text-slate-600 bg-rose-50 text-rose-800 p-3 rounded-lg border border-rose-200">
                    {scanResult.message}
                  </p>
                </div>
              )}

              {/* Action button & countdown */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">
                  {autoResumeSeconds !== null && `Auto-resumes in ${autoResumeSeconds}s`}
                </span>
                <button
                  onClick={() => setScanResult(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Scan Next Scholar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scanner Viewport Container */}
        <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-lg p-5 flex flex-col items-center">
          {/* Instructions banner */}
          <div className="w-full mb-4 text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Position your QR code inside the scanning frame
            </span>
          </div>

          {/* Camera Frame Container */}
          <div className="relative w-full aspect-square max-w-xs sm:max-w-sm rounded-xl overflow-hidden bg-slate-950 shadow-inner flex items-center justify-center">
            {/* The Video Element */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isScanning ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Hidden canvas for QR frame analysis */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Active Scanning Guides & Laser Overlay */}
            {isScanning && !cameraError && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Outer darkened vignette */}
                <div className="absolute inset-0 border-[36px] sm:border-[44px] border-slate-950/60" />

                {/* Target box */}
                <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                  {/* Four Corner Brackets */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />

                  {/* Animated laser scanning bar */}
                  <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 shadow-[0_0_12px_#10b981] animate-bounce" />
                </div>
              </div>
            )}

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white z-10">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                <p className="text-xs font-semibold tracking-wide">Validating Scholar Code...</p>
              </div>
            )}

            {/* Camera Stopped or Error State */}
            {(!isScanning || cameraError) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-300">
                <CameraOff className="w-12 h-12 text-slate-500 mb-3" />
                <p className="text-sm font-semibold text-slate-200 mb-1">
                  {cameraError ? 'Camera Unavailable' : 'Camera is Paused'}
                </p>
                <p className="text-xs text-slate-400 max-w-xs mb-4">
                  {cameraError || 'Click below to restart the camera scanner or enter your Scholar ID manually.'}
                </p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Start Camera Scanner
                </button>
              </div>
            )}
          </div>

          {/* Scanner Controls Bar */}
          <div className="w-full mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={toggleCamera}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
                isScanning
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
              }`}
            >
              {isScanning ? (
                <>
                  <CameraOff className="w-4 h-4" /> Stop Scanning
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" /> Start Scanning
                </>
              )}
            </button>

            <button
              onClick={switchCamera}
              disabled={!isScanning}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
              title="Switch between front and back camera"
            >
              <RefreshCw className="w-4 h-4" /> Switch Camera
            </button>

            {allowManualIdEntry && (
              <button
                onClick={() => setShowManualModal(true)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-all flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Search className="w-4 h-4" /> Manual ID Entry
              </button>
            )}
          </div>

          {/* Quick Notice on Rules */}
          <div className="w-full mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-md">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>1st Scan: Records <strong>TIME IN</strong></span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-md">
              <span className="w-2 h-2 rounded-full bg-teal-600"></span>
              <span>2nd Scan: Records <strong>TIME OUT</strong></span>
            </div>
          </div>
        </div>
      </main>

      {/* Manual Scholar ID Search Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Manual Scholar ID Entry</h3>
                <p className="text-xs text-slate-500">Record attendance using your assigned ID</p>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scholar ID Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. DS-2026-0001"
                  value={manualIdInput}
                  onChange={(e) => setManualIdInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 uppercase"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Enter your official Duty Scholar ID as indicated on your registration card.
                </p>
              </div>

              {/* Sample IDs Quick Fill for easy testing in preview */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px]">
                <span className="font-semibold text-slate-600 block mb-1">Test Scholar IDs:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['DS-2026-0001', 'DS-2026-0002', 'DS-2026-0003', 'DS-2026-0004'].map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setManualIdInput(id)}
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded hover:border-emerald-500 hover:text-emerald-700 text-[10px] font-mono cursor-pointer transition-colors"
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting || !manualIdInput.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {manualSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...
                    </>
                  ) : (
                    'Record Attendance'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer - No administrative links or hints as strictly required */}
      <footer className="border-t border-slate-200 bg-white py-3 px-4 text-center text-xs text-slate-500">
        <p className="max-w-4xl mx-auto">
          Office of Student Affairs (OSA) • Dedicated Scholar Monitoring Terminal • Asia/Manila Standard Time
        </p>
      </footer>
    </div>
  );
}
