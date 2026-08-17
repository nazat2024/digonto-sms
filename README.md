# 🇮🇳 IVAC OTP Auto-Fill System 🇧🇩

**Indian Visa Application Center (IVAC)** ওয়েবসাইটে একই সাথে **১০+ Chrome প্রোফাইলে** স্বয়ংক্রিয়ভাবে OTP পূরণ করার সিস্টেম।

---

## 🎯 এই সিস্টেম কী করে?

1. 📱 ফোনে IVAC থেকে SMS আসে (ইংরেজি শব্দে: `Nine-Zero-Six-Five-Two-Six`)
2. 📡 SMS স্বয়ংক্রিয়ভাবে কম্পিউটারে পৌঁছায়
3. 🔢 ইংরেজি শব্দ সংখ্যায় রূপান্তর হয় (`9-0-6-5-2-6`)
4. 🌐 Chrome এর OTP বক্সে স্বয়ংক্রিয়ভাবে বসে যায়
5. ✅ Verify OTP ক্লিক হয়ে লগইন সম্পন্ন হয়

**একই সাথে ১০+ প্রোফাইলে কাজ করে!**

---

## 📦 প্রয়োজনীয়তা

| বিষয় | ন্যূনতম |
|---|---|
| Python | 3.9+ |
| Chrome | যেকোনো সাম্প্রতিক সংস্করণ |
| RAM | 8 GB (১০ Chrome এর জন্য 16 GB ভালো) |
| Android ফোন | SMS ফরোয়ার্ডের জন্য |
| Wi-Fi | ফোন ও PC একই নেটওয়ার্কে |

---

## 🚀 দ্রুত শুরু

### ধাপ ১: Python Dependencies ইনস্টল করুন
```cmd
cd "D:\Ivac Auto Fill"
pip install -r requirements.txt
```

### ধাপ ২: config.json সম্পাদনা করুন
প্রতিটি প্রোফাইলের তথ্য দিন:
```json
{
    "profiles": [
        {
            "id": 1,
            "name": "MD REZHANUL HAQUE",
            "phone": "01351178457",
            "password": "your_actual_password",
            "chrome_profile": "Profile 10",
            "enabled": true
        }
    ]
}
```

### ধাপ ৩: Android ফোনে SMS ফরোয়ার্ড সেটআপ করুন
বিস্তারিত: [setup_guide.md](setup_guide.md)

### ধাপ ৪: সিস্টেম চালু করুন
```cmd
python main.py
```

---

## 📋 কমান্ড অপশন

```cmd
# সব প্রোফাইল চালু
python main.py

# নির্দিষ্ট প্রোফাইল চালু
python main.py --profile 1 3 5

# শুধু SMS সার্ভার ও Dashboard চালু (browser ছাড়া)
python main.py --server-only

# OTP parser পরীক্ষা
python main.py --test-parser
```

---

## 📁 ফাইল তালিকা

```
Ivac Auto Fill/
├── main.py              # মূল প্রোগ্রাম — এটি চালান
├── config.json          # আপনার প্রোফাইল তথ্য (সম্পাদনা করুন)
├── otp_parser.py        # ইংরেজি শব্দ → সংখ্যা রূপান্তর
├── sms_server.py        # SMS গ্রহণকারী সার্ভার
├── browser_manager.py   # Chrome প্রোফাইল ম্যানেজমেন্ট
├── requirements.txt     # Python dependencies
├── setup_guide.md       # Android সেটআপ গাইড
├── README.md            # এই ফাইল
└── dashboard/
    ├── index.html       # ওয়েব ড্যাশবোর্ড
    ├── style.css        # ড্যাশবোর্ড স্টাইল
    └── app.js           # ড্যাশবোর্ড লজিক
```

---

## 📊 Dashboard

সিস্টেম চালু হলে ব্রাউজারে যান: **http://localhost:5000**

Dashboard এ দেখতে পাবেন:
- সব প্রোফাইলের real-time স্ট্যাটাস
- OTP আসার সাথে সাথে দেখাবে
- ম্যানুয়ালি OTP দেওয়ার অপশন
- কার্যকলাপ লগ

---

## ⚠️ গুরুত্বপূর্ণ নোট

1. **config.json এ সঠিক তথ্য দিন** — ফোন নম্বর ও পাসওয়ার্ড সঠিক হতে হবে
2. **Wi-Fi একই হতে হবে** — ফোন ও কম্পিউটার একই Wi-Fi নেটওয়ার্কে
3. **Firewall** — Windows Firewall এ port 5000 allow করুন
4. **Battery Optimization** — ফোনে MacroDroid/Tasker এর জন্য battery optimization বন্ধ করুন
