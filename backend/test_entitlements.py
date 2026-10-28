"""Unit tests for Employee Entitlements module: allowances, deductions, service benefits, and audit."""

import unittest
from datetime import date
from unittest.mock import patch

from fastapi import HTTPException

from entitlements import (
    calculate_entitlement_amount,
    calculate_service_period,
    evaluate_benefit_rules,
    generate_entitlements_csv,
    get_employee_entitlements,
    get_entitlements_summary,
    list_entitlement_records,
    create_entitlement_record,
    update_entitlement_record,
    action_entitlement_record,
    update_employee_service_profile,
    get_entitlement_audit_trail,
)


class _MockCollection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    def find_one(self, query):
        for doc in self.docs:
            matched = True
            for k, v in query.items():
                if k == "_id" and doc.get("_id") != v:
                    matched = False
                    break
                elif k == "employee_id" and doc.get("employee_id") != v:
                    matched = False
                    break
                elif k == "category" and doc.get("category") != v:
                    matched = False
                    break
                elif k == "entitlement_name" and doc.get("entitlement_name") != v:
                    matched = False
                    break
                elif k == "approval_status" and isinstance(v, dict) and "$in" in v:
                    if doc.get("approval_status") not in v["$in"]:
                        matched = False
                        break
            if matched:
                return dict(doc)
        return None

    def find(self, query=None):
        if not query:
            return _MockCursor([dict(d) for d in self.docs])
        res = []
        for doc in self.docs:
            matched = True
            for k, v in query.items():
                if k == "employee_id" and doc.get("employee_id") != v:
                    matched = False
                    break
                elif k == "category" and doc.get("category") != v:
                    matched = False
                    break
                elif k == "approval_status" and doc.get("approval_status") != v:
                    matched = False
                    break
            if matched:
                res.append(dict(doc))
        return _MockCursor(res)

    def count_documents(self, query=None):
        return len(self.find(query))

    def insert_one(self, doc):
        self.docs.append(dict(doc))

    def insert_many(self, docs):
        self.docs.extend([dict(d) for d in docs])

    def update_one(self, query, update):
        wanted_id = query.get("_id")
        for doc in self.docs:
            if doc.get("_id") == wanted_id:
                doc.update(update.get("$set", {}))
                return True
        return False

    def delete_one(self, query):
        before = len(self.docs)
        self.docs = [d for d in self.docs if d.get("_id") != query.get("_id")]
        return len(self.docs) < before


class _MockCursor(list):
    def sort(self, *args, **kwargs):
        return self


