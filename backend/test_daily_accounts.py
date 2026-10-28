"""Unit tests for Daily Accounts Engine."""

import io
import unittest

import openpyxl

from daily_accounts import (
    CATEGORY_DEFINITIONS,
    _IN_MEMORY_AUDITS,
    _IN_MEMORY_BATCHES,
    _IN_MEMORY_ISSUES,
    _IN_MEMORY_RECORDS,
    approve_gl_prediction_item,
    auto_detect_column_mapping,
    commit_import_batch,
    delete_daily_account_batch,
    detect_dataset_category,
    get_all_imports,
    get_audit_history_list,
    get_cash_reconciliation,
    get_category_records,
    get_daily_accounts_summary,
    get_daily_money_order_dual_chart,
    get_gl_predictions_list,
    get_import_validation_report,
    get_monthly_revenue_breakdown,
    get_recent_uploaded_sheets,
    get_validation_issues_list,
    get_weekly_transaction_trend,
    inspect_file_sheets,
    map_category_to_standard,
    parse_and_validate_file,
    predict_gl_classification,
    resolve_validation_issue_item,
    seed_demo_daily_accounts,
    _sanitize_cell,
    create_clerk_transaction,
    export_advanced_accounting_report_excel,
    export_category_daily_excel,
    export_consolidated_daily_report_excel,
    get_advanced_accounting_report,
    get_clerk_transaction_by_id,
    get_clerk_transactions,
    get_sl_today_str,
    update_transaction_status,
)
from auth import (
    ROLE_CLERK,
    ROLE_POSTMASTER,
    bootstrap_clerk,
    verify_password,
)


