
Final-year research project · Postal Delivery Operations and Relief
Assignment
Institutional project: PostAssist LK · J26-IT-372
1. Project overview
This individual component focuses on supporting postal delivery
operations in the Kaduwela area. It combines a browser-based delivery
map prototype with a machine-learning research workflow that classifies
a postal address into one of three delivery areas.

The intended workflow is:
1. An administrator views and manages delivery areas on a map.
2. Delivery stops can be associated with the relevant area and
   organised into routes.
3. A user enters an address into the address-classification interface.
4. The machine-learning model predicts a delivery area and returns a
   confidence score.
5. Low-confidence predictions are flagged for manual review.
6. The user can view the relevant delivery area on the map when a
   matching boundary is available.
Important: A model prediction is a recommendation, not an automatic
operational decision. A prediction must not silently assign a stop or
change a route. The prototype does not include live GPS tracking.
2. Problem statement
Postal addresses may be written in different ways, and a new or relief
postman may not immediately know which delivery area an address belongs
to. The project investigates whether text classification can help
identify the correct delivery area from an English address, while a map
interface helps users understand the delivery-area boundaries and
organise delivery work.

The research classification labels are:
- PAHALA_BOMIRIYA
- IHALA_BOMIRIYA
- HEWAGAMA
3. Main objectives
- Provide a Leaflet-based map for viewing delivery areas and delivery
  stops.
- Support area-aware stop organisation and route planning in the
  prototype.
- Build and evaluate a text-classification baseline for Kaduwela
  delivery-area prediction.
- Display a predicted area and confidence score for an entered
  address.
- Flag predictions below a validation-selected threshold for manual
  review.
- Keep the map workflow and ML workflow understandable and separate
  within the web interface.
- Preserve human confirmation for operational decisions.
4. Technology stack
  Part                              Technology
  Map interface                     HTML, CSS, JavaScript, Leaflet
  Current prototype storage         Browser localStorage
  Backend found in the workspace    Node.js, Express
  Database found in the workspace   MongoDB
  ML experiments                    Python, pandas, scikit-learn, matplotlib
  Saved ML pipeline                 Character-level TF-IDF + Logistic Regression
  Model persistence                 joblib
  Dataset format                    Excel workbook (.xlsx)
  Development environment           Visual Studio Code

The map uses Leaflet. No alternative map library is required for this
component.
5. Delivery map prototype
The map component is intended for desktop administrator use and mobile
postman use. Its data model includes:
- Areas: id, name, color, points
- Stops: id, label, road, point, areaId
- Routes: id, name, stopIds
The browser prototype has used the postal-delivery-prototype-v1
local-storage key. Area assignment is represented by areaId;
unassigned or invalid assignments should be treated as Unassigned.
Renaming an area should preserve its stop assignments. Deleting an area
should clear the associated stop assignment without deleting the stops
or silently changing route order.

These behaviours should be checked against the current code before a
demonstration, especially if the application has changed since the
prototype was tested.
6. Address-classification research
6.1 Dataset
The workbook used during development is:

kaduwela_postal_dataset_Final.xlsx

The dataset documentation in the wider project describes 902 address
records across the three delivery areas:

  Delivery area         Number of records
  PAHALA_BOMIRIYA                   300
  IHALA_BOMIRIYA                    300
  HEWAGAMA                          302
  Total                       902

Relevant columns include record_id, address_text,
target_delivery_area, locality_name, road_name,
verification_status, split_group, and derived experiment-partition
information where present.

Data-provenance limitation: The wider repository README describes
the Kaduwela addresses as synthetic and says that official postal
records must be used to verify them before real operational use. Do not
describe the dataset as an official real-address dataset unless its
provenance supports that claim. Label verification and real-world
address verification are not the same thing.
6.2 Data splitting
The experiment used road-grouped train, validation, and test partitions
to reduce the risk of closely related road records appearing in
different partitions.

  Partition                       Records
  Train                               630
  Validation                          135
  Test                                135
  Excluded unassigned records           2

