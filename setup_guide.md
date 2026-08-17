# 📱 Android SMS ফরোয়ার্ড সেটআপ গাইড

IVAC থেকে আসা SMS আপনার কম্পিউটারে স্বয়ংক্রিয়ভাবে পাঠাতে এই গাইড অনুসরণ করুন।

---

## পদ্ধতি ১: MacroDroid (সবচেয়ে সহজ) — বিনামূল্যে

### ধাপ ১: MacroDroid ইনস্টল (১০০% বিনামূল্যে)
1. Google Play Store থেকে **MacroDroid** ইনস্টল করুন
2. অ্যাপ খুলুন এবং সব **Permission** দিন (SMS, Notification, Battery Optimization off)

> 💡 **গুরুত্বপূর্ণ সতর্কতা (টাকা দেবেন না!):** অ্যাপে ঢোকার পর যদি **"MacroDroid Pro (BDT 250.00)"** বা কেনার স্ক্রিন আসে, তবে ওপরে বাম দিকের **তীর চিহ্নে (← Back Button)** চাপ দিয়ে কেটে দিন! 
> MacroDroid-এ **৫টি Macro আজীবন ১০০% ফ্রি** তৈরি করা যায়। আমাদের কাজের জন্য মাত্র **১টি Macro** লাগবে, তাই এক টাকাও দেওয়ার প্রয়োজন নেই! ফ্রি ভার্সন দিয়েই সব কাজ হবে।

### ধাপ ২: নতুন Macro তৈরি করুন

**Trigger (ট্রিগার):**
1. `Add Trigger` → `Device Events` → `SMS Received`
2. `SMS From Contains:` → `IVAC` লিখুন
3. `Any Content` সিলেক্ট করুন

**Action (অ্যাকশন):**
1. `Add Action` → `Connectivity` → `HTTP Request`
2. সেটিংস:
   - **Method:** `POST`
   - **URL:** `http://YOUR_PC_IP:5000/api/sms`
     - (আপনার PC এর IP বসান, যেমন: `http://192.168.0.105:5000/api/sms`)
   - **Content Type:** `application/json`
   - **Body:**
     ```json
     {
       "body": "{sms_text}",
       "phone": "YOUR_PHONE_NUMBER",
       "from": "{sms_from}"
     }
     ```
     - `{sms_text}` → MacroDroid variable, SMS এর টেক্সট
     - `YOUR_PHONE_NUMBER` → এই ফোনের নম্বর লিখুন (যেমন: `01351178457`)
     - `{sms_from}` → MacroDroid variable, SMS প্রেরকের নাম

3. **Variable** বসাতে: Body তে cursor রেখে `Insert Variable` এ ক্লিক করুন → `SMS Text` সিলেক্ট করুন

**Constraint (শর্ত):**
- কোনো constraint লাগবে না (Empty)

### ধাপ ৩: Macro সেভ ও Enable করুন
- Macro এর নাম দিন: `IVAC SMS Forward`
- ✅ Enable করুন

### ধাপ ৪: PC IP খুঁজে বের করুন
আপনার কম্পিউটারে Command Prompt খুলুন:
```
ipconfig
```
`IPv4 Address` দেখুন — এটাই আপনার PC IP (যেমন: `192.168.0.105`)

> ⚠️ **গুরুত্বপূর্ণ:** ফোন ও কম্পিউটার **একই Wi-Fi** নেটওয়ার্কে থাকতে হবে!

### ধাপ ৫: পরীক্ষা করুন
1. কম্পিউটারে `python main.py --server-only` চালান
2. ফোনে MacroDroid এর Macro তে `Test` বাটনে ক্লিক করুন
3. Dashboard এ দেখুন SMS এসেছে কিনা

---

## পদ্ধতি ২: Tasker (আরও শক্তিশালী) — ₹৩০০

### ধাপ ১: Tasker ও AutoRemote ইনস্টল করুন
1. Google Play Store থেকে **Tasker** কিনুন ও ইনস্টল করুন
2. সব Permission দিন

