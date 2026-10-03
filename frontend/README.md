# Frontend – React web app (Vite + Tailwind CSS 4)

Counter intake, items, desk scans, review queue, sender messages, IoT scale diagnostics, offices & zones,
reports, audit, and the public sender tracking page.

```bash
npm install
npm run dev        # http://localhost:5173 ; /api is proxied to http://127.0.0.1:8000
npm run build      # production build in dist/
npm run lint
```
Set `VITE_API_PROXY` in `.env` if the backend runs elsewhere. Sign in with the demo accounts listed in
[../Documents/Setup_and_Run_Guide.md](../Documents/Setup_and_Run_Guide.md).

```
src/
├── api.js, auth.jsx         fetch wrapper (JWT, error mapping) and session context
├── components/              Layout, ui kit, ImagePanel (capture/crop/OCR), AddressBlock, WeightPanel, Timeline, badges
└── pages/                   CounterHome, IntakeWizard, LabelPrint, Items, ItemDetail, ScanEvent, ReviewQueue,
                             Notifications, Devices, Offices, Reports, Audit, Dashboard, Login, Track (public)
```
