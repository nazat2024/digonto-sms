import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Key, Plus, Trash2, ShieldBan, RefreshCw, CheckCircle2, Shield, Search, X, ChevronRight, ArrowLeft, User, Phone, FileText, Clock, CalendarPlus, Save, Edit3, Copy } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, updateDoc } from 'firebase/firestore';

interface IvacLicense {
  id: string;
  key: string;
  duration_months?: number;
  duration_days?: number;
  status: 'active' | 'blocked';
  hwid: string | null;
  payment_count: number;
  total_amount?: number;
  created_at: number;
  bound_at: number | null;
  client_name?: string;
  client_phone?: string;
  client_description?: string;
}

interface PaymentRecord {
  id: string;
  amount: number;
  status: string;
  stage: string;
  rocket_account: string;
  description: string;
  timestamp: number;
  datetime: string;
}

// ===== PROFILE VIEW (একজনের একটাই পেজ — সবকিছু এখান থেকে) =====
function ProfileView({ license, onBack, onBlockKey, onDeleteKey }: {
  license: IvacLicense;
  onBack: () => void;
  onBlockKey: (key: string, status: string) => void;
  onDeleteKey: (key: string) => void;
}) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

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

  useEffect(() => {
    const q = query(collection(db, `ivac_licenses/${license.key}/payments`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: PaymentRecord[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as PaymentRecord));
      data.sort((a, b) => b.timestamp - a.timestamp);
      setPayments(data);
      setLoadingPayments(false);
    });
    return () => unsubscribe();
  }, [license.key]);

  // Sync form fields when license prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditName(license.client_name || '');
      setEditPhone(license.client_phone || '');
      setEditDescription(license.client_description || '');
    }
  }, [license, isEditing]);

  const totalAmount = payments.reduce((sum, p) => p.status === 'success' ? sum + (p.amount || 0) : sum, 0);
  const successCount = payments.filter(p => p.status === 'success').length;

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
      const currentDays = license.duration_days || (license.duration_months ? license.duration_months * 30 : 0);
      await updateDoc(doc(db, 'ivac_licenses', license.key), {
        duration_days: currentDays + days,
        duration_months: null,
      });
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

  const durationText = license.duration_days
    ? `${license.duration_days} Days`
    : license.duration_months
      ? `${license.duration_months} Months`
      : 'Unknown';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors">
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

      {/* ===== LICENSE STATUS + ACTIONS ===== */}
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
        <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-900">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Duration</p>
            <p className="text-lg font-bold text-slate-800 dark:text-white">{durationText}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Payments</p>
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{successCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Revenue</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{'\u09F3'}{totalAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* ===== ACTION BUTTONS ===== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
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
                  {extending ? '...' : '\u2713 Add'}
                </button>
                <button
                  onClick={() => { setShowExtend(false); setExtendDays('30'); }}
                  className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-sm"
                >
                  {'\u2715'}
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
                    await updateDoc(doc(db, 'ivac_licenses', license.key), { hwid: null, bound_at: null });
                  } catch (e) { console.error(e); }
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors font-medium text-sm border border-amber-200 dark:border-amber-800"
              >
                <RefreshCw className="h-4 w-4" /> HWID Reset
              </button>
            )}

            {/* Delete */}
            <button
              onClick={() => onDeleteKey(license.key)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium text-sm border border-slate-200 dark:border-slate-700"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>

          {/* HWID Info */}
          {license.hwid && (
            <div className="mt-3 pt-3 border-t dark:border-slate-800">
              <p className="text-xs text-slate-400">
                <span className="font-medium">HWID:</span>{' '}
                <span className="font-mono">{license.hwid}</span>
                {license.bound_at && (
                  <span className="ml-3">Activated: {new Date(license.bound_at).toLocaleDateString()}</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== PAYMENT HISTORY ===== */}
      <Card>
        <CardHeader className="border-b dark:border-slate-800">
          <CardTitle className="text-lg">Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">Date & Time</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Rocket Account</th>
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
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500">
                      No payment records found.
                    </td>
                  </tr>
                ) : (
                  payments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                        {p.datetime || new Date(p.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {'\u09F3'}{p.amount?.toLocaleString() || 0}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-500">
                        {p.rocket_account || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {p.stage === 'pay_clicked' ? 'Pay Button Clicked' :
                         p.stage === 'account_filled' ? 'Account Submitted' :
                         p.stage === 'otp_submitted' ? 'OTP Submitted' : p.stage}
                      </td>
                      <td className="px-4 py-3">
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== MAIN COMPONENT =====
export default function IvacLicenseManager() {
  const [licenses, setLicenses] = useState<IvacLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [customDays, setCustomDays] = useState<string>('30');
  const [clientNameInput, setClientNameInput] = useState('');
  const [selectedLicense, setSelectedLicense] = useState<IvacLicense | null>(null);

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
      await updateDoc(doc(db, 'ivac_licenses', key), {
        status: currentStatus === 'active' ? 'blocked' : 'active'
      });
    } catch (error) {
      console.error("Error updating key:", error);
    }
  };

  const deleteKey = async (key: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this key?")) return;
    try {
      await deleteDoc(doc(db, 'ivac_licenses', key));
      if (selectedLicense?.key === key) {
        setSelectedLicense(null);
      }
    } catch (error) {
      console.error("Error deleting key:", error);
    }
  };

  // ===== PROFILE VIEW =====
  if (selectedLicense) {
    return (
      <ProfileView
        license={selectedLicense}
        onBack={() => setSelectedLicense(null)}
        onBlockKey={blockKey}
        onDeleteKey={(key) => { deleteKey(key); setSelectedLicense(null); }}
      />
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
          <Key className="h-7 w-7 text-indigo-500" /> IVAC License Manager
        </h2>
      </div>

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
                      <th className="px-4 py-3 font-medium">Duration</th>
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
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                              {lic.duration_days ? `${lic.duration_days} Days` : `${lic.duration_months} Months`}
                            </span>
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
                                onClick={(e) => { e.stopPropagation(); deleteKey(lic.key); }}
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
    </div>
  );
}
