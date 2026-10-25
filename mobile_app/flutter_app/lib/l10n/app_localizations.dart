import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_si.dart';
import 'app_localizations_ta.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('si'),
    Locale('ta'),
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'PostAssist LK'**
  String get appName;

  /// No description provided for @appSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Registered mail intake and tracking'**
  String get appSubtitle;

  /// No description provided for @officialUseStrip.
  ///
  /// In en, this message translates to:
  /// **'Official use – authorised postal staff only'**
  String get officialUseStrip;

  /// No description provided for @officialUseTitle.
  ///
  /// In en, this message translates to:
  /// **'Official use'**
  String get officialUseTitle;

  /// No description provided for @officialUseBody.
  ///
  /// In en, this message translates to:
  /// **'This app is for authorised postal staff. Every sign-in and every change to a record is logged. It is a research prototype: use synthetic mail unless the trial has been approved.'**
  String get officialUseBody;

  /// No description provided for @publicServiceStrip.
  ///
  /// In en, this message translates to:
  /// **'PostAssist LK – registered letter tracking'**
  String get publicServiceStrip;

  /// No description provided for @publicServiceTitle.
  ///
  /// In en, this message translates to:
  /// **'Letter tracking'**
  String get publicServiceTitle;

  /// No description provided for @publicServiceBody.
  ///
  /// In en, this message translates to:
  /// **'This page shows the progress of a registered letter to its sender. Places are shown as office names only; staff names and map positions are never shown.'**
  String get publicServiceBody;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @back.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get back;

  /// No description provided for @next.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get next;

  /// No description provided for @done.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get done;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @search.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get search;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @tryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get tryAgain;

  /// No description provided for @loading.
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get loading;

  /// No description provided for @saving.
  ///
  /// In en, this message translates to:
  /// **'Saving…'**
  String get saving;

  /// No description provided for @optional.
  ///
  /// In en, this message translates to:
  /// **'optional'**
  String get optional;

  /// No description provided for @thereIsAProblem.
  ///
  /// In en, this message translates to:
  /// **'There is a problem'**
  String get thereIsAProblem;

  /// No description provided for @somethingWentWrong.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong'**
  String get somethingWentWrong;

  /// No description provided for @errorNetwork.
  ///
  /// In en, this message translates to:
  /// **'The server did not answer. Check that the phone is on the same network as the PostAssist server and that the address is right.'**
  String get errorNetwork;

  /// No description provided for @errorSessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session has ended. Sign in again.'**
  String get errorSessionExpired;

  /// No description provided for @errorForbidden.
  ///
  /// In en, this message translates to:
  /// **'You are not allowed to do this.'**
  String get errorForbidden;

  /// No description provided for @reason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get reason;

  /// No description provided for @reasonTooShort.
  ///
  /// In en, this message translates to:
  /// **'Enter at least {min} characters'**
  String reasonTooShort(int min);

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @languageHint.
  ///
  /// In en, this message translates to:
  /// **'Choose the language for the app.'**
  String get languageHint;

  /// No description provided for @usePhoneLanguage.
  ///
  /// In en, this message translates to:
  /// **'Use the phone\'s language'**
  String get usePhoneLanguage;

  /// No description provided for @progress.
  ///
  /// In en, this message translates to:
  /// **'Progress'**
  String get progress;

  /// No description provided for @complete.
  ///
  /// In en, this message translates to:
  /// **'complete'**
  String get complete;

  /// No description provided for @notComplete.
  ///
  /// In en, this message translates to:
  /// **'not complete'**
  String get notComplete;

  /// No description provided for @signInTitle.
  ///
  /// In en, this message translates to:
  /// **'Staff sign-in'**
  String get signInTitle;

  /// No description provided for @serverAddress.
  ///
  /// In en, this message translates to:
  /// **'Server address'**
  String get serverAddress;

  /// No description provided for @serverAddressHint.
  ///
  /// In en, this message translates to:
  /// **'The computer running the PostAssist server, for example http://192.168.1.10:8000'**
  String get serverAddressHint;

  /// No description provided for @testConnection.
  ///
  /// In en, this message translates to:
  /// **'Test connection'**
  String get testConnection;

  /// No description provided for @connectionOk.
  ///
  /// In en, this message translates to:
  /// **'Server reached'**
  String get connectionOk;

  /// No description provided for @connectionFailed.
  ///
  /// In en, this message translates to:
  /// **'No answer'**
  String get connectionFailed;

  /// No description provided for @insecureConnectionWarning.
  ///
  /// In en, this message translates to:
  /// **'This connection is not encrypted (http). Use it only on a closed lab network; a live service must use https.'**
  String get insecureConnectionWarning;

  /// No description provided for @username.
  ///
  /// In en, this message translates to:
  /// **'Username'**
  String get username;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @showPassword.
  ///
  /// In en, this message translates to:
  /// **'Show password'**
  String get showPassword;

  /// No description provided for @hidePassword.
  ///
  /// In en, this message translates to:
  /// **'Hide password'**
  String get hidePassword;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signIn;

  /// No description provided for @staffOnlyNotice.
  ///
  /// In en, this message translates to:
  /// **'For authorised postal staff. Sign-ins are logged for audit.'**
  String get staffOnlyNotice;

  /// No description provided for @errServerRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter the server address'**
  String get errServerRequired;

  /// No description provided for @errServerInvalid.
  ///
  /// In en, this message translates to:
  /// **'The server address is not valid'**
  String get errServerInvalid;

  /// No description provided for @errUsernameRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your username'**
  String get errUsernameRequired;

  /// No description provided for @errPasswordRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your password'**
  String get errPasswordRequired;

  /// No description provided for @errWrongCredentials.
  ///
  /// In en, this message translates to:
  /// **'The username or password is wrong'**
  String get errWrongCredentials;

  /// No description provided for @sessionExpiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Session ended'**
  String get sessionExpiredTitle;

  /// No description provided for @sessionExpiredBody.
  ///
  /// In en, this message translates to:
  /// **'For security you were signed out. Sign in again – scans saved on this phone are kept.'**
  String get sessionExpiredBody;

  /// No description provided for @trackLetterPublic.
  ///
  /// In en, this message translates to:
  /// **'Sent a registered letter?'**
  String get trackLetterPublic;

  /// No description provided for @trackLetterPublicHint.
  ///
  /// In en, this message translates to:
  /// **'Anyone with a receipt can see the letter\'s progress – no sign-in needed.'**
  String get trackLetterPublicHint;

  /// No description provided for @trackALetter.
  ///
  /// In en, this message translates to:
  /// **'Track a letter'**
  String get trackALetter;

  /// No description provided for @aboutAndPrivacy.
  ///
  /// In en, this message translates to:
  /// **'About, privacy and accessibility'**
  String get aboutAndPrivacy;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @welcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome, {name}'**
  String welcome(String name);

  /// No description provided for @groupDaily.
  ///
  /// In en, this message translates to:
  /// **'Daily work'**
  String get groupDaily;

  /// No description provided for @groupSupervision.
  ///
  /// In en, this message translates to:
  /// **'Supervision'**
  String get groupSupervision;

  /// No description provided for @groupSetup.
  ///
  /// In en, this message translates to:
  /// **'Set-up and tools'**
  String get groupSetup;

  /// No description provided for @scanALetter.
  ///
  /// In en, this message translates to:
  /// **'Scan a registered letter'**
  String get scanALetter;

  /// No description provided for @auditFooter.
  ///
  /// In en, this message translates to:
  /// **'Sign-ins and changes to records are logged for audit.'**
  String get auditFooter;

  /// No description provided for @reviewWaiting.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 scan is waiting for your review} other{{count} scans are waiting for your review}}'**
  String reviewWaiting(int count);

  /// No description provided for @openReviewQueue.
  ///
  /// In en, this message translates to:
  /// **'Open review queue'**
  String get openReviewQueue;

  /// No description provided for @offlineScansTitle.
  ///
  /// In en, this message translates to:
  /// **'Scans on this phone'**
  String get offlineScansTitle;

  /// No description provided for @networkAvailable.
  ///
  /// In en, this message translates to:
  /// **'Network available'**
  String get networkAvailable;

  /// No description provided for @networkOffline.
  ///
  /// In en, this message translates to:
  /// **'Offline – scans are saved on this phone'**
  String get networkOffline;

  /// No description provided for @pendingCount.
  ///
  /// In en, this message translates to:
  /// **'{count} waiting to upload'**
  String pendingCount(int count);

  /// No description provided for @heldCount.
  ///
  /// In en, this message translates to:
  /// **'{count} held'**
  String heldCount(int count);

  /// No description provided for @rejectedCount.
  ///
  /// In en, this message translates to:
  /// **'{count} rejected'**
  String rejectedCount(int count);

  /// No description provided for @lastUploadFailed.
  ///
  /// In en, this message translates to:
  /// **'Last upload failed: {error}'**
  String lastUploadFailed(String error);

  /// No description provided for @lastUploadFailedNetwork.
  ///
  /// In en, this message translates to:
  /// **'Last upload failed: no connection to the server. Scans will upload automatically.'**
  String get lastUploadFailedNetwork;

  /// No description provided for @uploadNow.
  ///
  /// In en, this message translates to:
  /// **'Upload now'**
  String get uploadNow;

  /// No description provided for @uploading.
  ///
  /// In en, this message translates to:
  /// **'Uploading…'**
  String get uploading;

  /// No description provided for @taskRegister.
  ///
  /// In en, this message translates to:
  /// **'Register a letter'**
  String get taskRegister;

  /// No description provided for @taskRegisterHint.
  ///
  /// In en, this message translates to:
  /// **'Counter intake in five steps'**
  String get taskRegisterHint;

  /// No description provided for @taskScan.
  ///
  /// In en, this message translates to:
  /// **'Scan a letter'**
  String get taskScan;

  /// No description provided for @taskScanHint.
  ///
  /// In en, this message translates to:
  /// **'Record dispatch, transit or delivery'**
  String get taskScanHint;

  /// No description provided for @taskItems.
  ///
  /// In en, this message translates to:
  /// **'Registered items'**
  String get taskItems;

  /// No description provided for @taskItemsHint.
  ///
  /// In en, this message translates to:
  /// **'Find an item and see its history'**
  String get taskItemsHint;

  /// No description provided for @taskHistory.
  ///
  /// In en, this message translates to:
  /// **'My scans'**
  String get taskHistory;

  /// No description provided for @taskHistoryHint.
  ///
  /// In en, this message translates to:
  /// **'Saved scans and upload status'**
  String get taskHistoryHint;

  /// No description provided for @taskReview.
  ///
  /// In en, this message translates to:
  /// **'Review queue'**
  String get taskReview;

  /// No description provided for @taskReviewHint.
  ///
  /// In en, this message translates to:
  /// **'Approve or reject held scans'**
  String get taskReviewHint;

  /// No description provided for @taskMessages.
  ///
  /// In en, this message translates to:
  /// **'Sender messages'**
  String get taskMessages;

  /// No description provided for @taskMessagesHint.
  ///
  /// In en, this message translates to:
  /// **'E-mail and SMS updates to senders'**
  String get taskMessagesHint;

  /// No description provided for @taskSummary.
  ///
  /// In en, this message translates to:
  /// **'Summary'**
  String get taskSummary;

  /// No description provided for @taskSummaryHint.
  ///
  /// In en, this message translates to:
  /// **'Items, reviews and messages at a glance'**
  String get taskSummaryHint;

  /// No description provided for @taskAudit.
  ///
  /// In en, this message translates to:
  /// **'Audit log'**
  String get taskAudit;

  /// No description provided for @taskAuditHint.
  ///
  /// In en, this message translates to:
  /// **'Who did what, and when'**
  String get taskAuditHint;

  /// No description provided for @taskDevices.
  ///
  /// In en, this message translates to:
  /// **'Scale and camera'**
  String get taskDevices;

  /// No description provided for @taskDevicesHint.
  ///
  /// In en, this message translates to:
  /// **'IoT scale status, tare, calibrate'**
  String get taskDevicesHint;

  /// No description provided for @taskOffices.
  ///
  /// In en, this message translates to:
  /// **'Offices and zones'**
  String get taskOffices;

  /// No description provided for @taskOfficesHint.
  ///
  /// In en, this message translates to:
  /// **'Reference points for location checks'**
  String get taskOfficesHint;

  /// No description provided for @taskTrack.
  ///
  /// In en, this message translates to:
  /// **'Track a letter'**
  String get taskTrack;

  /// No description provided for @taskTrackHint.
  ///
  /// In en, this message translates to:
  /// **'The sender\'s view of an item'**
  String get taskTrackHint;

  /// No description provided for @stAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted at counter'**
  String get stAccepted;

  /// No description provided for @stDispatched.
  ///
  /// In en, this message translates to:
  /// **'Dispatched'**
  String get stDispatched;

  /// No description provided for @stInTransit.
  ///
  /// In en, this message translates to:
  /// **'In transit'**
  String get stInTransit;

  /// No description provided for @stAtDestination.
  ///
  /// In en, this message translates to:
  /// **'At destination office'**
  String get stAtDestination;

  /// No description provided for @stOutForDelivery.
  ///
  /// In en, this message translates to:
  /// **'Out for delivery'**
  String get stOutForDelivery;

  /// No description provided for @stDeliveryAttempted.
  ///
  /// In en, this message translates to:
  /// **'Delivery attempted'**
  String get stDeliveryAttempted;

  /// No description provided for @stDelivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get stDelivered;

  /// No description provided for @stReturnStarted.
  ///
  /// In en, this message translates to:
  /// **'Return started'**
  String get stReturnStarted;

  /// No description provided for @stReturnedToSender.
  ///
  /// In en, this message translates to:
  /// **'Returned to sender'**
  String get stReturnedToSender;

  /// No description provided for @roleAdmin.
  ///
  /// In en, this message translates to:
  /// **'Administrator'**
  String get roleAdmin;

  /// No description provided for @rolePostmaster.
  ///
  /// In en, this message translates to:
  /// **'Postmaster'**
  String get rolePostmaster;

  /// No description provided for @roleCounter.
  ///
  /// In en, this message translates to:
  /// **'Counter officer'**
  String get roleCounter;

  /// No description provided for @roleHub.
  ///
  /// In en, this message translates to:
  /// **'Hub officer'**
  String get roleHub;

  /// No description provided for @rolePostman.
  ///
  /// In en, this message translates to:
  /// **'Postman'**
  String get rolePostman;

  /// No description provided for @decAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get decAccepted;

  /// No description provided for @decAcceptedAfterReview.
  ///
  /// In en, this message translates to:
  /// **'Accepted after review'**
  String get decAcceptedAfterReview;

  /// No description provided for @decHeld.
  ///
  /// In en, this message translates to:
  /// **'Held for review'**
  String get decHeld;

  /// No description provided for @decRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get decRejected;

  /// No description provided for @decRejectedAfterReview.
  ///
  /// In en, this message translates to:
  /// **'Rejected after review'**
  String get decRejectedAfterReview;

  /// No description provided for @decDuplicate.
  ///
  /// In en, this message translates to:
  /// **'Already recorded'**
  String get decDuplicate;

  /// No description provided for @decPending.
  ///
  /// In en, this message translates to:
  /// **'Waiting to upload'**
  String get decPending;

  /// No description provided for @locConsistent.
  ///
  /// In en, this message translates to:
  /// **'Location matches'**
  String get locConsistent;

  /// No description provided for @locUncertain.
  ///
  /// In en, this message translates to:
  /// **'Location uncertain'**
  String get locUncertain;

  /// No description provided for @locMismatch.
  ///
  /// In en, this message translates to:
  /// **'Location mismatch'**
  String get locMismatch;

  /// No description provided for @locUnlocated.
  ///
  /// In en, this message translates to:
  /// **'No location sent'**
  String get locUnlocated;

  /// No description provided for @locNotAssessed.
  ///
  /// In en, this message translates to:
  /// **'Location not checked'**
  String get locNotAssessed;

  /// No description provided for @locDenied.
  ///
  /// In en, this message translates to:
  /// **'Location permission was refused – the scan was saved without location'**
  String get locDenied;

  /// No description provided for @locTimeout.
  ///
  /// In en, this message translates to:
  /// **'No location fix in time – the scan was saved without location'**
  String get locTimeout;

  /// No description provided for @locUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Location is switched off or unavailable'**
  String get locUnavailable;

  /// No description provided for @obQueued.
  ///
  /// In en, this message translates to:
  /// **'Queued'**
  String get obQueued;

  /// No description provided for @obRetry.
  ///
  /// In en, this message translates to:
  /// **'Waiting to retry'**
  String get obRetry;

  /// No description provided for @obSending.
  ///
  /// In en, this message translates to:
  /// **'Sending'**
  String get obSending;

  /// No description provided for @obSent.
  ///
  /// In en, this message translates to:
  /// **'Sent'**
  String get obSent;

  /// No description provided for @obAmbiguous.
  ///
  /// In en, this message translates to:
  /// **'Unclear – check'**
  String get obAmbiguous;

  /// No description provided for @obFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed'**
  String get obFailed;

  /// No description provided for @obResolved.
  ///
  /// In en, this message translates to:
  /// **'Resolved by hand'**
  String get obResolved;

  /// No description provided for @channelNone.
  ///
  /// In en, this message translates to:
  /// **'No messages (receipt only)'**
  String get channelNone;

  /// No description provided for @channelEmail.
  ///
  /// In en, this message translates to:
  /// **'E-mail'**
  String get channelEmail;

  /// No description provided for @channelSms.
  ///
  /// In en, this message translates to:
  /// **'SMS (only if a gateway is approved)'**
  String get channelSms;

  /// No description provided for @sevInfo.
  ///
  /// In en, this message translates to:
  /// **'Info'**
  String get sevInfo;

  /// No description provided for @sevWarning.
  ///
  /// In en, this message translates to:
  /// **'Warning'**
  String get sevWarning;

  /// No description provided for @sevSecurity.
  ///
  /// In en, this message translates to:
  /// **'Security'**
  String get sevSecurity;

  /// No description provided for @scanLabel.
  ///
  /// In en, this message translates to:
  /// **'Scan label'**
  String get scanLabel;

  /// No description provided for @scanInstruction.
  ///
  /// In en, this message translates to:
  /// **'Point the camera at the barcode or QR code on the label'**
  String get scanInstruction;

  /// No description provided for @torch.
  ///
  /// In en, this message translates to:
  /// **'Torch'**
  String get torch;

  /// No description provided for @cameraPermissionNeeded.
  ///
  /// In en, this message translates to:
  /// **'Camera permission is needed to scan labels. Allow it in the phone\'s settings, or type the ID below.'**
  String get cameraPermissionNeeded;

  /// No description provided for @cameraUnavailable.
  ///
  /// In en, this message translates to:
  /// **'The camera could not be started. Type the ID below.'**
  String get cameraUnavailable;

  /// No description provided for @notAPostAssistCode.
  ///
  /// In en, this message translates to:
  /// **'This code is not a PostAssist label. Try again or type the ID.'**
  String get notAPostAssistCode;

  /// No description provided for @typeTrackingId.
  ///
  /// In en, this message translates to:
  /// **'Damaged label? Type the tracking ID'**
  String get typeTrackingId;

  /// No description provided for @typeTrackingIdHint.
  ///
  /// In en, this message translates to:
  /// **'It is printed under the barcode.'**
  String get typeTrackingIdHint;

  /// No description provided for @useTypedId.
  ///
  /// In en, this message translates to:
  /// **'Use typed ID'**
  String get useTypedId;

  /// No description provided for @errTrackingIdInvalid.
  ///
  /// In en, this message translates to:
  /// **'This is not a valid tracking ID – check each character (example: PA-DEMO-7K3M9Q2XRH4)'**
  String get errTrackingIdInvalid;

  /// No description provided for @recordStatus.
  ///
  /// In en, this message translates to:
  /// **'Record status'**
  String get recordStatus;

  /// No description provided for @scanSaved.
  ///
  /// In en, this message translates to:
  /// **'Scan saved'**
  String get scanSaved;

  /// No description provided for @lookingUpItem.
  ///
  /// In en, this message translates to:
  /// **'Looking up the item…'**
  String get lookingUpItem;

  /// No description provided for @offlineModeTitle.
  ///
  /// In en, this message translates to:
  /// **'Working offline'**
  String get offlineModeTitle;

  /// No description provided for @offlineModeBody.
  ///
  /// In en, this message translates to:
  /// **'Item details could not be loaded. You can still record the scan; the server checks it when it uploads.'**
  String get offlineModeBody;

  /// No description provided for @destinationOffice.
  ///
  /// In en, this message translates to:
  /// **'Destination office'**
  String get destinationOffice;

  /// No description provided for @destinationTown.
  ///
  /// In en, this message translates to:
  /// **'Destination town'**
  String get destinationTown;

  /// No description provided for @assignedPostman.
  ///
  /// In en, this message translates to:
  /// **'Assigned postman'**
  String get assignedPostman;

  /// No description provided for @deliverTo.
  ///
  /// In en, this message translates to:
  /// **'Deliver to'**
  String get deliverTo;

  /// No description provided for @nothingToRecordTitle.
  ///
  /// In en, this message translates to:
  /// **'Nothing to record'**
  String get nothingToRecordTitle;

  /// No description provided for @nothingToRecordBody.
  ///
  /// In en, this message translates to:
  /// **'You cannot record a new status for this item now.'**
  String get nothingToRecordBody;

  /// No description provided for @newStatus.
  ///
  /// In en, this message translates to:
  /// **'New status'**
  String get newStatus;

  /// No description provided for @newStatusHint.
  ///
  /// In en, this message translates to:
  /// **'Only the statuses you may record for this item are shown.'**
  String get newStatusHint;

  /// No description provided for @reasonTitle.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get reasonTitle;

  /// No description provided for @reasonHint.
  ///
  /// In en, this message translates to:
  /// **'Why the letter could not be delivered.'**
  String get reasonHint;

  /// No description provided for @reasonNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'Recipient not available'**
  String get reasonNotAvailable;

  /// No description provided for @reasonClosed.
  ///
  /// In en, this message translates to:
  /// **'Premises closed'**
  String get reasonClosed;

  /// No description provided for @reasonAddressNotFound.
  ///
  /// In en, this message translates to:
  /// **'Address not found'**
  String get reasonAddressNotFound;

  /// No description provided for @reasonRefused.
  ///
  /// In en, this message translates to:
  /// **'Recipient refused'**
  String get reasonRefused;

  /// No description provided for @reasonUnsafe.
  ///
  /// In en, this message translates to:
  /// **'Unsafe access'**
  String get reasonUnsafe;

  /// No description provided for @otherReason.
  ///
  /// In en, this message translates to:
  /// **'Reason in your own words'**
  String get otherReason;

  /// No description provided for @ackTitle.
  ///
  /// In en, this message translates to:
  /// **'Delivery acknowledgement'**
  String get ackTitle;

  /// No description provided for @ackHint.
  ///
  /// In en, this message translates to:
  /// **'Required for a delivered letter: how did the recipient acknowledge it?'**
  String get ackHint;

  /// No description provided for @ackSignature.
  ///
  /// In en, this message translates to:
  /// **'Signature'**
  String get ackSignature;

  /// No description provided for @ackNameOnly.
  ///
  /// In en, this message translates to:
  /// **'Name only'**
  String get ackNameOnly;

  /// No description provided for @ackSheet.
  ///
  /// In en, this message translates to:
  /// **'Delivery sheet'**
  String get ackSheet;

  /// No description provided for @receivedBy.
  ///
  /// In en, this message translates to:
  /// **'Received by (name)'**
  String get receivedBy;

  /// No description provided for @relationship.
  ///
  /// In en, this message translates to:
  /// **'Relationship to the addressee'**
  String get relationship;

  /// No description provided for @relationshipHint.
  ///
  /// In en, this message translates to:
  /// **'For example: self, spouse, security officer'**
  String get relationshipHint;

  /// No description provided for @sheetNumber.
  ///
  /// In en, this message translates to:
  /// **'Delivery sheet / page number'**
  String get sheetNumber;

  /// No description provided for @signature.
  ///
  /// In en, this message translates to:
  /// **'Recipient\'s signature'**
  String get signature;

  /// No description provided for @signatureHint.
  ///
  /// In en, this message translates to:
  /// **'Ask the recipient to sign inside the box.'**
  String get signatureHint;

  /// No description provided for @signatureArea.
  ///
  /// In en, this message translates to:
  /// **'Signature area. Draw the signature with one finger.'**
  String get signatureArea;

  /// No description provided for @signHere.
  ///
  /// In en, this message translates to:
  /// **'Sign here with a finger'**
  String get signHere;

  /// No description provided for @clearSignature.
  ///
  /// In en, this message translates to:
  /// **'Clear signature'**
  String get clearSignature;

  /// No description provided for @noAckPossible.
  ///
  /// In en, this message translates to:
  /// **'No acknowledgement possible'**
  String get noAckPossible;

  /// No description provided for @noAckPossibleHint.
  ///
  /// In en, this message translates to:
  /// **'Describe the approved exception. The scan will be held for the postmaster.'**
  String get noAckPossibleHint;

  /// No description provided for @exceptionReason.
  ///
  /// In en, this message translates to:
  /// **'Exception reason'**
  String get exceptionReason;

  /// No description provided for @notes.
  ///
  /// In en, this message translates to:
  /// **'Notes'**
  String get notes;

  /// No description provided for @locationNotice.
  ///
  /// In en, this message translates to:
  /// **'Your location is read once, when you press Save. The postmaster sees it as evidence quality – it is not proof of delivery.'**
  String get locationNotice;

  /// No description provided for @saveScan.
  ///
  /// In en, this message translates to:
  /// **'Save scan'**
  String get saveScan;

  /// No description provided for @readingLocation.
  ///
  /// In en, this message translates to:
  /// **'Reading location…'**
  String get readingLocation;

  /// No description provided for @errChooseStatus.
  ///
  /// In en, this message translates to:
  /// **'Choose the new status'**
  String get errChooseStatus;

  /// No description provided for @errReasonRequired.
  ///
  /// In en, this message translates to:
  /// **'Choose or type a reason'**
  String get errReasonRequired;

  /// No description provided for @errExceptionTooShort.
  ///
  /// In en, this message translates to:
  /// **'Describe the exception in at least 5 characters'**
  String get errExceptionTooShort;

  /// No description provided for @errRecipientNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter the name of the person who received the letter'**
  String get errRecipientNameRequired;

  /// No description provided for @errSignatureRequired.
  ///
  /// In en, this message translates to:
  /// **'Ask the recipient to sign'**
  String get errSignatureRequired;

  /// No description provided for @errSheetRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter the delivery sheet or page number'**
  String get errSheetRequired;

  /// No description provided for @outcomeAcceptedTitle.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get outcomeAcceptedTitle;

  /// No description provided for @outcomeAcceptedBody.
  ///
  /// In en, this message translates to:
  /// **'The server accepted the scan and updated the status.'**
  String get outcomeAcceptedBody;

  /// No description provided for @outcomeDuplicateTitle.
  ///
  /// In en, this message translates to:
  /// **'Already recorded'**
  String get outcomeDuplicateTitle;

  /// No description provided for @outcomeDuplicateBody.
  ///
  /// In en, this message translates to:
  /// **'The server already had this scan. Nothing was added twice.'**
  String get outcomeDuplicateBody;

  /// No description provided for @outcomeHeldTitle.
  ///
  /// In en, this message translates to:
  /// **'Saved – held for review'**
  String get outcomeHeldTitle;

  /// No description provided for @outcomeHeldBody.
  ///
  /// In en, this message translates to:
  /// **'The scan is stored, but the status changes only after the postmaster approves it.'**
  String get outcomeHeldBody;

  /// No description provided for @outcomeRejectedTitle.
  ///
  /// In en, this message translates to:
  /// **'Not accepted'**
  String get outcomeRejectedTitle;

  /// No description provided for @outcomeRejectedBody.
  ///
  /// In en, this message translates to:
  /// **'The server did not accept this scan:'**
  String get outcomeRejectedBody;

  /// No description provided for @outcomePendingTitle.
  ///
  /// In en, this message translates to:
  /// **'Saved on this phone'**
  String get outcomePendingTitle;

  /// No description provided for @outcomePendingBody.
  ///
  /// In en, this message translates to:
  /// **'It will upload automatically when the network returns.'**
  String get outcomePendingBody;

  /// No description provided for @statusRecorded.
  ///
  /// In en, this message translates to:
  /// **'Status recorded'**
  String get statusRecorded;

  /// No description provided for @locationEvidence.
  ///
  /// In en, this message translates to:
  /// **'Location evidence'**
  String get locationEvidence;

  /// No description provided for @locationQuality.
  ///
  /// In en, this message translates to:
  /// **'± {metres} m, {seconds} s old'**
  String locationQuality(int metres, int seconds);

  /// No description provided for @mockLocationWarning.
  ///
  /// In en, this message translates to:
  /// **'The phone reported a simulated (mock) location. The scan will be held for review.'**
  String get mockLocationWarning;

  /// No description provided for @scanNext.
  ///
  /// In en, this message translates to:
  /// **'Scan next letter'**
  String get scanNext;

  /// No description provided for @scanAnother.
  ///
  /// In en, this message translates to:
  /// **'Scan another letter'**
  String get scanAnother;

  /// No description provided for @itemNotFoundTitle.
  ///
  /// In en, this message translates to:
  /// **'Item not found'**
  String get itemNotFoundTitle;

  /// No description provided for @notAllowedTitle.
  ///
  /// In en, this message translates to:
  /// **'You cannot scan this item'**
  String get notAllowedTitle;

  /// No description provided for @historyIntro.
  ///
  /// In en, this message translates to:
  /// **'Scans are saved on this phone first and uploaded when there is network. Scans waiting to upload are never deleted.'**
  String get historyIntro;

  /// No description provided for @noScansYet.
  ///
  /// In en, this message translates to:
  /// **'No scans on this phone yet'**
  String get noScansYet;

  /// No description provided for @waitingForUser.
  ///
  /// In en, this message translates to:
  /// **'Waits for {user} to sign in'**
  String waitingForUser(String user);

  /// No description provided for @retryPending.
  ///
  /// In en, this message translates to:
  /// **'Upload not finished – {attempts} attempt(s), will retry'**
  String retryPending(int attempts);

  /// No description provided for @trackIntro.
  ///
  /// In en, this message translates to:
  /// **'Senders can follow a registered letter with the QR code or the tracking ID and access code on their receipt.'**
  String get trackIntro;

  /// No description provided for @scanReceiptQr.
  ///
  /// In en, this message translates to:
  /// **'Scan the receipt QR code'**
  String get scanReceiptQr;

  /// No description provided for @scanReceipt.
  ///
  /// In en, this message translates to:
  /// **'Scan receipt'**
  String get scanReceipt;

  /// No description provided for @scanReceiptInstruction.
  ///
  /// In en, this message translates to:
  /// **'Point the camera at the QR code on the sender\'s receipt'**
  String get scanReceiptInstruction;

  /// No description provided for @orTypeDetails.
  ///
  /// In en, this message translates to:
  /// **'Or type the details from the receipt'**
  String get orTypeDetails;

  /// No description provided for @trackingId.
  ///
  /// In en, this message translates to:
  /// **'Tracking ID'**
  String get trackingId;

  /// No description provided for @trackingIdHint.
  ///
  /// In en, this message translates to:
  /// **'Printed under the barcode, for example PA-DEMO-7K3M9Q2XRH4'**
  String get trackingIdHint;

  /// No description provided for @accessCode.
  ///
  /// In en, this message translates to:
  /// **'Access code'**
  String get accessCode;

  /// No description provided for @accessCodeHint.
  ///
  /// In en, this message translates to:
  /// **'Part of the tracking link on the receipt (after #t=)'**
  String get accessCodeHint;

  /// No description provided for @errAccessCodeRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter the access code from the receipt'**
  String get errAccessCodeRequired;

  /// No description provided for @showStatus.
  ///
  /// In en, this message translates to:
  /// **'Show status'**
  String get showStatus;

  /// No description provided for @trackNotFoundTitle.
  ///
  /// In en, this message translates to:
  /// **'No tracking record found'**
  String get trackNotFoundTitle;

  /// No description provided for @trackNotFoundBody.
  ///
  /// In en, this message translates to:
  /// **'Check the tracking ID and the access code on the receipt. For your security we do not say which one is wrong.'**
  String get trackNotFoundBody;

  /// No description provided for @acceptedOn.
  ///
  /// In en, this message translates to:
  /// **'Accepted on'**
  String get acceptedOn;

  /// No description provided for @fromOffice.
  ///
  /// In en, this message translates to:
  /// **'From office'**
  String get fromOffice;

  /// No description provided for @history.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get history;

  /// No description provided for @syncedLater.
  ///
  /// In en, this message translates to:
  /// **'Uploaded later, at {time}'**
  String syncedLater(String time);

  /// No description provided for @historyOnly.
  ///
  /// In en, this message translates to:
  /// **'Kept in history only'**
  String get historyOnly;

  /// No description provided for @trackPrivacyNotice.
  ///
  /// In en, this message translates to:
  /// **'Status is recorded when authorised staff scan the letter. Places are office names only; a scan\'s position is not proof of delivery.'**
  String get trackPrivacyNotice;

  /// No description provided for @intakeIntro.
  ///
  /// In en, this message translates to:
  /// **'Register a registered letter in five steps: photo, addresses, confirm, weigh, charge.'**
  String get intakeIntro;

  /// No description provided for @registerNewLetter.
  ///
  /// In en, this message translates to:
  /// **'Register a new letter'**
  String get registerNewLetter;

  /// No description provided for @ocrUnavailableTitle.
  ///
  /// In en, this message translates to:
  /// **'Address reading is not available'**
  String get ocrUnavailableTitle;

  /// No description provided for @ocrUnavailableBody.
  ///
  /// In en, this message translates to:
  /// **'The server has no OCR engine or handwriting model installed. Type or paste the address instead.'**
  String get ocrUnavailableBody;

  /// No description provided for @draftsInProgress.
  ///
  /// In en, this message translates to:
  /// **'Registrations in progress'**
  String get draftsInProgress;

  /// No description provided for @noDrafts.
  ///
  /// In en, this message translates to:
  /// **'No registrations in progress'**
  String get noDrafts;

  /// No description provided for @noDraftsHint.
  ///
  /// In en, this message translates to:
  /// **'Press Register a new letter to start.'**
  String get noDraftsHint;

  /// No description provided for @stepsDone.
  ///
  /// In en, this message translates to:
  /// **'{done} of {total} steps'**
  String stepsDone(int done, int total);

  /// No description provided for @noAddressYet.
  ///
  /// In en, this message translates to:
  /// **'No address yet'**
  String get noAddressYet;

  /// No description provided for @startedAt.
  ///
  /// In en, this message translates to:
  /// **'Started {time}'**
  String startedAt(String time);

  /// No description provided for @continueDraft.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueDraft;

  /// No description provided for @deleteDraft.
  ///
  /// In en, this message translates to:
  /// **'Delete draft'**
  String get deleteDraft;

  /// No description provided for @deleteDraftTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete this draft?'**
  String get deleteDraftTitle;

  /// No description provided for @deleteDraftBody.
  ///
  /// In en, this message translates to:
  /// **'The draft is cancelled and its scale reading is released. This cannot be undone.'**
  String get deleteDraftBody;

  /// No description provided for @registerALetter.
  ///
  /// In en, this message translates to:
  /// **'Register a letter'**
  String get registerALetter;

  /// No description provided for @moreActions.
  ///
  /// In en, this message translates to:
  /// **'More actions'**
  String get moreActions;

  /// No description provided for @clearForm.
  ///
  /// In en, this message translates to:
  /// **'Clear form'**
  String get clearForm;

  /// No description provided for @clearFormTitle.
  ///
  /// In en, this message translates to:
  /// **'Clear the form?'**
  String get clearFormTitle;

  /// No description provided for @clearFormBody.
  ///
  /// In en, this message translates to:
  /// **'Clear the recipient, sender, destination office and contact fields?'**
  String get clearFormBody;

  /// No description provided for @openingDraft.
  ///
  /// In en, this message translates to:
  /// **'Opening draft…'**
  String get openingDraft;

  /// No description provided for @draft.
  ///
  /// In en, this message translates to:
  /// **'Draft'**
  String get draft;

  /// No description provided for @unsavedChanges.
  ///
  /// In en, this message translates to:
  /// **'Unsaved changes'**
  String get unsavedChanges;

  /// No description provided for @allChangesSaved.
  ///
  /// In en, this message translates to:
  /// **'All changes saved'**
  String get allChangesSaved;

  /// No description provided for @stepOf.
  ///
  /// In en, this message translates to:
  /// **'Step {step} of {total}'**
  String stepOf(int step, int total);

  /// No description provided for @stepPhoto.
  ///
  /// In en, this message translates to:
  /// **'Photo'**
  String get stepPhoto;

  /// No description provided for @stepAddresses.
  ///
  /// In en, this message translates to:
  /// **'Addresses'**
  String get stepAddresses;

  /// No description provided for @stepConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get stepConfirm;

  /// No description provided for @stepWeigh.
  ///
  /// In en, this message translates to:
  /// **'Weigh'**
  String get stepWeigh;

  /// No description provided for @stepPay.
  ///
  /// In en, this message translates to:
  /// **'Charge'**
  String get stepPay;

  /// No description provided for @alreadyAcceptedTitle.
  ///
  /// In en, this message translates to:
  /// **'Already accepted'**
  String get alreadyAcceptedTitle;

  /// No description provided for @alreadyAcceptedBody.
  ///
  /// In en, this message translates to:
  /// **'This draft became registered item {id}.'**
  String alreadyAcceptedBody(String id);

  /// No description provided for @openReceipt.
  ///
  /// In en, this message translates to:
  /// **'Open label and receipt'**
  String get openReceipt;

  /// No description provided for @draftClosedTitle.
  ///
  /// In en, this message translates to:
  /// **'Draft closed'**
  String get draftClosedTitle;

  /// No description provided for @draftClosedBody.
  ///
  /// In en, this message translates to:
  /// **'This draft was cancelled. Start a new registration from the counter screen.'**
  String get draftClosedBody;

  /// No description provided for @stepPhotoTitle.
  ///
  /// In en, this message translates to:
  /// **'Step 1 of 5: photograph the envelope'**
  String get stepPhotoTitle;

  /// No description provided for @nextPhoto.
  ///
  /// In en, this message translates to:
  /// **'Take a photo of the envelope, then press Read address. You can also type the address.'**
  String get nextPhoto;

  /// No description provided for @captureMode.
  ///
  /// In en, this message translates to:
  /// **'Capture mode (research)'**
  String get captureMode;

  /// No description provided for @captureModeHint.
  ///
  /// In en, this message translates to:
  /// **'P1 is the assisted mode. B1 and B0 are baselines for the evaluation.'**
  String get captureModeHint;

  /// No description provided for @modeP1.
  ///
  /// In en, this message translates to:
  /// **'P1 – assisted capture (recommended)'**
  String get modeP1;

  /// No description provided for @modeB1.
  ///
  /// In en, this message translates to:
  /// **'B1 – basic OCR + rules'**
  String get modeB1;

  /// No description provided for @modeB0.
  ///
  /// In en, this message translates to:
  /// **'B0 – manual entry (baseline)'**
  String get modeB0;

  /// No description provided for @envelopePhoto.
  ///
  /// In en, this message translates to:
  /// **'Envelope photo'**
  String get envelopePhoto;

  /// No description provided for @envelopePhotoHint.
  ///
  /// In en, this message translates to:
  /// **'Photograph the front of the envelope, flat and well lit.'**
  String get envelopePhotoHint;

  /// No description provided for @photoOptionalB0.
  ///
  /// In en, this message translates to:
  /// **'Optional in manual entry (B0).'**
  String get photoOptionalB0;

  /// No description provided for @takePhoto.
  ///
  /// In en, this message translates to:
  /// **'Take a photo'**
  String get takePhoto;

  /// No description provided for @chooseFromGallery.
  ///
  /// In en, this message translates to:
  /// **'Choose a photo'**
  String get chooseFromGallery;

  /// No description provided for @captureFromScale.
  ///
  /// In en, this message translates to:
  /// **'Capture from scale camera'**
  String get captureFromScale;

  /// No description provided for @noPhotoYet.
  ///
  /// In en, this message translates to:
  /// **'No photo yet'**
  String get noPhotoYet;

  /// No description provided for @noPhotoYetHint.
  ///
  /// In en, this message translates to:
  /// **'Take a photo of the front of the envelope.'**
  String get noPhotoYetHint;

  /// No description provided for @photoNotLoaded.
  ///
  /// In en, this message translates to:
  /// **'The photo could not be shown.'**
  String get photoNotLoaded;

  /// No description provided for @rotateLeft.
  ///
  /// In en, this message translates to:
  /// **'Rotate left'**
  String get rotateLeft;

  /// No description provided for @rotateRight.
  ///
  /// In en, this message translates to:
  /// **'Rotate right'**
  String get rotateRight;

  /// No description provided for @photoQualityTitle.
  ///
  /// In en, this message translates to:
  /// **'Photo quality'**
  String get photoQualityTitle;

  /// No description provided for @qLowResolution.
  ///
  /// In en, this message translates to:
  /// **'The photo is too small – move closer.'**
  String get qLowResolution;

  /// No description provided for @qBlurry.
  ///
  /// In en, this message translates to:
  /// **'The photo is blurred – hold the phone still and take it again.'**
  String get qBlurry;

  /// No description provided for @qTooDark.
  ///
  /// In en, this message translates to:
  /// **'The photo is too dark – add light.'**
  String get qTooDark;

  /// No description provided for @qTooBright.
  ///
  /// In en, this message translates to:
  /// **'The photo is too bright.'**
  String get qTooBright;

  /// No description provided for @qLowContrast.
  ///
  /// In en, this message translates to:
  /// **'The text contrast is low.'**
  String get qLowContrast;

  /// No description provided for @qGlare.
  ///
  /// In en, this message translates to:
  /// **'There is glare on the envelope – tilt it or switch off the flash.'**
  String get qGlare;

  /// No description provided for @readAddressTitle.
  ///
  /// In en, this message translates to:
  /// **'Read the address'**
  String get readAddressTitle;

  /// No description provided for @readAddressHint.
  ///
  /// In en, this message translates to:
  /// **'The server reads the photo and suggests the fields. You check them in step 2.'**
  String get readAddressHint;

  /// No description provided for @readFor.
  ///
  /// In en, this message translates to:
  /// **'Read the address of the'**
  String get readFor;

  /// No description provided for @recipient.
  ///
  /// In en, this message translates to:
  /// **'Recipient'**
  String get recipient;

  /// No description provided for @sender.
  ///
  /// In en, this message translates to:
  /// **'Sender'**
  String get sender;

  /// No description provided for @handwriting.
  ///
  /// In en, this message translates to:
  /// **'Handwriting'**
  String get handwriting;

  /// No description provided for @writingAuto.
  ///
  /// In en, this message translates to:
  /// **'Auto'**
  String get writingAuto;

  /// No description provided for @writingHand.
  ///
  /// In en, this message translates to:
  /// **'Handwritten'**
  String get writingHand;

  /// No description provided for @writingPrinted.
  ///
  /// In en, this message translates to:
  /// **'Printed'**
  String get writingPrinted;

  /// No description provided for @addressLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language of the address'**
  String get addressLanguage;

  /// No description provided for @detectAutomatically.
  ///
  /// In en, this message translates to:
  /// **'Detect automatically'**
  String get detectAutomatically;

  /// No description provided for @readAddress.
  ///
  /// In en, this message translates to:
  /// **'Read address'**
  String get readAddress;

  /// No description provided for @typeOrPaste.
  ///
  /// In en, this message translates to:
  /// **'Type or paste the address'**
  String get typeOrPaste;

  /// No description provided for @typeOrPasteHint.
  ///
  /// In en, this message translates to:
  /// **'Use this when there is no photo or the reader could not read it.'**
  String get typeOrPasteHint;

  /// No description provided for @fillFromText.
  ///
  /// In en, this message translates to:
  /// **'Fill fields from text'**
  String get fillFromText;

  /// No description provided for @readResultTitle.
  ///
  /// In en, this message translates to:
  /// **'What the reader found'**
  String get readResultTitle;

  /// No description provided for @fieldConfidence.
  ///
  /// In en, this message translates to:
  /// **'Field confidence {percent} %'**
  String fieldConfidence(int percent);

  /// No description provided for @noFlags.
  ///
  /// In en, this message translates to:
  /// **'No fields flagged'**
  String get noFlags;

  /// No description provided for @fieldsToCheck.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 field to check} other{{count} fields to check}}'**
  String fieldsToCheck(int count);

  /// No description provided for @handwritingModel.
  ///
  /// In en, this message translates to:
  /// **'Handwriting model'**
  String get handwritingModel;

  /// No description provided for @printedTextReader.
  ///
  /// In en, this message translates to:
  /// **'Printed-text reader'**
  String get printedTextReader;

  /// No description provided for @readResultNext.
  ///
  /// In en, this message translates to:
  /// **'Empty fields were filled from this result. Go to the next step to check them.'**
  String get readResultNext;

  /// No description provided for @stepAddressesTitle.
  ///
  /// In en, this message translates to:
  /// **'Step 2 of 5: check the addresses'**
  String get stepAddressesTitle;

  /// No description provided for @nextAddresses.
  ///
  /// In en, this message translates to:
  /// **'Compare every field with the envelope. Correct anything that is wrong.'**
  String get nextAddresses;

  /// No description provided for @recipientTo.
  ///
  /// In en, this message translates to:
  /// **'Recipient (to)'**
  String get recipientTo;

  /// No description provided for @recipientHint.
  ///
  /// In en, this message translates to:
  /// **'Who the letter is addressed to. Name and postal town are needed.'**
  String get recipientHint;

  /// No description provided for @senderFrom.
  ///
  /// In en, this message translates to:
  /// **'Sender (from)'**
  String get senderFrom;

  /// No description provided for @senderHint.
  ///
  /// In en, this message translates to:
  /// **'Who is posting the letter (printed on the receipt).'**
  String get senderHint;

  /// No description provided for @useAllSuggestions.
  ///
  /// In en, this message translates to:
  /// **'Use all suggestions'**
  String get useAllSuggestions;

  /// No description provided for @confidenceLegend.
  ///
  /// In en, this message translates to:
  /// **'Percentages show how sure the reader is. Fields marked in red need a closer look.'**
  String get confidenceLegend;

  /// No description provided for @fName.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get fName;

  /// No description provided for @fHouse.
  ///
  /// In en, this message translates to:
  /// **'House / unit no.'**
  String get fHouse;

  /// No description provided for @fStreet.
  ///
  /// In en, this message translates to:
  /// **'Street / road'**
  String get fStreet;

  /// No description provided for @fLocality.
  ///
  /// In en, this message translates to:
  /// **'Village / locality'**
  String get fLocality;

  /// No description provided for @fCity.
  ///
  /// In en, this message translates to:
  /// **'Postal town'**
  String get fCity;

  /// No description provided for @fPostcode.
  ///
  /// In en, this message translates to:
  /// **'Postcode'**
  String get fPostcode;

  /// No description provided for @fRegion.
  ///
  /// In en, this message translates to:
  /// **'District / province'**
  String get fRegion;

  /// No description provided for @modelConfidence.
  ///
  /// In en, this message translates to:
  /// **'Reader confidence {percent} percent'**
  String modelConfidence(int percent);

  /// No description provided for @lowConfidenceCheck.
  ///
  /// In en, this message translates to:
  /// **'Low confidence – check against the envelope'**
  String get lowConfidenceCheck;

  /// No description provided for @suggestedValue.
  ///
  /// In en, this message translates to:
  /// **'Suggested: {value}'**
  String suggestedValue(String value);

  /// No description provided for @use.
  ///
  /// In en, this message translates to:
  /// **'Use'**
  String get use;

  /// No description provided for @postcodeDerived.
  ///
  /// In en, this message translates to:
  /// **'Postcode {postcode} can be derived from the town. Check it before use.'**
  String postcodeDerived(String postcode);

  /// No description provided for @useIt.
  ///
  /// In en, this message translates to:
  /// **'Use it'**
  String get useIt;

  /// No description provided for @townPostcodeOk.
  ///
  /// In en, this message translates to:
  /// **'Town and postcode agree with the gazetteer.'**
  String get townPostcodeOk;

  /// No description provided for @townPostcodeCheck.
  ///
  /// In en, this message translates to:
  /// **'Town and postcode check'**
  String get townPostcodeCheck;

  /// No description provided for @townPostcodeMismatch.
  ///
  /// In en, this message translates to:
  /// **'The postcode belongs to a different town.'**
  String get townPostcodeMismatch;

  /// No description provided for @townUnknown.
  ///
  /// In en, this message translates to:
  /// **'The town is not in the reference list.'**
  String get townUnknown;

  /// No description provided for @postcodeUnknown.
  ///
  /// In en, this message translates to:
  /// **'The postcode is not in the reference list.'**
  String get postcodeUnknown;

  /// No description provided for @expectedValues.
  ///
  /// In en, this message translates to:
  /// **'Expected: {values}'**
  String expectedValues(String values);

  /// No description provided for @stepConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Step 3 of 5: confirm the details'**
  String get stepConfirmTitle;

  /// No description provided for @nextConfirm.
  ///
  /// In en, this message translates to:
  /// **'Choose the destination office and how the sender gets updates, then confirm.'**
  String get nextConfirm;

  /// No description provided for @destinationOfficeHint.
  ///
  /// In en, this message translates to:
  /// **'The post office that delivers to the recipient\'s address.'**
  String get destinationOfficeHint;

  /// No description provided for @deliveryOffice.
  ///
  /// In en, this message translates to:
  /// **'Delivery office'**
  String get deliveryOffice;

  /// No description provided for @choose.
  ///
  /// In en, this message translates to:
  /// **'Choose'**
  String get choose;

  /// No description provided for @senderUpdates.
  ///
  /// In en, this message translates to:
  /// **'Sender updates'**
  String get senderUpdates;

  /// No description provided for @senderUpdatesHint.
  ///
  /// In en, this message translates to:
  /// **'Optional messages to the sender when the status changes.'**
  String get senderUpdatesHint;

  /// No description provided for @sendUpdatesBy.
  ///
  /// In en, this message translates to:
  /// **'Send status updates by'**
  String get sendUpdatesBy;

  /// No description provided for @senderEmail.
  ///
  /// In en, this message translates to:
  /// **'Sender\'s e-mail'**
  String get senderEmail;

  /// No description provided for @senderMobile.
  ///
  /// In en, this message translates to:
  /// **'Sender\'s mobile number'**
  String get senderMobile;

  /// No description provided for @mobileFormat.
  ///
  /// In en, this message translates to:
  /// **'Format: 07XXXXXXXX'**
  String get mobileFormat;

  /// No description provided for @messageLanguage.
  ///
  /// In en, this message translates to:
  /// **'Message language'**
  String get messageLanguage;

  /// No description provided for @whichUpdates.
  ///
  /// In en, this message translates to:
  /// **'Which updates'**
  String get whichUpdates;

  /// No description provided for @updatesKey.
  ///
  /// In en, this message translates to:
  /// **'Key updates only (accepted, out for delivery, delivered, problems)'**
  String get updatesKey;

  /// No description provided for @updatesAll.
  ///
  /// In en, this message translates to:
  /// **'Every accepted scan'**
  String get updatesAll;

  /// No description provided for @smsGatewayNote.
  ///
  /// In en, this message translates to:
  /// **'SMS is sent only if an SMS gateway has been approved for the trial.'**
  String get smsGatewayNote;

  /// No description provided for @detailsConfirmedBy.
  ///
  /// In en, this message translates to:
  /// **'Details confirmed by {user}'**
  String detailsConfirmedBy(String user);

  /// No description provided for @reviewStats.
  ///
  /// In en, this message translates to:
  /// **'Suggested {suggested} · kept {kept} · corrected {corrected} · typed {typed}'**
  String reviewStats(int suggested, int kept, int corrected, int typed);

  /// No description provided for @reconfirmNeeded.
  ///
  /// In en, this message translates to:
  /// **'You changed the details after confirming. Confirm them again.'**
  String get reconfirmNeeded;

  /// No description provided for @confirmDetails.
  ///
  /// In en, this message translates to:
  /// **'I have checked the envelope – confirm details'**
  String get confirmDetails;

  /// No description provided for @confirmDetailsHint.
  ///
  /// In en, this message translates to:
  /// **'Confirm only after comparing every field with the envelope.'**
  String get confirmDetailsHint;

  /// No description provided for @errPartyName.
  ///
  /// In en, this message translates to:
  /// **'{party}: enter the name'**
  String errPartyName(String party);

  /// No description provided for @errPartyCity.
  ///
  /// In en, this message translates to:
  /// **'{party}: enter the postal town'**
  String errPartyCity(String party);

  /// No description provided for @errPartyAddress.
  ///
  /// In en, this message translates to:
  /// **'{party}: enter a house number, street or village'**
  String errPartyAddress(String party);

  /// No description provided for @errDestinationRequired.
  ///
  /// In en, this message translates to:
  /// **'Choose the destination office'**
  String get errDestinationRequired;

  /// No description provided for @errEmailInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid e-mail address, like name@example.com'**
  String get errEmailInvalid;

  /// No description provided for @errPhoneInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a Sri Lankan mobile number, like 0771234567'**
  String get errPhoneInvalid;

  /// No description provided for @stepWeighTitle.
  ///
  /// In en, this message translates to:
  /// **'Step 4 of 5: weigh the letter'**
  String get stepWeighTitle;

  /// No description provided for @nextWeigh.
  ///
  /// In en, this message translates to:
  /// **'Place the letter on the scale. When the reading is stable, press Use this weight.'**
  String get nextWeigh;

  /// No description provided for @weightRecorded.
  ///
  /// In en, this message translates to:
  /// **'Weight recorded: {weight}'**
  String weightRecorded(String weight);

  /// No description provided for @weightFromScale.
  ///
  /// In en, this message translates to:
  /// **'From scale {device}, uncertainty ± {uncertainty} g'**
  String weightFromScale(String device, String uncertainty);

  /// No description provided for @weightManual.
  ///
  /// In en, this message translates to:
  /// **'Entered by hand – {instrument}'**
  String weightManual(String instrument);

  /// No description provided for @iotScale.
  ///
  /// In en, this message translates to:
  /// **'IoT scale'**
  String get iotScale;

  /// No description provided for @iotScaleHint.
  ///
  /// In en, this message translates to:
  /// **'Place the letter on the scale and wait until the reading is stable.'**
  String get iotScaleHint;

  /// No description provided for @noScaleForOffice.
  ///
  /// In en, this message translates to:
  /// **'No IoT scale is registered for your office. Enter the weight by hand below.'**
  String get noScaleForOffice;

  /// No description provided for @scale.
  ///
  /// In en, this message translates to:
  /// **'Scale'**
  String get scale;

  /// No description provided for @noReading.
  ///
  /// In en, this message translates to:
  /// **'No reading'**
  String get noReading;

  /// No description provided for @currentReading.
  ///
  /// In en, this message translates to:
  /// **'Current reading'**
  String get currentReading;

  /// No description provided for @stableReady.
  ///
  /// In en, this message translates to:
  /// **'Stable – ready'**
  String get stableReady;

  /// No description provided for @settling.
  ///
  /// In en, this message translates to:
  /// **'Settling…'**
  String get settling;

  /// No description provided for @spread.
  ///
  /// In en, this message translates to:
  /// **'Spread {grams} g'**
  String spread(String grams);

  /// No description provided for @useThisWeight.
  ///
  /// In en, this message translates to:
  /// **'Use this weight'**
  String get useThisWeight;

  /// No description provided for @manualWeightTitle.
  ///
  /// In en, this message translates to:
  /// **'Enter weight by hand'**
  String get manualWeightTitle;

  /// No description provided for @manualWeightHint.
  ///
  /// In en, this message translates to:
  /// **'Only when the IoT scale cannot be used. This is recorded for audit.'**
  String get manualWeightHint;

  /// No description provided for @weightGrams.
  ///
  /// In en, this message translates to:
  /// **'Weight (grams)'**
  String get weightGrams;

  /// No description provided for @instrument.
  ///
  /// In en, this message translates to:
  /// **'Scale used'**
  String get instrument;

  /// No description provided for @instrumentHint.
  ///
  /// In en, this message translates to:
  /// **'For example: approved counter scale no. 2'**
  String get instrumentHint;

  /// No description provided for @manualReasonHint.
  ///
  /// In en, this message translates to:
  /// **'Why the IoT scale could not be used'**
  String get manualReasonHint;

  /// No description provided for @recordManualWeight.
  ///
  /// In en, this message translates to:
  /// **'Record manual weight'**
  String get recordManualWeight;

  /// No description provided for @errGrams.
  ///
  /// In en, this message translates to:
  /// **'Enter the weight in grams (more than 0, up to 5000)'**
  String get errGrams;

  /// No description provided for @errInstrument.
  ///
  /// In en, this message translates to:
  /// **'Enter the scale used'**
  String get errInstrument;

  /// No description provided for @errManualReason.
  ///
  /// In en, this message translates to:
  /// **'Say why the IoT scale was not used (at least 5 characters)'**
  String get errManualReason;

  /// No description provided for @stepPayTitle.
  ///
  /// In en, this message translates to:
  /// **'Step 5 of 5: charge and accept'**
  String get stepPayTitle;

  /// No description provided for @nextPay.
  ///
  /// In en, this message translates to:
  /// **'Calculate the charge, take the payment, then accept the letter.'**
  String get nextPay;

  /// No description provided for @extraServices.
  ///
  /// In en, this message translates to:
  /// **'Extra services'**
  String get extraServices;

  /// No description provided for @adviceOfDelivery.
  ///
  /// In en, this message translates to:
  /// **'Advice of delivery'**
  String get adviceOfDelivery;

  /// No description provided for @adviceOfDeliveryHint.
  ///
  /// In en, this message translates to:
  /// **'The sender receives a signed delivery card (extra fee).'**
  String get adviceOfDeliveryHint;

  /// No description provided for @insuredValue.
  ///
  /// In en, this message translates to:
  /// **'Insured value (Rs.)'**
  String get insuredValue;

  /// No description provided for @insuredValueHint.
  ///
  /// In en, this message translates to:
  /// **'Declared value of the contents, if the sender wants insurance'**
  String get insuredValueHint;

  /// No description provided for @errInsuredValue.
  ///
  /// In en, this message translates to:
  /// **'Enter the insured value as a number of rupees, or leave it empty'**
  String get errInsuredValue;

  /// No description provided for @calculateCharge.
  ///
  /// In en, this message translates to:
  /// **'Calculate charge'**
  String get calculateCharge;

  /// No description provided for @weighFirst.
  ///
  /// In en, this message translates to:
  /// **'Record the weight in step 4 first.'**
  String get weighFirst;

  /// No description provided for @reweighRequired.
  ///
  /// In en, this message translates to:
  /// **'Reweigh required'**
  String get reweighRequired;

  /// No description provided for @cannotQuote.
  ///
  /// In en, this message translates to:
  /// **'Cannot calculate the charge'**
  String get cannotQuote;

  /// No description provided for @charge.
  ///
  /// In en, this message translates to:
  /// **'Charge'**
  String get charge;

  /// No description provided for @tariffLine.
  ///
  /// In en, this message translates to:
  /// **'Tariff {version} · weight {weight} g ± {uncertainty} g'**
  String tariffLine(String version, String weight, String uncertainty);

  /// No description provided for @tariffNotApproved.
  ///
  /// In en, this message translates to:
  /// **'Tariff not yet approved – research use'**
  String get tariffNotApproved;

  /// No description provided for @qPostage.
  ///
  /// In en, this message translates to:
  /// **'Letter postage'**
  String get qPostage;

  /// No description provided for @qRegistration.
  ///
  /// In en, this message translates to:
  /// **'Registration fee'**
  String get qRegistration;

  /// No description provided for @qInsurance.
  ///
  /// In en, this message translates to:
  /// **'Insurance'**
  String get qInsurance;

  /// No description provided for @total.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get total;

  /// No description provided for @beforeAccepting.
  ///
  /// In en, this message translates to:
  /// **'Before accepting'**
  String get beforeAccepting;

  /// No description provided for @checkConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Details confirmed (step 3)'**
  String get checkConfirmed;

  /// No description provided for @checkWeight.
  ///
  /// In en, this message translates to:
  /// **'Weight recorded (step 4)'**
  String get checkWeight;

  /// No description provided for @checkCharge.
  ///
  /// In en, this message translates to:
  /// **'Charge calculated'**
  String get checkCharge;

  /// No description provided for @payment.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get payment;

  /// No description provided for @paymentMethod.
  ///
  /// In en, this message translates to:
  /// **'Payment method'**
  String get paymentMethod;

  /// No description provided for @payCash.
  ///
  /// In en, this message translates to:
  /// **'Cash'**
  String get payCash;

  /// No description provided for @payCard.
  ///
  /// In en, this message translates to:
  /// **'Card'**
  String get payCard;

  /// No description provided for @payOther.
  ///
  /// In en, this message translates to:
  /// **'Other (approved)'**
  String get payOther;

  /// No description provided for @receiptReference.
  ///
  /// In en, this message translates to:
  /// **'Receipt or reference number'**
  String get receiptReference;

  /// No description provided for @receivedAndAccept.
  ///
  /// In en, this message translates to:
  /// **'Received {amount} – accept letter'**
  String receivedAndAccept(String amount);

  /// No description provided for @confirmFirst.
  ///
  /// In en, this message translates to:
  /// **'Confirm the details (step 3) before accepting.'**
  String get confirmFirst;

  /// No description provided for @acceptLetter.
  ///
  /// In en, this message translates to:
  /// **'Accept letter'**
  String get acceptLetter;

  /// No description provided for @acceptLetterTitle.
  ///
  /// In en, this message translates to:
  /// **'Accept this letter?'**
  String get acceptLetterTitle;

  /// No description provided for @acceptLetterBody.
  ///
  /// In en, this message translates to:
  /// **'Confirm that you received {amount} from the sender. A tracking ID is created and cannot be removed.'**
  String acceptLetterBody(String amount);

  /// No description provided for @labelAndReceipt.
  ///
  /// In en, this message translates to:
  /// **'Label and receipt'**
  String get labelAndReceipt;

  /// No description provided for @letterAccepted.
  ///
  /// In en, this message translates to:
  /// **'Letter accepted'**
  String get letterAccepted;

  /// No description provided for @letterAcceptedBody.
  ///
  /// In en, this message translates to:
  /// **'Print the label, stick it on the envelope, then scan it to verify. Give the receipt to the sender.'**
  String get letterAcceptedBody;

  /// No description provided for @registeredLetter.
  ///
  /// In en, this message translates to:
  /// **'Registered letter'**
  String get registeredLetter;

  /// No description provided for @to.
  ///
  /// In en, this message translates to:
  /// **'To'**
  String get to;

  /// No description provided for @receiptDetails.
  ///
  /// In en, this message translates to:
  /// **'Receipt'**
  String get receiptDetails;

  /// No description provided for @acceptedBy.
  ///
  /// In en, this message translates to:
  /// **'Accepted by'**
  String get acceptedBy;

  /// No description provided for @senderName.
  ///
  /// In en, this message translates to:
  /// **'Sender'**
  String get senderName;

  /// No description provided for @weight.
  ///
  /// In en, this message translates to:
  /// **'Weight'**
  String get weight;

  /// No description provided for @paidBy.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get paidBy;

  /// No description provided for @tariff.
  ///
  /// In en, this message translates to:
  /// **'Tariff'**
  String get tariff;

  /// No description provided for @labelPrints.
  ///
  /// In en, this message translates to:
  /// **'Label prints'**
  String get labelPrints;

  /// No description provided for @senderTracking.
  ///
  /// In en, this message translates to:
  /// **'Sender\'s tracking QR'**
  String get senderTracking;

  /// No description provided for @senderTrackingHint.
  ///
  /// In en, this message translates to:
  /// **'Printed on the receipt. The sender can follow the letter with it.'**
  String get senderTrackingHint;

  /// No description provided for @copyLink.
  ///
  /// In en, this message translates to:
  /// **'Copy link'**
  String get copyLink;

  /// No description provided for @linkCopied.
  ///
  /// In en, this message translates to:
  /// **'Link copied'**
  String get linkCopied;

  /// No description provided for @verifyLabel.
  ///
  /// In en, this message translates to:
  /// **'Verify the printed label'**
  String get verifyLabel;

  /// No description provided for @verifyLabelInstruction.
  ///
  /// In en, this message translates to:
  /// **'Scan the barcode on the label you stuck on the envelope'**
  String get verifyLabelInstruction;

  /// No description provided for @labelVerified.
  ///
  /// In en, this message translates to:
  /// **'Label verified – the printed label matches this item.'**
  String get labelVerified;

  /// No description provided for @labelMismatch.
  ///
  /// In en, this message translates to:
  /// **'The scanned label shows {id}, not this item. Reprint the label.'**
  String labelMismatch(String id);

  /// No description provided for @markPrinted.
  ///
  /// In en, this message translates to:
  /// **'Mark label as printed'**
  String get markPrinted;

  /// No description provided for @recordReprint.
  ///
  /// In en, this message translates to:
  /// **'Record a reprint'**
  String get recordReprint;

  /// No description provided for @reprintTitle.
  ///
  /// In en, this message translates to:
  /// **'Reprint the label?'**
  String get reprintTitle;

  /// No description provided for @reprintBody.
  ///
  /// In en, this message translates to:
  /// **'A reprint does not create a new item. Say why the label is printed again.'**
  String get reprintBody;

  /// No description provided for @printRecorded.
  ///
  /// In en, this message translates to:
  /// **'Label print recorded'**
  String get printRecorded;

  /// No description provided for @reprintRecorded.
  ///
  /// In en, this message translates to:
  /// **'Reprint recorded'**
  String get reprintRecorded;

  /// No description provided for @printNote.
  ///
  /// In en, this message translates to:
  /// **'Print the label from the counter computer (web app) or a connected label printer, then record it here.'**
  String get printNote;

  /// No description provided for @openItem.
  ///
  /// In en, this message translates to:
  /// **'Open item details'**
  String get openItem;

  /// No description provided for @registerAnother.
  ///
  /// In en, this message translates to:
  /// **'Register another letter'**
  String get registerAnother;

  /// No description provided for @findItem.
  ///
  /// In en, this message translates to:
  /// **'Tracking ID'**
  String get findItem;

  /// No description provided for @findItemHint.
  ///
  /// In en, this message translates to:
  /// **'All or part of the ID'**
  String get findItemHint;

  /// No description provided for @status.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get status;

  /// No description provided for @allStatuses.
  ///
  /// In en, this message translates to:
  /// **'All statuses'**
  String get allStatuses;

  /// No description provided for @scanToFind.
  ///
  /// In en, this message translates to:
  /// **'Scan a label to find it'**
  String get scanToFind;

  /// No description provided for @noItemsFound.
  ///
  /// In en, this message translates to:
  /// **'No items found'**
  String get noItemsFound;

  /// No description provided for @itemsShown.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 item} other{{count} items}}'**
  String itemsShown(int count);

  /// No description provided for @acceptedAt.
  ///
  /// In en, this message translates to:
  /// **'Accepted {time}'**
  String acceptedAt(String time);

  /// No description provided for @itemDetails.
  ///
  /// In en, this message translates to:
  /// **'Item details'**
  String get itemDetails;

  /// No description provided for @copyId.
  ///
  /// In en, this message translates to:
  /// **'Copy tracking ID'**
  String get copyId;

  /// No description provided for @idCopied.
  ///
  /// In en, this message translates to:
  /// **'Tracking ID copied'**
  String get idCopied;

  /// No description provided for @recordAScan.
  ///
  /// In en, this message translates to:
  /// **'Record a scan'**
  String get recordAScan;

  /// No description provided for @assignPostman.
  ///
  /// In en, this message translates to:
  /// **'Assign postman'**
  String get assignPostman;

  /// No description provided for @assignedTo.
  ///
  /// In en, this message translates to:
  /// **'Assigned to {user}'**
  String assignedTo(String user);

  /// No description provided for @noPostmenAtOffice.
  ///
  /// In en, this message translates to:
  /// **'There is no active postman at the destination office.'**
  String get noPostmenAtOffice;

  /// No description provided for @details.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get details;

  /// No description provided for @byWorker.
  ///
  /// In en, this message translates to:
  /// **'By {worker} ({role})'**
  String byWorker(String worker, String role);

  /// No description provided for @locationAccuracy.
  ///
  /// In en, this message translates to:
  /// **'Location accuracy ± {metres} m'**
  String locationAccuracy(int metres);

  /// No description provided for @distanceFromZone.
  ///
  /// In en, this message translates to:
  /// **'{metres} m from the reference area'**
  String distanceFromZone(int metres);

  /// No description provided for @savedOffline.
  ///
  /// In en, this message translates to:
  /// **'Saved offline, uploaded {seconds} s later'**
  String savedOffline(int seconds);

  /// No description provided for @ackLine.
  ///
  /// In en, this message translates to:
  /// **'Acknowledgement: {type} {name}'**
  String ackLine(String type, String name);

  /// No description provided for @reviewNote.
  ///
  /// In en, this message translates to:
  /// **'Reviewed by {user}: {reason}'**
  String reviewNote(String user, String reason);

  /// No description provided for @flagged.
  ///
  /// In en, this message translates to:
  /// **'Flagged'**
  String get flagged;

  /// No description provided for @heldTab.
  ///
  /// In en, this message translates to:
  /// **'Held ({count})'**
  String heldTab(int count);

  /// No description provided for @flaggedTab.
  ///
  /// In en, this message translates to:
  /// **'Flagged ({count})'**
  String flaggedTab(int count);

  /// No description provided for @heldIntro.
  ///
  /// In en, this message translates to:
  /// **'These scans did not change the status. Check the reasons, then approve or reject each one.'**
  String get heldIntro;

  /// No description provided for @flaggedIntro.
  ///
  /// In en, this message translates to:
  /// **'Accepted scans marked for attention in the last 14 days (for example an uncertain location). No action is needed.'**
  String get flaggedIntro;

  /// No description provided for @noHeldScans.
  ///
  /// In en, this message translates to:
  /// **'No scans waiting for review'**
  String get noHeldScans;

  /// No description provided for @noFlaggedScans.
  ///
  /// In en, this message translates to:
  /// **'No flagged scans'**
  String get noFlaggedScans;

  /// No description provided for @requestedStatus.
  ///
  /// In en, this message translates to:
  /// **'Requested: {status}'**
  String requestedStatus(String status);

  /// No description provided for @mockLocation.
  ///
  /// In en, this message translates to:
  /// **'Simulated location'**
  String get mockLocation;

  /// No description provided for @offlineScan.
  ///
  /// In en, this message translates to:
  /// **'Saved offline'**
  String get offlineScan;

  /// No description provided for @approve.
  ///
  /// In en, this message translates to:
  /// **'Approve'**
  String get approve;

  /// No description provided for @reject.
  ///
  /// In en, this message translates to:
  /// **'Reject'**
  String get reject;

  /// No description provided for @approveScanTitle.
  ///
  /// In en, this message translates to:
  /// **'Approve this scan?'**
  String get approveScanTitle;

  /// No description provided for @approveScanBody.
  ///
  /// In en, this message translates to:
  /// **'The status changes and the sender is notified. Say why you approve it.'**
  String get approveScanBody;

  /// No description provided for @rejectScanTitle.
  ///
  /// In en, this message translates to:
  /// **'Reject this scan?'**
  String get rejectScanTitle;

  /// No description provided for @rejectScanBody.
  ///
  /// In en, this message translates to:
  /// **'The scan stays in the history but does not change the status. Say why you reject it.'**
  String get rejectScanBody;

  /// No description provided for @scanApproved.
  ///
  /// In en, this message translates to:
  /// **'Scan approved'**
  String get scanApproved;

  /// No description provided for @scanRejected.
  ///
  /// In en, this message translates to:
  /// **'Scan rejected'**
  String get scanRejected;

  /// No description provided for @messagesIntro.
  ///
  /// In en, this message translates to:
  /// **'Status messages to senders. Retry failed ones or mark them resolved after contacting the sender.'**
  String get messagesIntro;

  /// No description provided for @noMessages.
  ///
  /// In en, this message translates to:
  /// **'No messages'**
  String get noMessages;

  /// No description provided for @attemptsAndTime.
  ///
  /// In en, this message translates to:
  /// **'{attempts} attempt(s) · created {time}'**
  String attemptsAndTime(int attempts, String time);

  /// No description provided for @preview.
  ///
  /// In en, this message translates to:
  /// **'Preview'**
  String get preview;

  /// No description provided for @messagePreview.
  ///
  /// In en, this message translates to:
  /// **'Message'**
  String get messagePreview;

  /// No description provided for @markResolved.
  ///
  /// In en, this message translates to:
  /// **'Mark resolved'**
  String get markResolved;

  /// No description provided for @retryMessageTitle.
  ///
  /// In en, this message translates to:
  /// **'Retry this message?'**
  String get retryMessageTitle;

  /// No description provided for @retryMessageBody.
  ///
  /// In en, this message translates to:
  /// **'The message will be sent again.'**
  String get retryMessageBody;

  /// No description provided for @resolveMessageTitle.
  ///
  /// In en, this message translates to:
  /// **'Mark message resolved?'**
  String get resolveMessageTitle;

  /// No description provided for @resolveMessageBody.
  ///
  /// In en, this message translates to:
  /// **'Use this after you have informed the sender another way.'**
  String get resolveMessageBody;

  /// No description provided for @devicesIntro.
  ///
  /// In en, this message translates to:
  /// **'The scale weighs letters and its camera photographs envelopes. Tare the empty scale after every restart.'**
  String get devicesIntro;

  /// No description provided for @noDevices.
  ///
  /// In en, this message translates to:
  /// **'No scale registered for your office'**
  String get noDevices;

  /// No description provided for @online.
  ///
  /// In en, this message translates to:
  /// **'Online'**
  String get online;

  /// No description provided for @offline.
  ///
  /// In en, this message translates to:
  /// **'Offline'**
  String get offline;

  /// No description provided for @calibrationStatus.
  ///
  /// In en, this message translates to:
  /// **'Calibration: {value}'**
  String calibrationStatus(String value);

  /// No description provided for @firmware.
  ///
  /// In en, this message translates to:
  /// **'Firmware'**
  String get firmware;

  /// No description provided for @cameraOk.
  ///
  /// In en, this message translates to:
  /// **'Camera ready'**
  String get cameraOk;

  /// No description provided for @cameraFault.
  ///
  /// In en, this message translates to:
  /// **'Camera fault'**
  String get cameraFault;

  /// No description provided for @stable.
  ///
  /// In en, this message translates to:
  /// **'Stable'**
  String get stable;

  /// No description provided for @loaded.
  ///
  /// In en, this message translates to:
  /// **'Item on scale'**
  String get loaded;

  /// No description provided for @needsTare.
  ///
  /// In en, this message translates to:
  /// **'Needs tare'**
  String get needsTare;

  /// No description provided for @notReadyToWeigh.
  ///
  /// In en, this message translates to:
  /// **'Not ready to weigh'**
  String get notReadyToWeigh;

  /// No description provided for @actions.
  ///
  /// In en, this message translates to:
  /// **'Actions'**
  String get actions;

  /// No description provided for @tareHint.
  ///
  /// In en, this message translates to:
  /// **'Tare with the platform empty. Calibrate with a known reference mass.'**
  String get tareHint;

  /// No description provided for @tare.
  ///
  /// In en, this message translates to:
  /// **'Tare (set to zero)'**
  String get tare;

  /// No description provided for @calibrate.
  ///
  /// In en, this message translates to:
  /// **'Calibrate'**
  String get calibrate;

  /// No description provided for @identify.
  ///
  /// In en, this message translates to:
  /// **'Identify (blink light)'**
  String get identify;

  /// No description provided for @testPhoto.
  ///
  /// In en, this message translates to:
  /// **'Take a test photo'**
  String get testPhoto;

  /// No description provided for @commandSent.
  ///
  /// In en, this message translates to:
  /// **'Command sent to the scale'**
  String get commandSent;

  /// No description provided for @calibrateTitle.
  ///
  /// In en, this message translates to:
  /// **'Calibrate the scale'**
  String get calibrateTitle;

  /// No description provided for @calibrateBody.
  ///
  /// In en, this message translates to:
  /// **'Empty the platform and press Tare first. Then place a known reference mass on the platform and enter its weight.'**
  String get calibrateBody;

  /// No description provided for @referenceMass.
  ///
  /// In en, this message translates to:
  /// **'Reference mass (grams, 10–1000)'**
  String get referenceMass;

  /// No description provided for @office.
  ///
  /// In en, this message translates to:
  /// **'Office'**
  String get office;

  /// No description provided for @wifiSignal.
  ///
  /// In en, this message translates to:
  /// **'Wi-Fi signal'**
  String get wifiSignal;

  /// No description provided for @lastSeen.
  ///
  /// In en, this message translates to:
  /// **'Last seen'**
  String get lastSeen;

  /// No description provided for @calibration.
  ///
  /// In en, this message translates to:
  /// **'Calibration'**
  String get calibration;

  /// No description provided for @uncertainty.
  ///
  /// In en, this message translates to:
  /// **'Uncertainty'**
  String get uncertainty;

  /// No description provided for @recentCommands.
  ///
  /// In en, this message translates to:
  /// **'Recent commands'**
  String get recentCommands;

  /// No description provided for @cmdQueued.
  ///
  /// In en, this message translates to:
  /// **'Queued'**
  String get cmdQueued;

  /// No description provided for @cmdSent.
  ///
  /// In en, this message translates to:
  /// **'Sent to scale'**
  String get cmdSent;

  /// No description provided for @cmdDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get cmdDone;

  /// No description provided for @cmdFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed'**
  String get cmdFailed;

  /// No description provided for @cmdExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get cmdExpired;

  /// No description provided for @wpNoReading.
  ///
  /// In en, this message translates to:
  /// **'The scale has not sent a reading yet.'**
  String get wpNoReading;

  /// No description provided for @wpStale.
  ///
  /// In en, this message translates to:
  /// **'The last reading is too old – check the scale\'s Wi-Fi.'**
  String get wpStale;

  /// No description provided for @wpSensorFault.
  ///
  /// In en, this message translates to:
  /// **'Load-cell amplifier not responding – check the HX711 wiring.'**
  String get wpSensorFault;

  /// No description provided for @wpNeedsTare.
  ///
  /// In en, this message translates to:
  /// **'The scale was restarted. Empty the platform and press Tare on the Scale page.'**
  String get wpNeedsTare;

  /// No description provided for @wpUncalibrated.
  ///
  /// In en, this message translates to:
  /// **'The scale is not calibrated.'**
  String get wpUncalibrated;

  /// No description provided for @wpEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing on the platform.'**
  String get wpEmpty;

  /// No description provided for @wpUnstable.
  ///
  /// In en, this message translates to:
  /// **'Reading not stable yet – wait for the letter to settle.'**
  String get wpUnstable;

  /// No description provided for @wpNegative.
  ///
  /// In en, this message translates to:
  /// **'Negative weight – empty the platform and tare.'**
  String get wpNegative;

  /// No description provided for @officesIntro.
  ///
  /// In en, this message translates to:
  /// **'Each office\'s reference point and radius are used to check where scans were made.'**
  String get officesIntro;

  /// No description provided for @referencePoint.
  ///
  /// In en, this message translates to:
  /// **'Reference point'**
  String get referencePoint;

  /// No description provided for @zoneRadius.
  ///
  /// In en, this message translates to:
  /// **'Office zone radius (m)'**
  String get zoneRadius;

  /// No description provided for @serviceRadius.
  ///
  /// In en, this message translates to:
  /// **'Delivery area radius'**
  String get serviceRadius;

  /// No description provided for @provenance.
  ///
  /// In en, this message translates to:
  /// **'Provenance (how the point was measured)'**
  String get provenance;

  /// No description provided for @provenanceHint.
  ///
  /// In en, this message translates to:
  /// **'Required. It is stored with the point and logged.'**
  String get provenanceHint;

  /// No description provided for @provenanceDefault.
  ///
  /// In en, this message translates to:
  /// **'Measured on site {date} with phone GPS, accuracy ± {metres} m'**
  String provenanceDefault(String date, int metres);

  /// No description provided for @useMyLocation.
  ///
  /// In en, this message translates to:
  /// **'Use my location as the reference point'**
  String get useMyLocation;

  /// No description provided for @setReferencePoint.
  ///
  /// In en, this message translates to:
  /// **'Set reference point'**
  String get setReferencePoint;

  /// No description provided for @setReferencePointBody.
  ///
  /// In en, this message translates to:
  /// **'Stand at the entrance of {office}. This position becomes the office\'s reference point:'**
  String setReferencePointBody(String office);

  /// No description provided for @poorAccuracy.
  ///
  /// In en, this message translates to:
  /// **'The location is not precise. Move outside or near a window and try again.'**
  String get poorAccuracy;

  /// No description provided for @officeUpdated.
  ///
  /// In en, this message translates to:
  /// **'Office reference point saved'**
  String get officeUpdated;

  /// No description provided for @registeredItems.
  ///
  /// In en, this message translates to:
  /// **'Registered items'**
  String get registeredItems;

  /// No description provided for @waitingReview.
  ///
  /// In en, this message translates to:
  /// **'Waiting for review'**
  String get waitingReview;

  /// No description provided for @openDrafts.
  ///
  /// In en, this message translates to:
  /// **'Open drafts'**
  String get openDrafts;

  /// No description provided for @itemsByStatus.
  ///
  /// In en, this message translates to:
  /// **'Items by status'**
  String get itemsByStatus;

  /// No description provided for @messagesByState.
  ///
  /// In en, this message translates to:
  /// **'Sender messages by state'**
  String get messagesByState;

  /// No description provided for @reportsOnWeb.
  ///
  /// In en, this message translates to:
  /// **'CSV exports for the evaluation are on the web app\'s Reports page.'**
  String get reportsOnWeb;

  /// No description provided for @auditTarget.
  ///
  /// In en, this message translates to:
  /// **'Record'**
  String get auditTarget;

  /// No description provided for @auditTargetHint.
  ///
  /// In en, this message translates to:
  /// **'Tracking ID, draft ID, device or user name'**
  String get auditTargetHint;

  /// No description provided for @severity.
  ///
  /// In en, this message translates to:
  /// **'Level'**
  String get severity;

  /// No description provided for @allSeverities.
  ///
  /// In en, this message translates to:
  /// **'All levels'**
  String get allSeverities;

  /// No description provided for @noAuditEntries.
  ///
  /// In en, this message translates to:
  /// **'No audit entries'**
  String get noAuditEntries;

  /// No description provided for @account.
  ///
  /// In en, this message translates to:
  /// **'Your account'**
  String get account;

  /// No description provided for @name.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get name;

  /// No description provided for @role.
  ///
  /// In en, this message translates to:
  /// **'Role'**
  String get role;

  /// No description provided for @connection.
  ///
  /// In en, this message translates to:
  /// **'Connection'**
  String get connection;

  /// No description provided for @thisDevice.
  ///
  /// In en, this message translates to:
  /// **'This phone\'s ID'**
  String get thisDevice;

  /// No description provided for @changeServerHint.
  ///
  /// In en, this message translates to:
  /// **'To use a different server, sign out and change it on the sign-in screen.'**
  String get changeServerHint;

  /// No description provided for @offlineData.
  ///
  /// In en, this message translates to:
  /// **'Data on this phone'**
  String get offlineData;

  /// No description provided for @waitingToUpload.
  ///
  /// In en, this message translates to:
  /// **'Scans waiting to upload'**
  String get waitingToUpload;

  /// No description provided for @offlineDataHint.
  ///
  /// In en, this message translates to:
  /// **'Uploaded scans are kept for 14 days so you can check the server\'s answer. Scans waiting to upload are never deleted.'**
  String get offlineDataHint;

  /// No description provided for @clearUploadedHistory.
  ///
  /// In en, this message translates to:
  /// **'Delete uploaded scan history'**
  String get clearUploadedHistory;

  /// No description provided for @historyCleared.
  ///
  /// In en, this message translates to:
  /// **'{count} uploaded scan(s) deleted from this phone'**
  String historyCleared(int count);

  /// No description provided for @cannotSignOutTitle.
  ///
  /// In en, this message translates to:
  /// **'Upload your scans before signing out'**
  String get cannotSignOutTitle;

  /// No description provided for @cannotSignOutBody.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 scan is still on this phone. It can only be uploaded while you are signed in.} other{{count} scans are still on this phone. They can only be uploaded while you are signed in.}}'**
  String cannotSignOutBody(int count);

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @signOutTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign out?'**
  String get signOutTitle;

  /// No description provided for @signOutBody.
  ///
  /// In en, this message translates to:
  /// **'You will need your password to sign in again.'**
  String get signOutBody;

  /// No description provided for @prototypeTitle.
  ///
  /// In en, this message translates to:
  /// **'Research prototype'**
  String get prototypeTitle;

  /// No description provided for @prototypeBody.
  ///
  /// In en, this message translates to:
  /// **'This is a SLIIT research prototype (project J26-IT-372), not an official Sri Lanka Post service. Do not use it with real customer mail unless the trial is approved.'**
  String get prototypeBody;

  /// No description provided for @aboutTitle.
  ///
  /// In en, this message translates to:
  /// **'About this app'**
  String get aboutTitle;

  /// No description provided for @aboutBody.
  ///
  /// In en, this message translates to:
  /// **'PostAssist LK helps postal staff accept, label and track domestic registered letters. Counter officers register letters with assisted address reading and an IoT scale; postmen and hub officers record each handover with the phone\'s location; postmasters review exceptions and sender messages.'**
  String get aboutBody;

  /// No description provided for @version.
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String version(String version);

  /// No description provided for @privacyTitle.
  ///
  /// In en, this message translates to:
  /// **'Privacy notice'**
  String get privacyTitle;

  /// No description provided for @privacyIntro.
  ///
  /// In en, this message translates to:
  /// **'What this app collects and why:'**
  String get privacyIntro;

  /// No description provided for @privacyLocation.
  ///
  /// In en, this message translates to:
  /// **'Location: read once when you save a scan, with its accuracy, age and whether it is simulated. It is never tracked in the background.'**
  String get privacyLocation;

  /// No description provided for @privacyCamera.
  ///
  /// In en, this message translates to:
  /// **'Camera: used only to scan labels and to photograph envelopes at the counter. Photos are sent to the PostAssist server, not stored in the phone\'s gallery.'**
  String get privacyCamera;

  /// No description provided for @privacyStorage.
  ///
  /// In en, this message translates to:
  /// **'On this phone: your sign-in token (encrypted storage) and your scans until they are uploaded, then for 14 days.'**
  String get privacyStorage;

  /// No description provided for @privacyServer.
  ///
  /// In en, this message translates to:
  /// **'Data is sent only to the PostAssist server address entered at sign-in.'**
  String get privacyServer;

  /// No description provided for @privacyAudit.
  ///
  /// In en, this message translates to:
  /// **'Every sign-in, scan and decision is written to an audit log with your username.'**
  String get privacyAudit;

  /// No description provided for @accessibilityTitle.
  ///
  /// In en, this message translates to:
  /// **'Accessibility statement'**
  String get accessibilityTitle;

  /// No description provided for @accessibilityBody.
  ///
  /// In en, this message translates to:
  /// **'Everyone who works at a postal counter or delivers mail should be able to use this app.'**
  String get accessibilityBody;

  /// No description provided for @a11yLanguages.
  ///
  /// In en, this message translates to:
  /// **'Use the app in Sinhala, Tamil or English (Settings → Language).'**
  String get a11yLanguages;

  /// No description provided for @a11yText.
  ///
  /// In en, this message translates to:
  /// **'Text follows your phone\'s font size, up to 200 %.'**
  String get a11yText;

  /// No description provided for @a11yContrast.
  ///
  /// In en, this message translates to:
  /// **'Text and controls meet WCAG 2.2 AA contrast; status is shown with words and icons, never colour alone.'**
  String get a11yContrast;

  /// No description provided for @a11yTargets.
  ///
  /// In en, this message translates to:
  /// **'Buttons and controls are at least 48 × 48 dp.'**
  String get a11yTargets;

  /// No description provided for @a11yScreenReader.
  ///
  /// In en, this message translates to:
  /// **'Works with TalkBack and VoiceOver: fields, buttons and progress are labelled.'**
  String get a11yScreenReader;

  /// No description provided for @standardsTitle.
  ///
  /// In en, this message translates to:
  /// **'Design standards'**
  String get standardsTitle;

  /// No description provided for @standardsBody.
  ///
  /// In en, this message translates to:
  /// **'The interface follows the principles of the Sri Lanka Digital Design System (SLDDS, Ministry of Digital Economy, 2026 draft for public consultation): plain language, the three official languages, mobile-first layouts, consistent components and WCAG 2.2 AA accessibility. It has not been formally assessed or approved by a government body.'**
  String get standardsBody;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'si', 'ta'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'si':
      return AppLocalizationsSi();
    case 'ta':
      return AppLocalizationsTa();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
