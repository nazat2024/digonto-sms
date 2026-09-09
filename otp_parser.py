"""
IVAC OTP Parser — ইংরেজি শব্দকে সংখ্যায় রূপান্তর করে

SMS Format: "(IVACBD) For security, type the following sequence when prompted Nine-Zero-Six-Five-Two-Six ."
Output: [9, 0, 6, 5, 2, 6]
"""

import re
from typing import List, Optional, Tuple

# ইংরেজি শব্দ → সংখ্যা ম্যাপিং
WORD_TO_DIGIT = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
}


# SMS সোর্স প্রিফিক্স ম্যাপিং
SOURCE_PREFIX = {
    "IV": "IV",    # IVACBD
    "R": "R",      # Rocket
    "B": "B",      # bKash
    "N": "N",      # Nagad
}


def detect_sms_source(sms_body: str) -> Optional[str]:
    """
    SMS body থেকে সোর্স শনাক্ত করে।
    Returns: "IV", "R", "B", "N" অথবা None (অজানা SMS)
    """
    if not sms_body:
        return None
    
    body_lower = sms_body.lower()
    
    # IVACBD: "(IVACBD) For security, type the following sequence when prompted..." or email/visa OTP
    if "ivac" in body_lower or "visa" in body_lower or "indian" in body_lower:
        return "IV"
    
    # Rocket: "Your security code for Rocket transaction is..."
    if "rocket" in body_lower and ("security code" in body_lower or "transaction" in body_lower):
        return "R"
    
    # bKash: "Your bKash OTP for PAYMENT..."
    if "bkash" in body_lower and "otp" in body_lower:
        return "B"
    
    # Nagad: "Your OTP for Nagad ECOM payment..."
    if "nagad" in body_lower and "otp" in body_lower:
        return "N"
    
    return None


def parse_otp_from_sms(sms_body: str) -> Tuple[Optional[List[int]], Optional[str]]:
    """
    যেকোনো SMS থেকে ৬ ডিজিটের OTP বের করে এবং সোর্স ট্যাগ রিটার্ন করে।
    Returns: (digits, source) — source হলো "IV", "R", "B", "N" অথবা None
    শুধুমাত্র পরিচিত ৪ ধরনের SMS গ্রহণ করবে।
    """
    if not sms_body:
        return None, None

    # প্রথমে সোর্স শনাক্ত করো
    source = detect_sms_source(sms_body)
    if source is None:
        # অজানা SMS — রিজেক্ট
        return None, None

    # ১. IVAC এর শব্দভিত্তিক (Nine-Zero-Six) প্যাটার্ন খোঁজার চেষ্টা
    match = re.search(
        r"prompted\s+([\w\-]+(?:\-[\w]+)*)\s*\.?",
        sms_body,
        re.IGNORECASE
    )
    if match:
        word_sequence = match.group(1)
        parsed = _parse_word_sequence(word_sequence)
        if parsed and len(parsed) == 6:
            return parsed, source

    # ২. সাধারণ ৬-ডিজিটের সংখ্যা (যেমন: 630710) খোঁজা
    digit_match = re.search(r'\b(\d{6})\b', sms_body)
    if digit_match:
        number_str = digit_match.group(1)
        return [int(d) for d in number_str], source

    # ২.৫: ৪-ডিজিটের OTP (যেমন: DGPay ভেরিফিকেশন কোড)
    digit_match_4 = re.search(r'\b(\d{4})\b', sms_body)
    if digit_match_4:
        number_str = digit_match_4.group(1)
        return [int(d) for d in number_str], source

    # ৩. সর্বশেষ চেষ্টা: পুরো মেসেজ থেকে যেকোনো শব্দভিত্তিক সংখ্যাগুলো খুঁজে বের করা
    digits = _extract_digits_from_text(sms_body)
    return digits, source if digits else (None, None)


def _parse_word_sequence(word_sequence: str) -> Optional[List[int]]:
    """
    হাইফেন-বিভক্ত ইংরেজি সংখ্যা শব্দ থেকে ডিজিট লিস্ট তৈরি করে।

    Args:
        word_sequence: "Nine-Zero-Six-Five-Two-Six"

    Returns:
        [9, 0, 6, 5, 2, 6]
    """
    words = word_sequence.strip().split("-")
    digits = []

    for word in words:
        word_lower = word.strip().lower()
        if word_lower in WORD_TO_DIGIT:
            digits.append(WORD_TO_DIGIT[word_lower])
        else:
            # যদি কোনো অচেনা শব্দ থাকে
            print(f"⚠️ অচেনা শব্দ: '{word}' — উপেক্ষা করা হচ্ছে")

    if len(digits) == 6:
        return digits
    elif len(digits) > 0:
        print(f"⚠️ প্রত্যাশিত ৬টি ডিজিট, পাওয়া গেছে {len(digits)}টি: {digits}")
        return digits

    return None