class TestDailyAccountsEngine(unittest.TestCase):
    def setUp(self):
        seed_demo_daily_accounts(force=True)

    def test_category_mapping(self):
        self.assertEqual(map_category_to_standard("CEB Bill Payment"), "CEB Collections")
        self.assertEqual(map_category_to_standard("Money Order Issue"), "Money Orders")
        self.assertEqual(map_category_to_standard("LECO payment"), "LECO Collections")
        self.assertEqual(map_category_to_standard("Water Board"), "Water Board Collections")
        self.assertEqual(map_category_to_standard("Dialog GSM"), "Dialog")
        self.assertEqual(map_category_to_standard("SLT broadband"), "SLT/Mobitel")
        self.assertEqual(map_category_to_standard("Postage Stamps"), "Postage Stamps & Philatelic")
        self.assertEqual(map_category_to_standard("Pension Payment"), "Pension & Welfare")
        self.assertEqual(map_category_to_standard("Office fuel petty"), "Office Expenses & Imprest")

    def test_gl_prediction(self):
        pred_ceb = predict_gl_classification("CEB Collections", 15000.0)
        self.assertEqual(pred_ceb["predicted_gl_code"], "GL-2105")
        self.assertFalse(pred_ceb["is_revenue"])

        pred_stamps = predict_gl_classification("Postage Stamps & Philatelic", 5000.0)
        self.assertEqual(pred_stamps["predicted_gl_code"], "GL-4101")
        self.assertTrue(pred_stamps["is_revenue"])

    def test_parse_valid_csv(self):
        csv_text = (
            "Date,Category,Count,Amount,Reference No\n"
            "2026-07-15,Money Orders,10,25000,REF-101\n"
            "2026-07-15,CEB Collections,15,45000,REF-102\n"
            "2026-07-15,Postage Stamps & Philatelic,50,12000,REF-103\n"
        )
        batch_meta, records, issues = parse_and_validate_file(
            csv_text.encode("utf-8"), "test_accounts.csv"
        )
        self.assertEqual(batch_meta["total_rows"], 3)
        self.assertEqual(batch_meta["accepted_count"], 3)
        self.assertEqual(len(issues), 0)
        self.assertEqual(records[0]["category"], "Money Orders")
        self.assertEqual(records[0]["amount"], 25000.0)

    def test_parse_csv_with_errors_and_duplicates(self):
        csv_text = (
            "Date,Category,Count,Amount,Reference No\n"
            ",Money Orders,10,25000,REF-101\n"  # Missing date
            "2026-07-15,,15,45000,REF-102\n"  # Missing category
            "2026-07-15,CEB Collections,5,,REF-103\n"  # Missing amount
            "2026-07-15,CEB Collections,5,10000,REF-101\n"  # Duplicate REF-101
        )
        batch_meta, records, issues = parse_and_validate_file(
            csv_text.encode("utf-8"), "test_err.csv"
        )
        self.assertEqual(batch_meta["total_rows"], 4)
        self.assertGreater(len(issues), 0)
        severities = [i["severity"] for i in issues]
        self.assertIn("Error", severities)
        self.assertIn("Warning", severities)

    def test_parse_excel(self):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "DailyAccounts"
        ws.append(["Transaction Date", "Service Category", "Volume", "LKR Amount", "Voucher ID"])
        ws.append(["2026-08-01", "Money Orders", 25, 65000, "V-001"])
        ws.append(["2026-08-01", "LECO Collections", 30, 72000, "V-002"])

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        batch_meta, records, issues = parse_and_validate_file(
            buf.getvalue(), "DailyAccounts.xlsx"
        )
        self.assertEqual(batch_meta["total_rows"], 2)
        self.assertEqual(records[1]["category"], "LECO Collections")
        self.assertEqual(records[1]["amount"], 72000.0)

    def test_commit_import_batch(self):
        batch_meta = {
            "batch_id": "BATCH-TEST-001",
            "file_name": "test.xlsx",
            "total_rows": 1,
            "accepted_count": 1,
        }
        records = [{
            "id": "REC-TEST-001",
            "batch_id": "BATCH-TEST-001",
            "category": "Money Orders",
            "amount": 5000.0,
            "status": "Complete",
        }]
        issues = [{
            "id": "ISS-TEST-001",
            "severity": "Warning",
            "message": "Sample warning",
            "status": "Pending",
        }]
        res = commit_import_batch(batch_meta, records, issues, "Test Officer")
        self.assertEqual(res["imported_rows"], 1)

    def test_summary_and_completeness_metrics(self):
        summary = get_daily_accounts_summary("PO-COLOMBO-CENTRAL")
        kpis = summary["kpi_cards"]
        self.assertEqual(kpis["money_orders"]["value"], 1248)
        self.assertEqual(kpis["utility_collections"]["formatted_value"], "LKR 523,680")
        self.assertEqual(kpis["postal_revenue"]["formatted_value"], "LKR 1,245,320")
        self.assertEqual(kpis["validation_issues"]["value"], 42)

        completeness = summary["completeness"]
        self.assertEqual(completeness["percent"], 92)
        self.assertEqual(completeness["total_transactions"], 1254)

    def test_weekly_trend_and_dual_chart(self):
        trend = get_weekly_transaction_trend()
        self.assertEqual(len(trend["categories"]), 7)
        self.assertEqual(len(trend["series"]), 3)

        dual = get_daily_money_order_dual_chart()
        self.assertEqual(len(dual["categories"]), 7)
        self.assertEqual(len(dual["bars"]["data"]), 7)
        self.assertEqual(len(dual["line"]["data"]), 7)

    def test_monthly_revenue_breakdown(self):
        breakdown = get_monthly_revenue_breakdown()
        self.assertEqual(len(breakdown["slices"]), 12)
        self.assertEqual(breakdown["formatted_total"], "LKR 1,245,320")
        slice_names = [s["name"] for s in breakdown["slices"]]
        self.assertIn("Money Orders", slice_names)
        self.assertIn("CEB", slice_names)
        self.assertIn("Postage Stamps & Philatelic", slice_names)

    def test_cash_reconciliation(self):
        recon = get_cash_reconciliation()
        labels = [it["label"] for it in recon["items"]]
        self.assertIn("Opening Cash", labels)
        self.assertIn("Collections", labels)
        self.assertIn("Payments / Disbursements", labels)
        self.assertIn("Expenses", labels)
        self.assertIn("Expected Closing Cash", labels)
        self.assertIn("Counted Closing Cash", labels)
        self.assertIn("Variance", labels)
        var_item = next(it for it in recon["items"] if it["label"] == "Variance")
        self.assertEqual(var_item["amount"], -840.0)

    def test_recent_uploaded_sheets(self):
        recent = get_recent_uploaded_sheets()
        self.assertEqual(len(recent), 5)
        self.assertEqual(recent[0]["category"], "Money Orders")
        self.assertEqual(recent[0]["count"], 342)

    def test_validation_issue_resolution_and_audit(self):
        issues = get_validation_issues_list()
        self.assertGreater(len(issues), 0)
        target = issues[0]["id"]
        updated = resolve_validation_issue_item(target, "Corrected value", "Auditor Perera")
        self.assertEqual(updated["status"], "Resolved")
        self.assertEqual(updated["resolved_by"], "Auditor Perera")

        audits = get_audit_history_list()
        self.assertTrue(any(a.get("action") == "RESOLVE_VALIDATION_ISSUE" for a in audits))

    def test_gl_approval(self):
        preds = get_gl_predictions_list()
        self.assertGreater(len(preds), 0)
        target_id = preds[0]["id"]
        approved = approve_gl_prediction_item(target_id, "GL-4101", "Account Officer Silva")
        self.assertEqual(approved["approved_gl_code"], "GL-4101")
        self.assertEqual(approved["gl_status"], "Approved")

    def test_inspect_file_sheets_excel_and_csv(self):
        # 1. Multi-sheet Excel inspection
        wb = openpyxl.Workbook()
        ws1 = wb.active
        ws1.title = "Summary_Sheet"
        ws1.append(["Txn Date", "Service Type", "Amount LKR", "Ref Voucher"])
        ws1.append(["2026-07-20", "Postage Stamps", 2500, "V-101"])

        ws2 = wb.create_sheet("Utility_Bills")
        ws2.append(["Bill Date", "Utility Provider", "Total Amount", "Receipt ID"])
        ws2.append(["2026-07-20", "CEB Collections", 14500, "R-202"])

        buf = io.BytesIO()
        wb.save(buf)
        excel_bytes = buf.getvalue()

        info = inspect_file_sheets(excel_bytes, "AccountsWorkbook.xlsx")
        self.assertEqual(info["file_name"], "AccountsWorkbook.xlsx")
        self.assertEqual(info["sheet_names"], ["Summary_Sheet", "Utility_Bills"])
        self.assertEqual(info["selected_sheet"], "Summary_Sheet")
        self.assertIn("Txn Date", info["detected_headers"])
        self.assertEqual(info["suggested_mapping"].get("date"), "Txn Date")
        self.assertEqual(info["suggested_mapping"].get("amount"), "Amount LKR")

        # 2. CSV inspection
        csv_bytes = "TxnDate,Department,GrossSum,Ticket\n2026-07-21,Dialog,4500,T-11".encode("utf-8")
        csv_info = inspect_file_sheets(csv_bytes, "DialogBills.csv")
        self.assertEqual(csv_info["sheet_names"], ["Sheet1"])
        self.assertIn("TxnDate", csv_info["detected_headers"])
        self.assertEqual(len(csv_info["sample_rows"]), 1)

    def test_parse_with_sheet_selection_and_custom_mapping(self):
        wb = openpyxl.Workbook()
        ws_main = wb.active
        ws_main.title = "CoverSheet"
        ws_main.append(["Title", "Notes"])
        ws_main.append(["Colombo Post Office Daily Accounts", "Confidential"])

        ws_data = wb.create_sheet("Transactions")
        ws_data.append(["CustomDate", "ServiceHead", "LKRNet", "SlipNumber", "Carrier"])
        ws_data.append(["2026-07-22", "Water Board", 8700, "SLIP-991", "NWSDB"])
        ws_data.append(["2026-07-22", "CEB Bill Payment", 12300, "SLIP-992", "CEB"])

        buf = io.BytesIO()
        wb.save(buf)

        custom_map = {
            "date": "CustomDate",
            "category": "ServiceHead",
            "amount": "LKRNet",
            "reference_no": "SlipNumber",
            "provider": "Carrier",
        }

        batch_meta, records, issues = parse_and_validate_file(
            buf.getvalue(),
            "CustomMapped.xlsx",
            sheet_name="Transactions",
            column_mapping=custom_map,
        )

        self.assertEqual(batch_meta["sheet_name"], "Transactions")
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0]["category"], "Water Board Collections")
        self.assertEqual(records[0]["amount"], 8700.0)
        self.assertEqual(records[0]["reference_no"], "SLIP-991")
        self.assertEqual(records[1]["category"], "CEB Collections")
        self.assertEqual(records[1]["amount"], 12300.0)
        self.assertEqual(records[1]["provider"], "CEB")

    def test_summary_row_exclusion_behavior(self):
        csv_content = (
            "Date,Category,Amount,Reference\n"
            "2026-08-01,Money Orders,10000,REF-01\n"
            "2026-08-01,Postage Stamps & Philatelic,5000,REF-02\n"
            "Grand Total,Total for Day,15000,\n"
        )

        # 1. With exclude_summary_rows=True (default)
        meta_excluded, recs_excluded, _ = parse_and_validate_file(
            csv_content.encode("utf-8"),
            "daily_report.csv",
            exclude_summary_rows=True,
        )
        self.assertEqual(len(recs_excluded), 2)
        self.assertFalse(any("Grand Total" in r.get("description", "") for r in recs_excluded))

        # 2. With exclude_summary_rows=False
        meta_included, recs_included, _ = parse_and_validate_file(
            csv_content.encode("utf-8"),
            "daily_report.csv",
            exclude_summary_rows=False,
        )
        self.assertEqual(len(recs_included), 3)
        summary_rec = next(r for r in recs_included if r.get("is_summary_row"))
        self.assertTrue(summary_rec["is_summary_row"])

    def test_real_vs_demo_segregation_and_deletion(self):
        # Seed fresh demo accounts
        seed_demo_daily_accounts(force=True)

        demo_summary = get_daily_accounts_summary("PO-COLOMBO-CENTRAL", data_mode="demo")
        self.assertGreater(demo_summary["completeness"]["total_transactions"], 0)

        # Commit a real batch
        batch_meta = {
            "batch_id": "BATCH-REAL-TEST-999",
            "file_name": "real_upload.xlsx",
            "sheet_name": "Sheet1",
            "office_id": "PO-COLOMBO-CENTRAL",
            "reporting_period": "2026-07-01 - 2026-07-31",
            "uploader": "Audit Test",
            "uploaded_at": "2026-07-15T10:00:00Z",
            "total_rows": 1,
            "accepted_count": 1,
            "warning_count": 0,
            "rejected_count": 0,
            "status": "Validated",
            "is_demo": False,
        }
        records = [{
            "id": "REC-REAL-999",
            "batch_id": "BATCH-REAL-TEST-999",
            "category": "Money Orders",
            "office_id": "PO-COLOMBO-CENTRAL",
            "amount": 9999.0,
            "count": 5,
            "flow_type": "inflow",
            "is_revenue": False,
            "status": "Complete",
            "date": "2026-07-25",
            "is_summary_row": False,
            "is_demo": False,
        }]
        commit_import_batch(batch_meta, records, [], "Auditor User")

        # In real data mode, we should see only real records
        real_summary = get_daily_accounts_summary("PO-COLOMBO-CENTRAL", data_mode="real")
        self.assertEqual(real_summary["kpi_cards"]["money_orders"]["value"], 5)

        # In category records
        cat_recs = get_category_records("Money Orders", data_mode="real")
        self.assertEqual(len(cat_recs["records"]), 1)
        self.assertEqual(cat_recs["records"][0]["id"], "REC-REAL-999")

        # Test batch deletion
        del_res = delete_daily_account_batch("BATCH-REAL-TEST-999", "Auditor User")
        self.assertTrue(del_res["success"])
        self.assertEqual(del_res["deleted_records"], 1)

        # Re-check real summary after deletion
        cleared_real_summary = get_daily_accounts_summary("PO-COLOMBO-CENTRAL", data_mode="real")
        self.assertEqual(cleared_real_summary["kpi_cards"]["money_orders"]["value"], 0)

    def test_inspect_file_sheets(self):
        csv_text = "TxnDate,Description,Qty,LKR,Voucher\n2026-08-01,CEB Bill,1,1500,V-01\n"
        inspect_res = inspect_file_sheets(csv_text.encode("utf-8"), "daily_data.csv")
        self.assertEqual(inspect_res["file_name"], "daily_data.csv")
        self.assertEqual(inspect_res["sheet_names"], ["Sheet1"])
        self.assertIn("TxnDate", inspect_res["detected_headers"])
        self.assertIn("LKR", inspect_res["detected_headers"])
        self.assertEqual(inspect_res["suggested_mapping"]["date"], "TxnDate")
        self.assertEqual(inspect_res["suggested_mapping"]["amount"], "LKR")

    def test_parse_and_validate_with_column_mapping_and_preview_totals(self):
        csv_text = (
            "CustomDate,CustomService,CustomBills,CustomLKR,RefID,CustomProvider\n"
            "2026-08-10,Money Orders,12,35000,MO-101,Sri Lanka Post\n"
            "2026-08-10,CEB Collections,20,48000,CEB-101,CEB\n"
            "2026-08-10,Postage Stamps & Philatelic,50,15000,ST-101,Counter\n"
            "2026-08-10,Grand Total,82,98000,TOTAL,Summary\n"
        )
        mapping = {
            "date": "CustomDate",
            "category": "CustomService",
            "count": "CustomBills",
            "amount": "CustomLKR",
            "reference_no": "RefID",
            "provider": "CustomProvider",
        }
        batch_meta, records, issues = parse_and_validate_file(
            content=csv_text.encode("utf-8"),
            filename="mapped.csv",
            column_mapping=mapping,
            exclude_summary_rows=True,
            office_id="PO-COLOMBO-CENTRAL",
        )
        # Grand Total row should be excluded
        self.assertEqual(batch_meta["total_rows"], 3)
        self.assertEqual(batch_meta["total_mo_count"], 12)
        self.assertEqual(batch_meta["total_mo_amount"], 35000.0)
        self.assertEqual(batch_meta["total_utility_bills"], 20)
        self.assertEqual(batch_meta["total_utility_amount"], 48000.0)
        self.assertEqual(batch_meta["total_postal_revenue"], 0.0)
        self.assertEqual(batch_meta["total_stamps_revenue"], 15000.0)
        self.assertEqual(batch_meta["detected_date_range"], "2026-08-10 - 2026-08-10")

    def test_commit_append_and_replace_modes(self):
        # 1. Commit first batch with 2 records
        batch_1_meta = {
            "batch_id": "BATCH-APPEND-01",
            "file_name": "batch1.csv",
            "sheet_name": "Sheet1",
            "office_id": "PO-COLOMBO-CENTRAL",
            "reporting_period": "2026-08-01 - 2026-08-05",
            "detected_date_range": "2026-08-01 - 2026-08-05",
            "min_date": "2026-08-01",
            "max_date": "2026-08-05",
            "total_rows": 2,
            "valid_rows": 2,
            "invalid_rows": 0,
            "duplicate_rows": 0,
        }
        records_1 = [
            {
                "id": "REC-A1",
                "batch_id": "BATCH-APPEND-01",
                "office_id": "PO-COLOMBO-CENTRAL",
                "date": "2026-08-01",
                "category": "Money Orders",
                "count": 1,
                "amount": 10000.0,
                "reference_no": "REF-UNIQUE-01",
                "flow_type": "inflow",
                "is_revenue": False,
                "status": "Complete",
                "is_valid": True,
                "is_duplicate": False,
                "is_demo": False,
            },
            {
                "id": "REC-A2",
                "batch_id": "BATCH-APPEND-01",
                "office_id": "PO-COLOMBO-CENTRAL",
                "date": "2026-08-02",
                "category": "CEB Collections",
                "count": 2,
                "amount": 20000.0,
                "reference_no": "REF-UNIQUE-02",
                "flow_type": "collection",
                "is_revenue": False,
                "status": "Complete",
                "is_valid": True,
                "is_duplicate": False,
                "is_demo": False,
            },
        ]
        res1 = commit_import_batch(batch_1_meta, records_1, [], import_mode="append")
        self.assertEqual(res1["inserted"], 2)

        # 2. Append second batch that contains 1 duplicate and 1 new record
        batch_2_meta = {
            "batch_id": "BATCH-APPEND-02",
            "file_name": "batch2.csv",
            "sheet_name": "Sheet1",
            "office_id": "PO-COLOMBO-CENTRAL",
            "reporting_period": "2026-08-01 - 2026-08-05",
            "min_date": "2026-08-01",
            "max_date": "2026-08-05",
            "total_rows": 2,
            "valid_rows": 2,
            "invalid_rows": 0,
            "duplicate_rows": 1,
        }
        records_2 = [
            {
                "id": "REC-A1-DUP",
                "batch_id": "BATCH-APPEND-02",
                "office_id": "PO-COLOMBO-CENTRAL",
                "date": "2026-08-01",
                "category": "Money Orders",
                "count": 1,
                "amount": 10000.0,
                "reference_no": "REF-UNIQUE-01", # Existing business key
                "flow_type": "inflow",
                "is_revenue": False,
                "status": "Complete",
                "is_valid": True,
                "is_duplicate": True,
                "is_demo": False,
            },
            {
                "id": "REC-A3-NEW",
                "batch_id": "BATCH-APPEND-02",
                "office_id": "PO-COLOMBO-CENTRAL",
                "date": "2026-08-03",
                "category": "Postage Stamps & Philatelic",
                "count": 10,
                "amount": 5000.0,
                "reference_no": "REF-UNIQUE-03",
                "flow_type": "revenue",
                "is_revenue": True,
                "status": "Complete",
                "is_valid": True,
                "is_duplicate": False,
                "is_demo": False,
            },
        ]
        res2 = commit_import_batch(batch_2_meta, records_2, [], import_mode="append")
        # Duplicate should be skipped
        self.assertEqual(res2["inserted"], 1)
        self.assertEqual(res2["skipped"], 1)

        # 3. Test Replace mode scoped to 2026-08-01 to 2026-08-05
        batch_replace_meta = {
            "batch_id": "BATCH-REPLACE-03",
            "file_name": "batch_replace.csv",
            "sheet_name": "Sheet1",
            "office_id": "PO-COLOMBO-CENTRAL",
            "reporting_period": "2026-08-01 - 2026-08-05",
            "min_date": "2026-08-01",
            "max_date": "2026-08-05",
            "total_rows": 1,
            "valid_rows": 1,
            "invalid_rows": 0,
            "duplicate_rows": 0,
        }
        records_replace = [
            {
                "id": "REC-REP-NEW",
                "batch_id": "BATCH-REPLACE-03",
                "office_id": "PO-COLOMBO-CENTRAL",
                "date": "2026-08-04",
                "category": "Money Orders",
                "count": 8,
                "amount": 42000.0,
                "reference_no": "REF-REP-01",
                "flow_type": "inflow",
                "is_revenue": False,
                "status": "Complete",
                "is_valid": True,
                "is_duplicate": False,
                "is_demo": False,
            }
        ]
        res3 = commit_import_batch(batch_replace_meta, records_replace, [], import_mode="replace")
        self.assertEqual(res3["inserted"], 1)

        # Summary for real data in Colombo Central should now have exactly REC-REP-NEW
        summary = get_daily_accounts_summary("PO-COLOMBO-CENTRAL", data_mode="real")
        self.assertEqual(summary["kpi_cards"]["money_orders"]["value"], 8)

    def test_get_all_imports_and_validation_report(self):
        imports = get_all_imports("PO-COLOMBO-CENTRAL")
        self.assertIsInstance(imports, list)
        if len(imports) > 0:
            batch_id = imports[0]["batch_id"]
            report = get_import_validation_report(batch_id)
            self.assertEqual(report["batch_id"], batch_id)
            self.assertIn("csv", report)


