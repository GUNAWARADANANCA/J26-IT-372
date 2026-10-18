# J26-IT-372

## Postmaster sign-in

Forecast saving and forecast monitoring require a postmaster session. The server stores a scrypt password hash and an HttpOnly session cookie. The employee id in a URL is not treated as identity.

Set these in `backend/.env` before starting the API. Do not commit that file.

```text
POSTMASTER_USERNAME=postmaster
POSTMASTER_PASSWORD=choose-a-long-password
AUTH_COOKIE_SECURE=false
```

The password must be at least 10 characters. On startup, the API creates that postmaster only if one does not already exist. After the account exists, the password in `.env` is no longer read for sign-in. Set `AUTH_COOKIE_SECURE=true` when the desk is served over HTTPS.

Start the API from `backend` with `.\.venv\Scripts\python.exe main.py`. Start the desk from `frontend` with `npm run dev`. Open the desk and use Sign in. The Vite proxy forwards `/api` to `127.0.0.1:8000`. That proxy is only a development convenience. It does not authenticate anyone. Do not expose the API on a public address until the deployment, cookie, and HTTPS settings have been reviewed.

A session lasts 8 hours. Logging out deletes it. Five failed sign-in attempts within 15 minutes pause that username for 2 minutes. The pause ends on its own. A missing or expired session returns 401. A signed-in user who is not a postmaster receives 403. Employee, payroll, KPI, allocation, and settings routes require this session. The door attendance page can still check location and load names without salaries. A scan is accepted only with the current door code from the postmaster settings screen. That code expires quickly and is entered on the attendance page. It is not placed in the page address. The name chosen on the phone is recorded as a claim, not as proof of identity, and the code does not by itself prove someone is standing at the door. Set `ATTENDANCE_DOOR_SECRET` to at least 16 characters. `ATTENDANCE_TOKEN_SECONDS` defaults to 120 and `ATTENDANCE_DUPLICATE_SECONDS` defaults to 90. The Vite proxy is not a security boundary. Do not expose the API publicly until HTTPS and `AUTH_COOKIE_SECURE=true` have been reviewed.

## Next-week KPI model

The gradient-boosting model lives in `backend/ml_models/post_assist_kpi_model.joblib`, with `model_config.json` beside it. It is not served from the frontend. The December 2025 CSV files in that folder are a historical comparison for the week of 22 December 2025. They are not current predictions.

A postmaster generates live forecasts from **KPI Forecasts**. The API reads employee records and daily KPI logs, builds the training feature columns, and stores one forecast per employee and source week in `kpi_model_forecast`. Generating the same week again replaces that row. Weekly KPI uses the provisional weights completion 0.40, accuracy 0.30, and timeliness 0.30. That is not an official Sri Lanka Post formula. Leave days are not on the daily log, so that feature is left missing and the model's median imputer fills it. Predictions are monitoring categories only.

Endpoints, all requiring a postmaster session:

- `GET /api/kpi/forecasts`
- `GET /api/kpi/forecasts/summary`
- `GET /api/kpi/forecasts/{employee_id}`
- `POST /api/kpi/forecasts/generate`

## Power BI reporting data

These reads require a postmaster session. They do not create or change forecasts.

- `GET /api/reporting/datasets`
- `GET /api/reporting/{dataset}` with optional `date_from`, `date_to`, `limit`, and `offset`
- `GET /api/reporting/{dataset}?export=csv`
- `GET /api/reporting/workbook`

Datasets are `employees`, `daily-kpi`, `weekly-actuals`, `random-forest-forecasts`, `gradient-boosting-forecasts`, and `forecast-monitoring`. Every row uses `employee_id`. Weekly rows use `week_start`. Random-forest rows use `input_week` and `target_week`. Gradient-boosting rows use `source_week` and `forecast_week`. Dates are `YYYY-MM-DD`. Scores are numbers, or empty when the source value is missing. MongoDB `_id` values are omitted.

