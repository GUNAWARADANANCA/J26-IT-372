// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'PostAssist LK';

  @override
  String get appSubtitle => 'Registered mail intake and tracking';

  @override
  String get officialUseStrip => 'Official use – authorised postal staff only';

  @override
  String get officialUseTitle => 'Official use';

  @override
  String get officialUseBody =>
      'This app is for authorised postal staff. Every sign-in and every change to a record is logged. It is a research prototype: use synthetic mail unless the trial has been approved.';

  @override
  String get publicServiceStrip => 'PostAssist LK – registered letter tracking';

  @override
  String get publicServiceTitle => 'Letter tracking';

  @override
  String get publicServiceBody =>
      'This page shows the progress of a registered letter to its sender. Places are shown as office names only; staff names and map positions are never shown.';

  @override
  String get close => 'Close';

  @override
  String get cancel => 'Cancel';

  @override
  String get back => 'Back';

  @override
  String get next => 'Next';

  @override
  String get done => 'Done';

  @override
  String get save => 'Save';

  @override
  String get search => 'Search';

  @override
  String get retry => 'Retry';

  @override
  String get tryAgain => 'Try again';

  @override
  String get loading => 'Loading…';

  @override
  String get saving => 'Saving…';

  @override
  String get optional => 'optional';

  @override
  String get thereIsAProblem => 'There is a problem';

  @override
  String get somethingWentWrong => 'Something went wrong';

  @override
  String get errorNetwork =>
      'The server did not answer. Check that the phone is on the same network as the PostAssist server and that the address is right.';

  @override
  String get errorSessionExpired => 'Your session has ended. Sign in again.';

  @override
  String get errorForbidden => 'You are not allowed to do this.';

  @override
  String get reason => 'Reason';

  @override
  String reasonTooShort(int min) {
    return 'Enter at least $min characters';
  }

  @override
  String get language => 'Language';

  @override
  String get languageHint => 'Choose the language for the app.';

  @override
  String get usePhoneLanguage => 'Use the phone\'s language';

  @override
  String get progress => 'Progress';

  @override
  String get complete => 'complete';

  @override
  String get notComplete => 'not complete';

  @override
  String get signInTitle => 'Staff sign-in';

  @override
  String get serverAddress => 'Server address';

  @override
  String get serverAddressHint =>
      'The computer running the PostAssist server, for example http://192.168.1.10:8000';

  @override
  String get testConnection => 'Test connection';

  @override
  String get connectionOk => 'Server reached';

  @override
  String get connectionFailed => 'No answer';

  @override
  String get insecureConnectionWarning =>
      'This connection is not encrypted (http). Use it only on a closed lab network; a live service must use https.';

  @override
  String get username => 'Username';

  @override
  String get password => 'Password';

  @override
  String get showPassword => 'Show password';

  @override
  String get hidePassword => 'Hide password';

  @override
  String get signIn => 'Sign in';

  @override
  String get staffOnlyNotice =>
      'For authorised postal staff. Sign-ins are logged for audit.';

  @override
  String get errServerRequired => 'Enter the server address';

  @override
  String get errServerInvalid => 'The server address is not valid';

  @override
  String get errUsernameRequired => 'Enter your username';

  @override
  String get errPasswordRequired => 'Enter your password';

  @override
  String get errWrongCredentials => 'The username or password is wrong';

  @override
  String get sessionExpiredTitle => 'Session ended';

  @override
  String get sessionExpiredBody =>
      'For security you were signed out. Sign in again – scans saved on this phone are kept.';

  @override
  String get trackLetterPublic => 'Sent a registered letter?';

  @override
  String get trackLetterPublicHint =>
      'Anyone with a receipt can see the letter\'s progress – no sign-in needed.';

  @override
  String get trackALetter => 'Track a letter';

  @override
  String get aboutAndPrivacy => 'About, privacy and accessibility';

  @override
  String get settings => 'Settings';

  @override
  String welcome(String name) {
    return 'Welcome, $name';
  }

  @override
  String get groupDaily => 'Daily work';

  @override
  String get groupSupervision => 'Supervision';

  @override
  String get groupSetup => 'Set-up and tools';

  @override
  String get scanALetter => 'Scan a registered letter';

  @override
  String get auditFooter =>
      'Sign-ins and changes to records are logged for audit.';

  @override
  String reviewWaiting(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count scans are waiting for your review',
      one: '1 scan is waiting for your review',
    );
    return '$_temp0';
  }

  @override
  String get openReviewQueue => 'Open review queue';

  @override
  String get offlineScansTitle => 'Scans on this phone';

  @override
  String get networkAvailable => 'Network available';

  @override
  String get networkOffline => 'Offline – scans are saved on this phone';

  @override
  String pendingCount(int count) {
    return '$count waiting to upload';
  }

  @override
  String heldCount(int count) {
    return '$count held';
  }

  @override
  String rejectedCount(int count) {
    return '$count rejected';
  }

  @override
  String lastUploadFailed(String error) {
    return 'Last upload failed: $error';
  }

  @override
  String get lastUploadFailedNetwork =>
      'Last upload failed: no connection to the server. Scans will upload automatically.';

  @override
  String get uploadNow => 'Upload now';

  @override
  String get uploading => 'Uploading…';

  @override
  String get taskRegister => 'Register a letter';

  @override
  String get taskRegisterHint => 'Counter intake in five steps';

  @override
  String get taskScan => 'Scan a letter';

  @override
  String get taskScanHint => 'Record dispatch, transit or delivery';

  @override
  String get taskItems => 'Registered items';

  @override
  String get taskItemsHint => 'Find an item and see its history';

  @override
  String get taskHistory => 'My scans';

  @override
  String get taskHistoryHint => 'Saved scans and upload status';

  @override
  String get taskReview => 'Review queue';

  @override
  String get taskReviewHint => 'Approve or reject held scans';

  @override
  String get taskMessages => 'Sender messages';

  @override
  String get taskMessagesHint => 'E-mail and SMS updates to senders';

  @override
  String get taskSummary => 'Summary';

  @override
  String get taskSummaryHint => 'Items, reviews and messages at a glance';

  @override
  String get taskAudit => 'Audit log';

  @override
  String get taskAuditHint => 'Who did what, and when';

  @override
  String get taskDevices => 'Scale and camera';

  @override
  String get taskDevicesHint => 'IoT scale status, tare, calibrate';

  @override
  String get taskOffices => 'Offices and zones';

  @override
  String get taskOfficesHint => 'Reference points for location checks';

  @override
  String get taskTrack => 'Track a letter';

  @override
  String get taskTrackHint => 'The sender\'s view of an item';

  @override
  String get stAccepted => 'Accepted at counter';

  @override
  String get stDispatched => 'Dispatched';

  @override
  String get stInTransit => 'In transit';

  @override
  String get stAtDestination => 'At destination office';

  @override
  String get stOutForDelivery => 'Out for delivery';

  @override
  String get stDeliveryAttempted => 'Delivery attempted';

  @override
  String get stDelivered => 'Delivered';

  @override
  String get stReturnStarted => 'Return started';

  @override
  String get stReturnedToSender => 'Returned to sender';

  @override
  String get roleAdmin => 'Administrator';

  @override
  String get rolePostmaster => 'Postmaster';

  @override
  String get roleCounter => 'Counter officer';

  @override
  String get roleHub => 'Hub officer';

  @override
  String get rolePostman => 'Postman';

  @override
  String get decAccepted => 'Accepted';

  @override
  String get decAcceptedAfterReview => 'Accepted after review';

  @override
  String get decHeld => 'Held for review';

  @override
  String get decRejected => 'Rejected';

  @override
  String get decRejectedAfterReview => 'Rejected after review';

  @override
  String get decDuplicate => 'Already recorded';

  @override
  String get decPending => 'Waiting to upload';

  @override
  String get locConsistent => 'Location matches';

  @override
  String get locUncertain => 'Location uncertain';

  @override
  String get locMismatch => 'Location mismatch';

  @override
  String get locUnlocated => 'No location sent';

  @override
  String get locNotAssessed => 'Location not checked';

  @override
  String get locDenied =>
      'Location permission was refused – the scan was saved without location';

  @override
  String get locTimeout =>
      'No location fix in time – the scan was saved without location';

  @override
  String get locUnavailable => 'Location is switched off or unavailable';

  @override
  String get obQueued => 'Queued';

  @override
  String get obRetry => 'Waiting to retry';

  @override
  String get obSending => 'Sending';

  @override
  String get obSent => 'Sent';

  @override
  String get obAmbiguous => 'Unclear – check';

  @override
  String get obFailed => 'Failed';

  @override
  String get obResolved => 'Resolved by hand';

  @override
  String get channelNone => 'No messages (receipt only)';

  @override
  String get channelEmail => 'E-mail';

  @override
  String get channelSms => 'SMS (only if a gateway is approved)';

  @override
  String get sevInfo => 'Info';

  @override
  String get sevWarning => 'Warning';

  @override
  String get sevSecurity => 'Security';

  @override
  String get scanLabel => 'Scan label';

  @override
  String get scanInstruction =>
      'Point the camera at the barcode or QR code on the label';

  @override
  String get torch => 'Torch';

  @override
  String get cameraPermissionNeeded =>
      'Camera permission is needed to scan labels. Allow it in the phone\'s settings, or type the ID below.';

  @override
  String get cameraUnavailable =>
      'The camera could not be started. Type the ID below.';

  @override
  String get notAPostAssistCode =>
      'This code is not a PostAssist label. Try again or type the ID.';

  @override
  String get typeTrackingId => 'Damaged label? Type the tracking ID';

  @override
  String get typeTrackingIdHint => 'It is printed under the barcode.';

  @override
  String get useTypedId => 'Use typed ID';

  @override
  String get errTrackingIdInvalid =>
      'This is not a valid tracking ID – check each character (example: PA-DEMO-7K3M9Q2XRH4)';

  @override
  String get recordStatus => 'Record status';

  @override
  String get scanSaved => 'Scan saved';

  @override
  String get lookingUpItem => 'Looking up the item…';

  @override
  String get offlineModeTitle => 'Working offline';

  @override
  String get offlineModeBody =>
      'Item details could not be loaded. You can still record the scan; the server checks it when it uploads.';

  @override
  String get destinationOffice => 'Destination office';

  @override
  String get destinationTown => 'Destination town';

  @override
  String get assignedPostman => 'Assigned postman';

  @override
  String get deliverTo => 'Deliver to';

  @override
  String get nothingToRecordTitle => 'Nothing to record';

  @override
  String get nothingToRecordBody =>
      'You cannot record a new status for this item now.';

  @override
  String get newStatus => 'New status';

  @override
  String get newStatusHint =>
      'Only the statuses you may record for this item are shown.';

  @override
  String get reasonTitle => 'Reason';

  @override
  String get reasonHint => 'Why the letter could not be delivered.';

  @override
  String get reasonNotAvailable => 'Recipient not available';

  @override
  String get reasonClosed => 'Premises closed';

  @override
  String get reasonAddressNotFound => 'Address not found';

  @override
  String get reasonRefused => 'Recipient refused';

  @override
  String get reasonUnsafe => 'Unsafe access';

  @override
  String get otherReason => 'Reason in your own words';

  @override
  String get ackTitle => 'Delivery acknowledgement';

  @override
  String get ackHint =>
      'Required for a delivered letter: how did the recipient acknowledge it?';

  @override
  String get ackSignature => 'Signature';

  @override
  String get ackNameOnly => 'Name only';

  @override
  String get ackSheet => 'Delivery sheet';

  @override
  String get receivedBy => 'Received by (name)';

  @override
  String get relationship => 'Relationship to the addressee';

  @override
  String get relationshipHint => 'For example: self, spouse, security officer';

  @override
  String get sheetNumber => 'Delivery sheet / page number';

  @override
  String get signature => 'Recipient\'s signature';

  @override
  String get signatureHint => 'Ask the recipient to sign inside the box.';

  @override
  String get signatureArea =>
      'Signature area. Draw the signature with one finger.';

  @override
  String get signHere => 'Sign here with a finger';

  @override
  String get clearSignature => 'Clear signature';

  @override
  String get noAckPossible => 'No acknowledgement possible';

  @override
  String get noAckPossibleHint =>
      'Describe the approved exception. The scan will be held for the postmaster.';

  @override
  String get exceptionReason => 'Exception reason';

  @override
  String get notes => 'Notes';

  @override
  String get locationNotice =>
      'Your location is read once, when you press Save. The postmaster sees it as evidence quality – it is not proof of delivery.';

  @override
  String get saveScan => 'Save scan';

  @override
  String get readingLocation => 'Reading location…';

  @override
  String get errChooseStatus => 'Choose the new status';

  @override
  String get errReasonRequired => 'Choose or type a reason';

  @override
  String get errExceptionTooShort =>
      'Describe the exception in at least 5 characters';

  @override
  String get errRecipientNameRequired =>
      'Enter the name of the person who received the letter';

  @override
  String get errSignatureRequired => 'Ask the recipient to sign';

  @override
  String get errSheetRequired => 'Enter the delivery sheet or page number';

  @override
  String get outcomeAcceptedTitle => 'Accepted';

  @override
  String get outcomeAcceptedBody =>
      'The server accepted the scan and updated the status.';

  @override
  String get outcomeDuplicateTitle => 'Already recorded';

  @override
  String get outcomeDuplicateBody =>
      'The server already had this scan. Nothing was added twice.';

  @override
  String get outcomeHeldTitle => 'Saved – held for review';

  @override
  String get outcomeHeldBody =>
      'The scan is stored, but the status changes only after the postmaster approves it.';

  @override
  String get outcomeRejectedTitle => 'Not accepted';

  @override
  String get outcomeRejectedBody => 'The server did not accept this scan:';

  @override
  String get outcomePendingTitle => 'Saved on this phone';

  @override
  String get outcomePendingBody =>
      'It will upload automatically when the network returns.';

  @override
  String get statusRecorded => 'Status recorded';

  @override
  String get locationEvidence => 'Location evidence';

  @override
  String locationQuality(int metres, int seconds) {
    return '± $metres m, $seconds s old';
  }

  @override
  String get mockLocationWarning =>
      'The phone reported a simulated (mock) location. The scan will be held for review.';

  @override
  String get scanNext => 'Scan next letter';

  @override
  String get scanAnother => 'Scan another letter';

  @override
  String get itemNotFoundTitle => 'Item not found';

  @override
  String get notAllowedTitle => 'You cannot scan this item';

  @override
  String get historyIntro =>
      'Scans are saved on this phone first and uploaded when there is network. Scans waiting to upload are never deleted.';

  @override
  String get noScansYet => 'No scans on this phone yet';

  @override
  String waitingForUser(String user) {
    return 'Waits for $user to sign in';
  }

  @override
  String retryPending(int attempts) {
    return 'Upload not finished – $attempts attempt(s), will retry';
  }

  @override
  String get trackIntro =>
      'Senders can follow a registered letter with the QR code or the tracking ID and access code on their receipt.';

  @override
  String get scanReceiptQr => 'Scan the receipt QR code';

  @override
  String get scanReceipt => 'Scan receipt';

  @override
  String get scanReceiptInstruction =>
      'Point the camera at the QR code on the sender\'s receipt';

  @override
  String get orTypeDetails => 'Or type the details from the receipt';

  @override
  String get trackingId => 'Tracking ID';

  @override
  String get trackingIdHint =>
      'Printed under the barcode, for example PA-DEMO-7K3M9Q2XRH4';

  @override
  String get accessCode => 'Access code';

  @override
  String get accessCodeHint =>
      'Part of the tracking link on the receipt (after #t=)';

  @override
  String get errAccessCodeRequired => 'Enter the access code from the receipt';

  @override
  String get showStatus => 'Show status';

  @override
  String get trackNotFoundTitle => 'No tracking record found';

  @override
  String get trackNotFoundBody =>
      'Check the tracking ID and the access code on the receipt. For your security we do not say which one is wrong.';

  @override
  String get acceptedOn => 'Accepted on';

  @override
  String get fromOffice => 'From office';

  @override
  String get history => 'History';

  @override
  String syncedLater(String time) {
    return 'Uploaded later, at $time';
  }

  @override
  String get historyOnly => 'Kept in history only';

  @override
  String get trackPrivacyNotice =>
      'Status is recorded when authorised staff scan the letter. Places are office names only; a scan\'s position is not proof of delivery.';

  @override
  String get intakeIntro =>
      'Register a registered letter in five steps: photo, addresses, confirm, weigh, charge.';

  @override
  String get registerNewLetter => 'Register a new letter';

  @override
  String get ocrUnavailableTitle => 'Address reading is not available';

  @override
  String get ocrUnavailableBody =>
      'The server has no OCR engine or handwriting model installed. Type or paste the address instead.';

  @override
  String get draftsInProgress => 'Registrations in progress';

  @override
  String get noDrafts => 'No registrations in progress';

  @override
  String get noDraftsHint => 'Press Register a new letter to start.';

  @override
  String stepsDone(int done, int total) {
    return '$done of $total steps';
  }

  @override
  String get noAddressYet => 'No address yet';

  @override
  String startedAt(String time) {
    return 'Started $time';
  }

  @override
  String get continueDraft => 'Continue';

  @override
  String get deleteDraft => 'Delete draft';

  @override
  String get deleteDraftTitle => 'Delete this draft?';

  @override
  String get deleteDraftBody =>
      'The draft is cancelled and its scale reading is released. This cannot be undone.';

  @override
  String get registerALetter => 'Register a letter';

  @override
  String get moreActions => 'More actions';

  @override
  String get clearForm => 'Clear form';

  @override
  String get clearFormTitle => 'Clear the form?';

  @override
  String get clearFormBody =>
      'Clear the recipient, sender, destination office and contact fields?';

  @override
  String get openingDraft => 'Opening draft…';

  @override
  String get draft => 'Draft';

  @override
  String get unsavedChanges => 'Unsaved changes';

  @override
  String get allChangesSaved => 'All changes saved';

  @override
  String stepOf(int step, int total) {
    return 'Step $step of $total';
  }

  @override
  String get stepPhoto => 'Photo';

  @override
  String get stepAddresses => 'Addresses';

  @override
  String get stepConfirm => 'Confirm';

  @override
  String get stepWeigh => 'Weigh';

  @override
  String get stepPay => 'Charge';

  @override
  String get alreadyAcceptedTitle => 'Already accepted';

  @override
  String alreadyAcceptedBody(String id) {
    return 'This draft became registered item $id.';
  }

  @override
  String get openReceipt => 'Open label and receipt';

  @override
  String get draftClosedTitle => 'Draft closed';

  @override
  String get draftClosedBody =>
      'This draft was cancelled. Start a new registration from the counter screen.';

  @override
  String get stepPhotoTitle => 'Step 1 of 5: photograph the envelope';

  @override
  String get nextPhoto =>
      'Take a photo of the envelope, then press Read address. You can also type the address.';

  @override
  String get captureMode => 'Capture mode (research)';

  @override
  String get captureModeHint =>
      'P1 is the assisted mode. B1 and B0 are baselines for the evaluation.';

  @override
  String get modeP1 => 'P1 – assisted capture (recommended)';

  @override
  String get modeB1 => 'B1 – basic OCR + rules';

  @override
  String get modeB0 => 'B0 – manual entry (baseline)';

  @override
  String get envelopePhoto => 'Envelope photo';

  @override
  String get envelopePhotoHint =>
      'Photograph the front of the envelope, flat and well lit.';

  @override
  String get photoOptionalB0 => 'Optional in manual entry (B0).';

  @override
  String get takePhoto => 'Take a photo';

  @override
  String get chooseFromGallery => 'Choose a photo';

  @override
  String get captureFromScale => 'Capture from scale camera';

  @override
  String get noPhotoYet => 'No photo yet';

  @override
  String get noPhotoYetHint => 'Take a photo of the front of the envelope.';

  @override
  String get photoNotLoaded => 'The photo could not be shown.';

  @override
  String get rotateLeft => 'Rotate left';

  @override
  String get rotateRight => 'Rotate right';

  @override
  String get photoQualityTitle => 'Photo quality';

  @override
  String get qLowResolution => 'The photo is too small – move closer.';

  @override
  String get qBlurry =>
      'The photo is blurred – hold the phone still and take it again.';

  @override
  String get qTooDark => 'The photo is too dark – add light.';

  @override
  String get qTooBright => 'The photo is too bright.';

  @override
  String get qLowContrast => 'The text contrast is low.';

  @override
  String get qGlare =>
      'There is glare on the envelope – tilt it or switch off the flash.';

  @override
  String get readAddressTitle => 'Read the address';

  @override
  String get readAddressHint =>
      'The server reads the photo and suggests the fields. You check them in step 2.';

  @override
  String get readFor => 'Read the address of the';

  @override
  String get recipient => 'Recipient';

  @override
  String get sender => 'Sender';

  @override
  String get handwriting => 'Handwriting';

  @override
  String get writingAuto => 'Auto';

  @override
  String get writingHand => 'Handwritten';

  @override
  String get writingPrinted => 'Printed';

  @override
  String get addressLanguage => 'Language of the address';

  @override
  String get detectAutomatically => 'Detect automatically';

  @override
  String get readAddress => 'Read address';

  @override
  String get typeOrPaste => 'Type or paste the address';

  @override
  String get typeOrPasteHint =>
      'Use this when there is no photo or the reader could not read it.';

  @override
  String get fillFromText => 'Fill fields from text';

  @override
  String get readResultTitle => 'What the reader found';

  @override
  String fieldConfidence(int percent) {
    return 'Field confidence $percent %';
  }

  @override
  String get noFlags => 'No fields flagged';

  @override
  String fieldsToCheck(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count fields to check',
      one: '1 field to check',
    );
    return '$_temp0';
  }

  @override
  String get handwritingModel => 'Handwriting model';

  @override
  String get printedTextReader => 'Printed-text reader';

  @override
  String get readResultNext =>
      'Empty fields were filled from this result. Go to the next step to check them.';

  @override
  String get stepAddressesTitle => 'Step 2 of 5: check the addresses';

  @override
  String get nextAddresses =>
      'Compare every field with the envelope. Correct anything that is wrong.';

  @override
  String get recipientTo => 'Recipient (to)';

  @override
  String get recipientHint =>
      'Who the letter is addressed to. Name and postal town are needed.';

  @override
  String get senderFrom => 'Sender (from)';

  @override
  String get senderHint =>
      'Who is posting the letter (printed on the receipt).';

  @override
  String get useAllSuggestions => 'Use all suggestions';

  @override
  String get confidenceLegend =>
      'Percentages show how sure the reader is. Fields marked in red need a closer look.';

  @override
  String get fName => 'Name';

  @override
  String get fHouse => 'House / unit no.';

  @override
  String get fStreet => 'Street / road';

  @override
  String get fLocality => 'Village / locality';

  @override
  String get fCity => 'Postal town';

  @override
  String get fPostcode => 'Postcode';

  @override
  String get fRegion => 'District / province';

  @override
  String modelConfidence(int percent) {
    return 'Reader confidence $percent percent';
  }

  @override
  String get lowConfidenceCheck =>
      'Low confidence – check against the envelope';

  @override
  String suggestedValue(String value) {
    return 'Suggested: $value';
  }

  @override
  String get use => 'Use';

  @override
  String postcodeDerived(String postcode) {
    return 'Postcode $postcode can be derived from the town. Check it before use.';
  }

  @override
  String get useIt => 'Use it';

  @override
  String get townPostcodeOk => 'Town and postcode agree with the gazetteer.';

  @override
  String get townPostcodeCheck => 'Town and postcode check';

  @override
  String get townPostcodeMismatch =>
      'The postcode belongs to a different town.';

  @override
  String get townUnknown => 'The town is not in the reference list.';

  @override
  String get postcodeUnknown => 'The postcode is not in the reference list.';

  @override
  String expectedValues(String values) {
    return 'Expected: $values';
  }

  @override
  String get stepConfirmTitle => 'Step 3 of 5: confirm the details';

  @override
  String get nextConfirm =>
      'Choose the destination office and how the sender gets updates, then confirm.';

  @override
  String get destinationOfficeHint =>
      'The post office that delivers to the recipient\'s address.';

  @override
  String get deliveryOffice => 'Delivery office';

  @override
  String get choose => 'Choose';

  @override
  String get senderUpdates => 'Sender updates';

  @override
  String get senderUpdatesHint =>
      'Optional messages to the sender when the status changes.';

  @override
  String get sendUpdatesBy => 'Send status updates by';

  @override
  String get senderEmail => 'Sender\'s e-mail';

  @override
  String get senderMobile => 'Sender\'s mobile number';

  @override
  String get mobileFormat => 'Format: 07XXXXXXXX';

  @override
  String get messageLanguage => 'Message language';

  @override
  String get whichUpdates => 'Which updates';

  @override
  String get updatesKey =>
      'Key updates only (accepted, out for delivery, delivered, problems)';

  @override
  String get updatesAll => 'Every accepted scan';

  @override
  String get smsGatewayNote =>
      'SMS is sent only if an SMS gateway has been approved for the trial.';

  @override
  String detailsConfirmedBy(String user) {
    return 'Details confirmed by $user';
  }

  @override
  String reviewStats(int suggested, int kept, int corrected, int typed) {
    return 'Suggested $suggested · kept $kept · corrected $corrected · typed $typed';
  }

  @override
  String get reconfirmNeeded =>
      'You changed the details after confirming. Confirm them again.';

  @override
  String get confirmDetails => 'I have checked the envelope – confirm details';

  @override
  String get confirmDetailsHint =>
      'Confirm only after comparing every field with the envelope.';

  @override
  String errPartyName(String party) {
    return '$party: enter the name';
  }

  @override
  String errPartyCity(String party) {
    return '$party: enter the postal town';
  }

  @override
  String errPartyAddress(String party) {
    return '$party: enter a house number, street or village';
  }

  @override
  String get errDestinationRequired => 'Choose the destination office';

  @override
  String get errEmailInvalid =>
      'Enter a valid e-mail address, like name@example.com';

  @override
  String get errPhoneInvalid =>
      'Enter a Sri Lankan mobile number, like 0771234567';

  @override
  String get stepWeighTitle => 'Step 4 of 5: weigh the letter';

  @override
  String get nextWeigh =>
      'Place the letter on the scale. When the reading is stable, press Use this weight.';

  @override
  String weightRecorded(String weight) {
    return 'Weight recorded: $weight';
  }

  @override
  String weightFromScale(String device, String uncertainty) {
    return 'From scale $device, uncertainty ± $uncertainty g';
  }

  @override
  String weightManual(String instrument) {
    return 'Entered by hand – $instrument';
  }

  @override
  String get iotScale => 'IoT scale';

  @override
  String get iotScaleHint =>
      'Place the letter on the scale and wait until the reading is stable.';

  @override
  String get noScaleForOffice =>
      'No IoT scale is registered for your office. Enter the weight by hand below.';

  @override
  String get scale => 'Scale';

  @override
  String get noReading => 'No reading';

  @override
  String get currentReading => 'Current reading';

  @override
  String get stableReady => 'Stable – ready';

  @override
  String get settling => 'Settling…';

  @override
  String spread(String grams) {
    return 'Spread $grams g';
  }

  @override
  String get useThisWeight => 'Use this weight';

  @override
  String get manualWeightTitle => 'Enter weight by hand';

  @override
  String get manualWeightHint =>
      'Only when the IoT scale cannot be used. This is recorded for audit.';

  @override
  String get weightGrams => 'Weight (grams)';

  @override
  String get instrument => 'Scale used';

  @override
  String get instrumentHint => 'For example: approved counter scale no. 2';

  @override
  String get manualReasonHint => 'Why the IoT scale could not be used';

  @override
  String get recordManualWeight => 'Record manual weight';

  @override
  String get errGrams => 'Enter the weight in grams (more than 0, up to 5000)';

  @override
  String get errInstrument => 'Enter the scale used';

  @override
  String get errManualReason =>
      'Say why the IoT scale was not used (at least 5 characters)';

  @override
  String get stepPayTitle => 'Step 5 of 5: charge and accept';

  @override
  String get nextPay =>
      'Calculate the charge, take the payment, then accept the letter.';

  @override
  String get extraServices => 'Extra services';

  @override
  String get adviceOfDelivery => 'Advice of delivery';

  @override
  String get adviceOfDeliveryHint =>
      'The sender receives a signed delivery card (extra fee).';

  @override
  String get insuredValue => 'Insured value (Rs.)';

  @override
  String get insuredValueHint =>
      'Declared value of the contents, if the sender wants insurance';

  @override
  String get errInsuredValue =>
      'Enter the insured value as a number of rupees, or leave it empty';

  @override
  String get calculateCharge => 'Calculate charge';

  @override
  String get weighFirst => 'Record the weight in step 4 first.';

  @override
  String get reweighRequired => 'Reweigh required';

  @override
  String get cannotQuote => 'Cannot calculate the charge';

  @override
  String get charge => 'Charge';

  @override
  String tariffLine(String version, String weight, String uncertainty) {
    return 'Tariff $version · weight $weight g ± $uncertainty g';
  }

  @override
  String get tariffNotApproved => 'Tariff not yet approved – research use';

  @override
  String get qPostage => 'Letter postage';

  @override
  String get qRegistration => 'Registration fee';

  @override
  String get qInsurance => 'Insurance';

  @override
  String get total => 'Total';

  @override
  String get beforeAccepting => 'Before accepting';

  @override
  String get checkConfirmed => 'Details confirmed (step 3)';

  @override
  String get checkWeight => 'Weight recorded (step 4)';

  @override
  String get checkCharge => 'Charge calculated';

  @override
  String get payment => 'Payment';

  @override
  String get paymentMethod => 'Payment method';

  @override
  String get payCash => 'Cash';

  @override
  String get payCard => 'Card';

  @override
  String get payOther => 'Other (approved)';

  @override
  String get receiptReference => 'Receipt or reference number';

  @override
  String receivedAndAccept(String amount) {
    return 'Received $amount – accept letter';
  }

  @override
  String get confirmFirst => 'Confirm the details (step 3) before accepting.';

  @override
  String get acceptLetter => 'Accept letter';

  @override
  String get acceptLetterTitle => 'Accept this letter?';

  @override
  String acceptLetterBody(String amount) {
    return 'Confirm that you received $amount from the sender. A tracking ID is created and cannot be removed.';
  }

  @override
  String get labelAndReceipt => 'Label and receipt';

  @override
  String get letterAccepted => 'Letter accepted';

  @override
  String get letterAcceptedBody =>
      'Print the label, stick it on the envelope, then scan it to verify. Give the receipt to the sender.';

  @override
  String get registeredLetter => 'Registered letter';

  @override
  String get to => 'To';

  @override
  String get receiptDetails => 'Receipt';

  @override
  String get acceptedBy => 'Accepted by';

  @override
  String get senderName => 'Sender';

  @override
  String get weight => 'Weight';

  @override
  String get paidBy => 'Payment';

  @override
  String get tariff => 'Tariff';

  @override
  String get labelPrints => 'Label prints';

  @override
  String get senderTracking => 'Sender\'s tracking QR';

  @override
  String get senderTrackingHint =>
      'Printed on the receipt. The sender can follow the letter with it.';

  @override
  String get copyLink => 'Copy link';

  @override
  String get linkCopied => 'Link copied';

  @override
  String get verifyLabel => 'Verify the printed label';

  @override
  String get verifyLabelInstruction =>
      'Scan the barcode on the label you stuck on the envelope';

  @override
  String get labelVerified =>
      'Label verified – the printed label matches this item.';

  @override
  String labelMismatch(String id) {
    return 'The scanned label shows $id, not this item. Reprint the label.';
  }

  @override
  String get markPrinted => 'Mark label as printed';

  @override
  String get recordReprint => 'Record a reprint';

  @override
  String get reprintTitle => 'Reprint the label?';

  @override
  String get reprintBody =>
      'A reprint does not create a new item. Say why the label is printed again.';

  @override
  String get printRecorded => 'Label print recorded';

  @override
  String get reprintRecorded => 'Reprint recorded';

  @override
  String get printNote =>
      'Print the label from the counter computer (web app) or a connected label printer, then record it here.';

  @override
  String get openItem => 'Open item details';

  @override
  String get registerAnother => 'Register another letter';

  @override
  String get findItem => 'Tracking ID';

  @override
  String get findItemHint => 'All or part of the ID';

  @override
  String get status => 'Status';

  @override
  String get allStatuses => 'All statuses';

  @override
  String get scanToFind => 'Scan a label to find it';

  @override
  String get noItemsFound => 'No items found';

  @override
  String itemsShown(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count items',
      one: '1 item',
    );
    return '$_temp0';
  }

  @override
  String acceptedAt(String time) {
    return 'Accepted $time';
  }

  @override
  String get itemDetails => 'Item details';

  @override
  String get copyId => 'Copy tracking ID';

  @override
  String get idCopied => 'Tracking ID copied';

  @override
  String get recordAScan => 'Record a scan';

  @override
  String get assignPostman => 'Assign postman';

  @override
  String assignedTo(String user) {
    return 'Assigned to $user';
  }

  @override
  String get noPostmenAtOffice =>
      'There is no active postman at the destination office.';

  @override
  String get details => 'Details';

  @override
  String byWorker(String worker, String role) {
    return 'By $worker ($role)';
  }

  @override
  String locationAccuracy(int metres) {
    return 'Location accuracy ± $metres m';
  }

  @override
  String distanceFromZone(int metres) {
    return '$metres m from the reference area';
  }

  @override
  String savedOffline(int seconds) {
    return 'Saved offline, uploaded $seconds s later';
  }

  @override
  String ackLine(String type, String name) {
    return 'Acknowledgement: $type $name';
  }

  @override
  String reviewNote(String user, String reason) {
    return 'Reviewed by $user: $reason';
  }

  @override
  String get flagged => 'Flagged';

  @override
  String heldTab(int count) {
    return 'Held ($count)';
  }

  @override
  String flaggedTab(int count) {
    return 'Flagged ($count)';
  }

  @override
  String get heldIntro =>
      'These scans did not change the status. Check the reasons, then approve or reject each one.';

  @override
  String get flaggedIntro =>
      'Accepted scans marked for attention in the last 14 days (for example an uncertain location). No action is needed.';

  @override
  String get noHeldScans => 'No scans waiting for review';

  @override
  String get noFlaggedScans => 'No flagged scans';

  @override
  String requestedStatus(String status) {
    return 'Requested: $status';
  }

  @override
  String get mockLocation => 'Simulated location';

  @override
  String get offlineScan => 'Saved offline';

  @override
  String get approve => 'Approve';

  @override
  String get reject => 'Reject';

  @override
  String get approveScanTitle => 'Approve this scan?';

  @override
  String get approveScanBody =>
      'The status changes and the sender is notified. Say why you approve it.';

  @override
  String get rejectScanTitle => 'Reject this scan?';

  @override
  String get rejectScanBody =>
      'The scan stays in the history but does not change the status. Say why you reject it.';

  @override
  String get scanApproved => 'Scan approved';

  @override
  String get scanRejected => 'Scan rejected';

  @override
  String get messagesIntro =>
      'Status messages to senders. Retry failed ones or mark them resolved after contacting the sender.';

  @override
  String get noMessages => 'No messages';

  @override
  String attemptsAndTime(int attempts, String time) {
    return '$attempts attempt(s) · created $time';
  }

  @override
  String get preview => 'Preview';

  @override
  String get messagePreview => 'Message';

  @override
  String get markResolved => 'Mark resolved';

  @override
  String get retryMessageTitle => 'Retry this message?';

  @override
  String get retryMessageBody => 'The message will be sent again.';

  @override
  String get resolveMessageTitle => 'Mark message resolved?';

  @override
  String get resolveMessageBody =>
      'Use this after you have informed the sender another way.';

  @override
  String get devicesIntro =>
      'The scale weighs letters and its camera photographs envelopes. Tare the empty scale after every restart.';

  @override
  String get noDevices => 'No scale registered for your office';

  @override
  String get online => 'Online';

  @override
  String get offline => 'Offline';

  @override
  String calibrationStatus(String value) {
    return 'Calibration: $value';
  }

  @override
  String get firmware => 'Firmware';

  @override
  String get cameraOk => 'Camera ready';

  @override
  String get cameraFault => 'Camera fault';

  @override
  String get stable => 'Stable';

  @override
  String get loaded => 'Item on scale';

  @override
  String get needsTare => 'Needs tare';

  @override
  String get notReadyToWeigh => 'Not ready to weigh';

  @override
  String get actions => 'Actions';

  @override
  String get tareHint =>
      'Tare with the platform empty. Calibrate with a known reference mass.';

  @override
  String get tare => 'Tare (set to zero)';

  @override
  String get calibrate => 'Calibrate';

  @override
  String get identify => 'Identify (blink light)';

  @override
  String get testPhoto => 'Take a test photo';

  @override
  String get commandSent => 'Command sent to the scale';

  @override
  String get calibrateTitle => 'Calibrate the scale';

  @override
  String get calibrateBody =>
      'Empty the platform and press Tare first. Then place a known reference mass on the platform and enter its weight.';

  @override
  String get referenceMass => 'Reference mass (grams, 10–1000)';

  @override
  String get office => 'Office';

  @override
  String get wifiSignal => 'Wi-Fi signal';

  @override
  String get lastSeen => 'Last seen';

  @override
  String get calibration => 'Calibration';

  @override
  String get uncertainty => 'Uncertainty';

  @override
  String get recentCommands => 'Recent commands';

  @override
  String get cmdQueued => 'Queued';

  @override
  String get cmdSent => 'Sent to scale';

  @override
  String get cmdDone => 'Done';

  @override
  String get cmdFailed => 'Failed';

  @override
  String get cmdExpired => 'Expired';

  @override
  String get wpNoReading => 'The scale has not sent a reading yet.';

  @override
  String get wpStale =>
      'The last reading is too old – check the scale\'s Wi-Fi.';

  @override
  String get wpSensorFault =>
      'Load-cell amplifier not responding – check the HX711 wiring.';

  @override
  String get wpNeedsTare =>
      'The scale was restarted. Empty the platform and press Tare on the Scale page.';

  @override
  String get wpUncalibrated => 'The scale is not calibrated.';

  @override
  String get wpEmpty => 'Nothing on the platform.';

  @override
  String get wpUnstable =>
      'Reading not stable yet – wait for the letter to settle.';

  @override
  String get wpNegative => 'Negative weight – empty the platform and tare.';

  @override
  String get officesIntro =>
      'Each office\'s reference point and radius are used to check where scans were made.';

  @override
  String get referencePoint => 'Reference point';

  @override
  String get zoneRadius => 'Office zone radius (m)';

  @override
  String get serviceRadius => 'Delivery area radius';

  @override
  String get provenance => 'Provenance (how the point was measured)';

  @override
  String get provenanceHint =>
      'Required. It is stored with the point and logged.';

  @override
  String provenanceDefault(String date, int metres) {
    return 'Measured on site $date with phone GPS, accuracy ± $metres m';
  }

  @override
  String get useMyLocation => 'Use my location as the reference point';

  @override
  String get setReferencePoint => 'Set reference point';

  @override
  String setReferencePointBody(String office) {
    return 'Stand at the entrance of $office. This position becomes the office\'s reference point:';
  }

  @override
  String get poorAccuracy =>
      'The location is not precise. Move outside or near a window and try again.';

  @override
  String get officeUpdated => 'Office reference point saved';

  @override
  String get registeredItems => 'Registered items';

  @override
  String get waitingReview => 'Waiting for review';

  @override
  String get openDrafts => 'Open drafts';

  @override
  String get itemsByStatus => 'Items by status';

  @override
  String get messagesByState => 'Sender messages by state';

  @override
  String get reportsOnWeb =>
      'CSV exports for the evaluation are on the web app\'s Reports page.';

  @override
  String get auditTarget => 'Record';

  @override
  String get auditTargetHint => 'Tracking ID, draft ID, device or user name';

  @override
  String get severity => 'Level';

  @override
  String get allSeverities => 'All levels';

  @override
  String get noAuditEntries => 'No audit entries';

  @override
  String get account => 'Your account';

  @override
  String get name => 'Name';

  @override
  String get role => 'Role';

  @override
  String get connection => 'Connection';

  @override
  String get thisDevice => 'This phone\'s ID';

  @override
  String get changeServerHint =>
      'To use a different server, sign out and change it on the sign-in screen.';

  @override
  String get offlineData => 'Data on this phone';

  @override
  String get waitingToUpload => 'Scans waiting to upload';

  @override
  String get offlineDataHint =>
      'Uploaded scans are kept for 14 days so you can check the server\'s answer. Scans waiting to upload are never deleted.';

  @override
  String get clearUploadedHistory => 'Delete uploaded scan history';

  @override
  String historyCleared(int count) {
    return '$count uploaded scan(s) deleted from this phone';
  }

  @override
  String get cannotSignOutTitle => 'Upload your scans before signing out';

  @override
  String cannotSignOutBody(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other:
          '$count scans are still on this phone. They can only be uploaded while you are signed in.',
      one: '1 scan is still on this phone. It can only be uploaded while you are signed in.',
    );
    return '$_temp0';
  }

  @override
  String get signOut => 'Sign out';

  @override
  String get signOutTitle => 'Sign out?';

  @override
  String get signOutBody => 'You will need your password to sign in again.';

  @override
  String get prototypeTitle => 'Research prototype';

  @override
  String get prototypeBody =>
      'This is a SLIIT research prototype (project J26-IT-372), not an official Sri Lanka Post service. Do not use it with real customer mail unless the trial is approved.';

  @override
  String get aboutTitle => 'About this app';

  @override
  String get aboutBody =>
      'PostAssist LK helps postal staff accept, label and track domestic registered letters. Counter officers register letters with assisted address reading and an IoT scale; postmen and hub officers record each handover with the phone\'s location; postmasters review exceptions and sender messages.';

  @override
  String version(String version) {
    return 'Version $version';
  }

  @override
  String get privacyTitle => 'Privacy notice';

  @override
  String get privacyIntro => 'What this app collects and why:';

  @override
  String get privacyLocation =>
      'Location: read once when you save a scan, with its accuracy, age and whether it is simulated. It is never tracked in the background.';

  @override
  String get privacyCamera =>
      'Camera: used only to scan labels and to photograph envelopes at the counter. Photos are sent to the PostAssist server, not stored in the phone\'s gallery.';

  @override
  String get privacyStorage =>
      'On this phone: your sign-in token (encrypted storage) and your scans until they are uploaded, then for 14 days.';

  @override
  String get privacyServer =>
      'Data is sent only to the PostAssist server address entered at sign-in.';

  @override
  String get privacyAudit =>
      'Every sign-in, scan and decision is written to an audit log with your username.';

  @override
  String get accessibilityTitle => 'Accessibility statement';

  @override
  String get accessibilityBody =>
      'Everyone who works at a postal counter or delivers mail should be able to use this app.';

  @override
  String get a11yLanguages =>
      'Use the app in Sinhala, Tamil or English (Settings → Language).';

  @override
  String get a11yText => 'Text follows your phone\'s font size, up to 200 %.';

  @override
  String get a11yContrast =>
      'Text and controls meet WCAG 2.2 AA contrast; status is shown with words and icons, never colour alone.';

  @override
  String get a11yTargets => 'Buttons and controls are at least 48 × 48 dp.';

  @override
  String get a11yScreenReader =>
      'Works with TalkBack and VoiceOver: fields, buttons and progress are labelled.';

  @override
  String get standardsTitle => 'Design standards';

  @override
  String get standardsBody =>
      'The interface follows the principles of the Sri Lanka Digital Design System (SLDDS, Ministry of Digital Economy, 2026 draft for public consultation): plain language, the three official languages, mobile-first layouts, consistent components and WCAG 2.2 AA accessibility. It has not been formally assessed or approved by a government body.';
}
