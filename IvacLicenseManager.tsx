import mqtt from 'mqtt';
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Key, Plus, Trash2, ShieldBan, RefreshCw, CheckCircle2, Shield, Search, X, ChevronRight, ArrowLeft, ArrowRight, User, Phone, FileText, Clock, Calendar, CalendarPlus, Save, Edit3, Copy, Activity, Chrome, Power, CheckCircle, AlertCircle, AlertTriangle, ArrowUpRight, Filter, Smartphone, CreditCard, FileUp, LogIn, Layers, Radio, Sparkles, Database, HardDrive, Server, ExternalLink , Archive, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { db as oldDb } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, updateDoc, getDocs, where, getFirestore } from 'firebase/firestore';

// Dedicated IVAC Master Pro Firebase Configuration
const ivacFirebaseConfig = {
  apiKey: "AIzaSyCxtWF47hS8xRWCdaD7MYLgjwp-jdgxP48",
  authDomain: "ivac-master-pro.firebaseapp.com",
  projectId: "ivac-master-pro",
  storageBucket: "ivac-master-pro.firebasestorage.app",
  messagingSenderId: "569432912971",
  appId: "1:569432912971:web:59823945d245f2998f49ce"
};

const ivacApp = getApps().find(a => a.name === 'ivac-master-pro-app') || initializeApp(ivacFirebaseConfig, 'ivac-master-pro-app');
const db = getFirestore(ivacApp);

interface IvacLicense {
  id: string;
  key: string;
  duration_months?: number | string;
  duration_days?: number | string;
  status: 'active' | 'blocked';
  hwid: string | null;
  payment_count: number;
  total_amount?: number;
  created_at: number;
  bound_at: number | string | null;
  client_name?: string;
  client_phone?: string;
  client_description?: string;
  archived_cutoffs?: Record<string, number>;
}

interface LicenseExpiryDetails {
  isBound: boolean;
  isExpired: boolean;
  totalDays: number;
  expiryMs: number;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  expiryFormatted: string;
  expiryBangla: string;
  remainingText: string;
  remainingBadgeClass: string;
}