Two unassigned HEWAGAMA records were excluded from the split experiment.
Missing-road records were retained in training according to the
project's split plan.
6.3 Model approach
The saved model is a scikit-learn pipeline using:
- Character-level TF-IDF, configured with char_wb character
  n-grams in the 3--5 range.
- Logistic Regression for three-class classification.
- predict_proba to produce class probability scores.
Character n-grams can capture parts of road and locality names even when
address text varies in spacing, spelling, or formatting. The model
output is still dependent on the quality and representativeness of the
dataset.

Saved model path:

address_ml/models/character_tfidf_logistic_regression.joblib

The earlier word-level TF-IDF baseline is retained for comparison. The
saved character model should be loaded for inference rather than
retrained during a normal application demonstration.
6.4 Reported experiment results
The recorded experiment reports the following results:
  Model           Evaluation                  Accuracy             Macro F1
                  partition                            
  Word TF-IDF +   Validation                    91.11%               0.9097
  Logistic
  Regression                                           

  Word TF-IDF +   Test                          88.15%               0.8837
  Logistic
  Regression                                           

  Character       Validation                    97.04%               0.9703
  TF-IDF +
  Logistic
  Regression                                           
  Character       Final test                    94.07%               0.9409
  TF-IDF +        evaluation
  Logistic
  Regression                                           
For the character model, the recorded final test confusion matrix
(actual rows and predicted columns, in the order HEWAGAMA,
IHALA_BOMIRIYA, PAHALA_BOMIRIYA) was:
[[45, 0, 0],
 [ 7,38, 0],
 [ 1, 0,44]]
These results describe the recorded experiment, not a guarantee of
performance on real postal mail. The wider experiment history includes
earlier test-set evaluation and error analysis for the word baseline.
Therefore, the test set should not be described as having been
completely untouched by all previous exploratory work.
6.5 Confidence threshold and manual review
The recorded threshold selected using validation data was approximately:

0.4062616290792437

The intended policy is to send predictions below the threshold to manual
review. In the recorded character-model test evaluation, the threshold
accepted 131 of 135 records (97.04% coverage); accuracy among accepted
records was 96.95%, and 4 records (2.96%) were flagged for review.

The threshold is a research decision rule. A probability score is not
automatically a calibrated measure of real-world correctness. Threshold
behaviour should be tested in the actual application before it is relied
on.
7. Intended application workflow
The intended UI has two main views:
Delivery Map
- Display the Leaflet map and available delivery-area boundaries.
- Display and filter delivery stops by area.
- Support the existing area and route workflow.
- Keep map interactions available after switching between views.
Address Classifier
- Accept a non-empty English address.
- Send the address to the actual saved model through a
  backend/inference service once that integration is verified.
- Show the predicted delivery area and confidence.
- Show a manual-review warning when the confidence is below the
  configured threshold.
- Offer navigation to the matching map area when the relevant boundary
  exists.
- Clear the entered address and prediction result when requested.
Implementation status note: The UI navigation and classifier form
were implemented in the latest recorded Phase 2A work. The classifier
form was still a UI shell at that point; a real prediction should only
be claimed as working after the backend/model integration and end-to-end
tests pass. The Express/MongoDB server and the ML inference path must be
checked in the current workspace before claiming that the full system is
connected.
8. Project structure
The main development workspace used for the prototype is:
delivery_operations_relieaf/
├── index.html
├── styles.css
├── app.js
├── README.md
├── server/
│   ├── server.js
│   ├── db.js
│   └── package.json
└── address_ml/
    ├── .venv/
    ├── data_verified.xlsx
    ├── prepare_splits.py
    ├── baseline_experiment.py
    ├── character_tfidf_experiment.py
    ├── final_test_evaluation.py
    ├── analyze_baseline_errors.py
    ├── models/
    │   └── character_tfidf_logistic_regression.joblib
    └── outputs/
        ├── split_report.json
        ├── character_tfidf_evaluation.json
        ├── final_test_evaluation.json
        ├── final_model_comparison.md
        ├── research_artifact_audit.md
        └── ui_integration_plan.md