### ধাপ ২: Profile তৈরি করুন
1. `Profiles` ট্যাবে `+` চাপুন
2. `Event` → `Phone` → `Received Text`
3. `Sender:` → `IVAC` লিখুন
4. `OK` চাপুন

### ধাপ ৩: Task তৈরি করুন
1. নতুন Task → নাম দিন `Forward SMS`
2. `+` → `Net` → `HTTP Request`
3. সেটিংস:
   - **Method:** POST
   - **URL:** `http://YOUR_PC_IP:5000/api/sms`
   - **Headers:** `Content-Type: application/json`
   - **Body:**
     ```
     {"body":"%SMSRB","phone":"YOUR_PHONE_NUMBER","from":"%SMSRF"}
     ```
   - `%SMSRB` = SMS Body (Tasker variable)
   - `%SMSRF` = SMS From (Tasker variable)

---

## পদ্ধতি ৩: ADB (USB কানেকশন) — কোনো অ্যাপ লাগবে না

### প্রয়োজনীয়তা:
- USB ক্যাবল
- Android ফোনে **Developer Options** ও **USB Debugging** চালু

### ধাপ ১: ADB ইনস্টল করুন
1. [Android SDK Platform Tools](https://developer.android.com/tools/releases/platform-tools) ডাউনলোড করুন
2. Extract করুন এবং Path এ যোগ করুন

### ধাপ ২: ফোন সংযুক্ত করুন
```cmd
adb devices
```
আপনার ফোন তালিকায় দেখাবে।

### ধাপ ৩: SMS পড়ুন
```cmd
adb shell content query --uri content://sms/inbox --where "address LIKE '%%IVAC%%'" --sort "date DESC"
```

> ⚠️ **সীমাবদ্ধতা:** ADB পদ্ধতিতে real-time SMS পাওয়া কঠিন, polling করতে হয়। MacroDroid/Tasker অনেক ভালো।

---

## 🔧 সমস্যা সমাধান

### SMS ফরোয়ার্ড হচ্ছে না?
1. ফোনে **Battery Optimization** বন্ধ করুন MacroDroid/Tasker এর জন্য
2. **Background Activity** অনুমতি দিন
3. ফোন ও PC **একই Wi-Fi** তে আছে কিনা নিশ্চিত হোন
4. PC এর **Firewall** এ port 5000 allow করুন:
   ```cmd
   netsh advfirewall firewall add rule name="IVAC SMS Server" dir=in action=allow protocol=TCP localport=5000
   ```

### PC IP পরিবর্তন হচ্ছে?
- Router সেটিংসে আপনার PC এর জন্য **Static IP** সেট করুন
- অথবা প্রতিবার `ipconfig` দিয়ে নতুন IP দেখে MacroDroid এ আপডেট করুন

### একাধিক ফোনে সেটআপ
- প্রতিটি ফোনে MacroDroid ইনস্টল করুন
- প্রতিটি ফোনের Macro তে **নিজের নম্বর** (`phone` field) ভিন্ন ভিন্ন দিন
- সব ফোন একই PC IP তে SMS পাঠাবে
- সার্ভার ফোন নম্বর দিয়ে সঠিক Chrome প্রোফাইলে OTP পাঠাবে

---

## ✅ পরীক্ষা — cURL দিয়ে

কম্পিউটার থেকে সরাসরি SMS সার্ভার পরীক্ষা করুন:

```cmd
curl -X POST http://localhost:5000/api/sms -H "Content-Type: application/json" -d "{\"body\":\"(IVACBD) For security, type the following sequence when prompted Nine-Zero-Six-Five-Two-Six .\",\"phone\":\"01351178457\",\"from\":\"IVAC_BD\"}"
```

সফল হলে এমন response আসবে:
```json
{
  "success": true,
  "otp": "906526",
  "display": "906 - 526",
  "digits": [9, 0, 6, 5, 2, 6]
}
```