export function getLicenseExpiryInfo(lic: IvacLicense): LicenseExpiryDetails {
  let boundMs = 0;
  if (lic.bound_at) {
    boundMs = typeof lic.bound_at === 'string' ? parseInt(lic.bound_at, 10) : Number(lic.bound_at);
  }

  let totalDays = 0;
  if (lic.duration_days) {
    totalDays = typeof lic.duration_days === 'string' ? parseInt(lic.duration_days, 10) : Number(lic.duration_days);
  } else if (lic.duration_months) {
    const months = typeof lic.duration_months === 'string' ? parseInt(lic.duration_months, 10) : Number(lic.duration_months);
    totalDays = (months || 1) * 30;
  }
  if (!totalDays || isNaN(totalDays)) totalDays = 30;

  if (!boundMs || isNaN(boundMs)) {
    return {
      isBound: false,
      isExpired: false,
      totalDays,
      expiryMs: 0,
      daysRemaining: totalDays,
      hoursRemaining: 0,
      minutesRemaining: 0,
      expiryFormatted: 'প্রথম ব্যবহারের পর শুরু হবে',
      expiryBangla: 'প্রথম ব্যবহারের পর শুরু হবে',
      remainingText: `${totalDays} দিন বরাদ্দ (Unused)`,
      remainingBadgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    };
  }

  const expiryMs = boundMs + (totalDays * 86400000);
  const nowMs = Date.now();
  const diffMs = expiryMs - nowMs;
  const isExpired = diffMs <= 0;

  const daysRemaining = Math.max(0, Math.floor(diffMs / 86400000));
  const hoursRemaining = Math.max(0, Math.floor((diffMs % 86400000) / 3600000));
  const minutesRemaining = Math.max(0, Math.floor((diffMs % 3600000) / 60000));

  const expDate = new Date(expiryMs);
  const dateOptions: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  const datePart = expDate.toLocaleDateString('en-GB', dateOptions);
  const timePart = expDate.toLocaleTimeString('en-US', timeOptions);
  const expiryFormatted = `${datePart}, ${timePart}`;

  const bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
  const toBn = (n: number | string) => String(n).replace(/\d/g, (d) => bnDigits[Number(d)]);
  const bnMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const expiryBangla = `${toBn(expDate.getDate())} ${bnMonths[expDate.getMonth()]} ${toBn(expDate.getFullYear())}, ${timePart}`;

  let remainingText = '';
  let remainingBadgeClass = '';

  if (isExpired) {
    remainingText = 'মেয়াদ শেষ (Expired)';
    remainingBadgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
  } else if (daysRemaining > 0) {
    remainingText = `${toBn(daysRemaining)} দিন ${toBn(hoursRemaining)} ঘণ্টা বাকি`;
    if (daysRemaining <= 3) {
      remainingBadgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    } else if (daysRemaining <= 7) {
      remainingBadgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    } else {
      remainingBadgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
  } else if (hoursRemaining > 0) {
    remainingText = `${toBn(hoursRemaining)} ঘণ্টা ${toBn(minutesRemaining)} মিনিট বাকি`;
    remainingBadgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
  } else {
    remainingText = `${toBn(minutesRemaining)} মিনিট বাকি`;
    remainingBadgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
  }

  return {
    isBound: true,
    isExpired,
    totalDays,
    expiryMs,
    daysRemaining,
    hoursRemaining,
    minutesRemaining,
    expiryFormatted,
    expiryBangla,
    remainingText,
    remainingBadgeClass,
  };
}

interface PaymentRecord {
  id: string;
  amount: number;
  amount_1?: number;
  amount_2?: number;
  amount_3?: number;
  status: string;
  stage: string;
  rocket_account?: string;
  description: string;
  profile_id?: string;
  profile_label?: string;
  timestamp: number;
  datetime: string;
}

interface ActivityRecord {
  id: string;
  event_type: string;
  off_source?: string;
  profile_id: string;
  profile_label: string;
  title: string;
  details: string;
  amount?: number;
  status: 'success' | 'info' | 'warning' | 'error' | string;
  timestamp: number;
  datetime?: string;
  time_formatted?: string;
  metadata_json?: string;
}

interface ActiveProfile {
  id: string;
  profile_id: string;
  profile_label: string;
  last_event?: string;
  last_title?: string;
  last_seen: number;
  is_active: boolean;
}

// Profile color generator based on profile_id
const PROFILE_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-500' },
  { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800', dot: 'bg-purple-500' },
  { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
  { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-50 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800', dot: 'bg-cyan-500' },
  { bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800', dot: 'bg-indigo-500' },
  { bg: 'bg-teal-50 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800', dot: 'bg-teal-500' },
];

function getProfileColor(profileId: string) {
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) {
    hash = profileId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PROFILE_COLORS.length;
  return PROFILE_COLORS[index];
}

function formatRelativeTime(timestamp: number) {
  if (!timestamp) return '-';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 10) return 'এইমাত্র (Just now)';
  if (diffSec < 60) return `${diffSec}s আগে`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m আগে`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h আগে`;
  return `${Math.floor(diffHour / 24)}d আগে`;
}

// Format date and time in 12-hour AM/PM format
function formatDateTime12Hour(timestampOrStr?: number | string): { dateStr: string; timeStr: string; full12h: string } {
  if (!timestampOrStr) return { dateStr: '-', timeStr: '-', full12h: '-' };
  
  let date: Date | null = null;
  const strVal = String(timestampOrStr).trim();
  
  // 1. If it's a numeric timestamp (either number or string of digits e.g. "1789671305264")
  if (/^\d{9,16}$/.test(strVal) || (!isNaN(Number(strVal)) && !strVal.includes('-') && !strVal.includes(':'))) {
    const num = Number(strVal);
    date = new Date(num < 1e11 ? num * 1000 : num);
  } else if (strVal.includes('-') || strVal.includes(':') || strVal.includes('T')) {
    // 2. If it's a date string like "2026-09-18 00:55:05"
    const parts = strVal.split(' ');
    if (parts.length === 2 && parts[0].includes('-') && parts[1].includes(':')) {
      const [dPart, tPart] = parts;
      const [y, m, d] = dPart.split('-').map(Number);
      const [hh, mm, ss] = tPart.split(':').map(Number);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d) && !isNaN(hh) && !isNaN(mm)) {
        date = new Date(y, m - 1, d, hh, mm, ss || 0);
      }
    }
    if (!date || isNaN(date.getTime())) {
      date = new Date(strVal.replace(' ', 'T'));
    }
    if (isNaN(date.getTime())) {
      date = new Date(strVal);
    }
  } else {
    date = new Date(strVal);
  }
  
  if (!date || isNaN(date.getTime())) {
    return { dateStr: strVal, timeStr: '', full12h: strVal };
  }
  
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  const full12h = `${dateStr} ${timeStr}`;
  
  return { dateStr, timeStr, full12h };
}

// Keep-alive threshold: 3 minutes buffer (prevents background Chrome power throttling from flickering profiles)
const PROFILE_OFFLINE_THRESHOLD_MS = 180000;

// Helper for Event Icon & Badge
const getEventVisual = (act: ActivityRecord) => {
  const type = act.event_type || '';
  if (type === 'payment_success') {
    return {
      icon: <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      label: 'Payment Success'
    };
  }
  if (type === 'confirm_clicked') {
    return {
      icon: <CheckCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />,
      badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800',
      label: 'Confirm Clicked'
    };
  }
  if (type.includes('webfile_retry')) {
    return {
      icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      label: 'Webfile Retry'
    };
  }
  if (type.includes('webfile')) {
    return {
      icon: <FileUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      label: 'Webfile Upload'
    };
  }
  if (type.includes('login') || type.includes('otp')) {
    return {
      icon: <LogIn className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
      badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      label: 'Login & OTP'
    };
  }
  if (type.includes('gateway') || type.includes('payment') || type.includes('account') || type.includes('pin')) {
    return {
      icon: <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />,
      badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      label: 'Payment Flow'
    };
  }
  if (type === 'ext_enabled') {
    return {
      icon: <Power className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      label: 'Extension ON'
    };
  }
  if (type === 'ext_disabled' || type === 'ext_inactive' || type === 'manual_off' || type === 'ext_uninstalled') {
    return {
      icon: <Power className="h-4 w-4 text-rose-600 dark:text-rose-400" />,
      badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      label: 'Extension OFF'
    };
  }
  return {
    icon: <Activity className="h-4 w-4 text-slate-600 dark:text-slate-400" />,
    badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    label: 'Activity'
  };
};

// ===== TURSO DATABASE CLOUD VAULT VIEW =====

// ===== REUSABLE PERMANENT DELETE LICENSE WARNING MODAL =====
function DeleteLicenseModal({
  item,
  deleting,
  onCancel,
  onConfirm
}: {
  item: { key: string; clientName?: string };
  deleting: boolean;
  onCancel: () => void;
  onConfirm: (key: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/60 max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
          <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-xl border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              স্থায়ীভাবে মুছে ফেলার সতর্কতা
            </h3>
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              Permanent Delete Warning
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 font-mono">
          <div><span className="text-slate-500">License Key:</span> <strong className="text-slate-800 dark:text-slate-100">{item.key}</strong></div>
          {item.clientName && (
            <div><span className="text-slate-500">Client:</span> <strong className="text-slate-800 dark:text-slate-100">{item.clientName}</strong></div>
          )}
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-rose-50/60 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30">
          🚨 <strong>সাবধান:</strong> এই লাইসেন্সটি মুছে ফেললে <strong>Firebase</strong> এবং <strong>Turso</strong> ডাটাবেজ উভয় স্থান থেকেই এই কী-এর সমস্ত ডাটা (লাইসেন্স রেকর্ড, সমস্ত পেমেন্ট হিস্ট্রি এবং লাইভ অ্যাক্টিভিটি লগ) <strong>স্থায়ীভাবে সম্পূর্ণ মুছে যাবে</strong>। এটি আর কখনোই ফিরিয়ে আনা সম্ভব হবে না।
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => onConfirm(item.key)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {deleting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>মুছে ফেলা হচ্ছে...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>হ্যাঁ, সম্পূর্ণ ডিলিট করুন</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function TursoVaultView({ license, onBack }: {
  license: IvacLicense;
  onBack: () => void;
}) {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'activities' | 'payments'>('activities');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  // Safe Archive / Hide State (ডাটাবেজ অক্ষত রেখে ডিসপ্লে ফিল্টারিং)
  const [showHidden, setShowHidden] = useState(false);
  const [archiveConfirmProfile, setArchiveConfirmProfile] = useState<{ profileId: string; profileLabel: string } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archivedCutoffs, setArchivedCutoffs] = useState<Record<string, number>>(() => {
    try {
      const fromLic = (license as any)?.archived_cutoffs;
      if (fromLic && typeof fromLic === 'object') return fromLic;
      const local = localStorage.getItem(`ivac_archived_${license.key}`);
      return local ? JSON.parse(local) : {};
    } catch {
      return {};
    }
  });

  const handleConfirmArchive = async (profileId: string) => {
    setIsArchiving(true);
    const now = Date.now();
    let updated: Record<string, number>;
    if (profileId === 'all') {
      updated = { all: now };
    } else {
      updated = { ...archivedCutoffs, [profileId]: now };
    }
    setArchivedCutoffs(updated);
    try {
      localStorage.setItem(`ivac_archived_${license.key}`, JSON.stringify(updated));
      await updateDoc(doc(db, 'ivac_licenses', license.key), {
        archived_cutoffs: updated
      });
    } catch (e) {
      console.error('[Archive Error]', e);
    } finally {
      setIsArchiving(false);
      setArchiveConfirmProfile(null);
    }
  };

  const handleRestoreProfile = async (profileId: string) => {
    const updated = { ...archivedCutoffs };
    delete updated[profileId];
    if (profileId === 'all') {
      Object.keys(updated).forEach(k => delete updated[k]);
    }
    setArchivedCutoffs(updated);
    try {
      localStorage.setItem(`ivac_archived_${license.key}`, JSON.stringify(updated));
      await updateDoc(doc(db, 'ivac_licenses', license.key), {
        archived_cutoffs: updated
      });
    } catch (e) {
      console.error('[Restore Error]', e);
    }
  };

  const isItemArchived = (profileId: string, timestamp: any) => {
    const cutoff = Math.max(archivedCutoffs[profileId] || 0, archivedCutoffs['all'] || 0);
    const ts = Number(timestamp || 0);
    return cutoff > 0 && ts > 0 && ts <= cutoff;
  };

  const fetchTursoData = async () => {
    setIsRefreshing(true);
    setLoadingActivities(true);
    setLoadingPayments(true);

    try {
      const actBody = {
        requests: [
          {
            type: 'execute',
            stmt: {
              sql: 'SELECT id, license_key, profile_id, profile_label, event_type, off_source, title, details, amount, status, timestamp, datetime, time_formatted FROM activities WHERE license_key = ? ORDER BY timestamp DESC LIMIT 150',
              args: [{ type: 'text', value: license.key }]
            }
          },
          { type: 'close' }
        ]
      };

      const payBody = {
        requests: [
          {
            type: 'execute',
            stmt: {
              sql: 'SELECT id, license_key, profile_id, profile_label, amount, amount_1, amount_2, amount_3, status, stage, rocket_account, description, timestamp, datetime FROM payments WHERE license_key = ? ORDER BY timestamp DESC LIMIT 150',
              args: [{ type: 'text', value: license.key }]
            }
          },
          { type: 'close' }
        ]
      };

      const [actRes, payRes] = await Promise.all([
        fetch('/api/turso-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(actBody)
        }),
        fetch('/api/turso-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payBody)
        })
      ]);

      if (actRes.ok) {
        const actJson = await actRes.json();
        const actResult = actJson.results?.[0]?.response?.result;
        if (actResult && Array.isArray(actResult.rows)) {
          const cols: string[] = actResult.cols?.map((c: any) => c.name) || [];
          const records: ActivityRecord[] = actResult.rows.map((row: any[]) => {
            const obj: any = {};
            cols.forEach((col, idx) => {
              obj[col] = row[idx]?.value !== undefined ? row[idx].value : null;
            });
            return obj as ActivityRecord;
          });
          setActivities(records);
        }
      }

      if (payRes.ok) {
        const payJson = await payRes.json();
        const payResult = payJson.results?.[0]?.response?.result;
        if (payResult && Array.isArray(payResult.rows)) {
          const cols: string[] = payResult.cols?.map((c: any) => c.name) || [];
          const records: PaymentRecord[] = payResult.rows.map((row: any[]) => {
            const obj: any = {};
            cols.forEach((col, idx) => {
              obj[col] = row[idx]?.value !== undefined ? row[idx].value : null;
            });
            return obj as PaymentRecord;
          });
          setPayments(records);
        }
      }
      setLastRefreshedAt(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    } catch (err) {
      console.error('[Turso Vault Fetch Error]', err);
    } finally {
      setLoadingActivities(false);
      setLoadingPayments(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTursoData();
  }, [license.key]);

  // Live MQTT listener while in Turso Vault view
  useEffect(() => {
    let client: mqtt.MqttClient | null = null;
    try {
      client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
        clientId: `vault_live_${Math.random().toString(16).slice(2, 8)}`,
        connectTimeout: 5000,
      });
      client.on('connect', () => {
        client?.subscribe(`ivac_live_${license.key}`);
      });
      client.on('message', (topic: string, message: any) => {
        try {
          const data = JSON.parse(message.toString());
          if (data && data.type === 'activity_event') {
            setActivities((prev: ActivityRecord[]) => {
              if (prev.some((a: ActivityRecord) => a.id === data.id)) return prev;
              return [data as ActivityRecord, ...prev];
            });
          }
        } catch (e) {}
      });
    } catch (e) {}

    return () => {
      if (client) client.end();
    };
  }, [license.key]);

  // Filtered Activities (Respecting Archive/Hide Cutoff)
  const filteredActivities = activities.filter((act: ActivityRecord) => {
    if (selectedProfile !== 'all' && act.profile_id !== selectedProfile) return false;
    if (!showHidden && isItemArchived(act.profile_id, act.timestamp)) return false;
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'status') return act.event_type.includes('ext_') || act.event_type.includes('status') || act.event_type.includes('off');
    if (selectedCategory === 'payment') return act.event_type.includes('payment') || act.event_type.includes('pay');
    if (selectedCategory === 'webfile') return act.event_type.includes('webfile') || act.event_type.includes('confirm');
    if (selectedCategory === 'login') return act.event_type.includes('login') || act.event_type.includes('otp');
    return true;
  });

  // Filtered Payments (Respecting Archive/Hide Cutoff)
  const filteredPayments = payments.filter((p: PaymentRecord) => {
    if (selectedProfile !== 'all' && p.profile_id !== selectedProfile) return false;
    if (!showHidden && isItemArchived(p.profile_id, Number(p.timestamp || 0))) return false;
    return true;
  });

  // Distinct profiles for profile-wise selector:
  // Shows only profiles that have visible/active records (timestamp > cutoff) UNLESS showHidden is true.
  // When a hidden profile gets a new activity, it automatically reappears!
  const distinctProfiles = useMemo(() => {
    const map = new Map<string, string>();
    const actList = showHidden ? activities : activities.filter(a => !isItemArchived(a.profile_id, a.timestamp));
    const payList = showHidden ? payments : payments.filter(p => !isItemArchived(p.profile_id, Number(p.timestamp || 0)));

    actList.forEach((a: ActivityRecord) => {
      if (a.profile_id) map.set(a.profile_id, a.profile_label || `Profile ${a.profile_id}`);
    });
    payList.forEach((p: PaymentRecord) => {
      if (p.profile_id) map.set(p.profile_id, p.profile_label || `Profile ${p.profile_id}`);
    });
    return Array.from(map.entries());
  }, [activities, payments, archivedCutoffs, showHidden]);

  // Auto-reset selectedProfile if that profile is now archived/hidden
  useEffect(() => {
    if (selectedProfile !== 'all' && !showHidden) {
      const exists = distinctProfiles.some(([id]) => id === selectedProfile);
      if (!exists) {
        setSelectedProfile('all');
      }
    }
  }, [distinctProfiles, selectedProfile, showHidden]);

  const hiddenActivitiesCount = activities.filter(a => (selectedProfile === 'all' || a.profile_id === selectedProfile) && isItemArchived(a.profile_id, a.timestamp)).length;
  const hiddenPaymentsCount = payments.filter(p => (selectedProfile === 'all' || p.profile_id === selectedProfile) && isItemArchived(p.profile_id, Number(p.timestamp || 0))).length;
  const totalHiddenCount = activeTab === 'activities' ? hiddenActivitiesCount : hiddenPaymentsCount;
  const isProfileArchived = Boolean(archivedCutoffs[selectedProfile] || (selectedProfile === 'all' && Object.keys(archivedCutoffs).length > 0));

  const totalPaymentsAmount = filteredPayments.reduce((sum: number, p: PaymentRecord) => p.status === 'success' ? sum + (p.amount || 0) : sum, 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Big Reload Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back to License
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                <Database className="h-4 w-4" />
              </span>
              <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Turso Database Cloud Vault
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                libSQL Edge
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {license.client_name || license.key} — ফায়ারবেস ডাউন থাকলেও সমস্ত হিস্ট্রি ও ডাটা তুরসোতে সংরক্ষিত
            </p>
          </div>
        </div>

        {/* BIG RELOAD BUTTON */}
        <div className="flex items-center gap-2">
          {lastRefreshedAt && (
            <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
              শেষ রিফ্রেশ: {lastRefreshedAt}
            </span>
          )}
          <button
            onClick={fetchTursoData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>ভোল্ট ডাটা রিফ্রেশ করুন (Reload Data)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-100 dark:border-emerald-900/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">অ্যাক্টিভিটি রেকর্ড (Turso)</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                {showHidden ? activities.length : filteredActivities.length}
                {hiddenActivitiesCount > 0 && !showHidden && (
                  <span className="text-xs font-normal text-amber-600 dark:text-amber-400 ml-1.5">
                    ({hiddenActivitiesCount} লুকানো)
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">ম্যানুয়াল অফ ও টাইমলাইন</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-100 dark:border-purple-900/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">পেমেন্ট রেকর্ড (Turso)</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                {showHidden ? payments.length : filteredPayments.length}
                {hiddenPaymentsCount > 0 && !showHidden && (
                  <span className="text-xs font-normal text-amber-600 dark:text-amber-400 ml-1.5">
                    ({hiddenPaymentsCount} লুকানো)
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5 font-medium">Dual-Cloud Backup</p>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 dark:border-blue-900/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">মোট সফল পেমেন্ট (৳)</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 font-mono">
                {'৳'}{totalPaymentsAmount.toLocaleString()}
              </h3>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 font-medium">Turso ডাটাবেজ হিসাব</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-teal-100 dark:border-teal-900/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">ডাটাবেজ স্ট্যাটাস</p>
              <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Edge Live (0 Quota Spike)
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">aws-ap-south-1 (Mumbai)</p>
            </div>
            <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
              <Server className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="p-4 border-b dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Tab Switcher: Activities vs Payments */}
            <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-700/60 p-1 rounded-xl w-fit">
              <button
                onClick={() => setActiveTab('activities')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'activities'
                    ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                লাইভ অ্যাক্টিভিটি ও অফ লগ ({showHidden ? activities.length : filteredActivities.length})
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'payments'
                    ? 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                পেমেন্ট হিস্ট্রি - Turso Backup ({showHidden ? payments.length : filteredPayments.length})
              </button>
            </div>

            {/* Profile Selector (Profile অনুযায়ী দেখা) */}
            <div className="flex items-center flex-wrap gap-2">
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[11px] font-semibold text-slate-500">প্রোফাইল:</span>
                <select
                  value={selectedProfile}
                  onChange={(e: any) => setSelectedProfile(e.target.value)}
                  className="bg-transparent text-slate-800 dark:text-slate-200 font-bold outline-none cursor-pointer text-xs"
                >
                  <option value="all">সব প্রোফাইল (All Profiles)</option>
                  {distinctProfiles.map(([pId, pLabel]: [string, string]) => (
                    <option key={pId} value={pId}>{pLabel}</option>
                  ))}
                </select>
              </div>

              {activeTab === 'activities' && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${selectedCategory === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedCategory('status')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${selectedCategory === 'status' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs' : 'text-slate-500'}`}
                  >
                    ⚙️ On/Off
                  </button>
                  <button
                    onClick={() => setSelectedCategory('payment')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${selectedCategory === 'payment' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-slate-500'}`}
                  >
                    💳 Payment
                  </button>
                  <button
                    onClick={() => setSelectedCategory('webfile')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${selectedCategory === 'webfile' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500'}`}
                  >
                    📄 Webfile
                  </button>
                  <button
                    onClick={() => setSelectedCategory('login')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${selectedCategory === 'login' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500'}`}
                  >
                    🔑 Login
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Profile Quick Pill Filter Bar (প্রোফাইল ক্লিক বার) */}
          {distinctProfiles.length > 0 ? (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-0.5 no-scrollbar">
              <button
                onClick={() => setSelectedProfile('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedProfile === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                সব প্রোফাইল ({distinctProfiles.length})
              </button>
              {distinctProfiles.map(([pId, pLabel]: [string, string]) => {
                const color = getProfileColor(pId);
                const isSelected = selectedProfile === pId;
                return (
                  <button
                    key={pId}
                    onClick={() => setSelectedProfile(pId)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer ${
                      isSelected
                        ? `${color.bg} ${color.text} ring-2 ring-indigo-500 border-indigo-400`
                        : `${color.bg} ${color.text} ${color.border} opacity-80 hover:opacity-100`
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`}></span>
                    {pLabel}
                  </button>
                );
              })}
            </div>
          ) : (
            !showHidden && (hiddenActivitiesCount > 0 || hiddenPaymentsCount > 0) && (
              <div className="flex items-center justify-between gap-2 py-2 px-3 mt-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span>পূর্বের সব প্রোফাইল ও ডাটা লুকানো রয়েছে। কোনো প্রোফাইলে নতুন অ্যাক্টিভিটি হলে তা স্বয়ংক্রিয়ভাবে এখানে শো হবে।</span>
                </div>
                <button
                  onClick={() => setShowHidden(true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-200/80 dark:bg-amber-900/60 hover:bg-amber-300 text-amber-900 dark:text-amber-100 font-bold whitespace-nowrap cursor-pointer transition-colors"
                >
                  লুকানো প্রোফাইল দেখুন
                </button>
              </div>
            )
          )}

          {/* Archive / Hide Bar & Controls (স্পষ্ট দৃশ্যমান হাইড ও রিস্টোর বাটন বার) */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-3 mt-2 border-t border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  const label = selectedProfile === 'all'
                    ? 'সব প্রোফাইল (All Profiles)'
                    : (distinctProfiles.find(([id]: [string, string]) => id === selectedProfile)?.[1] || `Profile (${selectedProfile})`);
                  setArchiveConfirmProfile({ profileId: selectedProfile, profileLabel: label });
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700/80 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-xs font-bold shadow-xs transition-colors cursor-pointer"
                title="এই প্রোফাইলের পুরানো তথ্য স্ক্রিন থেকে হাইড করুন (ডাটাবেজ নিরাপদ থাকবে)"
              >
                <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>{selectedProfile === 'all' ? '🧹 সব পুরানো ডাটা লুকান (Hide All)' : '🧹 এই প্রোফাইলের ডাটা লুকান'}</span>
              </button>

              {isProfileArchived && (
                <button
                  onClick={() => handleRestoreProfile(selectedProfile)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  title="লুকানো তথ্য পুনরায় আনহাইড/রিস্টোর করুন"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>রিস্টোর / আনহাইড করুন</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHidden(!showHidden)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-xs transition-all cursor-pointer ${
                  showHidden
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="লুকানো/আর্কাইভ ডাটা দেখানো বা বন্ধ করার সুইচ"
              >
                {showHidden ? <EyeOff className="h-3.5 w-3.5 text-indigo-600" /> : <Eye className="h-3.5 w-3.5 text-slate-400" />}
                <span>{showHidden ? 'লুকানো ডাটা বন্ধ' : 'লুকানো ডাটা দেখান'}</span>
                {totalHiddenCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    showHidden ? 'bg-indigo-200 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                  }`}>
                    {totalHiddenCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {activeTab === 'activities' ? (
            /* ===== ACTIVITIES TABLE ===== */
            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3">Chrome Profile</th>
                    <th className="px-4 py-3">Step / Event</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800 text-sm">
                  {loadingActivities ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-500">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-500" />
                        Turso ডাটাবেজ থেকে অ্যাক্টিভিটি লোড হচ্ছে...
                      </td>
                    </tr>
                  ) : filteredActivities.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        কোনো অ্যাক্টিভিটি পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredActivities.map((act: ActivityRecord) => {
                      const profColor = getProfileColor(act.profile_id);
                      const visual = getEventVisual(act);
                      return (
                        <tr
                          key={act.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Time */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">
                              {formatDateTime12Hour(act.datetime || act.timestamp).full12h}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {formatRelativeTime(act.timestamp)}
                            </div>
                          </td>

                          {/* Profile Badge */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${profColor.bg} ${profColor.text} ${profColor.border}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${profColor.dot}`}></span>
                              {act.profile_label || `Profile #${act.profile_id.slice(-4)}`}
                            </span>
                          </td>

                          {/* Event / Step */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`p-1.5 rounded-lg border flex items-center justify-center ${visual.badge}`}>
                                {visual.icon}
                              </span>
                              <div>
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {act.title}
                                </div>
                                                                {act.off_source && (
                                  <span className={`inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                    act.event_type === 'ext_enabled'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                                  }`}>
                                    {act.event_type === 'ext_enabled'
                                      ? (act.off_source === 'popup' ? 'পপআপ থেকে অন (Popup)' : 'chrome://extensions থেকে অন')
                                      : (act.off_source === 'popup'
                                          ? 'পপআপ থেকে অফ (Popup)'
                                          : act.off_source === 'manage_extensions_page'
                                          ? 'chrome://extensions থেকে অফ'
                                          : act.off_source === 'uninstalled'
                                          ? 'এক্সটেনশন আনইনস্টল/রিমুভ'
                                          : act.off_source)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Details */}
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            <div className="line-clamp-2 text-xs font-medium">
                              {act.details || '-'}
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {act.amount && act.amount > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
                                {'৳'}{act.amount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* ===== TURSO PAYMENTS TABLE ===== */
            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3">Chrome Profile</th>
                    <th className="px-4 py-3">Amounts</th>
                    <th className="px-4 py-3">Stage / Gateway</th>
                    <th className="px-4 py-3">Account No.</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800 text-sm">
                  {loadingPayments ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-500">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-purple-500" />
                        Turso ডাটাবেজ থেকে পেমেন্ট হিস্ট্রি লোড হচ্ছে...
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Turso ডাটাবেজে কোনো পেমেন্ট পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((pay: PaymentRecord) => {
                      const profColor = getProfileColor(pay.profile_id || 'default');
                      return (
                        <tr
                          key={pay.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <div className="font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">
                                {formatDateTime12Hour(pay.datetime || pay.timestamp).full12h}
                              </div>
                              {isItemArchived(pay.profile_id, Number(pay.timestamp || 0)) && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  আর্কাইভ
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {formatRelativeTime(pay.timestamp)}
                            </div>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${profColor.bg} ${profColor.text} ${profColor.border}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${profColor.dot}`}></span>
                              {pay.profile_label || (pay.profile_id ? `Profile #${pay.profile_id.slice(-4)}` : 'Profile')}
                            </span>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-xs">
                            <div className="flex flex-col gap-1 py-0.5">
                              <div className="flex items-center justify-between gap-2 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80">
                                <span className="text-[10px] font-bold text-slate-400">Amount 1:</span>
                                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                                  {pay.amount_1 && pay.amount_1 > 0 ? `৳${pay.amount_1.toLocaleString()}` : '-'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80">
                                <span className="text-[10px] font-bold text-slate-400">Amount 2:</span>
                                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                                  {pay.amount_2 && pay.amount_2 > 0 ? `৳${pay.amount_2.toLocaleString()}` : '-'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-800/50">
                                <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">Amount 3:</span>
                                <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                                  {(pay.amount_3 && pay.amount_3 > 0 ? pay.amount_3 : pay.amount) ? `৳${((pay.amount_3 && pay.amount_3 > 0) ? pay.amount_3 : pay.amount || 0).toLocaleString()}` : '-'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {pay.stage || 'Rocket'}
                            </span>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-600 dark:text-slate-300">
                            {pay.rocket_account || '—'}
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              pay.status === 'success'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : pay.status === 'failed'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            }`}>
                              {pay.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== ARCHIVE CONFIRMATION MODAL ===== */}
      {archiveConfirmProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-900/60 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="p-3 bg-amber-100 dark:bg-amber-950/60 rounded-xl border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  সাবধান / সতর্কতা: তথ্য লুকানো (Archive)
                </h3>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Hide / Archive Old Records
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono">
              <span className="text-slate-500">টার্গেট প্রোফাইল:</span>{' '}
              <strong className="text-slate-800 dark:text-slate-100">{archiveConfirmProfile.profileLabel}</strong>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>ডাটাবেজ শতভাগ নিরাপদ:</strong> ডাটাবেজ (Turso বা Firebase) থেকে কোনো ডাটা মুছে যাবে না। সমস্ত হিস্ট্রি নিরাপদে সংরক্ষিত থাকবে।
                </span>
              </div>
              <p>
                এই প্রোফাইলের বর্তমান সব পেমেন্ট এবং লাইভ অ্যাক্টিভিটি স্ক্রিন থেকে সাময়িক হাইড করা হবে। আপনি যেকোনো সময় <strong>'লুকানো ডাটা দেখান'</strong> অপশন চালু করে পুনরায় দেখতে পারবেন অথবা <strong>'রিস্টোর'</strong> বাটনে ক্লিক করে ফিরিয়ে আনতে পারবেন।
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isArchiving}
                onClick={() => setArchiveConfirmProfile(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isArchiving}
                onClick={() => handleConfirmArchive(archiveConfirmProfile.profileId)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isArchiving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>হাইড করা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Archive className="h-3.5 w-3.5" />
                    <span>হ্যাঁ, হাইড / আর্কাইভ করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== PROFILE VIEW (একজনের একটাই পেজ — সবকিছু এখান থেকে) =====
function ProfileView({ license, onBack, onBlockKey, onDeleteKey }: {
  license: IvacLicense;
  onBack: () => void;
  onBlockKey: (key: string, status: string) => void;
  onDeleteKey: (key: string) => void;
}) {
  const [showTursoVault, setShowTursoVault] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  // Connected Profiles (MQTT Live Tunnel)
  const [activeProfiles, setActiveProfiles] = useState<ActiveProfile[]>([]);

  // Client info editing
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(license.client_name || '');
  const [editPhone, setEditPhone] = useState(license.client_phone || '');
  const [editDescription, setEditDescription] = useState(license.client_description || '');
  const [saving, setSaving] = useState(false);

  // Duration extend
  const [showExtend, setShowExtend] = useState(false);
  const [extendDays, setExtendDays] = useState('30');
  const [extending, setExtending] = useState(false);

  // Copy key feedback
  const [copied, setCopied] = useState(false);

  // 1. Payments Listener (With Smart Auto-Deduplication & Ghost Burst Cleanup)
  useEffect(() => {
    const q = query(collection(db, `ivac_licenses/${license.key}/payments`));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const rawData: any[] = [];
      snapshot.forEach((docSnap: any) => rawData.push({ id: docSnap.id, ref: docSnap.ref, ...docSnap.data() }));
      rawData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      const uniqueData: PaymentRecord[] = [];
      const seenSignatures = new Set<string>();
      const duplicatesToDelete: any[] = [];

      for (const item of rawData) {
        const timeBucket15s = Math.floor((item.timestamp || 0) / 15000);
        const sig = `${item.profile_id || ''}_${(item.rocket_account || '').replace(/[^0-9]/g, '')}_${item.amount || 0}_${timeBucket15s}`;

        if (seenSignatures.has(sig)) {
          duplicatesToDelete.push(item);
        } else {
          seenSignatures.add(sig);
          uniqueData.push(item as PaymentRecord);
        }
      }

      if (duplicatesToDelete.length > 0) {
        duplicatesToDelete.forEach(async (dup) => {
          try {
            await deleteDoc(dup.ref);
            console.log(`[IVAC Auto-Cleanup] Purged duplicate Firestore payment doc: ${dup.id}`);
          } catch (e) {
            console.warn('Failed to purge duplicate doc:', e);
          }
        });

        try {
          const extraCount = duplicatesToDelete.length;
          const extraAmount = duplicatesToDelete.reduce((sum, d) => sum + (d.amount || 0), 0);
          const licenseRef = doc(db, 'ivac_licenses', license.key);
          updateDoc(licenseRef, {
            payment_count: Math.max(1, (license.payment_count || 1) - extraCount),
            total_amount: Math.max(0, (license.total_amount || 0) - extraAmount)
          }).catch(() => {});
        } catch (e) {}
      }

      setPayments(uniqueData);
      setLoadingPayments(false);
    });
    return () => unsubscribe();
  }, [license.key]);

  // 2. Real-time Live Connected Chrome Profiles (MQTT Live Tunnel - 0 Firebase Writes & Reads!)
  useEffect(() => {
    let client: mqtt.MqttClient | null = null;
    try {
      client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
        clientId: `dash_presence_${Math.random().toString(16).slice(2, 8)}`,
        connectTimeout: 5000,
      });
      client.on('connect', () => {
        client?.subscribe(`ivac_live_${license.key}`);
      });
      client.on('message', (topic: string, message: any) => {
        try {
          const data = JSON.parse(message.toString());
          if (data && data.profile_id) {
            const now = Date.now();
            setActiveProfiles((prev: ActiveProfile[]) => {
              const existingIdx = prev.findIndex((p: ActiveProfile) => p.profile_id === data.profile_id);
              const existing = existingIdx >= 0 ? prev[existingIdx] : null;

              if (data.is_active === false) {
                // Only remove if explicitly disabled by user ('বন্ধ'/'Off') or if heartbeat hasn't been received in > 120s
                // This prevents background Chrome power throttling from falsely dropping active profiles!
                const isExplicitOff = data.last_title?.includes('বন্ধ') || data.last_title?.includes('Off') || data.last_title?.includes('Disabled');
                if (existing && !isExplicitOff && (now - existing.last_seen < 120000)) {
                  return prev;
                }
                return prev.filter((p: ActiveProfile) => p.profile_id !== data.profile_id);
              }

              // Prefer phone label over generic fallback
              const bestLabel = (data.profile_label && data.profile_label.includes('('))
                ? data.profile_label
                : (existing?.profile_label && existing.profile_label.includes('('))
                  ? existing.profile_label
                  : (data.profile_label || `Profile ${data.profile_id}`);

              const updatedProfile: ActiveProfile = {
                id: data.profile_id,
                profile_id: data.profile_id,
                profile_label: bestLabel,
                last_title: data.last_title || 'Active',
                last_seen: data.last_seen || now,
                is_active: true,
              };
              let nextList: ActiveProfile[];
              if (existingIdx >= 0) {
                nextList = [...prev];
                nextList[existingIdx] = updatedProfile;
              } else {
                nextList = [...prev, updatedProfile];
              }
              return nextList.filter((p: ActiveProfile) => p.is_active && (now - p.last_seen < PROFILE_OFFLINE_THRESHOLD_MS)).sort((a, b) => {
                const labelA = a.profile_label || a.profile_id || '';
                const labelB = b.profile_label || b.profile_id || '';
                return labelA.localeCompare(labelB);
              });
            });
          }
        } catch (e) {
          console.error("Live profile parse error:", e);
        }
      });
    } catch (err) {
      console.warn("MQTT Live Tunnel connection error:", err);
    }

    // Auto-cleanup: If no heartbeat received for > 2 min, remove profile from UI (Offline profiles never saved)
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setActiveProfiles((prev: ActiveProfile[]) => prev.filter((p: ActiveProfile) => p.is_active && (now - p.last_seen < PROFILE_OFFLINE_THRESHOLD_MS)));
    }, 3000);

    return () => {
      clearInterval(cleanupInterval);
      if (client) {
        client.end();
      }
    };
  }, [license.key]);

  // Sync form fields when license prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditName(license.client_name || '');
      setEditPhone(license.client_phone || '');
      setEditDescription(license.client_description || '');
    }
  }, [license, isEditing]);

  // Safe Archive / Hide State for Firebase Data (ডাটাবেজ অক্ষত রেখে ডিসপ্লে ফিল্টারিং)
  const [showHidden, setShowHidden] = useState(false);
  const [isHideConfirmOpen, setIsHideConfirmOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archivedCutoffs, setArchivedCutoffs] = useState<Record<string, number>>(() => {
    try {
      const fromLic = (license as any)?.archived_cutoffs;
      if (fromLic && typeof fromLic === 'object') return fromLic;
      const local = localStorage.getItem(`ivac_archived_${license.key}`);
      return local ? JSON.parse(local) : {};
    } catch {
      return {};
    }
  });

  // Keep archivedCutoffs in sync if license updates
  useEffect(() => {
    try {
      const fromLic = (license as any)?.archived_cutoffs;
      if (fromLic && typeof fromLic === 'object') {
        setArchivedCutoffs(fromLic);
      }
    } catch (e) {}
  }, [license]);

  const isPaymentArchived = (profileId: string, timestamp: number) => {
    const cutoff = archivedCutoffs[profileId] || (archivedCutoffs['all'] || 0);
    return cutoff > 0 && timestamp <= cutoff;
  };

  const handleConfirmArchiveAll = async () => {
    setIsArchiving(true);
    const now = Date.now();
    const updated = { ...archivedCutoffs, all: now };
    setArchivedCutoffs(updated);
    try {
      localStorage.setItem(`ivac_archived_${license.key}`, JSON.stringify(updated));
      await updateDoc(doc(db, 'ivac_licenses', license.key), {
        archived_cutoffs: updated
      });
    } catch (e) {
      console.error('[Archive Error]', e);
    } finally {
      setIsArchiving(false);
      setIsHideConfirmOpen(false);
    }
  };

  const handleRestoreAll = async () => {
    setArchivedCutoffs({});
    try {
      localStorage.removeItem(`ivac_archived_${license.key}`);
      await updateDoc(doc(db, 'ivac_licenses', license.key), {
        archived_cutoffs: {}
      });
    } catch (e) {
      console.error('[Restore Error]', e);
    }
  };

  const isArchived = Boolean(archivedCutoffs['all'] || Object.keys(archivedCutoffs).length > 0);

  const filteredPayments = payments.filter((p: PaymentRecord) => {
    if (!showHidden && isPaymentArchived(p.profile_id || 'default', Number(p.timestamp || 0))) return false;
    return true;
  });

  const hiddenPaymentsCount = payments.filter((p: PaymentRecord) => isPaymentArchived(p.profile_id || 'default', Number(p.timestamp || 0))).length;

  const totalAmount = filteredPayments.reduce((sum: number, p: PaymentRecord) => p.status === 'success' ? sum + (p.amount || 0) : sum, 0);
  const successCount = filteredPayments.filter((p: PaymentRecord) => p.status === 'success').length;

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'ivac_licenses', license.key), {
        client_name: editName.trim(),
        client_phone: editPhone.trim(),
        client_description: editDescription.trim(),
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Error saving profile!");
    }
    setSaving(false);
  };

  const handleExtendDuration = async () => {
    const days = parseInt(extendDays);
    if (isNaN(days) || days <= 0) {
      alert("দয়া করে সঠিক দিন সংখ্যা লিখুন");
      return;
    }
    setExtending(true);
    try {
      const rawDays = Number(license.duration_days) || (license.duration_months ? Number(license.duration_months) * 30 : 0);
      const currentDays = isNaN(rawDays) ? 0 : rawDays;
      const newTotalDays = currentDays + days;
      await updateDoc(doc(db, 'ivac_licenses', license.key), {
        duration_days: newTotalDays,
        duration_months: null,
      });
      publishLicenseKillSwitch(license.key, 'unblock', { ...license, duration_days: newTotalDays });
      setShowExtend(false);
      setExtendDays('30');
    } catch (error) {
      console.error("Error extending duration:", error);
      alert("Error extending duration!");
    }
    setExtending(false);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(license.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const expiry = getLicenseExpiryInfo(license);
  const durationText = `${expiry.totalDays} Days`;

  // Dedicated Turso Database Vault View
  if (showTursoVault) {
    return <TursoVaultView license={license} onBack={() => setShowTursoVault(false)} />;
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-medium">
          <ArrowLeft className="h-5 w-5" /> Back to Licenses
        </button>
      </div>

      {/* ===== CLIENT PROFILE CARD ===== */}
      <Card className="border-2 border-indigo-100 dark:border-indigo-900/30">
        <CardHeader className="pb-3 border-b dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                {(license.client_name || license.key)?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  {license.client_name || <span className="text-slate-400 italic">নাম দেওয়া হয়নি</span>}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-sm text-slate-500">{license.key}</span>
                  <button onClick={handleCopyKey} className="text-slate-400 hover:text-indigo-500 transition-colors" title="Copy Key">
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTursoVault(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg transition-all font-semibold text-xs shadow-sm hover:shadow cursor-pointer"
                title="Turso Database Vault"
              >
                <Database className="h-4 w-4" />
                <span>Turso Database</span>
              </button>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors font-medium text-sm"
                >
                  <Edit3 className="h-4 w-4" /> Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setIsEditing(false); setEditName(license.client_name || ''); setEditPhone(license.client_phone || ''); setEditDescription(license.client_description || ''); }}
                    className="px-4 py-2 text-slate-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  <User className="h-3.5 w-3.5 inline mr-1" /> ক্লায়েন্টের নাম
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="নাম লিখুন..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  <Phone className="h-3.5 w-3.5 inline mr-1" /> ফোন নম্বর
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="ফোন নম্বর লিখুন..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  <FileText className="h-3.5 w-3.5 inline mr-1" /> বিবরণ / নোট
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="এই ক্লায়েন্ট সম্পর্কে নোট লিখুন..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">ফোন</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{license.client_phone || <span className="text-slate-400">—</span>}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">বিবরণ</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{license.client_description || <span className="text-slate-400">কোনো বিবরণ দেওয়া হয়নি</span>}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== LICENSE STATUS + STATS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Status</p>
            {license.status === 'blocked' ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-red-600 dark:text-red-400">
                <ShieldBan className="h-4 w-4" /> Blocked
              </span>
            ) : license.hwid ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" /> Unused
              </span>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-900 border border-blue-100 dark:border-blue-900/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration & Validity</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${expiry.remainingBadgeClass}`}>
                {expiry.remainingText}
              </span>
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-white">
              {expiry.totalDays} Days
            </p>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <span>
                {expiry.isBound ? (
                  <>মেয়াদ শেষ: <strong className="font-semibold text-slate-800 dark:text-slate-100">{expiry.expiryBangla}</strong></>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">প্রথম ব্যবহারে মেয়াদ শুরু হবে</span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Payments</p>
              {hiddenPaymentsCount > 0 && !showHidden && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  {hiddenPaymentsCount} লুকানো
                </span>
              )}
            </div>
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{successCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Revenue</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{'৳'}{totalAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* ===== ACTION BUTTONS ===== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Turso Database Vault */}
            <button
              onClick={() => setShowTursoVault(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors font-semibold text-sm border border-emerald-200 dark:border-emerald-800 shadow-xs cursor-pointer"
            >
              <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Turso Database
            </button>

            {/* Extend Duration */}
            {!showExtend ? (
              <button
                onClick={() => setShowExtend(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-medium text-sm border border-blue-200 dark:border-blue-800"
              >
                <CalendarPlus className="h-4 w-4" /> মেয়াদ বাড়ান
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
                <input
                  type="number"
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  className="w-20 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none"
                  min="1"
                />
                <span className="text-sm text-slate-500">দিন</span>
                <button
                  onClick={handleExtendDuration}
                  disabled={extending}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {extending ? '...' : '✓ Add'}
                </button>
                <button
                  onClick={() => { setShowExtend(false); setExtendDays('30'); }}
                  className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-sm"
                >
                  {'✕'}
                </button>
              </div>
            )}

            {/* Block/Unblock */}
            <button
              onClick={() => onBlockKey(license.key, license.status)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm border transition-colors ${
                license.status === 'active'
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40'
                  : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
              }`}
            >
              <ShieldBan className="h-4 w-4" />
              {license.status === 'active' ? 'Block করুন' : 'Unblock করুন'}
            </button>

            {/* Reset HWID */}
            {license.hwid && (
              <button
                onClick={async () => {
                  if (!window.confirm("HWID রিসেট করলে ক্লায়েন্টকে নতুন করে activate করতে হবে। আপনি কি নিশ্চিত?")) return;
                  try {
                    await updateDoc(doc(db, 'ivac_licenses', license.key), { hwid: null });
                  } catch (e) { console.error(e); }
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors font-medium text-sm border border-amber-200 dark:border-amber-800"
              >
                <RefreshCw className="h-4 w-4" /> HWID Reset
              </button>
            )}

            {/* Safe Archive / Hide Data Button */}
            <button
              onClick={() => setIsHideConfirmOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors font-medium text-sm border border-amber-200 dark:border-amber-800 cursor-pointer"
              title="বর্তমান সব পুরানো তথ্য হাইড / আর্কাইভ করুন"
            >
              <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>ডাটা লুকান / আর্কাইভ</span>
            </button>

            {/* Restore Button */}
            {isArchived && (
              <button
                onClick={handleRestoreAll}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors font-medium text-sm border border-teal-200 dark:border-teal-800 cursor-pointer"
                title="লুকানো তথ্য পুনরায় আনহাইড/রিস্টোর করুন"
              >
                <RotateCcw className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <span>রিস্টোর / আনহাইড</span>
              </button>
            )}

            {/* Delete */}
            <button
              onClick={() => onDeleteKey(license.key)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium text-sm border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>

          {/* HWID & Activation / Expiry Info */}
          {license.hwid && (
            <div className="mt-3 pt-3 border-t dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600 dark:text-slate-400">HWID:</span>
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">{license.hwid}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {license.bound_at && (
                  <span>
                    🟢 অ্যাক্টিভেশন: <strong className="text-slate-700 dark:text-slate-300">{new Date(typeof license.bound_at === 'string' ? parseInt(license.bound_at, 10) : license.bound_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</strong>
                  </span>
                )}
                {expiry.isBound && (
                  <span>
                    ⏰ মেয়াদ সমাপ্তি: <strong className={expiry.isExpired ? 'text-rose-500' : 'text-slate-700 dark:text-slate-200'}>{expiry.expiryFormatted}</strong> ({expiry.remainingText})
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== CONNECTED CHROME PROFILES (LIVE STATUS) ===== */}
      <Card className="border-indigo-100 dark:border-indigo-900/30 overflow-hidden shadow-sm">
        <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b dark:border-slate-800 py-3.5 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                <Chrome className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Connected Chrome Profiles
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  গ্রাহকের সক্রিয় ও সাম্প্রতিক ব্রাউজার প্রোফাইলসমূহ
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {activeProfiles.filter(p => {
                  if (!showHidden && (archivedCutoffs['all'] || 0) > 0 && (p.last_seen || 0) <= (archivedCutoffs['all'] || 0)) return false;
                  return p.is_active && (Date.now() - p.last_seen < PROFILE_OFFLINE_THRESHOLD_MS);
                }).length} Online
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {activeProfiles.filter(p => {
            if (!showHidden && (archivedCutoffs['all'] || 0) > 0 && (p.last_seen || 0) <= (archivedCutoffs['all'] || 0)) return false;
            return p.is_active && (Date.now() - p.last_seen < PROFILE_OFFLINE_THRESHOLD_MS);
          }).length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              <Chrome className="h-8 w-8 mx-auto mb-2 opacity-40" />
              বর্তমানে কোনো সক্রিয় Chrome Profile নেই। গ্রাহক ব্রাউজারে এক্সটেনশন চালু করলে এখানে লাইভ ভেসে উঠবে (লুকানো থাকলে নতুন অ্যাক্টিভিটিতে আবার দেখাবে)।
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeProfiles.filter(p => {
                if (!showHidden && (archivedCutoffs['all'] || 0) > 0 && (p.last_seen || 0) <= (archivedCutoffs['all'] || 0)) return false;
                return p.is_active && (Date.now() - p.last_seen < PROFILE_OFFLINE_THRESHOLD_MS);
              }).map(prof => {
                const color = getProfileColor(prof.profile_id);
                const isRecent = (Date.now() - prof.last_seen) < 90000;
                return (
                  <div
                    key={prof.id || prof.profile_id}
                    className={`p-3.5 rounded-xl border transition-all ${color.bg} ${color.border} shadow-sm ring-1 ${isRecent ? 'ring-emerald-500/20' : 'ring-amber-500/20'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          {isRecent ? (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </>
                          ) : (
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                          )}
                        </span>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
                          {prof.profile_label || `Profile ${prof.profile_id}`}
                        </h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        isRecent
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                      }`}>
                        {isRecent ? 'Active' : 'Idle'}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 mt-2">
                      <div className="text-slate-600 dark:text-slate-300 font-medium truncate flex items-center gap-1.5">
                        <Activity className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate">{prof.last_title || 'Ready'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t dark:border-slate-800">
                        <span>Last Seen:</span>
                        <span className="font-mono">{formatRelativeTime(prof.last_seen)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== TURSO DATABASE VAULT BANNER ===== */}
      <Card className="border border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-cyan-50/50 dark:from-emerald-950/20 dark:via-teal-950/20 dark:to-cyan-950/10 shadow-sm">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Turso Database Vault
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                  0% Firebase Quota
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                লাইভ অ্যাক্টিভিটি টাইমলাইন (প্রোফাইল অনুযায়ী ফিল্টার), এক্সটেনশন অন/অফ ট্র্যাকিং এবং টারসো পেমেন্ট ব্যাকআপ
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowTursoVault(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all font-semibold text-xs shadow-sm hover:shadow cursor-pointer"
          >
            <span>ওপেন ডাটাবেজ পেজ</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </CardContent>
      </Card>

      {/* ===== PAYMENT HISTORY ===== */}
      <Card>
        <CardHeader className="border-b dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <span>Payment History</span>
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {filteredPayments.length} / {payments.length} টি
                </span>
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                ফায়ারবেস লাইভ পেমেন্ট ডাটা {hiddenPaymentsCount > 0 && !showHidden && `(${hiddenPaymentsCount} টি ডাটা সাময়িক লুকানো)`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Hide All Button */}
              <button
                type="button"
                onClick={() => setIsHideConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                title="বর্তমান সব পুরনো পেমেন্ট ডাটা স্ক্রিন থেকে লুকান"
              >
                <Archive className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>সব ডাটা লুকান</span>
              </button>

              {/* Restore Button */}
              {isArchived && (
                <button
                  type="button"
                  onClick={handleRestoreAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800/80 bg-teal-50/80 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  title="লুকানো তথ্য পুনরায় ফিরিয়ে আনুন"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>রিস্টোর</span>
                </button>
              )}

              {/* Show/Hide Toggle Button */}
              {hiddenPaymentsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHidden(!showHidden)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-xs transition-all cursor-pointer ${
                    showHidden
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                  title="লুকানো/আর্কাইভ ডাটা দেখানো বা বন্ধ করার সুইচ"
                >
                  {showHidden ? <EyeOff className="h-3.5 w-3.5 text-indigo-500" /> : <Eye className="h-3.5 w-3.5 text-slate-500" />}
                  <span>{showHidden ? 'লুকানো ডাটা বন্ধ' : `লুকানো ডাটা দেখান (${hiddenPaymentsCount})`}</span>
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">Date & Time</th>
                  <th className="px-4 py-3 font-medium">Chrome Profile</th>
                  <th className="px-4 py-3 font-medium">Amounts</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {loadingPayments ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      Loading payments...
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-500">
                      <div className="max-w-sm mx-auto space-y-2">
                        <Archive className="h-8 w-8 mx-auto text-amber-500/70" />
                        <p className="font-medium text-slate-700 dark:text-slate-300">
                          {hiddenPaymentsCount > 0 
                            ? 'সব পুরানো পেমেন্ট ডাটা লুকানো রয়েছে।' 
                            : 'কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি।'}
                        </p>
                        {hiddenPaymentsCount > 0 && (
                          <div className="flex items-center justify-center gap-2 pt-2">
                            <button
                              onClick={() => setShowHidden(true)}
                              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
                            >
                              লুকানো {hiddenPaymentsCount} টি ডাটা দেখান
                            </button>
                            <button
                              onClick={handleRestoreAll}
                              className="px-3 py-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-lg text-xs font-semibold hover:bg-teal-100 transition-colors cursor-pointer"
                            >
                              সম্পূর্ণ রিস্টোর করুন
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p: PaymentRecord) => {
                    const isArchivedRow = isPaymentArchived(p.profile_id || 'default', Number(p.timestamp || 0));
                    const matchedKnown = (p.profile_id && p.profile_id !== 'default')
                      ? activeProfiles.find((ap: ActiveProfile) => ap.profile_id === p.profile_id)?.profile_label
                      : null;
                    
                    let label = p.profile_label;
                    if (!label || label === 'Profile' || label.startsWith('Profile #')) {
                      if (matchedKnown && matchedKnown !== 'Profile') {
                        label = matchedKnown;
                      } else if (p.profile_id && p.profile_id !== 'default') {
                        label = `Profile #${p.profile_id.slice(-4)}`;
                      } else {
                        label = 'Profile';
                      }
                    }

                    // Extract pure phone number or ID (e.g. "01959166796" instead of "Profile (01959166796)")
                    const rawNumber = label.replace(/^Profile\s*\(?|\)$/gi, '').trim();
                    const displayPhone = rawNumber.length >= 10 ? rawNumber : (rawNumber.startsWith('#') ? rawNumber : (label || 'Default'));

                    const profId = p.profile_id || (matchedKnown ? activeProfiles.find(ap => ap.profile_label === matchedKnown)?.profile_id || 'prof_default' : 'prof_default');
                    const profColor = getProfileColor(profId);
                    return (
                      <tr key={p.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isArchivedRow ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''}`}>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {(() => {
                            const formatted = formatDateTime12Hour(p.timestamp || p.datetime);
                            return (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                                    {formatted.timeStr}
                                  </span>
                                  {isArchivedRow && (
                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                      আর্কাইভ
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {formatted.dateStr}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono ${profColor.bg} ${profColor.text} border ${profColor.border}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${profColor.dot}`}></span>
                            {displayPhone}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          <div className="flex flex-col gap-1 py-0.5">
                            <div className="flex items-center justify-between gap-2 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80">
                              <span className="text-[10px] font-bold text-slate-400">Amount 1:</span>
                              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                                {p.amount_1 && p.amount_1 > 0 ? `৳${p.amount_1.toLocaleString()}` : '-'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80">
                              <span className="text-[10px] font-bold text-slate-400">Amount 2:</span>
                              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                                {p.amount_2 && p.amount_2 > 0 ? `৳${p.amount_2.toLocaleString()}` : '-'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-800/50">
                              <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">Amount 3:</span>
                              <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                                {(p.amount_3 && p.amount_3 > 0 ? p.amount_3 : p.amount) ? `৳${((p.amount_3 && p.amount_3 > 0) ? p.amount_3 : p.amount || 0).toLocaleString()}` : '-'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap font-medium">
                          {(() => {
                            const s = (p.stage || '').toLowerCase();
                            if (s === 'bangla_qr' || s.includes('bangla') || s.includes('qr')) {
                              return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Bangla QR</span>;
                            }
                            if (s === 'bkash' || s === 'bkash_loaded') {
                              return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300 border border-pink-200 dark:border-pink-800">bKash</span>;
                            }
                            if (s === 'nagad' || s === 'nagad_loaded') {
                              return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800">Nagad</span>;
                            }
                            if (s === 'rocket' || s === 'rocket_loaded' || s === 'account_submitted' || s === 'account_filled') {
                              return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Rocket</span>;
                            }
                            if (s === 'cellfin') {
                              return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800">CellFin</span>;
                            }
                            if (s === 'tap') {
                              return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">TAP</span>;
                            }
                            if (s === 'net_banking') {
                              return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">Net Banking</span>;
                            }
                            if (s === 'card') {
                              return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">Card</span>;
                            }
                            if (s === 'pay_clicked') {
                              return <span className="text-slate-500 dark:text-slate-400 font-normal">Pay Button Clicked</span>;
                            }
                            if (s === 'otp_submitted') {
                              return <span className="text-cyan-600 dark:text-cyan-400 font-semibold">OTP Submitted</span>;
                            }
                            if (s === 'payment_success') {
                              return <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Payment Successful</span>;
                            }
                            const clean = (p.stage || '').replace(/_loaded$/i, '').replace(/_/g, ' ');
                            return <span className="capitalize text-slate-600 dark:text-slate-400 font-normal">{clean || '-'}</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {p.status === 'success' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              Success
                            </span>
                          ) : p.status === 'initiated' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              Initiated
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ===== SAFE ARCHIVE CONFIRMATION MODAL (PROFILE VIEW) ===== */}
      {isHideConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-900/60 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="p-3 bg-amber-100 dark:bg-amber-950/60 rounded-xl border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  সাবধান / সতর্কতা: তথ্য লুকানো (Archive)
                </h3>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Hide / Archive Old Records
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono">
              <span className="text-slate-500">টার্গেট ক্লায়েন্ট:</span>{' '}
              <strong className="text-slate-800 dark:text-slate-100">{license.client_name || license.key}</strong>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>ডাটাবেজ শতভাগ নিরাপদ:</strong> ডাটাবেজ (Firebase বা Turso) থেকে কোনো ডাটা মুছে যাবে না। সমস্ত পেমেন্ট হিস্ট্রি ডাটাবেজে নিরাপদে সংরক্ষিত থাকবে।
                </span>
              </div>
              <p>
                বর্তমান সব পুরানো পেমেন্ট রেকর্ড স্ক্রিন থেকে সাময়িক হাইড করা হবে। আপনি যেকোনো সময় <strong>'লুকানো ডাটা দেখান'</strong> অপশন চালু করে পুনরায় দেখতে পারবেন অথবা <strong>'রিস্টোর'</strong> বাটনে ক্লিক করে ফিরিয়ে আনতে পারবেন।
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isArchiving}
                onClick={() => setIsHideConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isArchiving}
                onClick={handleConfirmArchiveAll}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isArchiving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>হাইড করা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Archive className="h-3.5 w-3.5" />
                    <span>হ্যাঁ, হাইড / আর্কাইভ করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Real-time MQTT Kill Switch (Instant 50ms broadcast, 0 Firebase reads)
const publishLicenseKillSwitch = (key: string, nextStatus: string, lic?: any) => {
  try {
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
      clientId: `admin_block_${Math.random().toString(16).slice(2, 8)}`,
      connectTimeout: 5000,
    });
    client.on('connect', () => {
      const payload = JSON.stringify({
        action: nextStatus === 'blocked' ? 'block' : 'unblock',
        key: key,
        status: nextStatus,
        plan: lic?.plan || 'Standard',
        duration_days: lic?.duration_days || 30,
        bound_at: lic?.bound_at || Date.now(),
        timestamp: Date.now()
      });
      client.publish(`digonto_kill_${key}`, payload, { qos: 1 });
      client.publish('digonto_license_event', payload, { qos: 1 }, () => {
        client.end();
      });
    });
    client.on('error', (err) => {
      console.warn('MQTT kill switch error:', err);
    });
  } catch (err) {
    console.error('MQTT broadcast error:', err);
  }
};

// ===== MAIN COMPONENT =====
export default function IvacLicenseManager() {
  const [licenses, setLicenses] = useState<IvacLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [customDays, setCustomDays] = useState<string>('30');
  const [clientNameInput, setClientNameInput] = useState('');
  const [selectedLicense, setSelectedLicense] = useState<IvacLicense | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

  const migrateFromOldFirebase = async () => {
    if (!window.confirm("আপনি কি পূর্বের Firebase থেকে সমস্ত লাইসেন্স ও ডেটা নতুন ডেডিকেটেড Firebase (ivac-master-pro)-এ ট্রান্সফার করতে চান?")) return;
    setIsMigrating(true);
    setMigrationStatus("আগের Firebase থেকে ডেটা লোড করা হচ্ছে...");
    try {
      const oldSnap = await getDocs(collection(oldDb, 'ivac_licenses'));
      if (oldSnap.empty) {
        alert("আগের Firebase-এ কোনো লাইসেন্স পাওয়া যায়নি!");
        setIsMigrating(false);
        setMigrationStatus(null);
        return;
      }
      let count = 0;
      let paymentCount = 0;
      setMigrationStatus(`আগের Firebase-এ ${oldSnap.size}টি লাইসেন্স পাওয়া গেছে। নতুন ডেটাবেজে ট্রান্সফার হচ্ছে...`);
      for (const licDoc of oldSnap.docs) {
        const licData = licDoc.data();
        await setDoc(doc(db, 'ivac_licenses', licDoc.id), licData);
        count++;
        try {
          const paymentsSnap = await getDocs(collection(oldDb, `ivac_licenses/${licDoc.id}/payments`));
          for (const pDoc of paymentsSnap.docs) {
            await setDoc(doc(db, `ivac_licenses/${licDoc.id}/payments`, pDoc.id), pDoc.data());
            paymentCount++;
          }
        } catch (subErr) {
          console.error("Payment copy err:", subErr);
        }
      }
      setMigrationStatus(`✓ সফলভাবে ${count}টি লাইসেন্স ও ${paymentCount}টি পেমেন্ট নতুন Firebase-এ মাইগ্রেট সম্পন্ন হয়েছে!`);
      alert(`🎉 সফলভাবে ${count}টি লাইসেন্স ও ${paymentCount}টি পেমেন্ট নতুন Firebase-এ কপি সম্পন্ন হয়েছে!`);
    } catch (err: any) {
      console.error("Migration error:", err);
      setMigrationStatus(`❌ মাইগ্রেশন ব্যর্থ: ${err.message || err}`);
      alert("মাইগ্রেশন ব্যর্থ: " + (err.message || err));
    } finally {
      setIsMigrating(false);
    }
  };

  useEffect(() => {
    // Listen to ivac_licenses in real-time
    const q = query(collection(db, 'ivac_licenses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: IvacLicense[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as IvacLicense);
      });
      // Sort by latest created
      data.sort((a, b) => b.created_at - a.created_at);
      setLicenses(data);

      // Update selected license if it changes
      if (selectedLicense) {
        const updated = data.find(l => l.id === selectedLicense.id);
        if (updated) setSelectedLicense(updated);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedLicense]);

  const generateKey = async (days: number) => {
    setIsGenerating(true);
    try {
      // Generate a random key: IVAC-XXXX-XXXX-XXXX
      const generateSegment = () => Math.random().toString(36).substring(2, 6).toUpperCase();
      const newKey = `IVAC-${generateSegment()}-${generateSegment()}-${generateSegment()}`;

      const licenseData: Record<string, unknown> = {
        key: newKey,
        duration_days: days,
        status: 'active',
        hwid: null,
        payment_count: 0,
        total_amount: 0,
        created_at: Date.now(),
        bound_at: null,
        client_name: clientNameInput.trim() || '',
        client_phone: '',
        client_description: '',
      };

      await setDoc(doc(db, 'ivac_licenses', newKey), licenseData);
      setClientNameInput(''); // Reset after generating
    } catch (error) {
      console.error("Error generating key:", error);
      alert("Error generating key!");
    }
    setIsGenerating(false);
  };

  const handleCustomGenerate = () => {
    const days = parseInt(customDays);
    if (!isNaN(days) && days > 0) {
      generateKey(days);
    } else {
      alert("Please enter a valid number of days");
    }
  };

  const blockKey = async (key: string, currentStatus: string) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus === 'active' ? 'block' : 'unblock'} this key?`)) return;
    try {
      const nextStatus = currentStatus === 'active' ? 'blocked' : 'active';
      await updateDoc(doc(db, 'ivac_licenses', key), {
        status: nextStatus
      });
      setSelectedLicense(prev => prev && prev.key === key ? { ...prev, status: nextStatus } : prev);
      setLicenses(prev => prev.map(l => l.key === key ? { ...l, status: nextStatus } : l));
      const targetLic = licenses.find(l => l.key === key) || selectedLicense;
      publishLicenseKillSwitch(key, nextStatus, targetLic);
    } catch (error) {
      console.error("Error updating key:", error);
    }
  };

  // Delete Confirmation Modal State
  const [keyToDelete, setKeyToDelete] = useState<{ key: string; clientName?: string } | null>(null);
  const [deletingKey, setDeletingKey] = useState(false);

  const requestDeleteKey = (key: string, clientName?: string) => {
    setKeyToDelete({ key, clientName });
  };

  // Permanent Delete: Purges from Firebase Firestore AND Turso Database
  const handlePermanentDeleteLicense = async (key: string) => {
    setDeletingKey(true);
    try {
      // 1. MQTT Kill-Switch: Send instant kill signal to lock any running app
      publishLicenseKillSwitch(key, 'blocked');

      // 2. Turso Database Purge: Delete activities and payments for this license_key
      try {
        const purgeBody = {
          requests: [
            {
              type: 'execute',
              stmt: {
                sql: 'DELETE FROM activities WHERE license_key = ?',
                args: [{ type: 'text', value: key }]
              }
            },
            {
              type: 'execute',
              stmt: {
                sql: 'DELETE FROM payments WHERE license_key = ?',
                args: [{ type: 'text', value: key }]
              }
            },
            { type: 'close' }
          ]
        };

        await fetch('/api/turso-vault', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(purgeBody)
        });
        console.log(`[Turso Purge] Purged activities and payments for key: ${key}`);
      } catch (tursoErr) {
        console.error('[Turso Purge Error]', tursoErr);
      }

      // 3. Firestore Subcollection Payments Purge
      try {
        const subPayQuery = query(collection(db, `ivac_licenses/${key}/payments`));
        const subSnap = await getDocs(subPayQuery);
        await Promise.all(subSnap.docs.map(d => deleteDoc(d.ref)));
        console.log(`[Firestore Purge] Purged ${subSnap.docs.length} subcollection payments for key: ${key}`);
      } catch (subErr) {
        console.error('[Firestore Sub-Payments Purge Error]', subErr);
      }

      // 4. Firestore Root Payments Purge (if any)
      try {
        const payQuery = query(collection(db, 'payments'), where('license_key', '==', key));
        const snap = await getDocs(payQuery);
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
        console.log(`[Firestore Purge] Purged ${snap.docs.length} root payments for key: ${key}`);
      } catch (payErr) {
        console.error('[Firestore Payments Purge Error]', payErr);
      }

      // 5. Firestore License Document Purge
      await deleteDoc(doc(db, 'ivac_licenses', key));

      if (selectedLicense?.key === key) {
        setSelectedLicense(null);
      }
      setKeyToDelete(null);
    } catch (error: any) {
      console.error("Error deleting license:", error);
      alert("লাইসেন্স মুছে ফেলতে সমস্যা হয়েছে: " + error?.message);
    } finally {
      setDeletingKey(false);
    }
  };

  // ===== PROFILE VIEW =====
  if (selectedLicense) {
    return (
      <>
        <ProfileView
          license={selectedLicense}
          onBack={() => setSelectedLicense(null)}
          onBlockKey={blockKey}
          onDeleteKey={(key) => requestDeleteKey(key, selectedLicense?.client_name)}
        />
        {keyToDelete && (
          <DeleteLicenseModal
            item={keyToDelete}
            deleting={deletingKey}
            onCancel={() => setKeyToDelete(null)}
            onConfirm={handlePermanentDeleteLicense}
          />
        )}
      </>
    );
  }

  // Stats
  const totalKeys = licenses.length;
  const activeKeys = licenses.filter(l => l.status === 'active' && l.hwid !== null).length;
  const totalPayments = licenses.reduce((sum, l) => sum + (l.payment_count || 0), 0);
  const totalRevenue = licenses.reduce((sum, l) => sum + (l.total_amount || 0), 0);

  const filteredLicenses = licenses.filter(l =>
    l.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.hwid && l.hwid.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (l.client_name && l.client_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (l.client_phone && l.client_phone.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <Key className="h-7 w-7 text-indigo-500" /> IVAC License Manager
          </h2>
          <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full font-semibold flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-700 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            ivac-master-pro
          </span>
        </div>

        <button
          onClick={migrateFromOldFirebase}
          disabled={isMigrating}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-50"
          title="পূর্বের Firebase থেকে সমস্ত লাইসেন্স ও ডেটা নতুন ডেটাবেজে ট্রান্সফার করুন"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isMigrating ? 'animate-spin' : ''}`} />
          {isMigrating ? 'মাইগ্রেশন হচ্ছে...' : '🔄 পূর্বের Firebase থেকে ডেটা মাইগ্রেট করুন'}
        </button>
      </div>

      {migrationStatus && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-medium text-indigo-800 dark:text-indigo-200 flex items-center justify-between shadow-sm">
          <span>{migrationStatus}</span>
          <button onClick={() => setMigrationStatus(null)} className="text-indigo-500 hover:text-indigo-700 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Keys</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{totalKeys}</p>
              </div>
              <Key className="h-8 w-8 text-indigo-400 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Users</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{activeKeys}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-400 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Payments</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{totalPayments}</p>
              </div>
              <Shield className="h-8 w-8 text-blue-400 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Revenue</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{'\u09F3'}{totalRevenue.toLocaleString()}</p>
              </div>
              <ChevronRight className="h-8 w-8 text-amber-400 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Generate Panel */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Generate License</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Client Name Input */}
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  <User className="h-3.5 w-3.5 inline mr-1" /> Client Name (optional)
                </label>
                <input
                  type="text"
                  value={clientNameInput}
                  onChange={(e) => setClientNameInput(e.target.value)}
                  placeholder="ক্লায়েন্টের নাম..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Days Input */}
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Duration</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    min="1"
                  />
                  <span className="text-sm text-slate-500 font-medium">Days</span>
                </div>
              </div>

              <button
                onClick={handleCustomGenerate}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Generate License
              </button>

              {/* Quick Presets */}
              <div className="pt-2">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Quick Presets</p>
                <div className="grid grid-cols-2 gap-2">
                  {[30, 90, 180, 365].map(d => (
                    <button
                      key={d}
                      onClick={() => { setCustomDays(String(d)); generateKey(d); }}
                      disabled={isGenerating}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
                    >
                      {d} Days
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* List Panel */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b dark:border-slate-800">
              <CardTitle className="text-lg">License Keys</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, key, HWID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-3 font-medium">Client / Key</th>
                      <th className="px-4 py-3 font-medium">Duration & Expiry</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Payments</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-500">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                          Loading licenses...
                        </td>
                      </tr>
                    ) : filteredLicenses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-500">
                          No licenses found.
                        </td>
                      </tr>
                    ) : (
                      filteredLicenses.map((lic) => (
                        <tr
                          key={lic.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer"
                          onClick={() => setSelectedLicense(lic)}
                        >
                          <td className="px-4 py-3">
                            {lic.client_name && (
                              <div className="font-medium text-slate-900 dark:text-slate-200 flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                  {lic.client_name[0]?.toUpperCase()}
                                </div>
                                {lic.client_name}
                              </div>
                            )}
                            <div className={`font-mono text-sm ${lic.client_name ? 'text-slate-400 mt-0.5 ml-9' : 'text-slate-900 dark:text-slate-200'}`}>
                              {lic.key}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5" style={lic.client_name ? {marginLeft: '2.25rem'} : {}}>
                              Created: {new Date(lic.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const expiry = getLicenseExpiryInfo(lic);
                              return (
                                <div className="flex flex-col gap-1 items-start">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                      {expiry.totalDays} Days
                                    </span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${expiry.remainingBadgeClass}`}>
                                      {expiry.remainingText}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                    <span>
                                      {expiry.isBound ? (
                                        <>মেয়াদ শেষ: <strong className="font-medium text-slate-700 dark:text-slate-300">{expiry.expiryFormatted}</strong></>
                                      ) : (
                                        <span className="text-amber-600 dark:text-amber-400">অ্যাক্টিভেট করা হয়নি</span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            {lic.status === 'blocked' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                                <ShieldBan className="h-3 w-3" /> Blocked
                              </span>
                            ) : lic.hwid ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" /> Active
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                Unused
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-start justify-center">
                              <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
                                {lic.payment_count || 0}
                              </span>
                              <span className="text-xs font-medium text-slate-500">
                                {'\u09F3'}{(lic.total_amount || 0).toLocaleString()}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedLicense(lic); }}
                                title="View Profile"
                                className="p-2 flex items-center gap-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors font-medium text-sm"
                              >
                                Profile <ChevronRight className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); blockKey(lic.key, lic.status); }}
                                title={lic.status === 'active' ? 'Block Key' : 'Unblock Key'}
                                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                  lic.status === 'active'
                                    ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                    : 'text-red-500 bg-red-50 dark:bg-red-900/20 hover:text-red-600'
                                }`}
                              >
                                <ShieldBan className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); requestDeleteKey(lic.key, lic.client_name); }}
                                title="Delete Key"
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {keyToDelete && (
        <DeleteLicenseModal
          item={keyToDelete}
          deleting={deletingKey}
          onCancel={() => setKeyToDelete(null)}
          onConfirm={handlePermanentDeleteLicense}
        />
      )}
    </div>
  );
}