The workbook is one Excel file with those six sheets. In Power BI, relate every sheet to `employees` on `employee_id`, and relate forecast `target_week` or `forecast_week` to `weekly-actuals.week_start` for the same employee. Keep `employee_id` as the relationship key so employee names are not duplicated as separate dimensions.

### Manual upload in Power BI Service

Power BI Service in the browser cannot call an API on `127.0.0.1`. A manual report is a snapshot and does not refresh by itself.

1. Sign in to the desk.
2. Download `GET /api/export/employee` and `GET /api/export/daily_kpi_log` for the original employee and daily workbooks, or download `GET /api/reporting/workbook` for the six related reporting sheets.
3. In Power BI Service, open a workspace and create a report by uploading the Excel file.
4. In the model view, create the `employee_id` relationships described above. Use one employee table. Do not load the same employees from two files without relating them.
5. Build visuals from the uploaded tables. The existing React charts remain the live desk view.

The older two-file export does not include forecast sheets. Use the reporting workbook when the report needs forecasts or monitoring rows.

### Later automatic refresh

Automatic refresh is not configured. Do not publish the localhost API to the internet so Power BI can reach it. A later setup needs all of the following, and none of these identifiers are in this repository:

- A hosted API or a data gateway on a network Microsoft can reach, with HTTPS and the existing postmaster session or a dedicated read credential.
- A Power BI workspace, a Microsoft Entra service principal, and permission for that principal to use the workspace.
- A dataset whose scheduled refresh uses that hosted source. Opening a desk page does not refresh it.
- Power BI Pro or a capacity licence for app-owns-data embedding.

The route `/postal-kpi-dashboard` is a postmaster page. It asks `POST /api/powerbi/embed` with `{"page":"postal-kpi-dashboard"}` and renders the result with the Power BI JavaScript client. The token stays in the API response for that signed-in session. It is not a `VITE_` variable.

Set these in `backend/.env` only. Do not invent them.

- `POWERBI_TENANT_ID`: Microsoft Entra admin center, Overview, Tenant ID.
- `POWERBI_CLIENT_ID`: Entra app registration, Application (client) ID. The app needs the Power BI Service application permission to read content, with admin consent.
- `POWERBI_CLIENT_SECRET`: that app's client secret value.
- `POWERBI_WORKSPACE_ID`: Power BI workspace settings GUID. Add the service principal as Member or Admin. Do not use My workspace.
- `POWERBI_REPORT_POSTAL_KPI_DASHBOARD`: the report GUID for Postal KPI Dashboard. A `/links/` sharing code is not a report id.

The workspace must be assigned to Power BI Embedded, Premium, or Fabric capacity. Embedding has not been verified because these values are empty. A sharing URL remains rejected by `secureEmbedUrl` and is not sent to the iframe.

## Power BI

Power BI embedding is optional. The four analytics pages keep their own charts when it is not configured. The desk does not use Publish to web.

Set these in `backend/.env` only after a Power BI workspace, a service principal, and four reports exist. Leave them blank until then. Do not put the client secret in frontend code.

```text
POWERBI_TENANT_ID=
POWERBI_CLIENT_ID=
POWERBI_CLIENT_SECRET=
POWERBI_WORKSPACE_ID=
POWERBI_REPORT_PRODUCTIVITY=
POWERBI_REPORT_FORECAST_MONITORING=
POWERBI_REPORT_KPI_SIMULATOR=
POWERBI_REPORT_KPI_FORECASTS=
POWERBI_REPORT_POSTAL_KPI_DASHBOARD=
```

The API exposes `GET /api/powerbi/status` and `POST /api/powerbi/embed` to a postmaster session. Status returns setting names that are still empty. It does not return secret values. Embed asks Microsoft for a view token only when every setting above is present. Opening a page does not refresh a dataset. Schedule that refresh in the Power BI service.

Create the reports in a workspace that the service principal can access. Use the existing KPI and forecast collections as the dataset source. The application model remains responsible for predictions. Employee row-level security is not applied by this integration. A postmaster session is required before an embed token is issued. Power BI Pro or a capacity licence is required for app-owns-data embedding; this repository does not supply that licence.