This is a guide to the files recorded during development, not a
guarantee that every file is present in every checkout. Check the actual
workspace before running a command.
9. Setup and running locally
9.1 Open the project
Open this folder in Visual Studio Code:
C:\Users\user\OneDrive\Desktop\delivery_operations_relieaf
9.2 View the frontend
If the UI is opened directly as a file:// page, browser requests to
the Express API may fail. Use the project's configured local web server
when testing API-backed features. Check the current
server/package.json and project instructions for the supported start
command; do not assume the backend is running merely because the map
page loads.

The map may still render independently of the backend, but
backend-dependent behaviour is not verified by that alone.
9.3 Check JavaScript syntax
From the project root, run:
node --check app.js
This checks JavaScript syntax; it does not prove that the API, database,
map interactions, or ML predictions work end to end.
9.4 Use the existing ML environment
PowerShell example:
cd "C:\Users\user\OneDrive\Desktop\delivery_operations_relieaf\address_ml"
.\.venv\Scripts\Activate.ps1
python --version
Use the existing virtual environment for the research scripts. Do not
install packages or retrain the model merely to demonstrate the current
saved model. Before running an experiment, check the script's input
paths and output behaviour so that original data and previous results
are preserved.

The model inference service should use the saved pipeline at
models\character_tfidf_logistic_regression.joblib. Do not claim the
classifier page is connected until a real input has produced a result
through the application and failure cases have been tested.
10. Testing checklist
Before a supervisor demonstration, check:
- [ ] The map loads and Leaflet tiles display.
- [ ] Delivery-area boundaries and stops appear correctly.
- [ ] Area filtering and area assignment behave as expected.
- [ ] Existing route order is preserved during unrelated UI changes.
- [ ] Navigation between Delivery Map and Address Classifier works.
- [ ] The classifier rejects an empty address.
- [ ] A valid address produces a result from the actual saved model,
  not a hard-coded example.
- [ ] The predicted label is one of the three canonical labels.
- [ ] Confidence and manual-review status are displayed correctly.
- [ ] A low-confidence result is flagged for manual review.
- [ ] Clear resets the input and results.
- [ ] API/model failure is shown as an error, not as a fabricated
  prediction.
- [ ] No stop assignment or route change occurs without explicit user
  confirmation.
- [ ] The UI remains usable on a narrow mobile viewport.
- [ ] No live GPS tracking has been added.
11. Limitations and responsible use
- The address dataset is documented as synthetic in the wider project
  README; official postal verification is required before operational
  use.
- The dataset has no verified postcode or coordinate values in the
  shared project documentation.
- Reported model metrics apply to the recorded experimental split, not
  necessarily to real postal addresses.
- The experiment history includes earlier use of the test partition
  for baseline evaluation and error analysis; describe this limitation
  honestly in research reporting.
- A confidence threshold is a review policy, not a guarantee that
  predictions above it are correct.
- The UI/backend/model integration must be verified end to end before
  describing the full workflow as complete.
- Keep a human in the loop for uncertain predictions and operational
  changes.
- The prototype does not provide live GPS tracking.
12. Research artifacts
Useful experiment and audit files include:
- outputs/baseline_evaluation.json
- outputs/baseline_error_analysis.json
- outputs/error_pattern_analysis.md
- outputs/character_tfidf_evaluation.json
- outputs/word_vs_character_comparison.md
- outputs/final_test_evaluation.json
- outputs/final_model_comparison.md
- outputs/research_artifact_audit.md
- outputs/ui_integration_plan.md
Use these artifacts to explain the experimental process and its
limitations. Keep validation analysis separate from test evaluation, and
do not tune a threshold or model by repeatedly inspecting test errors.
13. Summary
This project combines a Leaflet delivery-map prototype with a
three-class postal-address classification research pipeline for
Kaduwela. The map supports visual understanding of delivery areas and
delivery work, while the ML research evaluates whether address text can
help predict the correct area. Low-confidence predictions are intended
for manual review, and operational decisions remain under human control.