class TestDynamicCategoryKpiPersistence(unittest.TestCase):
    """
    Unit tests ensuring the four KPI cards:
    1. Money Orders
    2. Utility Collections
    3. Postal Revenue
    4. Stamps Counter Revenue
    maintain independent category updates, category-wise persistence in real data mode,
    proper 'No Data' fallback states, and category-scoped replacement.
    """

    def setUp(self):
        self.office_id = "PO-TEST-DYNAMIC-KPI"
        from daily_accounts import (
            _IN_MEMORY_BATCHES,
            _IN_MEMORY_RECORDS,
            _get_collection,
            COLLECTION_BATCHES,
            COLLECTION_RECORDS,
        )

        coll_r = _get_collection(COLLECTION_RECORDS)
        if coll_r is not None:
            try:
                coll_r.delete_many({"office_id": self.office_id})
            except Exception:
                pass
        coll_b = _get_collection(COLLECTION_BATCHES)
        if coll_b is not None:
            try:
                coll_b.delete_many({"office_id": self.office_id})
            except Exception:
                pass
        for k in list(_IN_MEMORY_RECORDS.keys()):
            if _IN_MEMORY_RECORDS[k].get("office_id") == self.office_id:
                del _IN_MEMORY_RECORDS[k]
        for k in list(_IN_MEMORY_BATCHES.keys()):
            if _IN_MEMORY_BATCHES[k].get("office_id") == self.office_id:
                del _IN_MEMORY_BATCHES[k]

    def test_initial_empty_state_shows_no_data(self):
        """When no data has been imported for this office, all 4 cards show 'No Data'."""
        summary = get_daily_accounts_summary(self.office_id, data_mode="real")
        cards = summary["kpi_cards"]

        for cat_key in ("money_orders", "utility_collections", "postal_revenue", "stamps_revenue"):
            card = cards[cat_key]
            self.assertFalse(card["has_data"])
            self.assertEqual(card["formatted_value"], "No Data")
            self.assertEqual(card["formatted_amount"], "No Data")
            self.assertEqual(card["badge"], "NO DATA")
            self.assertIn("Upload", card.get("status_label", ""))

    def test_example_a_upload_money_orders_only_updates_money_orders(self):
        """Example A: Upload PMT Money Orders -> Only MO card updates; Utility, Postal, Stamps stay No Data."""
        batch_meta = {
            "batch_id": "BATCH-MO-01",
            "file_name": "pmt_money_orders.csv",
            "office_id": self.office_id,
            "reporting_period": "2026-08-01 - 2026-08-10",
            "min_date": "2026-08-01",
            "max_date": "2026-08-10",
            "total_rows": 2,
            "valid_rows": 2,
            "invalid_rows": 0,
            "duplicate_rows": 0,
            "dataset_category": "money_orders",
        }
        records = [
            {
                "id": "REC-MO-01",
                "batch_id": "BATCH-MO-01",
                "office_id": self.office_id,
                "date": "2026-08-02",
                "category": "Money Orders",
                "dataset_category": "money_orders",
                "count": 10,
                "amount": 75000.0,
                "reference_no": "PMT-001",
                "flow_type": "inflow",
                "is_revenue": False,
                "status": "Complete",
                "is_valid": True,
                "is_demo": False,
            },
            {
                "id": "REC-MO-02",
                "batch_id": "BATCH-MO-01",
                "office_id": self.office_id,
                "date": "2026-08-05",
                "category": "Money Orders",
                "dataset_category": "money_orders",
                "count": 5,
                "amount": 50000.0,
                "reference_no": "PMT-002",
                "flow_type": "inflow",
                "is_revenue": False,
                "status": "Complete",
                "is_valid": True,
                "is_demo": False,
            },
        ]
        res = commit_import_batch(batch_meta, records, [], import_mode="append", dataset_category="money_orders")
        self.assertEqual(res["inserted"], 2)

        summary = get_daily_accounts_summary(self.office_id, data_mode="real")
        cards = summary["kpi_cards"]

        # Money Orders must reflect the imported data
        self.assertTrue(cards["money_orders"]["has_data"])
        self.assertEqual(cards["money_orders"]["value"], 15)
        self.assertEqual(cards["money_orders"]["formatted_value"], "15")
        self.assertIn("15", cards["money_orders"]["secondary_metric"])
        self.assertEqual(cards["money_orders"]["amount"], 125000.0)
        self.assertIn("125,000", cards["money_orders"]["formatted_amount"])

        # Utility Collections, Postal Revenue, Stamps Counter must remain No Data
        self.assertFalse(cards["utility_collections"]["has_data"])
        self.assertEqual(cards["utility_collections"]["formatted_value"], "No Data")
        self.assertFalse(cards["postal_revenue"]["has_data"])
        self.assertEqual(cards["postal_revenue"]["formatted_value"], "No Data")
        self.assertFalse(cards["stamps_revenue"]["has_data"])
        self.assertEqual(cards["stamps_revenue"]["formatted_value"], "No Data")

    def test_example_b_upload_stamps_counter_updates_stamps_retaining_money_orders(self):
        """Example B: Upload Stamps Counter -> Stamps updates, Money Orders retains prior value."""
        self.test_example_a_upload_money_orders_only_updates_money_orders()

        batch_meta_stamps = {
            "batch_id": "BATCH-STAMPS-01",
            "file_name": "stamps_counter.xlsx",
            "office_id": self.office_id,
            "reporting_period": "2026-08-01 - 2026-08-10",
            "min_date": "2026-08-01",
            "max_date": "2026-08-10",
            "total_rows": 1,
            "valid_rows": 1,
            "invalid_rows": 0,
            "duplicate_rows": 0,
            "dataset_category": "stamps_revenue",
        }
        records_stamps = [
            {
                "id": "REC-ST-01",
                "batch_id": "BATCH-STAMPS-01",
                "office_id": self.office_id,
                "date": "2026-08-03",
                "category": "Postage Stamps & Philatelic",
                "dataset_category": "stamps_revenue",
                "count": 30,
                "amount": 8500.0,
                "reference_no": "STAMP-001",
                "flow_type": "revenue",
                "is_revenue": True,
                "status": "Complete",
                "is_valid": True,
                "is_demo": False,
            }
        ]
        res = commit_import_batch(batch_meta_stamps, records_stamps, [], import_mode="append", dataset_category="stamps_revenue")
        self.assertEqual(res["inserted"], 1)

        summary = get_daily_accounts_summary(self.office_id, data_mode="real")
        cards = summary["kpi_cards"]

        # Stamps Counter is updated
        self.assertTrue(cards["stamps_revenue"]["has_data"])
        self.assertEqual(cards["stamps_revenue"]["amount"], 8500.0)
        self.assertIn("8,500", cards["stamps_revenue"]["formatted_amount"])

        # Money Orders remains UNCHANGED from previous batch
        self.assertTrue(cards["money_orders"]["has_data"])
        self.assertEqual(cards["money_orders"]["value"], 15)
        self.assertEqual(cards["money_orders"]["amount"], 125000.0)

        # Utility Collections and Postal Revenue still No Data
        self.assertFalse(cards["utility_collections"]["has_data"])
        self.assertFalse(cards["postal_revenue"]["has_data"])

    def test_example_c_and_d_all_four_categories_persistent(self):
        """Example C & D: Incrementally add Utility and Postal Revenue -> All 4 cards populated."""
        self.test_example_b_upload_stamps_counter_updates_stamps_retaining_money_orders()

        # Add Utility Collections
        batch_meta_util = {
            "batch_id": "BATCH-UTIL-01",
            "file_name": "utility_bills.csv",
            "office_id": self.office_id,
            "reporting_period": "2026-08-01 - 2026-08-10",
            "min_date": "2026-08-01",
            "max_date": "2026-08-10",
            "total_rows": 1,
            "valid_rows": 1,
            "invalid_rows": 0,
            "duplicate_rows": 0,
            "dataset_category": "utility_collections",
        }
        records_util = [
            {
                "id": "REC-UT-01",
                "batch_id": "BATCH-UTIL-01",
                "office_id": self.office_id,
                "date": "2026-08-04",
                "category": "CEB Collections",
                "dataset_category": "utility_collections",
                "count": 22,
                "amount": 62000.0,
                "reference_no": "CEB-999",
                "flow_type": "inflow",
                "is_revenue": False,
                "status": "Complete",
                "is_valid": True,
                "is_demo": False,
            }
        ]
        commit_import_batch(batch_meta_util, records_util, [], import_mode="append", dataset_category="utility_collections")

        # Add Postal Revenue
        batch_meta_postal = {
            "batch_id": "BATCH-POST-01",
            "file_name": "postal_revenue.csv",
            "office_id": self.office_id,
            "reporting_period": "2026-08-01 - 2026-08-10",
            "min_date": "2026-08-01",
            "max_date": "2026-08-10",
            "total_rows": 1,
            "valid_rows": 1,
            "invalid_rows": 0,
            "duplicate_rows": 0,
            "dataset_category": "postal_revenue",
        }
        records_postal = [
            {
                "id": "REC-PR-01",
                "batch_id": "BATCH-POST-01",
                "office_id": self.office_id,
                "date": "2026-08-06",
                "category": "Speed Post",
                "dataset_category": "postal_revenue",
                "count": 18,
                "amount": 14200.0,
                "reference_no": "SP-001",
                "flow_type": "revenue",
                "is_revenue": True,
                "status": "Complete",
                "is_valid": True,
                "is_demo": False,
            }
        ]
        commit_import_batch(batch_meta_postal, records_postal, [], import_mode="append", dataset_category="postal_revenue")

        summary = get_daily_accounts_summary(self.office_id, data_mode="real")
        cards = summary["kpi_cards"]

        self.assertTrue(cards["money_orders"]["has_data"])
        self.assertEqual(cards["money_orders"]["amount"], 125000.0)

        self.assertTrue(cards["stamps_revenue"]["has_data"])
        self.assertEqual(cards["stamps_revenue"]["amount"], 8500.0)

        self.assertTrue(cards["utility_collections"]["has_data"])
        self.assertEqual(cards["utility_collections"]["amount"], 62000.0)
        self.assertEqual(cards["utility_collections"]["bills_count"], 22)

        self.assertTrue(cards["postal_revenue"]["has_data"])
        self.assertEqual(cards["postal_revenue"]["amount"], 14200.0)
        self.assertEqual(cards["postal_revenue"]["items_count"], 18)

    def test_category_scoped_replace_mode(self):
        """In Replace mode for a category, only that category's records are replaced; other categories persist."""
        self.test_example_c_and_d_all_four_categories_persistent()

        # Replace Money Orders with a new batch (10 MOs, 80,000)
        batch_meta_mo_replace = {
            "batch_id": "BATCH-MO-REPLACE-02",
            "file_name": "pmt_mo_new.xlsx",
            "office_id": self.office_id,
            "reporting_period": "2026-08-01 - 2026-08-10",
            "min_date": "2026-08-01",
            "max_date": "2026-08-10",
            "total_rows": 1,
            "valid_rows": 1,
            "invalid_rows": 0,
            "duplicate_rows": 0,
            "dataset_category": "money_orders",
        }
        records_mo_replace = [
            {
                "id": "REC-MO-REP-01",
                "batch_id": "BATCH-MO-REPLACE-02",
                "office_id": self.office_id,
                "date": "2026-08-07",
                "category": "Money Orders",
                "dataset_category": "money_orders",
                "count": 10,
                "amount": 80000.0,
                "reference_no": "PMT-REP-01",
                "flow_type": "inflow",
                "is_revenue": False,
                "status": "Complete",
                "is_valid": True,
                "is_demo": False,
            }
        ]
        commit_import_batch(batch_meta_mo_replace, records_mo_replace, [], import_mode="replace", dataset_category="money_orders")

        summary = get_daily_accounts_summary(self.office_id, data_mode="real")
        cards = summary["kpi_cards"]

        # Money Orders must now be the replaced amount (80,000 instead of 125,000)
        self.assertEqual(cards["money_orders"]["amount"], 80000.0)
        self.assertEqual(cards["money_orders"]["value"], 10)

        # Other 3 categories MUST remain untouched!
        self.assertEqual(cards["utility_collections"]["amount"], 62000.0)
        self.assertEqual(cards["stamps_revenue"]["amount"], 8500.0)
        self.assertEqual(cards["postal_revenue"]["amount"], 14200.0)

    def test_genuine_zero_sales_vs_no_data(self):
        """A valid imported dataset with 0 amount must show has_data: True and 'LKR 0.00', not 'No Data'."""
        batch_meta_zero = {
            "batch_id": "BATCH-ZERO-01",
            "file_name": "stamps_zero.csv",
            "office_id": self.office_id,
            "reporting_period": "2026-08-01 - 2026-08-10",
            "min_date": "2026-08-01",
            "max_date": "2026-08-10",
            "total_rows": 1,
            "valid_rows": 1,
            "invalid_rows": 0,
            "duplicate_rows": 0,
            "dataset_category": "stamps_revenue",
        }
        records_zero = [
            {
                "id": "REC-ZERO-01",
                "batch_id": "BATCH-ZERO-01",
                "office_id": self.office_id,
                "date": "2026-08-02",
                "category": "Postage Stamps & Philatelic",
                "dataset_category": "stamps_revenue",
                "count": 0,
                "amount": 0.0,
                "reference_no": "ZERO-001",
                "flow_type": "revenue",
                "is_revenue": True,
                "status": "Complete",
                "is_valid": True,
                "is_demo": False,
            }
        ]
        commit_import_batch(batch_meta_zero, records_zero, [], import_mode="append", dataset_category="stamps_revenue")

        summary = get_daily_accounts_summary(self.office_id, data_mode="real")
        card = summary["kpi_cards"]["stamps_revenue"]

        self.assertTrue(card["has_data"])
        self.assertEqual(card["amount"], 0.0)
        self.assertEqual(card["formatted_amount"], "LKR 0")


