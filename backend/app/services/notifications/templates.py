"""Sender message templates in English, Sinhala and Tamil (proposal appendix A1.4).

Templates never include a precise address or a live worker coordinate, and
the 'delivered' wording does not claim that GPS identified the recipient.
The Sinhala and Tamil wording is a draft that must be reviewed by native
speakers / the Department of Posts before use with real senders
(TEMPLATE_VERSION records which wording was sent).
"""
from __future__ import annotations

TEMPLATE_VERSION = "2026.10-draft1"

STATUS_LABELS = {
    "en": {
        "accepted": "Accepted", "dispatched": "Dispatched", "in_transit": "In transit",
        "at_destination_office": "At destination office", "out_for_delivery": "Out for delivery",
        "delivery_attempted": "Delivery attempted", "delivered": "Delivered",
        "return_started": "Return started", "returned_to_sender": "Returned to sender",
    },
    "si": {
        "accepted": "භාරගන්නා ලදී", "dispatched": "පිටත් කර යවන ලදී", "in_transit": "ප්‍රවාහනයේ",
        "at_destination_office": "ගමනාන්ත කාර්යාලයට ළඟා විය", "out_for_delivery": "භාරදීම සඳහා පිටත්ව ඇත",
        "delivery_attempted": "භාරදීමට උත්සාහ කරන ලදී", "delivered": "භාරදෙන ලදී",
        "return_started": "ආපසු යැවීම ආරම්භ විය", "returned_to_sender": "යවන්නා වෙත ආපසු භාරදෙන ලදී",
    },
    "ta": {
        "accepted": "ஏற்றுக்கொள்ளப்பட்டது", "dispatched": "அனுப்பி வைக்கப்பட்டது", "in_transit": "போக்குவரத்தில்",
        "at_destination_office": "சேருமிட அலுவலகத்தை அடைந்தது", "out_for_delivery": "விநியோகத்திற்காக வெளியே",
        "delivery_attempted": "விநியோக முயற்சி செய்யப்பட்டது", "delivered": "விநியோகிக்கப்பட்டது",
        "return_started": "திருப்பி அனுப்புதல் ஆரம்பிக்கப்பட்டது", "returned_to_sender": "அனுப்புநரிடம் திருப்பி ஒப்படைக்கப்பட்டது",
    },
}

SUBJECTS = {
    "en": "Registered item {tracking_id}: {status}",
    "si": "ලියාපදිංචි අයිතමය {tracking_id}: {status}",
    "ta": "பதிவுத் தபால் {tracking_id}: {status}",
}

BODIES = {
    "en": {
        "accepted": "Your registered item {tracking_id} was accepted at {office} on {time}. Keep your receipt. "
                    "View updates through your tracking link: {link}",
        "scan": "A scan for {tracking_id} was recorded at {place} at {time}. Current accepted status: {status}.",
        "delivery_attempted": "Delivery was attempted for {tracking_id} at {time}. Reason: {reason}. Follow the "
                              "instructions in your tracking record or contact {office}.",
        "delivered": "The postal system recorded {tracking_id} as delivered at {time} under the applicable "
                     "acknowledgement procedure.",
        "return_started": "Item {tracking_id} is being returned to you. Reason: {reason}.",
        "returned_to_sender": "Item {tracking_id} was recorded as returned to the sender at {time}.",
        "delayed": "This update was synchronised at {server_time}.",
        "footer": "Tracking: {link}",
    },
    "si": {
        "accepted": "ඔබගේ ලියාපදිංචි තැපැල් අයිතමය {tracking_id}, {time} දින {office} හිදී භාරගන්නා ලදී. "
                    "ඔබගේ රිසිට්පත සුරක්ෂිතව තබා ගන්න. යාවත්කාලීන තොරතුරු: {link}",
        "scan": "{tracking_id} සඳහා {time} ට {place} හිදී ස්කෑන් කිරීමක් සටහන් විය. වත්මන් තත්ත්වය: {status}.",
        "delivery_attempted": "{tracking_id} භාරදීමට {time} ට උත්සාහ කරන ලදී. හේතුව: {reason}. වැඩි විස්තර සඳහා "
                              "ඔබගේ ලුහුබැඳීමේ සටහන බලන්න හෝ {office} අමතන්න.",
        "delivered": "{tracking_id} අයිතමය අදාළ පිළිගැනීමේ ක්‍රියාපටිපාටිය යටතේ {time} ට භාරදුන් බව තැපැල් "
                     "පද්ධතියේ සටහන් විය.",
        "return_started": "{tracking_id} අයිතමය ඔබ වෙත ආපසු එවමින් පවතී. හේතුව: {reason}.",
        "returned_to_sender": "{tracking_id} අයිතමය {time} ට යවන්නා වෙත ආපසු භාරදුන් බව සටහන් විය.",
        "delayed": "මෙම යාවත්කාලීනය {server_time} ට සමමුහුර්ත කරන ලදී.",
        "footer": "ලුහුබැඳීම: {link}",
    },
    "ta": {
        "accepted": "உங்கள் பதிவுத் தபால் பொருள் {tracking_id}, {time} அன்று {office} இல் ஏற்றுக்கொள்ளப்பட்டது. "
                    "உங்கள் பற்றுச்சீட்டைப் பாதுகாப்பாக வைத்திருங்கள். புதுப்பிப்புகள்: {link}",
        "scan": "{tracking_id} க்கான ஒரு ஸ்கேன் {time} மணிக்கு {place} இல் பதிவு செய்யப்பட்டது. தற்போதைய நிலை: {status}.",
        "delivery_attempted": "{tracking_id} ஐ விநியோகிக்க {time} மணிக்கு முயற்சி செய்யப்பட்டது. காரணம்: {reason}. "
                              "மேலதிக விவரங்களுக்கு உங்கள் கண்காணிப்புப் பதிவைப் பார்க்கவும் அல்லது {office} ஐத் தொடர்பு கொள்ளவும்.",
        "delivered": "{tracking_id} பொருள் பொருந்தக்கூடிய ஒப்புகை நடைமுறையின் கீழ் {time} மணிக்கு விநியோகிக்கப்பட்டதாக "
                     "தபால் அமைப்பில் பதிவாகியுள்ளது.",
        "return_started": "{tracking_id} பொருள் உங்களிடம் திருப்பி அனுப்பப்படுகிறது. காரணம்: {reason}.",
        "returned_to_sender": "{tracking_id} பொருள் {time} மணிக்கு அனுப்புநரிடம் திருப்பி ஒப்படைக்கப்பட்டதாகப் பதிவாகியுள்ளது.",
        "delayed": "இந்தப் புதுப்பிப்பு {server_time} மணிக்கு ஒத்திசைக்கப்பட்டது.",
        "footer": "கண்காணிப்பு: {link}",
    },
}


class _Safe(dict):
    def __missing__(self, key):
        return ""


def template_for(status: str) -> str:
    if status in ("accepted", "delivery_attempted", "delivered", "return_started", "returned_to_sender"):
        return status
    return "scan"


def render(language: str, status: str, variables: dict) -> tuple[str, str]:
    lang = language if language in BODIES else "en"
    v = _Safe(variables)
    v["status"] = STATUS_LABELS[lang].get(status, status)
    body = BODIES[lang][template_for(status)].format_map(v)
    if variables.get("server_time"):
        body += " " + BODIES[lang]["delayed"].format_map(v)
    if template_for(status) != "accepted" and variables.get("link"):
        body += "\n\n" + BODIES[lang]["footer"].format_map(v)
    subject = SUBJECTS[lang].format_map(v)
    return subject, body
