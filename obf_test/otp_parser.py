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


def parse_otp_from_sms(sms_body: str) -> Optional[List[int]]:
    """
    যেকোনো SMS থেকে ৬ ডিজিটের OTP বের করে। (IVAC-এর শব্দভিত্তিক অথবা সাধারণ সংখ্যার OTP)
    """
    if not sms_body:
        return None

    # ১. প্রথমে IVAC এর শব্দভিত্তিক (Nine-Zero-Six) প্যাটার্ন খোঁজার চেষ্টা
    match = re.search(
        r"prompted\s+([\w\-]+(?:\-[\w]+)*)\s*\.?",
        sms_body,
        re.IGNORECASE
    )
    if match:
        word_sequence = match.group(1)
        parsed = _parse_word_sequence(word_sequence)
        if parsed and len(parsed) == 6:
            return parsed

    # ২. যদি শব্দভিত্তিক না থাকে, তবে সাধারণ ৬-ডিজিটের সংখ্যা (যেমন: 630710) খোঁজা
    digit_match = re.search(r'\b(\d{6})\b', sms_body)
    if digit_match:
        number_str = digit_match.group(1)
        return [int(d) for d in number_str]

    # ২.৫: ৪-ডিজিটের OTP (যেমন: DGPay ভেরিফিকেশন কোড)
    digit_match_4 = re.search(r'\b(\d{4})\b', sms_body)
    if digit_match_4:
        number_str = digit_match_4.group(1)
        return [int(d) for d in number_str]

    # ৩. সর্বশেষ চেষ্টা: পুরো মেসেজ থেকে যেকোনো শব্দভিত্তিক সংখ্যাগুলো খুঁজে বের করা
    return _extract_digits_from_text(sms_body)


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


def format_otp_display(digits: List[int]) -> str:
    """
    OTP কে সুন্দর ফরম্যাটে দেখায় (3-3 ফরম্যাটে)।

    Args:
        digits: [9, 0, 6, 5, 2, 6]

    Returns:
        "906 - 526"
    """
    if len(digits) == 6:
        first = "".join(str(d) for d in digits[:3])
        second = "".join(str(d) for d in digits[3:])
        return f"{first} - {second}"
    return digits_to_string(digits)


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
    print("🧪 OTP Parser পরীক্ষা শুরু...")
    print("=" * 50)

    # টেস্ট ১: স্ট্যান্ডার্ড IVAC SMS
    sms1 = "(IVACBD) For security, type the following sequence when prompted Nine-Zero-Six-Five-Two-Six ."
    result1 = parse_otp_from_sms(sms1)
    assert result1 == [9, 0, 6, 5, 2, 6], f"টেস্ট ১ ব্যর্থ: {result1}"
    print(f"✅ টেস্ট ১ সফল: {sms1[:50]}... → {result1}")

    # টেস্ট ২: আরেকটি OTP
    sms2 = "(IVACBD) For security, type the following sequence when prompted Six-Eight-Five-Five-Two-Eight ."
    result2 = parse_otp_from_sms(sms2)
    assert result2 == [6, 8, 5, 5, 2, 8], f"টেস্ট ২ ব্যর্থ: {result2}"
    print(f"✅ টেস্ট ২ সফল: {sms2[:50]}... → {result2}")

    # টেস্ট ৩: ডিজিট টু স্ট্রিং
    assert digits_to_string([9, 0, 6, 5, 2, 6]) == "906526"
    print("✅ টেস্ট ৩ সফল: digits_to_string([9,0,6,5,2,6]) → '906526'")

    # টেস্ট ৪: ফরম্যাট ডিসপ্লে
    assert format_otp_display([9, 0, 6, 5, 2, 6]) == "906 - 526"
    print("✅ টেস্ট ৪ সফল: format_otp_display → '906 - 526'")

    # টেস্ট ৫: খালি/ভুল SMS
    assert parse_otp_from_sms("") is None
    assert parse_otp_from_sms("Hello World") is None
    print("✅ টেস্ট ৫ সফল: ভুল SMS → None")

    # টেস্ট ৬: সব ডিজিট পরীক্ষা
    sms6 = "(IVACBD) For security, type the following sequence when prompted Zero-One-Two-Three-Four-Five ."
    result6 = parse_otp_from_sms(sms6)
    assert result6 == [0, 1, 2, 3, 4, 5], f"টেস্ট ৬ ব্যর্থ: {result6}"
    print(f"✅ টেস্ট ৬ সফল: সব ডিজিট → {result6}")

    sms7 = "(IVACBD) For security, type the following sequence when prompted Six-Seven-Eight-Nine-Zero-One ."
    result7 = parse_otp_from_sms(sms7)
    assert result7 == [6, 7, 8, 9, 0, 1], f"টেস্ট ৭ ব্যর্থ: {result7}"
    print(f"✅ টেস্ট ৭ সফল: বাকি ডিজিট → {result7}")

    print("=" * 50)
    print("🎉 সব পরীক্ষা সফল!")
    print("=" * 50)


if __name__ == "__main__":
    run_tests()