def _extract_digits_from_text(text: str) -> Optional[List[int]]:
    """
    Fallback: পুরো টেক্সট থেকে সংখ্যা শব্দগুলো খুঁজে বের করে।
    """
    digits = []
    words = re.findall(r'\b\w+\b', text.lower())

    for word in words:
        if word in WORD_TO_DIGIT:
            digits.append(WORD_TO_DIGIT[word])

    if len(digits) >= 6:
        # শেষ ৬টি নেওয়া হবে (OTP সাধারণত শেষে থাকে)
        return digits[-6:]

    return digits if digits else None


def digits_to_string(digits: List[int]) -> str:
    """
    ডিজিট লিস্টকে স্ট্রিং এ রূপান্তর করে।

    Args:
        digits: [9, 0, 6, 5, 2, 6]

    Returns:
        "906526"
    """
    return "".join(str(d) for d in digits)


def format_otp_display(digits: List[int], source: str = None) -> str:
    """
    OTP কে সুন্দর ফরম্যাটে দেখায় (সোর্স প্রিফিক্স + 3-3 ফরম্যাটে)।

    Args:
        digits: [9, 0, 6, 5, 2, 6]
        source: "IV", "R", "B", "N" বা None

    Returns:
        "IV 906 - 526" বা "R 258 - 876"
    """
    if len(digits) == 6:
        first = "".join(str(d) for d in digits[:3])
        second = "".join(str(d) for d in digits[3:])
        otp_str = f"{first} - {second}"
    else:
        otp_str = digits_to_string(digits)
    
    if source:
        return f"{source} {otp_str}"
    return otp_str


def identify_phone_from_sms(sms_body: str) -> Optional[str]:
    """
    SMS থেকে ফোন নম্বর শনাক্ত করার চেষ্টা (যদি SMS body তে থাকে)।
    সাধারণত এটি SMS metadata থেকে আসবে, body থেকে নয়।
    """
    # বাংলাদেশি মোবাইল নম্বর প্যাটার্ন: 01XXXXXXXXX
    phone_match = re.search(r'\b(01[3-9]\d{8})\b', sms_body)
    if phone_match:
        return phone_match.group(1)
    return None


# ===== টেস্ট ফাংশন =====
def run_tests():
    """OTP parser এর সব ফাংশন পরীক্ষা করে।"""
    print("=" * 50)
    print("OTP Parser Tests Starting...")
    print("=" * 50)

    # টেস্ট ১: স্ট্যান্ডার্ড IVAC SMS
    sms1 = "(IVACBD) For security, type the following sequence when prompted Nine-Zero-Six-Five-Two-Six ."
    result1, source1 = parse_otp_from_sms(sms1)
    assert result1 == [9, 0, 6, 5, 2, 6], f"টেস্ট ১ ব্যর্থ: {result1}"
    assert source1 == "IV"
    print(f"Test 1 OK: {result1}, {source1}")

    # টেস্ট ২: Rocket SMS
    sms2 = "Your security code for Rocket transaction is 258876."
    result2, source2 = parse_otp_from_sms(sms2)
    assert result2 == [2, 5, 8, 8, 7, 6]
    assert source2 == "R"
    print(f"Test 2 OK: {result2}, {source2}")

    # টেস্ট ৩: bKash SMS
    sms3 = "Do NOT share your OTP or PIN with anyone. Your bKash OTP for PAYMENT of Tk.15.27 to PayStation is 939147. Expires in 2 min."
    result3, source3 = parse_otp_from_sms(sms3)
    assert result3 == [9, 3, 9, 1, 4, 7]
    assert source3 == "B"
    print(f"Test 3 OK: {result3}, {source3}")

    # টেস্ট ৪: Nagad SMS
    sms4 = "NEVER share your OTP or PIN with anyone. Nagad will never ask for these. Your OTP for Nagad ECOM payment is 026730."
    result4, source4 = parse_otp_from_sms(sms4)
    assert result4 == [0, 2, 6, 7, 3, 0]
    assert source4 == "N"
    print(f"Test 4 OK: {result4}, {source4}")

    # টেস্ট ৫: খালি/ভুল SMS
    res5, src5 = parse_otp_from_sms("")
    assert res5 is None
    res5_bad, src5_bad = parse_otp_from_sms("Hello World this is 123456")
    assert res5_bad is None
    print("Test 5 OK: Invalid SMS -> None")

    print("=" * 50)
    print("All tests passed!")
    print("=" * 50)

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    run_tests()