class TestStampStockLedgerIngestion(unittest.TestCase):
    """Test suite verifying Stamp Stock workbook ingestion, GL-1201 segregation, and scoped commits."""

    def setUp(self):
        self.office_id = "PO-COLOMBO-CENTRAL"
        _IN_MEMORY_RECORDS.clear()
        _IN_MEMORY_BATCHES.clear()
        _IN_MEMORY_ISSUES.clear()

    def test_stamp_stock_auto_detect_category_and_mapping(self):
        headers = [
            "Date", "Stock Type", "Denomination (Rs.)", "Opening Qty",
            "Received from HPO / Stores", "Sold / Issued Qty",
            "Damaged / Returned Qty", "Closing Qty", "Closing Value (Rs.)",
            "Verified By / Postmaster"
        ]
        fn = "SLP_Stamp_Stock_2026-07-01_to_2026-09-01.xlsx"
        detected_cat = detect_dataset_category([], fn, headers)
        self.assertEqual(detected_cat, "stamp_stock")

        mapping = auto_detect_column_mapping(headers)
        self.assertEqual(mapping.get("date"), "Date")
        self.assertEqual(mapping.get("category"), "Stock Type")
        self.assertEqual(mapping.get("denomination"), "Denomination (Rs.)")
        self.assertEqual(mapping.get("opening_qty"), "Opening Qty")
        self.assertEqual(mapping.get("receipts_qty"), "Received from HPO / Stores")
        self.assertEqual(mapping.get("issued_qty"), "Sold / Issued Qty")
        self.assertEqual(mapping.get("closing_qty"), "Closing Qty")
        self.assertEqual(mapping.get("closing_value"), "Closing Value (Rs.)")
        self.assertEqual(mapping.get("verified_by"), "Verified By / Postmaster")

    def test_stamp_stock_validation_zero_revenue_and_gl_1201(self):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Stamp Stock"
        ws.append([
            "Date", "Stock Type", "Denomination (Rs.)", "Opening Qty",
            "Received from HPO / Stores", "Sold / Issued Qty",
            "Damaged / Returned Qty", "Closing Qty", "Closing Value (Rs.)",
            "Verified By / Postmaster"
        ])
        ws.append(["2026-07-01", "Postage Stamp", 25.0, 1000, 500, 200, 0, 1300, 32500.0, "Mr. Silva"])
        ws.append(["2026-07-01", "Stamped Cover", 50.0, 200, 0, 50, 0, 150, 7500.0, "Mr. Silva"])

        buf = io.BytesIO()
        wb.save(buf)
        excel_bytes = buf.getvalue()

        batch_meta, records, issues = parse_and_validate_file(
            excel_bytes,
            "SLP_Stamp_Stock_2026-07-01_to_2026-09-01.xlsx",
            sheet_name="Stamp Stock",
            office_id=self.office_id,
        )

        self.assertEqual(batch_meta["dataset_category"], "stamp_stock")
        self.assertEqual(batch_meta["total_rows"], 2)
        self.assertEqual(batch_meta["valid_rows"], 2)
        self.assertEqual(batch_meta["invalid_rows"], 0)
        self.assertEqual(batch_meta["net_revenue_impact"], 0.0)
        self.assertEqual(batch_meta["total_stock_closing_value"], 40000.0)
        self.assertEqual(batch_meta["total_stock_closing_qty"], 1450)
        self.assertEqual(records[0]["gl_code"], "GL-1201")
        self.assertFalse(records[0]["is_revenue"])
        self.assertEqual(records[0]["flow_type"], "stock")

    def test_stamp_stock_scoped_replace_preserves_other_categories(self):
        # 1. First commit a money orders batch
        mo_batch_meta = {
            "_id": "BATCH-MO-01",
            "batch_id": "BATCH-MO-01",
            "office_id": self.office_id,
            "reporting_period": "01 Jul 2026 - 01 Sep 2026",
            "detected_date_range": "2026-07-01 - 2026-09-01",
            "min_date": "2026-07-01",
            "max_date": "2026-09-01",
            "total_rows": 1,
            "dataset_category": "money_orders",
        }
        mo_record = {
            "id": "REC-MO-01",
            "batch_id": "BATCH-MO-01",
            "office_id": self.office_id,
            "date": "2026-07-15",
            "category": "Money Orders",
            "dataset_category": "money_orders",
            "count": 10,
            "amount": 50000.0,
            "reference_no": "PMT-9999",
            "status": "Complete",
            "is_valid": True,
            "is_demo": False,
        }
        commit_import_batch(mo_batch_meta, [mo_record], [], import_mode="append", dataset_category="money_orders")

        # Verify MO exists
        summary1 = get_daily_accounts_summary(self.office_id, data_mode="real")
        self.assertTrue(summary1["kpi_cards"]["money_orders"]["has_data"])
        self.assertEqual(summary1["kpi_cards"]["money_orders"]["amount"], 50000.0)

        # 2. Commit Stamp Stock in REPLACE mode
        stock_batch_meta = {
            "_id": "BATCH-STOCK-01",
            "batch_id": "BATCH-STOCK-01",
            "office_id": self.office_id,
            "reporting_period": "01 Jul 2026 - 01 Sep 2026",
            "detected_date_range": "2026-07-01 - 2026-09-01",
            "min_date": "2026-07-01",
            "max_date": "2026-09-01",
            "total_rows": 1,
            "dataset_category": "stamp_stock",
            "total_stock_closing_value": 311269130.0,
            "total_stock_closing_qty": 50000,
            "net_revenue_impact": 0.0,
        }
        stock_record = {
            "id": "REC-STOCK-01",
            "batch_id": "BATCH-STOCK-01",
            "office_id": self.office_id,
            "date": "2026-07-01",
            "category": "Postage Stamp",
            "dataset_category": "stamp_stock",
            "denomination": 25.0,
            "count": 50,
            "amount": 311269130.0,
            "closing_value": 311269130.0,
            "closing_qty": 50000,
            "reference_no": "STK-2026-07-01-1",
            "status": "Complete",
            "is_valid": True,
            "is_demo": False,
        }
        commit_import_batch(stock_batch_meta, [stock_record], [], import_mode="replace", dataset_category="stamp_stock")

        # 3. Verify Money Orders is UNTOUCHED and Stamp Stock exists
        summary2 = get_daily_accounts_summary(self.office_id, data_mode="real")
        self.assertTrue(summary2["kpi_cards"]["money_orders"]["has_data"], "Money Orders must not be deleted by stamp stock replace")
        self.assertEqual(summary2["kpi_cards"]["money_orders"]["amount"], 50000.0)
        self.assertTrue(summary2["kpi_cards"]["stamp_stock"]["has_data"], "Stamp Stock must be populated")
        self.assertEqual(summary2["kpi_cards"]["stamp_stock"]["amount"], 311269130.0)
        # Stamps counter revenue remains No Data (zero sales invented)
        self.assertFalse(summary2["kpi_cards"]["stamps_revenue"]["has_data"])

    def test_real_stamp_stock_workbook_11220_rows(self):
        import os
        sample_path = r"C:\Users\bbb\Downloads\GL prediction\SLP_Stamp_Stock_2026-07-01_to_2026-09-01.xlsx"
        if not os.path.exists(sample_path):
            self.skipTest("Sample workbook not found at " + sample_path)

        with open(sample_path, "rb") as f:
            content = f.read()

        fn = os.path.basename(sample_path)
        inspect_res = inspect_file_sheets(content, fn)
        self.assertEqual(inspect_res["detected_category"], "stamp_stock")
        self.assertIn("Stamp Stock", inspect_res["sheet_names"])

        batch_meta, records, issues = parse_and_validate_file(
            content,
            fn,
            sheet_name="Stamp Stock",
            office_id=self.office_id,
        )

        self.assertEqual(batch_meta["total_rows"], 11220)
        self.assertEqual(batch_meta["valid_rows"], 11220)
        self.assertEqual(batch_meta["invalid_rows"], 0)
        self.assertEqual(batch_meta["duplicate_rows"], 0)
        self.assertEqual(len(issues), 0)
        self.assertEqual(batch_meta["dataset_category"], "stamp_stock")
        self.assertEqual(batch_meta["net_revenue_impact"], 0.0)
        self.assertEqual(batch_meta["total_stamps_revenue"], 0.0)
        self.assertAlmostEqual(batch_meta["total_stock_closing_value"], 311269130.0, places=1)
        self.assertEqual(records[0]["gl_code"], "GL-1201")
        self.assertFalse(records[0]["is_revenue"])