class EntitlementsModuleTests(unittest.TestCase):
    def setUp(self):
        self.mock_employees = [
            {
                "_id": "EMP1137",
                "employee_id": "EMP1137",
                "employee_name": "Nuwan Priyantha Fernando",
                "designation": "Senior Postman",
                "post_office": "Kaduwela",
                "employment_type": "Permanent",
                "appointment_date": "2018-03-01",
                "basic_salary": 48000.0,
                "years_of_experience": 8,
            },
            {
                "_id": "EMP1141",
                "employee_id": "EMP1141",
                "employee_name": "Prasanna Madushanka Dias",
                "designation": "Postman",
                "post_office": "Kaduwela",
                "employment_type": "Contract",
                "appointment_date": "2023-05-15",
                "basic_salary": 38000.0,
                "years_of_experience": 3,
            },
            {
                "_id": "EMP_NEW",
                "employee_id": "EMP_NEW",
                "employee_name": "New Officer",
                "designation": "Postal Clerk",
                "post_office": "Kaduwela",
                "employment_type": "Permanent",
                "appointment_date": None,
                "basic_salary": None,
                "years_of_experience": None,
            },
        ]
        self.database = {
            "employee": _MockCollection(self.mock_employees),
            "entitlement_record": _MockCollection([]),
            "entitlement_audit": _MockCollection([]),
        }
        self.patcher = patch("entitlements.get_db", return_value=self.database)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()

    def test_service_period_calculation(self):
        # 1. From appointment date 2018-03-01 as of 2026-05-01 = 8 years, 2 months
        p1 = calculate_service_period("2018-03-01", as_of=date(2026, 5, 1))
        self.assertTrue(p1["is_available"])
        self.assertEqual(p1["service_years"], 8)
        self.assertEqual(p1["service_months"], 2)
        self.assertIn("8 years, 2 months", p1["formatted"])

        # 2. Fallback to years of experience when appointment date is missing
        p2 = calculate_service_period(None, years_of_experience=5)
        self.assertTrue(p2["is_available"])
        self.assertEqual(p2["service_years"], 5)
        self.assertEqual(p2["formatted"], "5 years")

        # 3. Missing information returns Not available
        p3 = calculate_service_period(None, years_of_experience=None)
        self.assertFalse(p3["is_available"])
        self.assertEqual(p3["formatted"], "Not available")

    def test_benefit_rules_evaluation(self):
        emp_senior = self.mock_employees[0]
        benefits_senior = evaluate_benefit_rules(emp_senior)
        gratuity = next(b for b in benefits_senior if b["benefit_key"] == "gratuity")
        self.assertEqual(gratuity["eligibility_status"], "Eligible")
        # 48000 / 2 * 8 = 192000
        self.assertEqual(gratuity["estimated_amount"], 192000.0)

        housing = next(b for b in benefits_senior if b["benefit_key"] == "housing_loan")
        self.assertEqual(housing["eligibility_status"], "Eligible")

        emp_junior_contract = self.mock_employees[1]
        benefits_junior = evaluate_benefit_rules(emp_junior_contract)
        gratuity_jr = next(b for b in benefits_junior if b["benefit_key"] == "gratuity")
        self.assertEqual(gratuity_jr["eligibility_status"], "Not eligible")

        housing_jr = next(b for b in benefits_junior if b["benefit_key"] == "housing_loan")
        self.assertEqual(housing_jr["eligibility_status"], "Not eligible")

    def test_calculate_entitlement_amount(self):
        fixed_monthly = {"amount": 5000.0, "amount_type": "fixed", "frequency": "Monthly"}
        self.assertEqual(calculate_entitlement_amount(fixed_monthly, 48000.0), 5000.0)

        fixed_annual = {"amount": 12000.0, "amount_type": "fixed", "frequency": "Annual"}
        self.assertEqual(calculate_entitlement_amount(fixed_annual, 48000.0), 1000.0)

        pct_epf = {"amount_type": "percentage", "percentage_value": 8.0, "frequency": "Monthly"}
        # 48000 * 8% = 3840.0
        self.assertEqual(calculate_entitlement_amount(pct_epf, 48000.0), 3840.0)

    def test_create_and_validate_entitlement_record(self):
        # Successful creation
        created = create_entitlement_record(
            {
                "employee_id": "EMP1137",
                "category": "allowance",
                "entitlement_name": "Special Travel Allowance",
                "amount": 4500.0,
                "frequency": "Monthly",
                "eligibility_status": "Approved",
                "effective_date": "2025-01-01",
                "notes": "Field delivery travel",
            },
            user="postmaster",
        )
        self.assertEqual(created["employee_id"], "EMP1137")
        self.assertEqual(created["effective_amount"], 4500.0)
        self.assertEqual(created["approval_status"], "Approved")

        # Duplicate active entitlement rejection
        with self.assertRaises(HTTPException) as dup:
            create_entitlement_record(
                {
                    "employee_id": "EMP1137",
                    "category": "allowance",
                    "entitlement_name": "Special Travel Allowance",
                    "amount": 5000.0,
                }
            )
        self.assertEqual(dup.exception.status_code, 409)

        # Negative amount rejection
        with self.assertRaises(HTTPException) as neg:
            create_entitlement_record(
                {
                    "employee_id": "EMP1137",
                    "category": "allowance",
                    "entitlement_name": "Negative Test",
                    "amount": -500.0,
                }
            )
        self.assertEqual(neg.exception.status_code, 400)

        # Expiry before effective date rejection
        with self.assertRaises(HTTPException) as exp:
            create_entitlement_record(
                {
                    "employee_id": "EMP1137",
                    "category": "allowance",
                    "entitlement_name": "Date Test",
                    "amount": 1000.0,
                    "effective_date": "2025-06-01",
                    "expiry_date": "2025-05-01",
                }
            )
        self.assertEqual(exp.exception.status_code, 400)

        # Audit trail recorded
        audit = get_entitlement_audit_trail(created["id"])
        self.assertGreaterEqual(len(audit), 1)
        self.assertEqual(audit[0]["action"], "created")
        self.assertEqual(audit[0]["performed_by"], "postmaster")

    def test_update_and_action_entitlement_record(self):
        created = create_entitlement_record(
            {
                "employee_id": "EMP1141",
                "category": "allowance",
                "entitlement_name": "Route Fuel Subsidy",
                "amount": 3000.0,
                "approval_status": "Pending",
            },
            user="EMP1141",
        )

        # Update amount
        updated = update_entitlement_record(created["id"], {"amount": 3500.0}, user="postmaster")
        self.assertEqual(updated["amount"], 3500.0)

        # Consequential action: approve
        approved = action_entitlement_record(created["id"], "approve", notes="Signed off", user="postmaster")
        self.assertEqual(approved["approval_status"], "Approved")

        # Consequential action: deactivate
        deactivated = action_entitlement_record(created["id"], "deactivate", notes="Route discontinued", user="postmaster")
        self.assertEqual(deactivated["approval_status"], "Inactive")

        # Verify audit history captured all events
        audit = get_entitlement_audit_trail(created["id"])
        actions = [a["action"] for a in audit]
        self.assertIn("deactivate", actions)
        self.assertIn("approve", actions)
        self.assertIn("updated", actions)
        self.assertIn("created", actions)

    def test_employee_service_profile_update(self):
        updated_profile = update_employee_service_profile(
            "EMP_NEW",
            {
                "appointment_date": "2021-08-15",
                "basic_salary": 45000.0,
                "employment_type": "Permanent",
                "years_of_experience": 5,
            },
            user="postmaster",
        )
        emp_data = updated_profile["employee"]
        self.assertEqual(emp_data["basic_salary"], 45000.0)
        self.assertEqual(emp_data["appointment_date"], "2021-08-15")
        self.assertTrue(emp_data["service_period"]["is_available"])

    def test_summary_and_csv_generation(self):
        summary = get_entitlements_summary()
        self.assertIn("total_employees", summary)
        self.assertIn("active_allowances_count", summary)

        csv_text = generate_entitlements_csv()
        self.assertIn("Employee ID,Employee Name", csv_text)


if __name__ == "__main__":
    unittest.main()
