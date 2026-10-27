"""Gratuity estimate from basic salary and years of experience."""

import unittest

from payroll import gratuity_for


class GratuityTests(unittest.TestCase):
    def test_nine_years_is_half_a_month_for_each_year(self):
        result = gratuity_for(
            {
                "employee_id": "EMP1139",
                "employee_name": "Dinesh Lakmal Silva",
                "designation": "Postman",
                "basic_salary": 42000,
                "years_of_experience": 9,
            }
        )
        self.assertEqual(result["status"], "Eligible")
        self.assertEqual(result["estimated_amount"], 189000)

    def test_under_five_years_is_not_eligible(self):
        result = gratuity_for(
            {
                "employee_id": "EMP1141",
                "employee_name": "Prasanna Madushanka Dias",
                "basic_salary": 42000,
                "years_of_experience": 4,
            }
        )
        self.assertEqual(result["status"], "Not eligible")
        self.assertEqual(result["estimated_amount"], 84000)

    def test_missing_years_cannot_be_calculated(self):
        result = gratuity_for({"employee_id": "EMP1", "basic_salary": 42000})
        self.assertEqual(result["status"], "Not eligible")
        self.assertIsNone(result["estimated_amount"])


if __name__ == "__main__":
    unittest.main()
