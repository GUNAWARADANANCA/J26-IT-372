import json
import uuid
import urllib.request
import urllib.parse
import urllib.error
from datetime import date
from dotenv import load_dotenv

load_dotenv()
from db import get_db

BASE_URL = "http://127.0.0.1:8000"
OFFICE = "PO-COLOMBO-CENTRAL"
TODAY = date.today().isoformat()

def req(method, path, data=None, params=None):
    url = f"{BASE_URL}{path}"
    if params:
        url += f"?{urllib.parse.urlencode(params)}"
    headers = {"Content-Type": "application/json"} if data else {}
    body = json.dumps(data).encode("utf-8") if data else None
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as resp:
            content = resp.read()
            status = resp.status
            try:
                json_data = json.loads(content.decode("utf-8"))
            except Exception:
                json_data = content
            return status, json_data
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_content)
        except Exception:
            err_json = err_content
        return e.code, err_json

def run_tests():
    db = get_db()
    print("Testing connection to MongoDB...")
    assert db is not None, "Failed to connect to MongoDB"
    print("Connected to database:", db.name)

    # Clean up any leftover test transactions
    db["daily_account_records"].delete_many({"reference_no": {"$regex": "^TEST-"}})
    db["daily_account_audits"].delete_many({"reference_no": {"$regex": "^TEST-"}})

    # ---------------------------------------------------------
    # 1. MONEY ORDERS
    # ---------------------------------------------------------
    print("\n--- 1. Testing Money Orders Persistence ---")
    mo_ref = f"TEST-MO-{uuid.uuid4().hex[:6].upper()}"
    mo_payload = {
        "category": "Money Orders",
        "office_id": OFFICE,
        "date": TODAY,
        "reference_no": mo_ref,
        "remitter": "Sunimal Perera",
        "recipient": "Fathima Farook",
        "amount": 7500.0,
        "service_fee": 150.0,
        "payment_method": "Cash",
        "status": "Submitted",
        "remarks": "Automated persistence test MO",
    }
    status, mo_doc = req("POST", "/api/daily-accounts/transactions", mo_payload)
    assert status == 201, f"Failed to create MO: {status} {mo_doc}"
    assert mo_doc["reference_no"] == mo_ref
    assert mo_doc["amount"] == 7500.0
    assert mo_doc["gl_code"] == "GL-1104"
    print("Created Money Order:", mo_doc["id"])

    # Verify in MongoDB
    db_mo = db["daily_account_records"].find_one({"reference_no": mo_ref})
    assert db_mo is not None, "Money Order not found in MongoDB daily_account_records!"
    assert db_mo["amount"] == 7500.0
    print("Verified in MongoDB daily_account_records [OK]")

    # Duplicate prevention test
    status_dup, dup_doc = req("POST", "/api/daily-accounts/transactions", mo_payload)
    assert status_dup == 409, f"Expected 409 Conflict for duplicate MO ref, got {status_dup}"
    print("Duplicate reference prevention verified (HTTP 409) [OK]")

    # ---------------------------------------------------------
    # 2. POSTAL SERVICES
    # ---------------------------------------------------------
    print("\n--- 2. Testing Postal Services Persistence ---")
    ps_ref = f"TEST-PS-{uuid.uuid4().hex[:6].upper()}"
    ps_payload = {
        "category": "Postal Services",
        "service_type": "Speed Post / EMS",
        "office_id": OFFICE,
        "date": TODAY,
        "reference_no": ps_ref,
        "count": 3,
        "unit_charge": 250.0,
        "amount": 750.0,
        "payment_method": "Cash",
        "status": "Submitted",
        "remarks": "Express dispatch test",
    }
    status, ps_doc = req("POST", "/api/daily-accounts/postal-services", ps_payload)
    assert status == 201, f"Failed to create PS: {status} {ps_doc}"
    assert ps_doc["reference_no"] == ps_ref
    print("Created Postal Service:", ps_doc["id"])

    db_ps = db["daily_account_records"].find_one({"reference_no": ps_ref})
    assert db_ps is not None, "Postal Service not found in MongoDB!"
    assert db_ps["amount"] == 750.0
    print("Verified in MongoDB daily_account_records [OK]")

    # ---------------------------------------------------------
    # 3. UTILITY COLLECTIONS
    # ---------------------------------------------------------
    print("\n--- 3. Testing Utility Collections Persistence ---")
    uc_ref = f"TEST-UC-{uuid.uuid4().hex[:6].upper()}"
    uc_payload = {
        "category": "Utility Collections",
        "provider": "CEB",
        "customer_ref": "CEB-99887766",
        "office_id": OFFICE,
        "date": TODAY,
        "reference_no": uc_ref,
        "amount": 4250.0,
        "commission": 25.0,
        "status": "Submitted",
        "remarks": "CEB Bill Payment",
    }
    status, uc_doc = req("POST", "/api/daily-accounts/utility-collections", uc_payload)
    assert status == 201, f"Failed to create UC: {status} {uc_doc}"
    assert uc_doc["reference_no"] == uc_ref
    print("Created Utility Collection:", uc_doc["id"])

    db_uc = db["daily_account_records"].find_one({"reference_no": uc_ref})
    assert db_uc is not None, "Utility record not found in MongoDB!"
    print("Verified in MongoDB daily_account_records [OK]")

    # ---------------------------------------------------------
    # 4. PENSION & WELFARE
    # ---------------------------------------------------------
    print("\n--- 4. Testing Pension & Welfare Persistence ---")
    pw_ref = f"TEST-PW-{uuid.uuid4().hex[:6].upper()}"
    pw_payload = {
        "category": "Pension & Welfare",
        "transaction_type": "Civil Pension",
        "beneficiary_ref": "NIC-195234567V",
        "office_id": OFFICE,
        "date": TODAY,
        "reference_no": pw_ref,
        "amount": 32000.0,
        "payment_status": "Paid",
        "status": "Submitted",
        "remarks": "Senior citizen pension disbursement",
    }
    status, pw_doc = req("POST", "/api/daily-accounts/pension-welfare", pw_payload)
    assert status == 201, f"Failed to create PW: {status} {pw_doc}"
    assert pw_doc["reference_no"] == pw_ref
    print("Created Pension Disbursement:", pw_doc["id"])

    db_pw = db["daily_account_records"].find_one({"reference_no": pw_ref})
    assert db_pw is not None, "Pension record not found in MongoDB!"
    print("Verified in MongoDB daily_account_records [OK]")

    # ---------------------------------------------------------
    # 5. CASH & STAMP STOCK
    # ---------------------------------------------------------
    print("\n--- 5. Testing Cash & Stamp Stock Persistence ---")
    st_err_payload = {
        "category": "Stamp Stock Ledger",
        "stock_type": "Postage Stamp",
        "denomination": 25.0,
        "office_id": OFFICE,
        "date": TODAY,
        "opening_qty": 100,
        "receipts_qty": 50,
        "issued_qty": 20,
        "damaged_qty": 5,
        "closing_qty": 140,  # Invalid: 100 + 50 - 20 - 5 = 125, not 140
    }
    status_err, err_res = req("POST", "/api/daily-accounts/stamp-stock", st_err_payload)
    assert status_err == 400, f"Expected 400 for balance error, got {status_err}"
    print("Stock balance equation validation verified (HTTP 400) [OK]")

    st_ref = f"TEST-ST-{uuid.uuid4().hex[:6].upper()}"
    st_payload = {
        "category": "Stamp Stock Ledger",
        "stock_type": "Postage Stamp",
        "denomination": 25.0,
        "office_id": OFFICE,
        "date": TODAY,
        "reference_no": st_ref,
        "opening_qty": 100,
        "receipts_qty": 50,
        "issued_qty": 20,
        "damaged_qty": 5,
        "closing_qty": 125,
        "closing_value": 3125.0,
        "amount": 3125.0,
        "status": "Submitted",
        "remarks": "Daily vault stock count",
    }
    status, st_doc = req("POST", "/api/daily-accounts/stamp-stock", st_payload)
    assert status == 201, f"Failed to create ST: {status} {st_doc}"
    assert st_doc["reference_no"] == st_ref
    print("Created Stamp Stock Entry:", st_doc["id"])

    db_st = db["daily_account_records"].find_one({"reference_no": st_ref})
    assert db_st is not None, "Stamp Stock record not found in MongoDB!"
    assert db_st["closing_qty"] == 125
    print("Verified in MongoDB daily_account_records [OK]")

    # ---------------------------------------------------------
    # 6. EXPENSES & IMPREST
    # ---------------------------------------------------------
    print("\n--- 6. Testing Expenses & Imprest Persistence ---")
    exp_ref = f"TEST-EXP-{uuid.uuid4().hex[:6].upper()}"
    exp_payload = {
        "category": "Expenses & Imprest",
        "expense_category": "Fuel & Conveyance",
        "payee": "Ceylon Petroleum Corp - Fort Station",
        "office_id": OFFICE,
        "date": TODAY,
        "reference_no": exp_ref,
        "amount": 4500.0,
        "payment_method": "Cash from Imprest",
        "status": "Submitted",
        "remarks": "Delivery van fuel voucher",
    }
    status, exp_doc = req("POST", "/api/daily-accounts/expenses-imprest", exp_payload)
    assert status == 201, f"Failed to create Expense: {status} {exp_doc}"
    assert exp_doc["reference_no"] == exp_ref
    assert exp_doc["flow_type"] == "expense"
    assert exp_doc["gl_code"] == "GL-5102"
    print("Created Expense Transaction:", exp_doc["id"])

    db_exp = db["daily_account_records"].find_one({"reference_no": exp_ref})
    assert db_exp is not None, "Expense record not found in MongoDB!"
    assert db_exp["amount"] == 4500.0
    print("Verified in MongoDB daily_account_records [OK]")

    # ---------------------------------------------------------
    # 7. POSTMASTER STATUS APPROVAL / REVIEW
    # ---------------------------------------------------------
    print("\n--- 7. Testing Postmaster Status Review Workflow ---")
    status, rev_doc = req(
        "PATCH",
        f"/api/daily-accounts/transactions/{mo_doc['id']}/status",
        {"status": "Reviewed", "remarks": "Audited and verified by Postmaster"},
    )
    assert status == 200, f"Failed to review status: {status} {rev_doc}"
    assert rev_doc["status"] == "Reviewed"
    print("Approved transaction status:", rev_doc["id"])

    db_mo_updated = db["daily_account_records"].find_one({"id": mo_doc["id"]})
    assert db_mo_updated["status"] == "Reviewed", "Status not updated in MongoDB!"
    print("Verified status update in MongoDB [OK]")

    # ---------------------------------------------------------
    # 8. GL CODE APPROVAL / OVERRIDE
    # ---------------------------------------------------------
    print("\n--- 8. Testing GL Prediction Review & Override ---")
    status, gl_doc = req(
        "POST",
        f"/api/daily-accounts/gl-predictions/{exp_doc['id']}/approve",
        {"approved_gl_code": "GL-5102-AUDITED"},
    )
    assert status == 200, f"Failed to approve GL code: {status} {gl_doc}"
    print("Approved GL classification for record:", exp_doc["id"])

    db_exp_gl = db["daily_account_records"].find_one({"id": exp_doc["id"]})
    assert db_exp_gl["approved_gl_code"] == "GL-5102-AUDITED", "GL code not updated in MongoDB!"
    print("Verified GL code updated in MongoDB [OK]")

    # ---------------------------------------------------------
    # 9. RETRIEVING LIVE CATEGORY RECORDS & TRANSACTIONS
    # ---------------------------------------------------------
    print("\n--- 9. Testing Category Query Endpoints ---")
    categories_to_test = [
        "Money Orders",
        "Postal Services",
        "Utility Collections",
        "Pension & Welfare",
        "Cash & Stamp Stock",
        "Expenses & Imprest",
    ]
    for cat in categories_to_test:
        status, data = req(
            "GET",
            "/api/daily-accounts/category-records",
            params={"category": cat, "office_id": OFFICE, "data_mode": "auto"},
        )
        assert status == 200, f"Failed to get category records for {cat}: {status} {data}"
        print(f"[{cat}] total_records: {data.get('total_records')}, total_amount: {data.get('total_amount')}")

        status, tx_data = req(
            "GET",
            "/api/daily-accounts/transactions",
            params={"category": cat, "office_id": OFFICE, "data_mode": "auto", "limit": 10},
        )
        assert status == 200, f"Failed to get transactions for {cat}: {status} {tx_data}"
        print(f"[{cat}] clerk txs found: {len(tx_data.get('records', []))}")

    # ---------------------------------------------------------
    # 10. AUDIT HISTORY LIVE LOGS
    # ---------------------------------------------------------
    print("\n--- 10. Testing Audit History ---")
    status, audits = req("GET", "/api/daily-accounts/audit-history")
    assert status == 200, f"Failed to get audit history: {status} {audits}"
    assert len(audits) > 0, "No audit records returned!"
    actions = [a.get("action") for a in audits[:10]]
    print("Recent audit actions in database:", actions)
    assert any("CREATE_CLERK_TRANSACTION" in str(act) for act in actions)
    assert any("REVIEW_TRANSACTION" in str(act) for act in actions)
    print("Audit History logs verified [OK]")

    # ---------------------------------------------------------
    # 11. EXCEL EXPORT FROM REAL DATABASE RECORDS
    # ---------------------------------------------------------
    print("\n--- 11. Testing Category Excel Export Endpoints ---")
    status, exp_mo_bytes = req(
        "GET",
        "/api/daily-accounts/export/category",
        params={"category": "Money Orders", "office_id": OFFICE},
    )
    assert status == 200, f"MO Excel export failed: {status}"
    assert len(exp_mo_bytes) > 1000, "Empty MO Excel file"
    print("Money Orders Excel export verified (size:", len(exp_mo_bytes), "bytes) [OK]")

    status, exp_exp_bytes = req(
        "GET",
        "/api/daily-accounts/export/category",
        params={"category": "Expenses & Imprest", "office_id": OFFICE},
    )
    assert status == 200, f"Expenses Excel export failed: {status}"
    assert len(exp_exp_bytes) > 1000, "Empty Expenses Excel file"
    print("Expenses & Imprest Excel export verified (size:", len(exp_exp_bytes), "bytes) [OK]")

    # Clean up test records
    db["daily_account_records"].delete_many({"reference_no": {"$regex": "^TEST-"}})
    db["daily_account_audits"].delete_many({"reference_no": {"$regex": "^TEST-"}})
    print("\n=======================================================")
    print("ALL 11 VERIFICATION TESTS PASSED SUCCESSFULLY! ")
    print("=======================================================")

if __name__ == "__main__":
    run_tests()
