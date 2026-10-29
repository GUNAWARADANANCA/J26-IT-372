Intelligent Ledger and KPI Prediction Module
PostAssist LK -- Intelligent Backbone for Local Postal Services
Description: An AI-assisted financial support module for postal
branches. It suggests the correct General Ledger (GL) account for each
transaction written in Sinhala, Tamil or English, shows a confidence
score, and sends uncertain cases to an authorized officer for review. It
also supports daily reconciliation, predicts each officer's daily KPI
achievement with improvement tips, and presents the results on Power BI
dashboards. A human officer always makes the final accounting decision.
Status: Proposal stage (project J26-IT-372) · Tech: FastAPI,
React + TypeScript, PostgreSQL, Python ML/NLP, Postman, Power BI
---
Student                         Gunawardena N C A
Student ID                      IT23323216
Project ID                      J26-IT-372
Programme                       B.Sc. (Hons) in Information
Technology, Specialized in
Information Technology
Institute                       Sri Lanka Institute of Information
Technology (SLIIT), Department of
Information Technology
Document                        Project Proposal Report, September
2026
---
> **Status note.** This README is derived from the project proposal. The
> system is at the design and planning stage. All numeric targets below
> are **proposed acceptance targets**, not achieved results.
---
Table of Contents
Overview
Problem and Research Gap
Objectives and Acceptance
Targets
Key Features
System Architecture
End-to-End Workflow
GL Prediction and Human-in-the-Loop
Logic
Transaction State Model
Data Model
Secure API Design
ML Pipeline and Experiments
KPI Prediction Module
Users and Roles
Technology Stack and
Deployment
Security, Privacy and
Safeguards
Requirements Summary
Testing Plan
Methodology
Work Breakdown Structure
Project Schedule (Gantt)
Risks and Mitigations
Budget
Commercialization Outlook
Proposed Repository Structure
Getting Started (Planned)
Limitations and Honest Notes
References
---
1. Overview
Daily postal branch operations require every financial transaction to
have an accurate description, the correct General Ledger (GL)
account, a reliable record, and reconciliation with operational
activity. Clerks and officers often interpret transaction descriptions
written in Sinhala, Tamil or English by hand, which causes delays,
inconsistent classification and human error. KPI reporting is usually
based on completed work, so shortfalls are noticed late.
This component is the Intelligent Ledger and KPI Prediction Module
of PostAssist LK. It:
Accepts transactions from clerks through a secure API pipeline.
Recommends a GL account using multilingual NLP and machine
learning, with a confidence score.
Routes low-confidence predictions to an authorized officer
(human-in-the-loop).
Stores approved corrections as feedback for future model
improvement.
Performs daily reconciliation between transactions and ledger
postings.
Predicts each officer's daily KPI achievement and generates
improvement recommendations.
Presents ledger, reconciliation, confidence and KPI information
through Power BI dashboards.
The guiding workflow of the module is:
Workflow: transaction data → AI prediction → human verification →
reconciliation → KPI analytics.
Design principle: the AI is a decision-support tool. Final
accounting decisions always stay with an authorized human officer, and
KPI predictions are never used for disciplinary, promotion or employment
decisions.
---
2. Problem and Research Gap
Established platforms (SAP S/4HANA, Oracle Fusion Cloud Financials,
QuickBooks Online, Xero) provide mature GL processing and reporting.
Existing research supports ML-based transaction classification,
multilingual NLP for Sinhala and Tamil, human-in-the-loop decision
support, and employee performance prediction. However, limited evidence
exists for an integrated solution for multilingual postal
transactions.
---
Gap                     Proposed contribution   Evidence required
---
Limited GL prediction   AI-based GL account     Prediction accuracy
for postal transactions prediction
Limited Sinhala, Tamil  Multilingual            Accuracy compared per
and English transaction transaction             language
processing              understanding
Limited human           Human-in-the-loop       Correct vs corrected
verification for        approval                predictions
uncertain predictions
Limited prediction of   KPI prediction module   Predicted vs actual KPI
daily employee KPI  
performance
Financial and KPI       Integrated financial    System accuracy,
functions handled       management workflow     processing time,
separately                                      usability
Research question. Can an integrated, human-supervised Intelligent
Ledger and KPI Prediction Module provide accurate and reliable
multilingual GL recommendations and KPI predictions in a scoped
postal-management environment?
---
3. Objectives and Acceptance Targets
Main objective. Within a provisional 24-week individual project,
design, implement and evaluate an intelligent financial and
performance-support component that securely processes postal
transactions, predicts GL accounts from multilingual transaction
information, supports daily reconciliation, predicts employee KPI
achievement and provides human-supervised analytics through integrated
dashboards.
---
ID                      Specific objective      Proposed measure and
target
---
SO1                 Secure API for          At least 95% of API
clerk-to-officer        tests succeed; all
transactions with       unauthorized-access
authentication and data tests rejected
protection
SO2                 AI model to predict the At least 85%
correct GL account from macro-F1, compared
transaction details and against a baseline
history                 model
SO3                 Support Sinhala, Tamil  Per-language results
and English with        reported; at least
confidence-based        90% of
officer review          high-confidence
recommendations correct
at the chosen
threshold;
low-confidence cases
routed to an officer,
never auto-finalized
SO4                 KPI prediction and      At least 90%
financial monitoring    accuracy on
module with management  reconciliation test
dashboards              cases; KPI performance
reported with suitable
metrics
Targets are to be confirmed by the supervisor after an initial
feasibility assessment and before the final held-out evaluation.
---
4. Key Features
---
Area                                Feature
---
Secure transaction processing       Authenticated clerk-to-officer API,
private/public data classification,
validation, unique `reference_id`,
audit logging
AI GL prediction                    Predicts a GL account from
description, amount, service type,
branch, payment method, language
and history
Multilingual NLP                    Sinhala, Tamil and English
preprocessing, evaluated separately
per language
Confidence scoring                  Every prediction carries a
confidence score; a threshold fixed
on validation data drives routing
Human-in-the-loop                   Officers confirm, reject or
manually change a predicted GL
account; corrections are stored as
feedback
Ledger posting                      Only approved transactions are
posted, with posting status and
audit trail
Daily reconciliation                Matches transactions to ledger
postings; flags unmatched and
inconsistent records for review
KPI prediction                      Predicts daily KPI achievement per
officer and generates coaching
recommendations
Dashboards                          Power BI views for ledger activity,
reconciliation, revenue, GL
accuracy, confidence and KPI
achievement
Notifications                       Submission, recommendation,
approval, reconciliation and KPI
messages that use `reference_id`
instead of sensitive details
---
5. System Architecture
5.1 High-level architecture
``` mermaid
flowchart TB
    subgraph Users["Users"]
        CL["Clerk"]
        OF["Finance / Accounting Officer"]
        MG["Postmaster / Manager"]
    end

    subgraph UI["Presentation Layer"]
        WEB["React + TypeScript Web App"]
        PBI["Power BI Dashboards"]
    end

    subgraph API["Secure API Layer - FastAPI"]
        AUTH["Authentication and RBAC"]
        VAL["Validation and Data Classification"]
        TXS["Transaction Service"]
        APR["Approval and Posting Service"]
        REC["Reconciliation Service"]
        DSH["Dashboard Data Service"]
    end

    subgraph AI["AI Services - Python"]
        NLP["Multilingual NLP Preprocessing"]
        GLM["GL Prediction Model + Confidence Score"]
        KPI["KPI Prediction and Recommendations"]
        FB["Feedback Store for Retraining"]
    end

    subgraph DATA["Data Layer"]
        PG[("PostgreSQL")]
        AUD[("Audit Log")]
    end

    CL --> WEB
    OF --> WEB
    MG --> PBI
    WEB -->|HTTPS| AUTH
    AUTH --> VAL --> TXS
    TXS --> NLP --> GLM
    GLM --> APR
    APR --> REC
    APR --> FB
    REC --> KPI
    TXS --> PG
    APR --> PG
    REC --> PG
    KPI --> PG
    FB --> PG
    APR --> AUD
    DSH --> PG
    PBI --> DSH
```
5.2 Component boundary and integration
The module is independently demonstrable. Other PostAssist LK components
may consume its versioned, approved APIs later, but none is required
to demonstrate this contribution. Only approved, non-sensitive,
aggregated information is exposed to other components or dashboards, and
the full financial database is never shared directly.
5.3 Deployment view
A browser (React + TypeScript) reaches the FastAPI app over HTTPS
through a reverse proxy. The app hosts the API and AI services, reads
and writes PostgreSQL, and loads versioned models from a model store.
Power BI reads reporting views only. Development runs locally; secure
cloud hosting is optional.
---
6. End-to-End Workflow
``` mermaid
sequenceDiagram
    autonumber
    actor Clerk
    participant API as Secure API (FastAPI)
    participant ML as GL Prediction Model
    participant Officer as Authorized Officer
    participant DB as PostgreSQL
    participant Rec as Reconciliation
    participant KPI as KPI Module
    participant BI as Power BI

    Clerk->>API: POST /transactions (description, amount, service type, branch, payment method, language)
    API->>API: Authenticate, authorize, validate, classify private/public data
    API->>DB: Store transaction with reference_id
    API-->>Clerk: reference_id (status: submitted)
    API->>ML: POST /transactions/{id}/predict-gl
    ML-->>API: GL account + confidence score
    API->>DB: Store prediction (model version, language, time)
    API->>Officer: Review request (recommended GL + confidence)
    alt Confidence at or above threshold
        Officer->>API: Confirm predicted GL account
    else Confidence below threshold
        Officer->>API: Manually select or correct GL account
    end
    API->>DB: Store approval and correction as feedback (audit trail)
    Officer->>API: POST /transactions/{id}/post
    API->>DB: Post to ledger (status: posted)
    Officer->>Rec: POST /reconciliation/daily
    Rec->>DB: Compare transactions vs ledger postings
    Rec-->>Officer: Matched / unmatched / exception results
    DB->>KPI: Transaction and performance data
    KPI-->>DB: Predicted daily KPI + recommendations
    BI->>API: GET /dashboards/financial-summary
    API-->>BI: Validated, role-restricted indicators
```
---
7. GL Prediction and Human-in-the-Loop Logic
``` mermaid
flowchart TD
    S(["Validated transaction"]) --> P["Predict GL account + confidence score"]
    P --> Q{"Confidence at or above threshold?"}
    Q -->|Yes| H["Show recommendation to officer for confirmation"]
    Q -->|No| L["Flag as low confidence: officer must select GL account manually"]
    H --> D{"Officer decision"}
    L --> D
    D -->|Confirm| A["Approved GL account"]
    D -->|Modify| M["Corrected GL account"]
    D -->|Reject| X["Rejected: needs review"]
    A --> LOG["Audit record: original prediction, decision, timestamp"]
    M --> LOG
    X --> LOG
    M --> FB[("Approved corrections feed future model improvement")]
    A --> POST["Ledger posting"]
    M --> POST
    classDef warn fill:#FFF3E0,stroke:#FB8C00,color:#000
    classDef ok fill:#E8F5E9,stroke:#43A047,color:#000
    class L,X warn
    class A,M,POST ok
```
Key rules from the proposal:
No transaction is posted solely on an AI prediction. Officer
verification is required.
The confidence threshold is chosen on validation data and fixed
before final testing.
High confidence does not automatically mean correct. Confidence
reliability is evaluated on a separate test set.
Only approved corrections are used for future learning, since
not every correction is assumed correct.
A prediction does not count as successful if it improves speed by
increasing incorrect GL assignments.
---
8. Transaction State Model
Transaction progress and GL prediction confidence are stored
separately, so the system can distinguish how far a transaction has
progressed from how reliable the AI recommendation is.
``` mermaid
stateDiagram-v2
    [*] --> created
    created --> submitted
    submitted --> validated : passes validation
    submitted --> exception : fails validation
    validated --> gl_predicted
    gl_predicted --> pending_approval
    pending_approval --> approved : officer confirms or corrects
    pending_approval --> rejected : officer rejects
    approved --> posted
    posted --> reconciled : matched
    posted --> exception : mismatch found
    rejected --> [*]
    reconciled --> [*]
    exception --> [*] : resolved by officer
```
Prediction result (stored separately): `high_confidence` |
`low_confidence` | `corrected` | `manually_selected`
---
9. Data Model
``` mermaid
erDiagram
    USER ||--o{ TRANSACTION : submits
    USER ||--o{ OFFICER_APPROVAL : makes
    USER ||--o{ KPI_RECORD : "is measured by"
    TRANSACTION ||--o| GL_PREDICTION : has
    TRANSACTION ||--o| OFFICER_APPROVAL : "reviewed in"
    TRANSACTION ||--o| LEDGER_POSTING : "posted as"
    TRANSACTION ||--o{ RECONCILIATION_RECORD : "checked in"
    TRANSACTION ||--o{ AUDIT_LOG : generates

    USER {
        string user_id PK
        string role
        string branch_id
    }
    TRANSACTION {
        string transaction_id PK
        string reference_id UK
        text transaction_description
        decimal amount
        string service_type
        string branch_id
        string payment_method
        string language
        string clerk_id FK
        string state
        datetime submitted_at
        datetime received_at
    }
    GL_PREDICTION {
        string prediction_id PK
        string transaction_id FK
        string predicted_gl_account
        float confidence_score
        string model_version
        string language
        datetime predicted_at
        string outcome
    }
    OFFICER_APPROVAL {
        string approval_id PK
        string transaction_id FK
        string officer_id FK
        string decision
        string final_gl_account
        boolean corrected
        datetime decided_at
    }
    LEDGER_POSTING {
        string posting_id PK
        string transaction_id FK
        string gl_account
        string posting_status
        datetime posted_at
    }
    RECONCILIATION_RECORD {
        string recon_id PK
        string transaction_id FK
        date recon_date
        string result
    }
    KPI_RECORD {
        string kpi_id PK
        string officer_id FK
        date kpi_date
        int tasks_completed
        decimal revenue_contribution
        float predicted_kpi
        float actual_kpi
    }
    AUDIT_LOG {
        string log_id PK
        string transaction_id FK
        string action
        string actor_id
        datetime logged_at
    }
```
Transaction payload
Client-submitted fields: `transaction_id`, `reference_id`,
`transaction_description`, `amount`, `service_type`, `branch_id`,
`payment_method`, `language`, `clerk_id`, `client_version`,
`submitted_at`.
Server-added fields: `received_at`, `validation_status`,
`GL_prediction`, `confidence_score`, `approval_status`,
`policy_version`, `transaction_revision`.
The clerk identity comes from authentication, never from an
editable field in the request.
`submitted_at` and `received_at` are kept separate so network delays
are not wrongly treated as invalid.
Amounts must be non-negative; service type, payment method, language
and GL account must match approved values.
---
10. Secure API Design
---
Endpoint                               Authorized actor        Essential behavior
---
`POST /transactions`                   Clerk                   Create and submit a
transaction; returns a
unique reference ID
`POST /transactions/{id}/predict-gl`   Authorized officer /    Generates the
system                  recommended GL account
and confidence score
`POST /transactions/{id}/approve-gl`   Finance officer         Confirms the predicted
GL account or manually
selects another when
confidence is below
threshold
`POST /transactions/{id}/post`         Authorized finance      Posts the approved
officer                 transaction to the
selected GL account
with an audit trail
`POST /reconciliation/daily`           Finance officer         Compares transactions
with ledger postings;
returns mismatches for
review
`GET /dashboards/financial-summary`    Authorized manager      Validated financial,
reconciliation, GL
prediction and KPI
indicators for Power
BI, with data-access
rules enforced
API collections are designed and tested with Postman.
---
11. ML Pipeline and Experiments
11.1 GL prediction pipeline
``` mermaid
flowchart LR
    RAW["Transaction records: Sinhala / Tamil / English"] --> PRE["Preprocessing and normalization"]
    PRE --> FE["Feature engineering"]
    subgraph FEAT["Features"]
        F1["Description text"]
        F2["Amount"]
        F3["Service type"]
        F4["Branch"]
        F5["Payment method"]
        F6["Language"]
        F7["Historical records"]
    end
    FE --> FEAT
    FEAT --> MODEL["Supervised GL classifier"]
    MODEL --> OUT["Top GL account + confidence score"]
    OUT --> CAL["Threshold selection on validation set"]
    CAL --> ROUTE["Officer confirmation or manual selection"]
    ROUTE --> FBK[("Approved corrections")]
    FBK -.->|"periodic retraining"| MODEL
```
> Candidate algorithms (for example TF-IDF with a conventional
> classifier as baseline, and tree-based or multilingual embedding
> approaches for the proposed model) will be finalized after the
> feasibility assessment.
11.2 Experiment configurations
Each experiment compares a manual/existing approach, a conventional
baseline and the proposed approach on the same scenarios.
---
Config                  Secure API experiment   GL prediction
experiment
---
B0                  Existing/manual         Manual GL selection by
transaction flow        the officer
B1                  Basic API with          Conventional ML on
authentication and      description and basic
structured exchange     attributes
P1                  Adds private/public     Proposed model using
classification,         description, amount,
validation, secure      service type, branch,
exchange and audit      payment method,
logging                 language and history
11.3 Dataset plan
Split: 60% development, 20% validation (threshold selection and
tuning), 20% held-out test (untouched until thresholds are frozen).
---
Material          Proposed amount   Ground truth      Limitation
---
Primary postal    1,000--1,500      GL verified with  May not represent
transaction       unique records    predefined rules  all Sri Lankan
dataset                             and authorized    postal branches
review
Multilingual      Suitable Sinhala, Existing labels   Controlled cases
secondary dataset Tamil and English and predefined    may not match real
text              NLP criteria      offices
KPI prediction    500--1,000        Predefined KPI    Synthetic or
dataset           operational or    values and        limited history
synthetic records approved          may reduce
indicators        generalizability
Synchronization   1,000 replay      Expected event    Synthetic load,
tests             requests plus     IDs, revisions    not nationwide
ordered failure   and outcomes      traffic
scenarios
API and security  100+ valid and    Expected          Prototype-level,
tests             invalid requests  responses and     not a security
access rules      certification
Related or duplicate transactions must not cross partitions.
11.4 Evaluation metrics
---
Component                           Metrics
---
GL prediction                       Accuracy, precision, recall, F1,
macro-F1, top-k accuracy,
per-GL-account and per-language
results
Confidence                          Calibration and reliability
analysis; share of low-confidence
cases correctly flagged for review
Human-in-the-loop                   Officer correction rate;
performance before and after
incorporating approved corrections
Secure API                          Successful request rate, response
time, validation accuracy, rejected
unauthorized requests
Reconciliation                      Accuracy on matched, unmatched and
flagged test cases
KPI prediction                      Suitable regression or
classification metrics, with
temporal validation
End to end                          Processing time, transaction
accuracy, dashboard calculation
consistency, task completion
---
12. KPI Prediction Module
The KPI module predicts daily KPI achievement for individual
officers and produces personalized recommendations. It supports
performance improvement; it does not judge an employee's overall value.
``` mermaid
flowchart LR
    subgraph IN["Inputs: approved data only"]
        I1["Transaction records"]
        I2["Task completion"]
        I3["Work history"]
        I4["Revenue contribution"]
        I5["Rewards and approved performance indicators"]
    end
    IN --> FE["Feature engineering"]
    FE --> MD["KPI prediction model"]
    MD --> PR["Predicted daily KPI achievement"]
    PR --> RC["Personalized recommendations"]
    PR --> DB["Power BI: KPI dashboard"]
    RC --> DB
    DB --> MGR["Postmaster / Manager view"]
```
Validity safeguards
Temporal validation (train on the past, test on the future) to
avoid overly optimistic results from randomly mixed records.
Historical data may contain organizational bias or reflect
opportunity rather than ability, so predictions are decision
support only.
No disciplinary, promotion or employment decisions are made from
predictions.
Recommendations display the relevant prediction or confidence
information.
---
13. Users and Roles
---
Persona                             Needs
---
Clerk                           Fast, limited-time transaction
entry through the secure API;
multilingual input; clear error
recovery
Officer                         Review and approve or correct AI
recommendations; resolve
low-confidence cases and
reconciliation discrepancies
Postmaster / Manager            Reliable dashboards: ledger
activity, reconciliation, revenue,
KPI achievement, prediction
performance
Administrator                   User, role and policy management
The finance or accounts manager is the operational decision-maker for
ledger rules, reconciliation and exception handling. The project
supervisor approves the research scope.
---
14. Technology Stack and Deployment
---
Function                Technology              Cost and feasibility
note
---
Frontend (clerk and     React + TypeScript  Open source
officer UI)
Secure API and AI       Python FastAPI,     Open source
services                REST, HTTPS, role-based
authentication
API design and testing  Postman             Free
academic/open-source
allowance
GL and KPI prediction   Python ML / NLP       Accuracy depends on
libraries             data quality and
availability
Multilingual processing Python NLP for Sinhala, External APIs may have
Tamil, English;         usage limits or costs
optional translation  
API
Database                PostgreSQL          Local use is sufficient
for the prototype
Dashboards              Power BI            Free Desktop/academic
allowance
Deployment              Local first; secure     Cloud hosting may add
cloud optional (HTTPS,  cost
access control, regular
backups)
Methodology and process: Design Science Research with Agile/Scrum
iterations.
---
15. Security, Privacy and Safeguards
Access control: authentication on every endpoint, role-based
authorization, object-level authorization (no access by changing an
ID).
Transport and session: HTTPS/TLS, secure password handling,
session management, rate limiting.
Data protection: private/public data classification, no
sensitive data in API responses or logs, protected backups, secrets
kept outside source code.
Governance: audit logging of corrections and approvals, AI
predictions never authorize decisions, synthetic or anonymized data
preferred, manual-procedure fallback on outage.
Failure handling. If the API, database or prediction service is
unavailable, the approved manual accounting procedure is followed.
The transaction can be entered later as an explicitly marked
reconciliation record, without creating false system records.
---
16. Requirements Summary
16.1 Functional requirements
---
ID                      Requirement             Priority
---
FR01                    Authenticate clerks and Must
officers; enforce  
role-based access
FR02                    Classify data as        Must
private or permitted  
public and enforce it  
through the API
FR03                    Create, submit,         Must
retrieve and update  
transactions via the  
secure API
FR04                    Securely transfer       Must
approved transaction  
information from clerk  
to officer review
FR05                    Generate a unique       Must
reference ID per  
accepted transaction  
and maintain its status
FR06                    Capture description,    Must
amount, service type,  
branch, payment method  
and language
FR07                    Preprocess and          Must
normalize Sinhala,  
Tamil and English  
descriptions
FR08                    Recommend the most      Must
appropriate GL account  
from attributes and  
history
FR09                    Generate and display a  Must
confidence score with  
each prediction
FR10                    Route low-confidence    Must
predictions to an  
officer for manual  
selection
FR11                    Allow officers to       Must
confirm, reject or  
modify predicted GL  
accounts before posting
FR12                    Record corrections and  Must
approved decisions for  
audit and model  
improvement
FR13                    Post approved           Must
transactions to the  
ledger and maintain  
posting status
FR14                    Perform daily           Must
reconciliation of  
transactions, postings  
and totals
FR15                    Flag reconciliation     Must
discrepancies for  
officer review and  
resolution
FR16                    Predict daily KPI       Must
achievement from  
transactions, tasks and
performance data
FR17                    Generate personalized   Should
KPI and coaching  
recommendations
FR18                    Provide interactive     Must
dashboards for  
postings,  
reconciliation,  
accuracy, confidence,  
KPI and revenue
16.2 Non-functional requirements
---
ID                      Attribute               Proposed acceptance
criterion
---
NFR01                   API responsiveness      95th-percentile
response under 2 s
at 10 concurrent
pilot users
NFR02                   API security and        All protected endpoints
privacy                 require authentication
and authorization;
unauthorized tests
denied; no private data
in ordinary logs
NFR03                   Data integrity          No duplicate
transaction or ledger
records in idempotency
tests; every approval
and correction retained
with reference ID and
timestamp
NFR04                   GL prediction accuracy  Accuracy and confidence
reported on a defined
test set;
low-confidence cases
routed to human review
NFR05                   Human-in-the-loop       Officers can confirm,
control                 reject or change
predictions; 100%
of low-confidence cases
offer manual selection
NFR06                   Multilingual support    Representative Sinhala,
Tamil and English
processed; performance
reported per language
NFR07                   Reconciliation          Defined test
reliability             transactions correctly
matched, unmatched or
flagged; consistent
after repeated runs and
restarts
NFR08                   KPI prediction and      Generated from declared
recommendation          data and evaluated on a
defined test set; shows
prediction or
confidence information
NFR09                   Dashboard usability and Dashboards show
timeliness              required indicators
from validated test
data without exposing
unauthorized private
information
NFR10                   Maintainability and     Versioned APIs,
cost                    documented schemas,
automated critical-path
tests, reproducible
setup, backup/restore,
no mandatory paid cloud
during development
---
17. Testing Plan
Eighteen scenario tests (T01--T18) cover the happy path, validation,
multilingual input, confidence routing, security and recovery.
---
Test                    Setup                   Expected outcome
---
T01                     Submit valid            Accepted and sent for
transaction with all    GL prediction
fields
T02                     Missing description     Rejected with
required-field message
T03                     Invalid or negative     Rejected and flagged
amount                  invalid
T04--T06                Valid Sinhala / Tamil / Processed and GL
English description     prediction generated
T07                     Unsupported language    Rejected or flagged
value                   without an incorrect
prediction
T08                     Valid service type,     Attributes used in
branch, payment method  prediction
T09                     Confidence above        Recommendation
threshold               presented for officer
confirmation
T10                     Confidence below        Routed to an authorized
threshold               officer
T11                     Officer approves        Approval and decision
low-confidence          recorded
prediction
T12                     Officer rejects and     Correction stored;
selects correct account corrected account
becomes the approved
classification
T13                     Unauthenticated or      Denied; nothing
unauthorized user       processed
T14                     Private data sent to an Denied per
unauthorized role       classification policy
T15                     Same transaction        Duplicate prevented or
identifier submitted    safely identified
twice
T16                     Temporary API or        No partial commit;
network failure         failure recorded for
retry or review
T17                     Valid transactions then Records compared and
reconciliation          status generated
T18                     Transaction and         Daily KPI predicted and
performance data to KPI available for dashboard
module                  and recommendations
---
18. Methodology
Stages: secure API pipeline → GL prediction → multilingual
processing → confidence and human-in-the-loop → reconciliation → KPI
prediction → Power BI analytics → integrated evaluation, iterated with
Design Science Research and Agile/Scrum.
Each stage is independently demonstrable and tested with secondary and
synthetic datasets, predefined measures and baselines. Research
decisions, results and limitations are documented for reproducibility.
Participants (planning ranges, not yet recruited): 3--5 postal
clerks, 2--4 accounting officers, 1--2 postmasters or branch managers,
and 4--6 adult postal service users, subject to institutional and postal
permission. If postal access is unavailable, role-based university
participants and synthetic or secondary data are used, and findings are
labelled as simulated.
---
19. Work Breakdown Structure
The work is split into eight packages, shown with their completion
evidence. Chronology is shown in the Gantt chart below.
---
Package                             Completion evidence
---
WP1 Research and evidence       Approved research protocol,
evidence matrix, research
questions, frozen test dataset
WP2 Data and transaction        Validated transaction dataset, GL
foundation                          mapping, documented
data-classification rules
WP3 Secure API pipeline         Tested secure API collection,
successful transaction flow, API
security test results
WP4 AI GL prediction            Trained GL model, confidence
results, accuracy metrics,
multilingual evaluation
WP5 Human approval and          Officer approval workflow,
reconciliation                      correction records, reconciliation
results, exception report
WP6 KPI prediction and          KPI prediction results,
dashboard                           personalized recommendations,
interactive Power BI dashboard
WP7 Integration and validation  Integrated prototype, test report,
comparative results, limitations
analysis
WP8 Handover and demonstration  Reproducible package, final report,
supervisor-ready demonstration
---
20. Project Schedule (Gantt)
Provisional 24-week schedule (about 600 planned hours). Week 1
starts after proposal approval. The calendar dates in the chart are
placeholders; read the bars as relative weeks.
``` mermaid
gantt
    title 24-Week Plan (relative weeks, Week 1 = 05 Jan placeholder)
    dateFormat YYYY-MM-DD
    axisFormat Wk %U
    section Research
    Literature review and research gap (40h)      :a1, 2026-01-05, 28d
    Ethics, data requirements, security (30h)     :a2, 2026-01-05, 28d
    section Data
    Dataset collection and preprocessing (50h)    :b1, 2026-01-19, 35d
    section Secure API
    Secure API pipeline (55h)                     :c1, 2026-02-02, 35d
    section AI
    GL mapping and baseline model (50h)           :d1, 2026-02-16, 35d
    AI-powered GL prediction (65h)                :d2, 2026-03-02, 42d
    Multilingual transaction processing (50h)     :d3, 2026-03-16, 42d
    Human-in-the-loop and learning (45h)          :d4, 2026-04-06, 35d
    KPI prediction and modelling (35h)            :d5, 2026-05-04, 28d
    section Finance and BI
    Reconciliation and ledger processing (40h)    :e1, 2026-05-18, 28d
    Power BI dashboard (25h)                      :e2, 2026-05-25, 28d
    section Validation
    Integration, security, performance tests (25h):f1, 2026-05-25, 21d
    Evaluation and analysis (35h)                 :f2, 2026-06-01, 21d
    Final report and demonstration (25h)          :f3, 2026-06-08, 14d
```
Milestones
---
Milestone               Week                    Outcome
---
M1                  4                       Secure API design, data
classification,
required permissions
and minimum scope
confirmed
M2                  8                       Dataset, preprocessing,
data split and baseline
GL model completed
M3--M5              12--21                  Secure API,
multilingual GL
prediction, human
approval,
reconciliation, KPI
prediction, dashboards
and security completed
The held-out evaluation cannot begin until thresholds and test scripts
are frozen. Permission delays must be reflected in an updated schedule,
not hidden by backdating.
---
21. Risks and Mitigations
---
Risk                    Impact                  Mitigation
---
Real postal data        Limited real-world      Approved synthetic and
delayed or unavailable  validation              secondary datasets;
state the limitation
Data contains sensitive Privacy, security and   Classification,
information             ethical risk            minimization, access
control, redaction,
secure storage
Secure API              Clerk-to-officer        Test authN/authZ, TLS,
authentication or       processing blocked      validation and failure
exchange fails                                  handling in Postman
before integration
Insufficient or         Poor GL prediction      Combine approved
imbalanced historical                           historical and
data                                            synthetic data, class
balancing, report
limitations
Inconsistent GL labels  Incorrect training and  Controlled GL mapping,
predictions             validate labels with
domain guidance, remove
or correct bad records
Low prediction          Unreliable              Predefined threshold;
confidence              recommendations         manual ledger selection
for low confidence
Incorrect GL            Misclassified financial Human approval; never
recommendations         records                 auto-finalize
unsupported predictions
Sinhala, Tamil or       Lower accuracy for some Multilingual
English text hard to    languages               preprocessing,
process                                         per-language
evaluation, manual
review fallback
KPI data incomplete or  Unreliable KPI          Define required fields,
inconsistent            predictions             validate missing
values, approved
synthetic data where
needed
---
22. Budget
Item                                             Allowance                     Subtotal
---
Postman / API testing tools                      Free academic / open-source   0
Cloud hosting / backend services                 6 months × 1,500              9,000
Database / cloud storage                         6 months × 1,000              6,000
AI/ML model development and computing            Approx.                       5,000
Google Translate API / multilingual processing   Approx.                       3,000
Power BI / dashboard development                 Free academic / Desktop       0
Domain, SSL and deployment contingency           Approx.                       3,000
Dataset preparation and validation               Approx.                       3,000
Total                                                                      29,000
Cost controls: local backend and database before any cloud deployment,
open-source ML before commercial AI services, and synthetic or existing
data to reduce collection cost. Production payment gateways, enterprise
financial-system integration and security certification are excluded
from the academic prototype.
---
23. Commercialization Outlook
Stages: (1) academic prototype with synthetic and secondary data →
(2) small authorized shadow pilot with approved data → (3) limited
operational integration, only if evidence and approval exist.
Organization-wide rollout is outside this project.
Target adopter: a financial or postal-service organization
managing daily transactions, ledgers, reconciliation and officer
performance.
Value proposition: an integrated support layer combining secure
transaction processing, multilingual AI GL prediction,
reconciliation, KPI prediction and dashboards.
Possible model: one-time integration/configuration fee plus
annual maintenance and support.
No revenue forecast or customer commitment is claimed at this
stage. Benefits remain hypotheses until pilot-tested.
---
24. Proposed Repository Structure
> This is a suggested layout for the implementation phase and does not
> yet exist.
``` text
postassist-ledger-kpi/
├── README.md
├── docs/
│   ├── proposal.pdf
│   ├── architecture/
│   └── api/                    # OpenAPI schema, Postman exports
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI entry point
│   │   ├── api/                # transactions, approvals, posting, reconciliation, dashboards
│   │   ├── core/               # auth, RBAC, security, config
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   └── services/           # business logic, audit logging
│   └── tests/
├── ml/
│   ├── data/                   # synthetic / anonymized datasets only
│   ├── notebooks/
│   ├── gl_prediction/          # preprocessing, training, calibration, evaluation
│   ├── kpi_prediction/
│   └── models/                 # versioned model artifacts
├── frontend/                   # React + TypeScript clerk/officer UI
├── dashboards/                 # Power BI (.pbix) and reporting SQL views
├── postman/                    # API collections and environments
├── scripts/                    # seed data, migrations, backup/restore
├── .env.example
└── docker-compose.yml          # optional local setup
```
---
25. Getting Started (Planned)
> Placeholder commands for when the implementation exists. Adjust paths
> and names to match the final code.
Prerequisites: Python 3.10+, Node.js 18+, PostgreSQL 14+, Postman,
Power BI Desktop.
``` bash
# 1. Clone
git clone <your-repository-url>
cd postassist-ledger-kpi

# 2. Backend
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env            # set DB URL, JWT secret and threshold (never commit secrets)
uvicorn app.main:app --reload

# 3. Frontend
cd ../frontend
npm install
npm run dev

# 4. API testing
# Import the collections from /postman into Postman and select the local environment
```
Suggested configuration (`.env`)
``` ini
DATABASE_URL=postgresql://user:password@localhost:5432/postassist
JWT_SECRET=change-me
GL_CONFIDENCE_THRESHOLD=0.80   # example only; select on validation data, then freeze
```
---
26. Limitations and Honest Notes
This section states plainly what this project is, and is not, so that
nobody reads more into it than the evidence supports.
26.1 Current status
The project is at proposal stage. No code, model, dataset,
experiment, interview or survey result exists yet.
Every number in this README (95% API tests, 85% macro-F1, 90%
high-confidence accuracy, 90% reconciliation accuracy, 2 s response,
10 concurrent users) is a proposed target, not an achieved
result.
The targets still need supervisor approval after a feasibility check
and before the final held-out evaluation.
Technology choices (FastAPI, PostgreSQL, React, Power BI) are plans.
The ML algorithms are not yet chosen.
26.2 Data limitations
The plan relies on synthetic, anonymized or approved secondary
data (about 1,000--1,500 transactions, 500--1,000 KPI records).
Real postal records are not guaranteed to be available.
Results from such data will not prove performance in real Sri
Lankan postal branches, and no nationwide validation is claimed.
GL labels depend on how well the account mapping and officer review
reflect real accounting practice. Inconsistent labels would hurt
training.
A small dataset may be imbalanced across GL accounts, so rare
accounts may be predicted poorly. Results will be reported per
account and per language.
Sinhala and Tamil have fewer language resources than English, so
performance may differ by language. English results cannot be
assumed to transfer.
26.3 Model and evaluation limitations
High confidence does not guarantee a correct prediction.
Calibration is tested, not assumed.
Accuracy on a general financial dataset in the literature does not
guarantee similar accuracy on postal transactions.
Officer corrections are not automatically correct, so only approved
corrections will be used for retraining.
A faster prediction is not a success if it increases wrong GL
assignments.
KPI prediction may inherit organizational bias and may reflect
opportunity rather than individual ability. Without temporal
validation, random splits would give overly optimistic results.
Predicted KPI is decision support only. It must not be used for
disciplinary, promotion or employment decisions.
26.4 Security and scope limitations
API security testing is prototype-level and is not a formal
security certification.
The prototype is evaluated as a decision-support system. It does
not replace approved Sri Lanka Post accounting procedures, and
it never makes autonomous financial decisions.
Out of scope: production payment gateways, integration with official
financial systems, security certification, ongoing staff support,
and organization-wide rollout. Each would need separate costing and
approval.
Cash reconciliation of other modules and route optimization are not
part of this component. Other PostAssist LK components may only use
its approved, versioned APIs.
The proposal's commercial benefits (time saved, fewer errors, cost
advantages) are hypotheses until pilot-tested. No revenue
forecast or customer commitment is claimed.
26.5 Ethics and permissions
Interviews and observations need institutional and postal
permission, are voluntary, and focus on workflows, not employee
monitoring. No participant has been recruited yet, and no
operational approval is represented as complete.
Real financial and employee records are treated as private.
Sensitive data must not appear in API responses, logs or dashboards.
If postal access is unavailable, findings from role-based university
participants and synthetic data will be clearly labelled as
simulated.
26.6 Schedule and budget caveats
The 24-week schedule is provisional and relative to proposal
approval. Permission delays will be reflected in an updated
schedule, not hidden.
The budget (29,000) is an allowance estimate for an academic
prototype, based on free tiers and open-source tools. Hosting,
translation API usage and cloud costs may vary.
26.7 AI use disclosure
The proposal was prepared with AI assistance (ChatGPT) for planning,
design and methodology drafting. This README was also drafted with AI
assistance from the proposal text. The student is responsible for
verifying the content, checking institutional requirements, running the
experiments and making the final research decisions.
---
27. References
Key sources (full list in the proposal report):
[34] Z. Yang et al., "A deep learning framework for automated
transaction classification and budget prediction in personal
financial management," Discover Artificial Intelligence, vol. 6,
2026.
[35] Y. Li, "Accounting Data Classification and Prediction Based
on Machine Learning Algorithms," Procedia Computer Science,
vol. 285, 2026.
[36] A. Booker et al., "AIS research opportunities utilizing
machine learning," Int. J. Accounting Information Systems,
vol. 52, 2024.
[10] "Si-Ta: Machine Translation of Sinhala and Tamil Official
Documents," NITC, 2018.
[11] "A Multi-way Parallel Named Entity Annotated Corpus for
English, Tamil and Sinhala," Natural Language Processing Journal,
vol. 11, 2025.
[13] "Human-in-the-loop: Explainable or Accurate Artificial
Intelligence by Exploiting Human Bias?" IEEE, 2022.
[15] "Analysis and Prediction of Employee Promotions Using Machine
Learning," DSIT, 2022.
[16] "Predicting Employee Performance Using Machine Learning to
Enhance Workforce Efficiency," IEEE, 2024.
[5] NIST, "Guidelines for API Protection for Cloud-Native
Systems," SP 800-228, 2025.
[6] NIST, "Data Classification Concepts and Considerations for
Improving Data Protection," IR 8496, 2023.
---
```{=html}
<p align="center">
```
`<b>`{=html}PostAssist LK -- Intelligent Ledger and KPI
Prediction`</b>`{=html}`<br>`{=html} Gunawardena N C A · IT23323216 ·
J26-IT-372 · SLIIT · September 2026
```{=html}
</p>
```
