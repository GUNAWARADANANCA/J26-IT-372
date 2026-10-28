import json
import os
import sys
import unittest
import urllib.request
import http.cookiejar

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from coach import (
    classify_coaching_intent,
    generate_coaching_chat_response,
    OUT_OF_SCOPE_MESSAGE_EN,
    OUT_OF_SCOPE_MESSAGE_SI,
)

BASE_URL = "http://127.0.0.1:8000"


class TestMultilingualCategoryCoach(unittest.TestCase):
    def test_01_sinhala_and_english_intent_classification(self):
        print("\n--- TEST 01: Multilingual Intent Classification ---")
        # English
        self.assertEqual(classify_coaching_intent("How am I performing?", "EMP1137"), "OVERVIEW")
        self.assertEqual(classify_coaching_intent("What are my strengths?", "EMP1137"), "STRENGTHS")
        self.assertEqual(classify_coaching_intent("How can I improve my timeliness?", "EMP1137"), "IMPROVE_TIMELINESS")
        self.assertEqual(classify_coaching_intent("What does my predicted KPI mean?", "EMP1137"), "FORECAST_EXPLANATION")

        # Sinhala
        self.assertEqual(classify_coaching_intent("මගේ කාර්යසාධනය කෙබඳුද?", "EMP1137"), "OVERVIEW")
        self.assertEqual(classify_coaching_intent("මගේ ශක්තීන් මොනවාද?", "EMP1137"), "STRENGTHS")
        self.assertEqual(classify_coaching_intent("කාලෝචිතභාවය වැඩිදියුණු කරන්නේ කෙසේද?", "EMP1137"), "IMPROVE_TIMELINESS")
        self.assertEqual(classify_coaching_intent("නිරවද්‍යතාවය සහ දෝෂ අඩු කරන්නේ කෙසේද?", "EMP1137"), "IMPROVE_ACCURACY")
        self.assertEqual(classify_coaching_intent("පෙර සතිය සමඟ සසඳන්න", "EMP1137"), "COMPARISON")
        self.assertEqual(classify_coaching_intent("මගේ අනාගත kpi පුරෝකථනය පැහැදිලි කරන්න", "EMP1137"), "FORECAST_EXPLANATION")

        # Out-of-scope in English
        self.assertEqual(classify_coaching_intent("What is the weather in Colombo?", "EMP1137"), "UNSUPPORTED")
        self.assertEqual(classify_coaching_intent("Write a python script", "EMP1137"), "UNSUPPORTED")

        # Out-of-scope in Sinhala
        self.assertEqual(classify_coaching_intent("අද කොළඹ කාලගුණය කොහොමද?", "EMP1137"), "UNSUPPORTED")
        self.assertEqual(classify_coaching_intent("මට පයිතන් කෝඩින් උගන්වන්න", "EMP1137"), "UNSUPPORTED")
        self.assertEqual(classify_coaching_intent("ක්‍රිකට් මැච් එක කවුද දින්නේ?", "EMP1137"), "UNSUPPORTED")
        print("[OK] Multilingual intent classification passed for English and Sinhala.")

    def test_02_out_of_scope_rejection_multilingual(self):
        print("\n--- TEST 02: Multilingual Out-of-Scope Enforcement ---")
        # English
        res_en = generate_coaching_chat_response("EMP1137", "What is the weather today?")
        self.assertFalse(res_en["supported"])
        self.assertEqual(res_en["reply"], OUT_OF_SCOPE_MESSAGE_EN)

        # Sinhala
        res_si = generate_coaching_chat_response("EMP1137", "අද වැස්ස තියෙනවද?")
        self.assertFalse(res_si["supported"])
        self.assertEqual(res_si["reply"], OUT_OF_SCOPE_MESSAGE_SI)
        print("[OK] Out-of-scope messages strictly enforced in English and Sinhala.")

    def test_03_delivery_category_differentiated_recommendations(self):
        print("\n--- TEST 03: Delivery (Field) Differentiated Recommendations (EMP1137) ---")
        res = generate_coaching_chat_response("EMP1137", "How can I improve my timeliness?", year=2025, week="2025-01-27", language="en")
        self.assertTrue(res["supported"])
        self.assertEqual(res["work_category"], "Delivery (Field)")
        self.assertIn("Senior Postman", res["designation"])
        top_rec = res["recommendations"][0]
        # Must relate to delivery beat, departure cutoff, sorting bags
        self.assertIn("Delivery Beat", top_rec["title"])
        self.assertIn("street", top_rec["action"].lower())
        print(f"[OK] Delivery (Field) recommendation generated: '{top_rec['title']}'")

    def test_04_office_category_differentiated_recommendations(self):
        print("\n--- TEST 04: Office Category Differentiated Recommendations (EMP1150) ---")
        res = generate_coaching_chat_response("EMP1150", "How can I improve my accuracy?", year=2025, week="2025-01-27", language="en")
        self.assertTrue(res["supported"])
        self.assertEqual(res["work_category"], "Office")
        self.assertEqual(res["designation"], "Postal Assistant")
        top_rec = res["recommendations"][0]
        # Must relate to counter collections, utility bills, money orders
        self.assertTrue(
            "Bill Collections" in top_rec["title"] or "Counter" in top_rec["title"] or "Financial" in top_rec["title"],
            f"Expected counter-specific title, got: {top_rec['title']}"
        )
        print(f"[OK] Office (Postal Assistant) recommendation generated: '{top_rec['title']}'")

    def test_05_supervisory_category_differentiated_recommendations(self):
        print("\n--- TEST 05: Supervisory / Office Recommendations (EMP1149) ---")
        res = generate_coaching_chat_response("EMP1149", "How can I improve my timeliness?", year=2025, week="2025-01-27", language="en")
        self.assertTrue(res["supported"])
        self.assertEqual(res["work_category"], "Supervisory / Office")
        self.assertIn("Postmaster", res["designation"])
        top_rec = res["recommendations"][0]
        # Must relate to supervisory master dispatch windows, authorization
        self.assertTrue(
            "Master Dispatch" in top_rec["title"] or "Supervisory" in top_rec["title"] or "Sign-Off" in top_rec["title"],
            f"Expected supervisory title, got: {top_rec['title']}"
        )
        print(f"[OK] Supervisory (Postmaster) recommendation generated: '{top_rec['title']}'")

    def test_06_sinhala_recommendations_and_kpi_model(self):
        print("\n--- TEST 06: Sinhala Language Delivery with kpi_forecast_model.joblib ---")
        res = generate_coaching_chat_response("EMP1137", "මගේ කාර්යසාධනය කෙබඳුද?", year=2025, week="2025-01-27", language="si")
        self.assertTrue(res["supported"])
        self.assertEqual(res["language"], "si")
        self.assertIn("මනින ලද සමස්ත KPI", res["reply"])
        self.assertIn("සම්පූර්ණ කිරීම", res["reply"])
        self.assertIn("නිරවද්‍යතාවය", res["reply"])
        self.assertIn("කාලෝචිතභාවය", res["reply"])

        # Check model forecast
        fc = res["forecast"]
        self.assertIsNotNone(fc.get("predicted_kpi"))
        self.assertIn("Random Forest", fc.get("model"))
        self.assertIn("MAE ±3.41", fc.get("model"))

        # Check Sinhala recommendations
        recs = res["recommendations"]
        self.assertGreater(len(recs), 0)
        self.assertIn("බෙදාහැරීමේ", recs[0]["title"])
        print(f"[OK] Sinhala response and forecast validated (Predicted KPI: {fc['predicted_kpi']}%, Rec: {recs[0]['title']}).")

    def test_07_http_api_endpoint_sinhala_and_english(self):
        print("\n--- TEST 07: Live HTTP API Endpoint with Language Filtering ---")
        cj = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

        # 1. Login as postmaster
        login_data = json.dumps({"username": "postmaster", "password": "YourStrongDemoPassword123!"}).encode("utf-8")
        login_req = urllib.request.Request(
            f"{BASE_URL}/api/auth/login",
            data=login_data,
            headers={"Content-Type": "application/json"},
        )
        with opener.open(login_req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            csrf_token = data.get("csrf_token")

        headers = {
            "Content-Type": "application/json",
            "x-csrf-token": csrf_token or "",
        }

        # 2. Query in English for Office Employee (EMP1150)
        chat_data_en = json.dumps({
            "message": "How can I improve my accuracy?",
            "week": "2025-01-27",
            "year": 2025,
            "language": "en"
        }).encode("utf-8")
        req_en = urllib.request.Request(
            f"{BASE_URL}/api/productivity/EMP1150/coach/chat",
            data=chat_data_en,
            headers=headers,
        )
        with opener.open(req_en) as resp:
            self.assertEqual(resp.status, 200)
            body = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(body["supported"])
            self.assertEqual(body["work_category"], "Office")
            self.assertIn("Accuracy Coaching", body["reply"])

        # 3. Query in Sinhala for Delivery Postman (EMP1137)
        chat_data_si = json.dumps({
            "message": "මගේ කාර්යසාධනය කෙබඳුද?",
            "week": "2025-01-27",
            "year": 2025,
            "language": "si"
        }).encode("utf-8")
        req_si = urllib.request.Request(
            f"{BASE_URL}/api/productivity/EMP1137/coach/chat",
            data=chat_data_si,
            headers=headers,
        )
        with opener.open(req_si) as resp:
            self.assertEqual(resp.status, 200)
            body = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(body["supported"])
            self.assertEqual(body["language"], "si")
            self.assertIn("කාර්යසාධන සාරාංශය", body["reply"])

        print("[OK] HTTP API endpoint verified with English and Sinhala payloads.")


if __name__ == "__main__":
    unittest.main()
