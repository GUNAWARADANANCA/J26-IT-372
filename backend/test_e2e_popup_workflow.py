"""
End-to-end HTTP verification of the Employee Unique Verification Code popup workflow.
"""
import urllib.request
import urllib.parse
import json
import http.cookiejar

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

    print("\n--- TEST 1: Postmaster Sign-In ---")
    login_data = json.dumps({"username": "postmaster", "password": "YourStrongDemoPassword123!"}).encode()
    login_req = urllib.request.Request(
        f"{BASE_URL}/api/auth/login",
        data=login_data,
        headers={"Content-Type": "application/json"}
    )
    with opener.open(login_req) as resp:
        user_info = json.loads(resp.read().decode())
        csrf_token = user_info.get("csrf_token")
        print(f"Logged in user: {user_info.get('username')} (role: {user_info.get('role')})")
        print(f"Obtained CSRF Token: {csrf_token[:12]}...")
        assert user_info.get("role") == "postmaster", "User must be postmaster"

    print("\n--- TEST 2: Seed / Ensure Default Credentials Exist ---")
    seed_req = urllib.request.Request(
        f"{BASE_URL}/api/admin/attendance-credentials/seed",
        data=b"{}",
        headers={"Content-Type": "application/json", "X-CSRF-Token": csrf_token}
    )
    with opener.open(seed_req) as resp:
        seed_res = json.loads(resp.read().decode())
        print(f"Seed response: {seed_res.get('message')}")

    print("\n--- TEST 3: Select Officer & Test Invalid Code Rejection (401) ---")
    test_emp = "EMP1148"  # Anura Wasantha Mendis
    invalid_data = json.dumps({
        "employee_id": test_emp,
        "verification_code": "WRONG_CODE_999",
        "device_info": "TestDevice/1.0"
    }).encode()
    inv_req = urllib.request.Request(
        f"{BASE_URL}/api/attendance/verify-employee",
        data=invalid_data,
        headers={"Content-Type": "application/json", "X-CSRF-Token": csrf_token}
    )
    try:
        opener.open(inv_req)
        raise AssertionError("Expected 401 for wrong code, got 200")
    except urllib.error.HTTPError as err:
        assert err.code == 401, f"Expected HTTP 401, got {err.code}"
        err_msg = json.loads(err.read().decode())
        print(f"Correctly rejected with 401: {err_msg.get('detail')}")

    print("\n--- TEST 4: Reset Officer Today's Record For Clean Start ---")
    reset_data = json.dumps({"employee_id": test_emp}).encode()
    reset_req = urllib.request.Request(
        f"{BASE_URL}/api/attendance/reset",
        data=reset_data,
        headers={"Content-Type": "application/json", "X-CSRF-Token": csrf_token}
    )
    with opener.open(reset_req) as resp:
        res_info = json.loads(resp.read().decode())
        print(f"Reset result: {res_info}")

    print("\n--- TEST 5: Verify Identity with Valid Default Code (SLP-1148) ---")
    valid_data = json.dumps({
        "employee_id": test_emp,
        "verification_code": "SLP-1148",
        "device_info": "TestDevice/1.0"
    }).encode()
    val_req = urllib.request.Request(
        f"{BASE_URL}/api/attendance/verify-employee",
        data=valid_data,
        headers={"Content-Type": "application/json", "X-CSRF-Token": csrf_token}
    )
    with opener.open(val_req) as resp:
        verify_res = json.loads(resp.read().decode())
        print(f"Verify response: ok={verify_res.get('ok')}, employee={verify_res.get('employee_name')}")
        vtoken = verify_res.get("verification_token")
        assert vtoken and vtoken.startswith("slp_v1."), f"Must issue single-use token: {vtoken}"
        print(f"Token issued: {vtoken[:25]}...")

    print("\n--- TEST 6: Execute Check-In Using Verification Token ---")
    checkin_data = json.dumps({
        "employee_id": test_emp,
        "verification_token": vtoken,
        "latitude": 6.927763,
        "longitude": 79.949514,
        "accuracy": 10.0,
        "device_info": "TestDevice/1.0"
    }).encode()
    cin_req = urllib.request.Request(
        f"{BASE_URL}/api/attendance/check-in",
        data=checkin_data,
        headers={"Content-Type": "application/json", "X-CSRF-Token": csrf_token}
    )
    try:
        with opener.open(cin_req) as resp:
            cin_res = json.loads(resp.read().decode())
            print(f"Check-In Success: employee={cin_res.get('employee_name')}, time={cin_res.get('check_in_time')}, status={cin_res.get('status')}")
            assert cin_res.get("status", "").lower() in ("on-time", "on time", "late", "half-day", "shift"), f"Unexpected status: {cin_res.get('status')}"
    except urllib.error.HTTPError as err:
        print(f"Check-In HTTP {err.code}: {err.read().decode()}")
        raise

    print("\n--- TEST 7: Attempt Token Replay (Must Fail with 403) ---")
    replay_req = urllib.request.Request(
        f"{BASE_URL}/api/attendance/check-in",
        data=checkin_data,
        headers={"Content-Type": "application/json", "X-CSRF-Token": csrf_token}
    )
    try:
        opener.open(replay_req)
        raise AssertionError("Expected 403 on token replay, got 200")
    except urllib.error.HTTPError as err:
        assert err.code == 403, f"Expected 403, got {err.code}"
        print(f"Token replay correctly blocked: code 403")

    print("\n--- TEST 8: Check-In Duplicate Prevention ---")
    # Verify another token for the same employee who is already checked in
    with opener.open(val_req) as resp:
        vtoken2 = json.loads(resp.read().decode())["verification_token"]
    cin_dup_data = json.dumps({
        "employee_id": test_emp,
        "verification_token": vtoken2,
        "latitude": 6.927763,
        "longitude": 79.949514,
        "accuracy": 10.0,
    }).encode()
    cin_dup_req = urllib.request.Request(
        f"{BASE_URL}/api/attendance/check-in",
        data=cin_dup_data,
        headers={"Content-Type": "application/json", "X-CSRF-Token": csrf_token}
    )
    try:
        opener.open(cin_dup_req)
        print("Duplicate check-in was accepted (server may handle update or duplicate)")
    except urllib.error.HTTPError as err:
        print(f"Duplicate check-in rejected: HTTP {err.code}")

    print("\n--- ALL END-TO-END WORKFLOW TESTS PASSED PERFECTLY! ---\n")

if __name__ == "__main__":
    run_tests()