class TestClerkDailyAccountsAndReporting(unittest.TestCase):
    """Unit tests for Clerk Daily Transactions, Postmaster Review, Excel Exports, and Category Isolation."""

    def setUp(self):
        seed_demo_daily_accounts(force=True)
        self.office_id = "PO-COLOMBO-CENTRAL"
        self.clerk_actor = {"username": "clerk", "role": ROLE_CLERK}
        self.pm_actor = {"username": "postmaster", "role": ROLE_POSTMASTER}

    def test_clerk_auth_bootstrap(self):
        clerk_user = bootstrap_clerk()
        uname = getattr(clerk_user, "username", None) or (clerk_user.get("username") if isinstance(clerk_user, dict) else None)
        role = getattr(clerk_user, "role", None) or (clerk_user.get("role") if isinstance(clerk_user, dict) else None)
        pwd_hash = getattr(clerk_user, "hashed_password", None) or (clerk_user.get("hashed_password") or clerk_user.get("password_hash") if isinstance(clerk_user, dict) else None)
        self.assertEqual(uname, "clerk")
        self.assertEqual(role, ROLE_CLERK)
        self.assertTrue(verify_password("Clerk@123456", pwd_hash))

    def test_create_money_order_transaction(self):
        ref = "MO-20261019-9901"
        data = {
            "category": "Money Orders",
            "office_id": self.office_id,
            "reference_no": ref,
            "remitter": "Sunimal Perera",
            "remitter_phone": "0771234567",
            "recipient": "Nimali Silva",
            "recipient_phone": "0719876543",
            "amount": 12500.0,
            "service_fee": 125.0,
            "status": "Submitted",
        }
        res = create_clerk_transaction(data, actor=self.clerk_actor)
        self.assertEqual(res["reference_no"], ref)
        self.assertEqual(res["total_collected"], 12625.0)
        self.assertEqual(res["gl_code"], "GL-1104")
        self.assertEqual(res["status"], "Submitted")
        self.assertEqual(res["clerk_id"], "clerk")

        # Test duplicate reference prevention
        with self.assertRaises(ValueError) as ctx:
            create_clerk_transaction(data, actor=self.clerk_actor)
        self.assertIn("already exists", str(ctx.exception))

    def test_create_postal_services_transaction(self):
        ref = "PS-20261019-9902"
        data = {
            "category": "Postal Services",
            "office_id": self.office_id,
            "reference_no": ref,
            "service_type": "Speed Post / EMS",
            "count": 5,
            "unit_charge": 450.0,
            "status": "Submitted",
        }
        res = create_clerk_transaction(data, actor=self.clerk_actor)
        self.assertEqual(res["amount"], 2250.0)
        self.assertEqual(res["gl_code"], "GL-4105")
        self.assertTrue(res["is_revenue"])

    def test_create_utility_collections_transaction(self):
        ref = "UC-20261019-9903"
        data = {
            "category": "Utility Collections",
            "office_id": self.office_id,
            "reference_no": ref,
            "provider": "CEB",
            "customer_ref": "CEB-0421873910",
            "amount": 8450.0,
            "commission": 15.0,
            "status": "Submitted",
        }
        res = create_clerk_transaction(data, actor=self.clerk_actor)
        self.assertEqual(res["amount"], 8450.0)
        self.assertEqual(res["gl_code"], "GL-2105")
        self.assertEqual(res["provider"], "CEB")

    def test_create_pension_welfare_transaction(self):
        ref = "PW-20261019-9904"
        data = {
            "category": "Pension & Welfare",
            "office_id": self.office_id,
            "reference_no": ref,
            "beneficiary_ref": "PEN-1956102938V",
            "transaction_type": "Civil Pension",
            "amount": 32000.0,
            "payment_status": "Paid",
            "status": "Submitted",
        }
        res = create_clerk_transaction(data, actor=self.clerk_actor)
        self.assertEqual(res["amount"], 32000.0)
        self.assertEqual(res["gl_code"], "GL-2201")
        self.assertFalse(res["is_revenue"])

    def test_create_stamp_stock_transaction_and_balance_equation(self):
        ref_err = "ST-20261019-ERR"
        invalid_data = {
            "category": "Stamp Stock Ledger",
            "office_id": self.office_id,
            "reference_no": ref_err,
            "denomination": 25.0,
            "opening_qty": 1000,
            "receipts_qty": 500,
            "issued_qty": 200,
            "damaged_qty": 10,
            "closing_qty": 2000,  # Invalid: 1000+500-200-10 = 1290 != 2000
            "status": "Submitted",
        }
        with self.assertRaises(ValueError) as ctx:
            create_clerk_transaction(invalid_data, actor=self.clerk_actor)
        self.assertIn("Stock balance equation error", str(ctx.exception))

        # Valid balance equation
        ref_ok = "ST-20261019-9905"
        valid_data = {
            "category": "Stamp Stock Ledger",
            "office_id": self.office_id,
            "reference_no": ref_ok,
            "denomination": 25.0,
            "opening_qty": 1000,
            "receipts_qty": 500,
            "issued_qty": 200,
            "damaged_qty": 10,
            "closing_qty": 1290,
            "status": "Submitted",
        }
        res = create_clerk_transaction(valid_data, actor=self.clerk_actor)
        self.assertEqual(res["closing_qty"], 1290)
        self.assertEqual(res["closing_value"], 32250.0)
        self.assertEqual(res["amount"], 32250.0)
        self.assertEqual(res["net_revenue_impact"], 0.0)
        self.assertFalse(res["is_revenue"])
        self.assertEqual(res["gl_code"], "GL-1201")

    def test_postmaster_review_workflow(self):
        ref = "MO-20261019-9906"
        data = {
            "category": "Money Orders",
            "office_id": self.office_id,
            "reference_no": ref,
            "remitter": "K. Silva",
            "recipient": "M. Perera",
            "amount": 7500.0,
            "status": "Submitted",
        }
        res = create_clerk_transaction(data, actor=self.clerk_actor)
        tx_id = res["id"]

        # Postmaster Approves
        upd = update_transaction_status(tx_id, "Reviewed", actor=self.pm_actor)
        self.assertEqual(upd["status"], "Reviewed")
        self.assertEqual(upd["verified_by"], "postmaster")
        self.assertIsNotNone(upd["verified_at"])

        # Fetch and verify persistent status
        fetched = get_clerk_transaction_by_id(tx_id)
        self.assertEqual(fetched["status"], "Reviewed")

        # Postmaster Rejects another
        ref_rej = "MO-20261019-9907"
        data_rej = {
            "category": "Money Orders",
            "office_id": self.office_id,
            "reference_no": ref_rej,
            "remitter": "Test Rej",
            "recipient": "Test Rec",
            "amount": 1000.0,
            "status": "Submitted",
        }
        res_rej = create_clerk_transaction(data_rej, actor=self.clerk_actor)
        upd_rej = update_transaction_status(res_rej["id"], "Rejected", actor=self.pm_actor)
        self.assertEqual(upd_rej["status"], "Rejected")

    def test_formula_injection_guard(self):
        self.assertEqual(_sanitize_cell("=SUM(A1:A10)"), "'=SUM(A1:A10)")
        self.assertEqual(_sanitize_cell("+100"), "'+100")
        self.assertEqual(_sanitize_cell("-50"), "'-50")
        self.assertEqual(_sanitize_cell("@cmd"), "'@cmd")
        self.assertEqual(_sanitize_cell("Normal Text"), "Normal Text")
        self.assertEqual(_sanitize_cell(1234.5), 1234.5)

    def test_export_category_daily_excel(self):
        xlsx_bytes = export_category_daily_excel("Money Orders", self.office_id, period="2026-07-01_to_2026-09-01")
        self.assertTrue(xlsx_bytes.startswith(b"PK\x03\x04"))
        wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
        self.assertIn("Money Orders", wb.sheetnames)
        ws = wb["Money Orders"]
        # Verify title header
        self.assertIn("SRI LANKA POST", str(ws.cell(row=1, column=1).value))
        self.assertIn("Money Orders", str(ws.cell(row=2, column=1).value))

    def test_export_consolidated_daily_report_excel(self):
        xlsx_bytes = export_consolidated_daily_report_excel(self.office_id, period="2026-07-01_to_2026-09-01")
        self.assertTrue(xlsx_bytes.startswith(b"PK\x03\x04"))
        wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
        expected_sheets = [
            "Daily Summary",
            "Money Orders",
            "Postal Services",
            "Utility Collections",
            "Pension & Welfare",
            "Cash & Stamp Stock",
            "Reconciliation & Exceptions",
        ]
        for name in expected_sheets:
            self.assertIn(name, wb.sheetnames, f"Expected sheet '{name}' missing from consolidated workbook")

    def test_advanced_accounting_report_and_excel(self):
        rep = get_advanced_accounting_report(self.office_id)
        self.assertIn("summary", rep)
        self.assertIn("daily_collections", rep)
        self.assertIn("category_breakdown", rep)
        self.assertIn("clerk_activity", rep)

        # Excel export
        xlsx_bytes = export_advanced_accounting_report_excel(self.office_id)
        self.assertTrue(xlsx_bytes.startswith(b"PK\x03\x04"))
        wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
        self.assertIn("Accounting Report", wb.sheetnames)
        ws = wb["Accounting Report"]
        self.assertIn("SRI LANKA POSTAL DEPARTMENT", str(ws.cell(row=1, column=1).value))
        self.assertIn("Executive Financial Summary", str(ws.cell(row=5, column=1).value))

    def test_category_dataset_isolation_clerk(self):
        # Create a real Pension & Welfare record
        create_clerk_transaction({
            "category": "Pension & Welfare",
            "office_id": self.office_id,
            "reference_no": "PW-ISOLATION-01",
            "beneficiary_ref": "PEN-ISO-01",
            "amount": 25000.0,
            "status": "Submitted",
        }, actor=self.clerk_actor)

        txs_pw_before = get_clerk_transactions(category="Pension & Welfare", office_id=self.office_id, data_mode="real")
        count_before = len(txs_pw_before.get("records", []))
        self.assertEqual(count_before, 1)

        # Clerk enters a Money Order
        create_clerk_transaction({
            "category": "Money Orders",
            "office_id": self.office_id,
            "reference_no": "MO-ISOLATION-01",
            "remitter": "Iso User",
            "recipient": "Iso Rec",
            "amount": 9999.0,
            "status": "Submitted",
        }, actor=self.clerk_actor)

        # Pension & Welfare must remain untouched
        txs_pw_after = get_clerk_transactions(category="Pension & Welfare", office_id=self.office_id, data_mode="real")
        self.assertEqual(len(txs_pw_after.get("records", [])), count_before)
        self.assertEqual(txs_pw_after["records"][0]["reference_no"], "PW-ISOLATION-01")


if __name__ == "__main__":
    unittest.main()


