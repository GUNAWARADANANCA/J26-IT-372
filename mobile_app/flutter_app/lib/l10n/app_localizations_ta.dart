// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Tamil (`ta`).
class AppLocalizationsTa extends AppLocalizations {
  AppLocalizationsTa([String locale = 'ta']) : super(locale);

  @override
  String get appName => 'PostAssist LK';

  @override
  String get appSubtitle => 'பதிவுத் தபால் ஏற்பு மற்றும் கண்காணிப்பு';

  @override
  String get officialUseStrip =>
      'உத்தியோகபூர்வ பயன்பாடு – அங்கீகரிக்கப்பட்ட தபால் ஊழியர்களுக்கு மட்டும்';

  @override
  String get officialUseTitle => 'உத்தியோகபூர்வ பயன்பாடு';

  @override
  String get officialUseBody =>
      'இந்தச் செயலி அங்கீகரிக்கப்பட்ட தபால் ஊழியர்களுக்கானது. ஒவ்வொரு உள்நுழைவும் பதிவுகளில் செய்யப்படும் ஒவ்வொரு மாற்றமும் பதிவு செய்யப்படும். இது ஒரு ஆய்வு முன்மாதிரி: சோதனை அங்கீகரிக்கப்படாவிட்டால் மாதிரித் தபால்களை மட்டும் பயன்படுத்தவும்.';

  @override
  String get publicServiceStrip => 'PostAssist LK – பதிவுக் கடிதக் கண்காணிப்பு';

  @override
  String get publicServiceTitle => 'கடிதக் கண்காணிப்பு';

  @override
  String get publicServiceBody =>
      'இந்தப் பக்கம் பதிவுக் கடிதத்தின் முன்னேற்றத்தை அனுப்புநருக்குக் காட்டுகிறது. இடங்கள் அலுவலகப் பெயர்களாக மட்டுமே காட்டப்படும்; ஊழியர் பெயர்களும் வரைபட இருப்பிடங்களும் ஒருபோதும் காட்டப்படாது.';

  @override
  String get close => 'மூடு';

  @override
  String get cancel => 'ரத்துசெய்';

  @override
  String get back => 'பின்செல்';

  @override
  String get next => 'அடுத்து';

  @override
  String get done => 'முடிந்தது';

  @override
  String get save => 'சேமி';

  @override
  String get search => 'தேடு';

  @override
  String get retry => 'மீண்டும் முயல்';

  @override
  String get tryAgain => 'மீண்டும் முயலவும்';

  @override
  String get loading => 'ஏற்றப்படுகிறது…';

  @override
  String get saving => 'சேமிக்கப்படுகிறது…';

  @override
  String get optional => 'விருப்பத்தேர்வு';

  @override
  String get thereIsAProblem => 'ஒரு சிக்கல் உள்ளது';

  @override
  String get somethingWentWrong => 'ஏதோ தவறு நடந்துள்ளது';

  @override
  String get errorNetwork =>
      'சேவையகம் பதிலளிக்கவில்லை. தொலைபேசி PostAssist சேவையகம் உள்ள அதே வலையமைப்பில் உள்ளதா, முகவரி சரியானதா என்பதைச் சரிபார்க்கவும்.';

  @override
  String get errorSessionExpired =>
      'உங்கள் அமர்வு முடிந்துவிட்டது. மீண்டும் உள்நுழையவும்.';

  @override
  String get errorForbidden => 'இதைச் செய்ய உங்களுக்கு அனுமதி இல்லை.';

  @override
  String get reason => 'காரணம்';

  @override
  String reasonTooShort(int min) {
    return 'குறைந்தது $min எழுத்துகளை உள்ளிடவும்';
  }

  @override
  String get language => 'மொழி';

  @override
  String get languageHint => 'செயலியின் மொழியைத் தேர்ந்தெடுக்கவும்.';

  @override
  String get usePhoneLanguage => 'தொலைபேசியின் மொழியைப் பயன்படுத்து';

  @override
  String get progress => 'முன்னேற்றம்';

  @override
  String get complete => 'முடிந்தது';

  @override
  String get notComplete => 'முடியவில்லை';

  @override
  String get signInTitle => 'ஊழியர் உள்நுழைவு';

  @override
  String get serverAddress => 'சேவையக முகவரி';

  @override
  String get serverAddressHint =>
      'PostAssist சேவையகம் இயங்கும் கணினி, உதா: http://192.168.1.10:8000';

  @override
  String get testConnection => 'இணைப்பைச் சோதி';

  @override
  String get connectionOk => 'சேவையகம் கிடைத்தது';

  @override
  String get connectionFailed => 'பதில் இல்லை';

  @override
  String get insecureConnectionWarning =>
      'இந்த இணைப்பு மறையாக்கம் செய்யப்படவில்லை (http). மூடிய ஆய்வக வலையமைப்பில் மட்டும் பயன்படுத்தவும்; நேரடிச் சேவை https பயன்படுத்த வேண்டும்.';

  @override
  String get username => 'பயனர் பெயர்';

  @override
  String get password => 'கடவுச்சொல்';

  @override
  String get showPassword => 'கடவுச்சொல்லைக் காட்டு';

  @override
  String get hidePassword => 'கடவுச்சொல்லை மறை';

  @override
  String get signIn => 'உள்நுழைக';

  @override
  String get staffOnlyNotice =>
      'அங்கீகரிக்கப்பட்ட தபால் ஊழியர்களுக்கு. உள்நுழைவுகள் கணக்காய்வுக்காகப் பதிவு செய்யப்படும்.';

  @override
  String get errServerRequired => 'சேவையக முகவரியை உள்ளிடவும்';

  @override
  String get errServerInvalid => 'சேவையக முகவரி செல்லுபடியாகாது';

  @override
  String get errUsernameRequired => 'உங்கள் பயனர் பெயரை உள்ளிடவும்';

  @override
  String get errPasswordRequired => 'உங்கள் கடவுச்சொல்லை உள்ளிடவும்';

  @override
  String get errWrongCredentials => 'பயனர் பெயர் அல்லது கடவுச்சொல் தவறு';

  @override
  String get sessionExpiredTitle => 'அமர்வு முடிந்தது';

  @override
  String get sessionExpiredBody =>
      'பாதுகாப்புக்காக நீங்கள் வெளியேற்றப்பட்டீர்கள். மீண்டும் உள்நுழையவும் – இந்தத் தொலைபேசியில் சேமிக்கப்பட்ட ஸ்கேன்கள் வைக்கப்படும்.';

  @override
  String get trackLetterPublic => 'பதிவுக் கடிதம் அனுப்பினீர்களா?';

  @override
  String get trackLetterPublicHint =>
      'பற்றுச்சீட்டு உள்ள எவரும் கடிதத்தின் முன்னேற்றத்தைப் பார்க்கலாம் – உள்நுழைவு தேவையில்லை.';

  @override
  String get trackALetter => 'கடிதத்தைக் கண்காணி';

  @override
  String get aboutAndPrivacy => 'செயலி பற்றி, தனியுரிமை மற்றும் அணுகல்தன்மை';

  @override
  String get settings => 'அமைப்புகள்';

  @override
  String welcome(String name) {
    return 'வணக்கம், $name';
  }

  @override
  String get groupDaily => 'தினசரி பணிகள்';

  @override
  String get groupSupervision => 'மேற்பார்வை';

  @override
  String get groupSetup => 'அமைப்பு மற்றும் கருவிகள்';

  @override
  String get scanALetter => 'பதிவுக் கடிதத்தை ஸ்கேன் செய்';

  @override
  String get auditFooter =>
      'உள்நுழைவுகளும் பதிவு மாற்றங்களும் கணக்காய்வுக்காகப் பதிவு செய்யப்படும்.';

  @override
  String reviewWaiting(int count) {
    return '$count ஸ்கேன்கள் உங்கள் மீளாய்வுக்காகக் காத்திருக்கின்றன';
  }

  @override
  String get openReviewQueue => 'மீளாய்வு வரிசையைத் திற';

  @override
  String get offlineScansTitle => 'இந்தத் தொலைபேசியில் உள்ள ஸ்கேன்கள்';

  @override
  String get networkAvailable => 'வலையமைப்பு உள்ளது';

  @override
  String get networkOffline =>
      'இணைப்பு இல்லை – ஸ்கேன்கள் இந்தத் தொலைபேசியில் சேமிக்கப்படும்';

  @override
  String pendingCount(int count) {
    return 'பதிவேற்ற $count காத்திருக்கின்றன';
  }

  @override
  String heldCount(int count) {
    return 'நிறுத்திவைக்கப்பட்டவை $count';
  }

  @override
  String rejectedCount(int count) {
    return 'நிராகரிக்கப்பட்டவை $count';
  }

  @override
  String lastUploadFailed(String error) {
    return 'கடைசிப் பதிவேற்றம் தோல்வியடைந்தது: $error';
  }

  @override
  String get lastUploadFailedNetwork =>
      'கடைசிப் பதிவேற்றம் தோல்வி: சேவையகத்துடன் இணைப்பு இல்லை. ஸ்கேன்கள் தானாகப் பதிவேற்றப்படும்.';

  @override
  String get uploadNow => 'இப்போது பதிவேற்று';

  @override
  String get uploading => 'பதிவேற்றப்படுகிறது…';

  @override
  String get taskRegister => 'கடிதத்தைப் பதிவுசெய்';

  @override
  String get taskRegisterHint => 'ஐந்து படிகளில் கருமபீட ஏற்பு';

  @override
  String get taskScan => 'கடிதத்தை ஸ்கேன் செய்';

  @override
  String get taskScanHint =>
      'அனுப்புதல், போக்குவரத்து அல்லது விநியோகத்தைப் பதிவுசெய்';

  @override
  String get taskItems => 'பதிவு செய்யப்பட்ட பொருட்கள்';

  @override
  String get taskItemsHint => 'பொருளைத் தேடி அதன் வரலாற்றைப் பார்';

  @override
  String get taskHistory => 'எனது ஸ்கேன்கள்';

  @override
  String get taskHistoryHint => 'சேமித்த ஸ்கேன்களும் பதிவேற்ற நிலையும்';

  @override
  String get taskReview => 'மீளாய்வு வரிசை';

  @override
  String get taskReviewHint =>
      'நிறுத்திவைத்த ஸ்கேன்களை அங்கீகரி அல்லது நிராகரி';

  @override
  String get taskMessages => 'அனுப்புநருக்கான செய்திகள்';

  @override
  String get taskMessagesHint => 'அனுப்புநர்களுக்கான மின்னஞ்சல், SMS தகவல்கள்';

  @override
  String get taskSummary => 'சுருக்கம்';

  @override
  String get taskSummaryHint =>
      'பொருட்கள், மீளாய்வுகள், செய்திகள் ஒரே பார்வையில்';

  @override
  String get taskAudit => 'கணக்காய்வுப் பதிவு';

  @override
  String get taskAuditHint => 'யார், என்ன, எப்போது செய்தார்கள்';

  @override
  String get taskDevices => 'தராசும் கமராவும்';

  @override
  String get taskDevicesHint =>
      'IoT தராசு நிலை, பூஜ்ஜியமாக்கல், அளவுத்திருத்தம்';

  @override
  String get taskOffices => 'அலுவலகங்களும் வலயங்களும்';

  @override
  String get taskOfficesHint =>
      'இருப்பிடச் சரிபார்ப்புக்கான குறிப்புப் புள்ளிகள்';

  @override
  String get taskTrack => 'கடிதத்தைக் கண்காணி';

  @override
  String get taskTrackHint => 'அனுப்புநர் பார்க்கும் விதம்';

  @override
  String get stAccepted => 'கருமபீடத்தில் ஏற்கப்பட்டது';

  @override
  String get stDispatched => 'அனுப்பப்பட்டது';

  @override
  String get stInTransit => 'போக்குவரத்தில்';

  @override
  String get stAtDestination => 'சேருமிட அலுவலகத்தில்';

  @override
  String get stOutForDelivery => 'விநியோகத்துக்கு எடுத்துச் செல்லப்பட்டது';

  @override
  String get stDeliveryAttempted => 'விநியோக முயற்சி செய்யப்பட்டது';

  @override
  String get stDelivered => 'விநியோகிக்கப்பட்டது';

  @override
  String get stReturnStarted => 'திருப்பி அனுப்புதல் தொடங்கியது';

  @override
  String get stReturnedToSender => 'அனுப்புநருக்குத் திருப்பி அனுப்பப்பட்டது';

  @override
  String get roleAdmin => 'நிர்வாகி';

  @override
  String get rolePostmaster => 'தபால் அதிபர்';

  @override
  String get roleCounter => 'கருமபீட அலுவலர்';

  @override
  String get roleHub => 'பரிமாற்ற மைய அலுவலர்';

  @override
  String get rolePostman => 'தபால்காரர்';

  @override
  String get decAccepted => 'ஏற்கப்பட்டது';

  @override
  String get decAcceptedAfterReview => 'மீளாய்வுக்குப் பின் ஏற்கப்பட்டது';

  @override
  String get decHeld => 'மீளாய்வுக்காக நிறுத்திவைக்கப்பட்டது';

  @override
  String get decRejected => 'நிராகரிக்கப்பட்டது';

  @override
  String get decRejectedAfterReview => 'மீளாய்வுக்குப் பின் நிராகரிக்கப்பட்டது';

  @override
  String get decDuplicate => 'ஏற்கனவே பதிவுசெய்யப்பட்டது';

  @override
  String get decPending => 'பதிவேற்றக் காத்திருக்கிறது';

  @override
  String get locConsistent => 'இருப்பிடம் பொருந்துகிறது';

  @override
  String get locUncertain => 'இருப்பிடம் உறுதியில்லை';

  @override
  String get locMismatch => 'இருப்பிடம் பொருந்தவில்லை';

  @override
  String get locUnlocated => 'இருப்பிடம் அனுப்பப்படவில்லை';

  @override
  String get locNotAssessed => 'இருப்பிடம் சரிபார்க்கப்படவில்லை';

  @override
  String get locDenied =>
      'இருப்பிட அனுமதி மறுக்கப்பட்டது – ஸ்கேன் இருப்பிடம் இல்லாமல் சேமிக்கப்பட்டது';

  @override
  String get locTimeout =>
      'உரிய நேரத்தில் இருப்பிடம் கிடைக்கவில்லை – ஸ்கேன் இருப்பிடம் இல்லாமல் சேமிக்கப்பட்டது';

  @override
  String get locUnavailable =>
      'இருப்பிடச் சேவை அணைக்கப்பட்டுள்ளது அல்லது கிடைக்கவில்லை';

  @override
  String get obQueued => 'வரிசையில்';

  @override
  String get obRetry => 'மீண்டும் முயலக் காத்திருக்கிறது';

  @override
  String get obSending => 'அனுப்பப்படுகிறது';

  @override
  String get obSent => 'அனுப்பப்பட்டது';

  @override
  String get obAmbiguous => 'தெளிவில்லை – சரிபார்க்கவும்';

  @override
  String get obFailed => 'தோல்வி';

  @override
  String get obResolved => 'கைமுறையாகத் தீர்க்கப்பட்டது';

  @override
  String get channelNone => 'செய்திகள் இல்லை (பற்றுச்சீட்டு மட்டும்)';

  @override
  String get channelEmail => 'மின்னஞ்சல்';

  @override
  String get channelSms => 'SMS (நுழைவாயில் அங்கீகரிக்கப்பட்டால் மட்டும்)';

  @override
  String get sevInfo => 'தகவல்';

  @override
  String get sevWarning => 'எச்சரிக்கை';

  @override
  String get sevSecurity => 'பாதுகாப்பு';

  @override
  String get scanLabel => 'லேபலை ஸ்கேன் செய்';

  @override
  String get scanInstruction =>
      'கமராவை லேபலில் உள்ள பார்கோட் அல்லது QR குறியீட்டை நோக்கிக் காட்டவும்';

  @override
  String get torch => 'டார்ச்';

  @override
  String get cameraPermissionNeeded =>
      'லேபல்களை ஸ்கேன் செய்ய கமரா அனுமதி தேவை. தொலைபேசி அமைப்புகளில் அனுமதிக்கவும், அல்லது கீழே இலக்கத்தைத் தட்டச்சு செய்யவும்.';

  @override
  String get cameraUnavailable =>
      'கமராவைத் தொடங்க முடியவில்லை. கீழே இலக்கத்தைத் தட்டச்சு செய்யவும்.';

  @override
  String get notAPostAssistCode =>
      'இந்தக் குறியீடு PostAssist லேபல் அல்ல. மீண்டும் முயலவும் அல்லது இலக்கத்தைத் தட்டச்சு செய்யவும்.';

  @override
  String get typeTrackingId =>
      'லேபல் சேதமடைந்ததா? கண்காணிப்பு இலக்கத்தைத் தட்டச்சு செய்யவும்';

  @override
  String get typeTrackingIdHint => 'அது பார்கோடின் கீழே அச்சிடப்பட்டுள்ளது.';

  @override
  String get useTypedId => 'தட்டச்சு செய்த இலக்கத்தைப் பயன்படுத்து';

  @override
  String get errTrackingIdInvalid =>
      'இது செல்லுபடியான கண்காணிப்பு இலக்கம் அல்ல – ஒவ்வொரு எழுத்தையும் சரிபார்க்கவும் (உதா: PA-DEMO-7K3M9Q2XRH4)';

  @override
  String get recordStatus => 'நிலையைப் பதிவுசெய்';

  @override
  String get scanSaved => 'ஸ்கேன் சேமிக்கப்பட்டது';

  @override
  String get lookingUpItem => 'பொருள் தேடப்படுகிறது…';

  @override
  String get offlineModeTitle => 'இணைப்பின்றி இயங்குகிறது';

  @override
  String get offlineModeBody =>
      'பொருளின் விவரங்களை ஏற்ற முடியவில்லை. நீங்கள் ஸ்கேனைப் பதிவுசெய்யலாம்; பதிவேற்றப்படும்போது சேவையகம் அதைச் சரிபார்க்கும்.';

  @override
  String get destinationOffice => 'சேருமிட அலுவலகம்';

  @override
  String get destinationTown => 'சேருமிட நகரம்';

  @override
  String get assignedPostman => 'ஒதுக்கப்பட்ட தபால்காரர்';

  @override
  String get deliverTo => 'விநியோகிக்க வேண்டியவர்';

  @override
  String get nothingToRecordTitle => 'பதிவு செய்ய எதுவும் இல்லை';

  @override
  String get nothingToRecordBody =>
      'இந்தப் பொருளுக்கு இப்போது புதிய நிலையைப் பதிவுசெய்ய முடியாது.';

  @override
  String get newStatus => 'புதிய நிலை';

  @override
  String get newStatusHint =>
      'இந்தப் பொருளுக்கு நீங்கள் பதிவுசெய்யக்கூடிய நிலைகள் மட்டும் காட்டப்படும்.';

  @override
  String get reasonTitle => 'காரணம்';

  @override
  String get reasonHint => 'கடிதத்தை ஏன் விநியோகிக்க முடியவில்லை.';

  @override
  String get reasonNotAvailable => 'பெறுநர் இல்லை';

  @override
  String get reasonClosed => 'இடம் மூடப்பட்டுள்ளது';

  @override
  String get reasonAddressNotFound => 'முகவரி கண்டுபிடிக்கப்படவில்லை';

  @override
  String get reasonRefused => 'பெறுநர் மறுத்தார்';

  @override
  String get reasonUnsafe => 'பாதுகாப்பற்ற அணுகல்';

  @override
  String get otherReason => 'உங்கள் சொந்த வார்த்தைகளில் காரணம்';

  @override
  String get ackTitle => 'விநியோக ஒப்புகை';

  @override
  String get ackHint =>
      'விநியோகிக்கப்பட்ட கடிதத்துக்கு அவசியம்: பெறுநர் எவ்வாறு ஒப்புக்கொண்டார்?';

  @override
  String get ackSignature => 'கையொப்பம்';

  @override
  String get ackNameOnly => 'பெயர் மட்டும்';

  @override
  String get ackSheet => 'விநியோகத் தாள்';

  @override
  String get receivedBy => 'பெற்றவரின் பெயர்';

  @override
  String get relationship => 'முகவரிதாரருடனான உறவு';

  @override
  String get relationshipHint =>
      'உதா: தானே, வாழ்க்கைத் துணை, பாதுகாப்பு அலுவலர்';

  @override
  String get sheetNumber => 'விநியோகத் தாள் / பக்க இலக்கம்';

  @override
  String get signature => 'பெறுநரின் கையொப்பம்';

  @override
  String get signatureHint =>
      'பெட்டிக்குள் கையொப்பமிடுமாறு பெறுநரிடம் கேளுங்கள்.';

  @override
  String get signatureArea => 'கையொப்பப் பகுதி. ஒரு விரலால் கையொப்பமிடவும்.';

  @override
  String get signHere => 'இங்கே விரலால் கையொப்பமிடவும்';

  @override
  String get clearSignature => 'கையொப்பத்தை அழி';

  @override
  String get noAckPossible => 'ஒப்புகை பெற முடியவில்லை';

  @override
  String get noAckPossibleHint =>
      'அங்கீகரிக்கப்பட்ட விதிவிலக்கை விவரிக்கவும். ஸ்கேன் தபால் அதிபருக்காக நிறுத்திவைக்கப்படும்.';

  @override
  String get exceptionReason => 'விதிவிலக்குக் காரணம்';

  @override
  String get notes => 'குறிப்புகள்';

  @override
  String get locationNotice =>
      'நீங்கள் சேமி என்பதை அழுத்தும்போது மட்டும் உங்கள் இருப்பிடம் ஒருமுறை படிக்கப்படும். தபால் அதிபர் அதைச் சான்றின் தரமாகப் பார்க்கிறார் – அது விநியோகத்துக்கான நிரூபணம் அல்ல.';

  @override
  String get saveScan => 'ஸ்கேனைச் சேமி';

  @override
  String get readingLocation => 'இருப்பிடம் படிக்கப்படுகிறது…';

  @override
  String get errChooseStatus => 'புதிய நிலையைத் தேர்ந்தெடுக்கவும்';

  @override
  String get errReasonRequired =>
      'காரணத்தைத் தேர்ந்தெடுக்கவும் அல்லது தட்டச்சு செய்யவும்';

  @override
  String get errExceptionTooShort =>
      'விதிவிலக்கைக் குறைந்தது 5 எழுத்துகளில் விவரிக்கவும்';

  @override
  String get errRecipientNameRequired =>
      'கடிதத்தைப் பெற்றவரின் பெயரை உள்ளிடவும்';

  @override
  String get errSignatureRequired => 'கையொப்பமிடுமாறு பெறுநரிடம் கேளுங்கள்';

  @override
  String get errSheetRequired =>
      'விநியோகத் தாள் அல்லது பக்க இலக்கத்தை உள்ளிடவும்';

  @override
  String get outcomeAcceptedTitle => 'ஏற்கப்பட்டது';

  @override
  String get outcomeAcceptedBody =>
      'சேவையகம் ஸ்கேனை ஏற்று நிலையைப் புதுப்பித்தது.';

  @override
  String get outcomeDuplicateTitle => 'ஏற்கனவே பதிவுசெய்யப்பட்டது';

  @override
  String get outcomeDuplicateBody =>
      'இந்த ஸ்கேன் ஏற்கனவே சேவையகத்தில் உள்ளது. எதுவும் இருமுறை சேர்க்கப்படவில்லை.';

  @override
  String get outcomeHeldTitle =>
      'சேமிக்கப்பட்டது – மீளாய்வுக்காக நிறுத்திவைக்கப்பட்டது';

  @override
  String get outcomeHeldBody =>
      'ஸ்கேன் சேமிக்கப்பட்டது, ஆனால் தபால் அதிபர் அங்கீகரித்த பின்னரே நிலை மாறும்.';

  @override
  String get outcomeRejectedTitle => 'ஏற்கப்படவில்லை';

  @override
  String get outcomeRejectedBody => 'சேவையகம் இந்த ஸ்கேனை ஏற்கவில்லை:';

  @override
  String get outcomePendingTitle => 'இந்தத் தொலைபேசியில் சேமிக்கப்பட்டது';

  @override
  String get outcomePendingBody =>
      'வலையமைப்பு மீண்டும் கிடைக்கும்போது அது தானாகப் பதிவேற்றப்படும்.';

  @override
  String get statusRecorded => 'பதிவுசெய்யப்பட்ட நிலை';

  @override
  String get locationEvidence => 'இருப்பிடச் சான்று';

  @override
  String locationQuality(int metres, int seconds) {
    return '± $metres மீ, $seconds வினாடிகள் பழையது';
  }

  @override
  String get mockLocationWarning =>
      'தொலைபேசி போலியான இருப்பிடத்தைத் தெரிவித்தது. ஸ்கேன் மீளாய்வுக்காக நிறுத்திவைக்கப்படும்.';

  @override
  String get scanNext => 'அடுத்த கடிதத்தை ஸ்கேன் செய்';

  @override
  String get scanAnother => 'வேறு கடிதத்தை ஸ்கேன் செய்';

  @override
  String get itemNotFoundTitle => 'பொருள் கிடைக்கவில்லை';

  @override
  String get notAllowedTitle => 'இந்தப் பொருளை நீங்கள் ஸ்கேன் செய்ய முடியாது';

  @override
  String get historyIntro =>
      'ஸ்கேன்கள் முதலில் இந்தத் தொலைபேசியில் சேமிக்கப்பட்டு, வலையமைப்பு உள்ளபோது பதிவேற்றப்படும். பதிவேற்றக் காத்திருக்கும் ஸ்கேன்கள் ஒருபோதும் நீக்கப்படாது.';

  @override
  String get noScansYet => 'இந்தத் தொலைபேசியில் இன்னும் ஸ்கேன்கள் இல்லை';

  @override
  String waitingForUser(String user) {
    return '$user உள்நுழையும் வரை காத்திருக்கிறது';
  }

  @override
  String retryPending(int attempts) {
    return 'பதிவேற்றம் முடியவில்லை – $attempts முயற்சி(கள்), மீண்டும் முயலும்';
  }

  @override
  String get trackIntro =>
      'அனுப்புநர்கள் தங்கள் பற்றுச்சீட்டில் உள்ள QR குறியீடு அல்லது கண்காணிப்பு இலக்கம் மற்றும் அணுகல் குறியீட்டைக் கொண்டு பதிவுக் கடிதத்தைக் கண்காணிக்கலாம்.';

  @override
  String get scanReceiptQr => 'பற்றுச்சீட்டின் QR குறியீட்டை ஸ்கேன் செய்';

  @override
  String get scanReceipt => 'பற்றுச்சீட்டை ஸ்கேன் செய்';

  @override
  String get scanReceiptInstruction =>
      'கமராவை அனுப்புநரின் பற்றுச்சீட்டில் உள்ள QR குறியீட்டை நோக்கிக் காட்டவும்';

  @override
  String get orTypeDetails =>
      'அல்லது பற்றுச்சீட்டில் உள்ள விவரங்களைத் தட்டச்சு செய்யவும்';

  @override
  String get trackingId => 'கண்காணிப்பு இலக்கம்';

  @override
  String get trackingIdHint =>
      'பார்கோடின் கீழ் அச்சிடப்பட்டுள்ளது, உதா: PA-DEMO-7K3M9Q2XRH4';

  @override
  String get accessCode => 'அணுகல் குறியீடு';

  @override
  String get accessCodeHint =>
      'பற்றுச்சீட்டில் உள்ள கண்காணிப்பு இணைப்பின் பகுதி (#t= க்குப் பின்)';

  @override
  String get errAccessCodeRequired =>
      'பற்றுச்சீட்டில் உள்ள அணுகல் குறியீட்டை உள்ளிடவும்';

  @override
  String get showStatus => 'நிலையைக் காட்டு';

  @override
  String get trackNotFoundTitle => 'கண்காணிப்புப் பதிவு எதுவும் கிடைக்கவில்லை';

  @override
  String get trackNotFoundBody =>
      'பற்றுச்சீட்டில் உள்ள கண்காணிப்பு இலக்கத்தையும் அணுகல் குறியீட்டையும் சரிபார்க்கவும். உங்கள் பாதுகாப்புக்காக எது தவறு என்பதை நாங்கள் கூறுவதில்லை.';

  @override
  String get acceptedOn => 'ஏற்ற திகதி';

  @override
  String get fromOffice => 'அனுப்பிய அலுவலகம்';

  @override
  String get history => 'வரலாறு';

  @override
  String syncedLater(String time) {
    return 'பின்னர் பதிவேற்றப்பட்டது, $time';
  }

  @override
  String get historyOnly => 'வரலாற்றில் மட்டும் வைக்கப்பட்டது';

  @override
  String get trackPrivacyNotice =>
      'அங்கீகரிக்கப்பட்ட ஊழியர்கள் கடிதத்தை ஸ்கேன் செய்யும்போது நிலை பதிவாகும். இடங்கள் அலுவலகப் பெயர்கள் மட்டுமே; ஸ்கேனின் இருப்பிடம் விநியோகத்துக்கான நிரூபணம் அல்ல.';

  @override
  String get intakeIntro =>
      'பதிவுக் கடிதத்தை ஐந்து படிகளில் பதிவுசெய்யவும்: புகைப்படம், முகவரிகள், உறுதிப்படுத்தல், நிறுத்தல், கட்டணம்.';

  @override
  String get registerNewLetter => 'புதிய கடிதத்தைப் பதிவுசெய்';

  @override
  String get ocrUnavailableTitle => 'முகவரி வாசிப்பு கிடைக்கவில்லை';

  @override
  String get ocrUnavailableBody =>
      'சேவையகத்தில் OCR இயந்திரமோ கையெழுத்து மாதிரியோ நிறுவப்படவில்லை. அதற்குப் பதிலாக முகவரியைத் தட்டச்சு செய்யவும் அல்லது ஒட்டவும்.';

  @override
  String get draftsInProgress => 'நடைபெறும் பதிவுகள்';

  @override
  String get noDrafts => 'நடைபெறும் பதிவுகள் இல்லை';

  @override
  String get noDraftsHint =>
      'தொடங்க \'புதிய கடிதத்தைப் பதிவுசெய்\' என்பதை அழுத்தவும்.';

  @override
  String stepsDone(int done, int total) {
    return '$total படிகளில் $done';
  }

  @override
  String get noAddressYet => 'இன்னும் முகவரி இல்லை';

  @override
  String startedAt(String time) {
    return 'தொடங்கியது $time';
  }

  @override
  String get continueDraft => 'தொடர்';

  @override
  String get deleteDraft => 'வரைவை நீக்கு';

  @override
  String get deleteDraftTitle => 'இந்த வரைவை நீக்கவா?';

  @override
  String get deleteDraftBody =>
      'வரைவு ரத்துசெய்யப்பட்டு அதன் தராசு அளவீடு விடுவிக்கப்படும். இதை மீளமைக்க முடியாது.';

  @override
  String get registerALetter => 'கடிதத்தைப் பதிவுசெய்';

  @override
  String get moreActions => 'மேலும் செயல்கள்';

  @override
  String get clearForm => 'படிவத்தை அழி';

  @override
  String get clearFormTitle => 'படிவத்தை அழிக்கவா?';

  @override
  String get clearFormBody =>
      'பெறுநர், அனுப்புநர், சேருமிட அலுவலகம், தொடர்பு விவரங்களை அழிக்கவா?';

  @override
  String get openingDraft => 'வரைவு திறக்கப்படுகிறது…';

  @override
  String get draft => 'வரைவு';

  @override
  String get unsavedChanges => 'சேமிக்கப்படாத மாற்றங்கள்';

  @override
  String get allChangesSaved => 'அனைத்து மாற்றங்களும் சேமிக்கப்பட்டன';

  @override
  String stepOf(int step, int total) {
    return '$total இல் படி $step';
  }

  @override
  String get stepPhoto => 'புகைப்படம்';

  @override
  String get stepAddresses => 'முகவரிகள்';

  @override
  String get stepConfirm => 'உறுதி';

  @override
  String get stepWeigh => 'நிறை';

  @override
  String get stepPay => 'கட்டணம்';

  @override
  String get alreadyAcceptedTitle => 'ஏற்கனவே ஏற்கப்பட்டது';

  @override
  String alreadyAcceptedBody(String id) {
    return 'இந்த வரைவு பதிவுப் பொருள் $id ஆக மாறியது.';
  }

  @override
  String get openReceipt => 'லேபலையும் பற்றுச்சீட்டையும் திற';

  @override
  String get draftClosedTitle => 'வரைவு மூடப்பட்டது';

  @override
  String get draftClosedBody =>
      'இந்த வரைவு ரத்துசெய்யப்பட்டது. கருமபீடத் திரையிலிருந்து புதிய பதிவைத் தொடங்கவும்.';

  @override
  String get stepPhotoTitle => 'படி 1/5: உறையைப் புகைப்படம் எடுக்கவும்';

  @override
  String get nextPhoto =>
      'உறையைப் புகைப்படம் எடுத்து \'முகவரியைப் படி\' என்பதை அழுத்தவும். முகவரியைத் தட்டச்சும் செய்யலாம்.';

  @override
  String get captureMode => 'பிடிப்பு முறை (ஆய்வு)';

  @override
  String get captureModeHint =>
      'P1 உதவி முறை. B1, B0 மதிப்பீட்டுக்கான அடிப்படைகள்.';

  @override
  String get modeP1 => 'P1 – உதவியுடன் பிடிப்பு (பரிந்துரைக்கப்பட்டது)';

  @override
  String get modeB1 => 'B1 – அடிப்படை OCR + விதிகள்';

  @override
  String get modeB0 => 'B0 – கைமுறை உள்ளீடு (அடிப்படை)';

  @override
  String get envelopePhoto => 'உறையின் புகைப்படம்';

  @override
  String get envelopePhotoHint =>
      'உறையின் முன்பக்கத்தைச் சமதளமாகவும் நல்ல வெளிச்சத்திலும் புகைப்படம் எடுக்கவும்.';

  @override
  String get photoOptionalB0 => 'கைமுறை உள்ளீட்டில் (B0) விருப்பத்தேர்வு.';

  @override
  String get takePhoto => 'புகைப்படம் எடு';

  @override
  String get chooseFromGallery => 'புகைப்படத்தைத் தேர்ந்தெடு';

  @override
  String get captureFromScale => 'தராசு கமராவிலிருந்து எடு';

  @override
  String get noPhotoYet => 'இன்னும் புகைப்படம் இல்லை';

  @override
  String get noPhotoYetHint => 'உறையின் முன்பக்கத்தைப் புகைப்படம் எடுக்கவும்.';

  @override
  String get photoNotLoaded => 'புகைப்படத்தைக் காட்ட முடியவில்லை.';

  @override
  String get rotateLeft => 'இடப்புறம் சுழற்று';

  @override
  String get rotateRight => 'வலப்புறம் சுழற்று';

  @override
  String get photoQualityTitle => 'புகைப்படத் தரம்';

  @override
  String get qLowResolution => 'புகைப்படம் மிகச் சிறியது – அருகில் செல்லவும்.';

  @override
  String get qBlurry =>
      'புகைப்படம் மங்கலாக உள்ளது – தொலைபேசியை அசையாமல் பிடித்து மீண்டும் எடுக்கவும்.';

  @override
  String get qTooDark =>
      'புகைப்படம் மிக இருட்டாக உள்ளது – வெளிச்சம் சேர்க்கவும்.';

  @override
  String get qTooBright => 'புகைப்படம் மிகப் பிரகாசமாக உள்ளது.';

  @override
  String get qLowContrast => 'எழுத்தின் வேறுபாடு குறைவு.';

  @override
  String get qGlare =>
      'உறையில் கண்கூசும் ஒளி உள்ளது – சாய்க்கவும் அல்லது ஃபிளாஷை அணைக்கவும்.';

  @override
  String get readAddressTitle => 'முகவரியைப் படி';

  @override
  String get readAddressHint =>
      'சேவையகம் புகைப்படத்தைப் படித்துப் புலங்களைப் பரிந்துரைக்கும். படி 2 இல் நீங்கள் அவற்றைச் சரிபார்ப்பீர்கள்.';

  @override
  String get readFor => 'யாருடைய முகவரியைப் படிக்க வேண்டும்';

  @override
  String get recipient => 'பெறுநர்';

  @override
  String get sender => 'அனுப்புநர்';

  @override
  String get handwriting => 'கையெழுத்து';

  @override
  String get writingAuto => 'தானியங்கு';

  @override
  String get writingHand => 'கையால் எழுதியது';

  @override
  String get writingPrinted => 'அச்சிடப்பட்டது';

  @override
  String get addressLanguage => 'முகவரியின் மொழி';

  @override
  String get detectAutomatically => 'தானாகக் கண்டறி';

  @override
  String get readAddress => 'முகவரியைப் படி';

  @override
  String get typeOrPaste => 'முகவரியைத் தட்டச்சு செய்யவும் அல்லது ஒட்டவும்';

  @override
  String get typeOrPasteHint =>
      'புகைப்படம் இல்லாதபோது அல்லது வாசிப்பான் படிக்க முடியாதபோது இதைப் பயன்படுத்தவும்.';

  @override
  String get fillFromText => 'உரையிலிருந்து புலங்களை நிரப்பு';

  @override
  String get readResultTitle => 'வாசிப்பான் கண்டறிந்தவை';

  @override
  String fieldConfidence(int percent) {
    return 'புல நம்பகத்தன்மை $percent %';
  }

  @override
  String get noFlags => 'குறிக்கப்பட்ட புலங்கள் இல்லை';

  @override
  String fieldsToCheck(int count) {
    return 'சரிபார்க்க $count புலங்கள்';
  }

  @override
  String get handwritingModel => 'கையெழுத்து மாதிரி';

  @override
  String get printedTextReader => 'அச்சு உரை வாசிப்பான்';

  @override
  String get readResultNext =>
      'வெற்றுப் புலங்கள் இந்த முடிவிலிருந்து நிரப்பப்பட்டன. அவற்றைச் சரிபார்க்க அடுத்த படிக்குச் செல்லவும்.';

  @override
  String get stepAddressesTitle => 'படி 2/5: முகவரிகளைச் சரிபார்க்கவும்';

  @override
  String get nextAddresses =>
      'ஒவ்வொரு புலத்தையும் உறையுடன் ஒப்பிடவும். தவறானதைத் திருத்தவும்.';

  @override
  String get recipientTo => 'பெறுநர் (க்கு)';

  @override
  String get recipientHint =>
      'கடிதம் யாருக்கு முகவரியிடப்பட்டுள்ளது. பெயரும் தபால் நகரமும் தேவை.';

  @override
  String get senderFrom => 'அனுப்புநர் (இடமிருந்து)';

  @override
  String get senderHint =>
      'கடிதத்தை அனுப்புபவர் (பற்றுச்சீட்டில் அச்சிடப்படும்).';

  @override
  String get useAllSuggestions => 'அனைத்துப் பரிந்துரைகளையும் பயன்படுத்து';

  @override
  String get confidenceLegend =>
      'சதவீதங்கள் வாசிப்பானின் நம்பகத்தன்மையைக் காட்டுகின்றன. சிவப்பில் குறிக்கப்பட்ட புலங்களைக் கவனமாகப் பாருங்கள்.';

  @override
  String get fName => 'பெயர்';

  @override
  String get fHouse => 'வீடு / அலகு இலக்கம்';

  @override
  String get fStreet => 'வீதி / சாலை';

  @override
  String get fLocality => 'கிராமம் / பகுதி';

  @override
  String get fCity => 'தபால் நகரம்';

  @override
  String get fPostcode => 'அஞ்சல் குறியீடு';

  @override
  String get fRegion => 'மாவட்டம் / மாகாணம்';

  @override
  String modelConfidence(int percent) {
    return 'வாசிப்பான் நம்பகத்தன்மை $percent சதவீதம்';
  }

  @override
  String get lowConfidenceCheck =>
      'குறைந்த நம்பகத்தன்மை – உறையுடன் சரிபார்க்கவும்';

  @override
  String suggestedValue(String value) {
    return 'பரிந்துரை: $value';
  }

  @override
  String get use => 'பயன்படுத்து';

  @override
  String postcodeDerived(String postcode) {
    return 'நகரத்திலிருந்து அஞ்சல் குறியீடு $postcode பெறலாம். பயன்படுத்தும் முன் சரிபார்க்கவும்.';
  }

  @override
  String get useIt => 'அதைப் பயன்படுத்து';

  @override
  String get townPostcodeOk =>
      'நகரமும் அஞ்சல் குறியீடும் பெயர்ப்பட்டியலுடன் பொருந்துகின்றன.';

  @override
  String get townPostcodeCheck => 'நகரம், அஞ்சல் குறியீடு சரிபார்ப்பு';

  @override
  String get townPostcodeMismatch => 'அஞ்சல் குறியீடு வேறு நகரத்துக்குரியது.';

  @override
  String get townUnknown => 'நகரம் குறிப்புப் பட்டியலில் இல்லை.';

  @override
  String get postcodeUnknown => 'அஞ்சல் குறியீடு குறிப்புப் பட்டியலில் இல்லை.';

  @override
  String expectedValues(String values) {
    return 'எதிர்பார்க்கப்படுவது: $values';
  }

  @override
  String get stepConfirmTitle => 'படி 3/5: விவரங்களை உறுதிப்படுத்தவும்';

  @override
  String get nextConfirm =>
      'சேருமிட அலுவலகத்தையும் அனுப்புநருக்குத் தகவல் அனுப்பும் முறையையும் தேர்ந்தெடுத்து உறுதிப்படுத்தவும்.';

  @override
  String get destinationOfficeHint =>
      'பெறுநரின் முகவரிக்கு விநியோகிக்கும் தபால் அலுவலகம்.';

  @override
  String get deliveryOffice => 'விநியோக அலுவலகம்';

  @override
  String get choose => 'தேர்ந்தெடு';

  @override
  String get senderUpdates => 'அனுப்புநருக்கான தகவல்கள்';

  @override
  String get senderUpdatesHint =>
      'நிலை மாறும்போது அனுப்புநருக்கு விருப்பச் செய்திகள்.';

  @override
  String get sendUpdatesBy => 'நிலைத் தகவல்களை அனுப்பும் வழி';

  @override
  String get senderEmail => 'அனுப்புநரின் மின்னஞ்சல்';

  @override
  String get senderMobile => 'அனுப்புநரின் கைபேசி இலக்கம்';

  @override
  String get mobileFormat => 'வடிவம்: 07XXXXXXXX';

  @override
  String get messageLanguage => 'செய்தியின் மொழி';

  @override
  String get whichUpdates => 'எந்தத் தகவல்கள்';

  @override
  String get updatesKey =>
      'முக்கியத் தகவல்கள் மட்டும் (ஏற்பு, விநியோகத்துக்கு எடுத்துச் செல்லல், விநியோகம், சிக்கல்கள்)';

  @override
  String get updatesAll => 'ஏற்கப்பட்ட ஒவ்வொரு ஸ்கேனும்';

  @override
  String get smsGatewayNote =>
      'சோதனைக்கு SMS நுழைவாயில் அங்கீகரிக்கப்பட்டிருந்தால் மட்டுமே SMS அனுப்பப்படும்.';

  @override
  String detailsConfirmedBy(String user) {
    return '$user விவரங்களை உறுதிப்படுத்தினார்';
  }

  @override
  String reviewStats(int suggested, int kept, int corrected, int typed) {
    return 'பரிந்துரை $suggested · வைத்தவை $kept · திருத்தியவை $corrected · தட்டச்சு $typed';
  }

  @override
  String get reconfirmNeeded =>
      'உறுதிப்படுத்திய பின் விவரங்களை மாற்றினீர்கள். மீண்டும் உறுதிப்படுத்தவும்.';

  @override
  String get confirmDetails =>
      'உறையைச் சரிபார்த்தேன் – விவரங்களை உறுதிப்படுத்து';

  @override
  String get confirmDetailsHint =>
      'ஒவ்வொரு புலத்தையும் உறையுடன் ஒப்பிட்ட பின்னரே உறுதிப்படுத்தவும்.';

  @override
  String errPartyName(String party) {
    return '$party: பெயரை உள்ளிடவும்';
  }

  @override
  String errPartyCity(String party) {
    return '$party: தபால் நகரத்தை உள்ளிடவும்';
  }

  @override
  String errPartyAddress(String party) {
    return '$party: வீட்டு இலக்கம், வீதி அல்லது கிராமத்தை உள்ளிடவும்';
  }

  @override
  String get errDestinationRequired => 'சேருமிட அலுவலகத்தைத் தேர்ந்தெடுக்கவும்';

  @override
  String get errEmailInvalid =>
      'செல்லுபடியான மின்னஞ்சல் முகவரியை உள்ளிடவும், உதா: name@example.com';

  @override
  String get errPhoneInvalid =>
      'இலங்கைக் கைபேசி இலக்கத்தை உள்ளிடவும், உதா: 0771234567';

  @override
  String get stepWeighTitle => 'படி 4/5: கடிதத்தை நிறுக்கவும்';

  @override
  String get nextWeigh =>
      'கடிதத்தைத் தராசில் வைக்கவும். அளவீடு நிலையானதும் \'இந்த நிறையைப் பயன்படுத்து\' என்பதை அழுத்தவும்.';

  @override
  String weightRecorded(String weight) {
    return 'பதிவுசெய்த நிறை: $weight';
  }

  @override
  String weightFromScale(String device, String uncertainty) {
    return 'தராசு $device இலிருந்து, நிச்சயமின்மை ± $uncertainty கி';
  }

  @override
  String weightManual(String instrument) {
    return 'கைமுறையாக உள்ளிடப்பட்டது – $instrument';
  }

  @override
  String get iotScale => 'IoT தராசு';

  @override
  String get iotScaleHint =>
      'கடிதத்தைத் தராசில் வைத்து அளவீடு நிலையாகும் வரை காத்திருக்கவும்.';

  @override
  String get noScaleForOffice =>
      'உங்கள் அலுவலகத்துக்கு IoT தராசு பதிவுசெய்யப்படவில்லை. கீழே நிறையைக் கைமுறையாக உள்ளிடவும்.';

  @override
  String get scale => 'தராசு';

  @override
  String get noReading => 'அளவீடு இல்லை';

  @override
  String get currentReading => 'தற்போதைய அளவீடு';

  @override
  String get stableReady => 'நிலையானது – தயார்';

  @override
  String get settling => 'நிலைபெறுகிறது…';

  @override
  String spread(String grams) {
    return 'மாறுபாடு $grams கி';
  }

  @override
  String get useThisWeight => 'இந்த நிறையைப் பயன்படுத்து';

  @override
  String get manualWeightTitle => 'நிறையைக் கைமுறையாக உள்ளிடு';

  @override
  String get manualWeightHint =>
      'IoT தராசைப் பயன்படுத்த முடியாதபோது மட்டும். இது கணக்காய்வுக்காகப் பதிவுசெய்யப்படும்.';

  @override
  String get weightGrams => 'நிறை (கிராம்)';

  @override
  String get instrument => 'பயன்படுத்திய தராசு';

  @override
  String get instrumentHint => 'உதா: அங்கீகரிக்கப்பட்ட கருமபீடத் தராசு இல. 2';

  @override
  String get manualReasonHint => 'IoT தராசை ஏன் பயன்படுத்த முடியவில்லை';

  @override
  String get recordManualWeight => 'கைமுறை நிறையைப் பதிவுசெய்';

  @override
  String get errGrams =>
      'நிறையைக் கிராமில் உள்ளிடவும் (0 ஐ விட அதிகம், 5000 வரை)';

  @override
  String get errInstrument => 'பயன்படுத்திய தராசை உள்ளிடவும்';

  @override
  String get errManualReason =>
      'IoT தராசு ஏன் பயன்படுத்தப்படவில்லை எனக் கூறவும் (குறைந்தது 5 எழுத்துகள்)';

  @override
  String get stepPayTitle => 'படி 5/5: கட்டணமும் ஏற்பும்';

  @override
  String get nextPay =>
      'கட்டணத்தைக் கணக்கிட்டு, கொடுப்பனவைப் பெற்று, கடிதத்தை ஏற்கவும்.';

  @override
  String get extraServices => 'கூடுதல் சேவைகள்';

  @override
  String get adviceOfDelivery => 'விநியோக அறிவிப்பு';

  @override
  String get adviceOfDeliveryHint =>
      'அனுப்புநருக்குக் கையொப்பமிட்ட விநியோக அட்டை கிடைக்கும் (கூடுதல் கட்டணம்).';

  @override
  String get insuredValue => 'காப்புறுதி மதிப்பு (ரூ.)';

  @override
  String get insuredValueHint =>
      'அனுப்புநர் காப்புறுதி விரும்பினால், உள்ளடக்கத்தின் அறிவிக்கப்பட்ட மதிப்பு';

  @override
  String get errInsuredValue =>
      'காப்புறுதி மதிப்பை ரூபாய் எண்ணாக உள்ளிடவும், அல்லது காலியாக விடவும்';

  @override
  String get calculateCharge => 'கட்டணத்தைக் கணக்கிடு';

  @override
  String get weighFirst => 'முதலில் படி 4 இல் நிறையைப் பதிவுசெய்யவும்.';

  @override
  String get reweighRequired => 'மீண்டும் நிறுக்க வேண்டும்';

  @override
  String get cannotQuote => 'கட்டணத்தைக் கணக்கிட முடியவில்லை';

  @override
  String get charge => 'கட்டணம்';

  @override
  String tariffLine(String version, String weight, String uncertainty) {
    return 'கட்டண அட்டவணை $version · நிறை $weight கி ± $uncertainty கி';
  }

  @override
  String get tariffNotApproved =>
      'கட்டண அட்டவணை இன்னும் அங்கீகரிக்கப்படவில்லை – ஆய்வுப் பயன்பாடு';

  @override
  String get qPostage => 'கடிதத் தபால் கட்டணம்';

  @override
  String get qRegistration => 'பதிவுக் கட்டணம்';

  @override
  String get qInsurance => 'காப்புறுதி';

  @override
  String get total => 'மொத்தம்';

  @override
  String get beforeAccepting => 'ஏற்பதற்கு முன்';

  @override
  String get checkConfirmed => 'விவரங்கள் உறுதிப்படுத்தப்பட்டன (படி 3)';

  @override
  String get checkWeight => 'நிறை பதிவுசெய்யப்பட்டது (படி 4)';

  @override
  String get checkCharge => 'கட்டணம் கணக்கிடப்பட்டது';

  @override
  String get payment => 'கொடுப்பனவு';

  @override
  String get paymentMethod => 'கொடுப்பனவு முறை';

  @override
  String get payCash => 'பணம்';

  @override
  String get payCard => 'அட்டை';

  @override
  String get payOther => 'பிற (அங்கீகரிக்கப்பட்டது)';

  @override
  String get receiptReference => 'பற்றுச்சீட்டு அல்லது குறிப்பு இலக்கம்';

  @override
  String receivedAndAccept(String amount) {
    return '$amount பெறப்பட்டது – கடிதத்தை ஏற்கவும்';
  }

  @override
  String get confirmFirst =>
      'ஏற்பதற்கு முன் விவரங்களை உறுதிப்படுத்தவும் (படி 3).';

  @override
  String get acceptLetter => 'கடிதத்தை ஏற்கவும்';

  @override
  String get acceptLetterTitle => 'இந்தக் கடிதத்தை ஏற்கவா?';

  @override
  String acceptLetterBody(String amount) {
    return 'அனுப்புநரிடமிருந்து $amount பெற்றதை உறுதிப்படுத்தவும். கண்காணிப்பு இலக்கம் உருவாக்கப்படும், அதை நீக்க முடியாது.';
  }

  @override
  String get labelAndReceipt => 'லேபலும் பற்றுச்சீட்டும்';

  @override
  String get letterAccepted => 'கடிதம் ஏற்கப்பட்டது';

  @override
  String get letterAcceptedBody =>
      'லேபலை அச்சிட்டு உறையில் ஒட்டி, சரிபார்க்க ஸ்கேன் செய்யவும். பற்றுச்சீட்டை அனுப்புநரிடம் கொடுக்கவும்.';

  @override
  String get registeredLetter => 'பதிவுக் கடிதம்';

  @override
  String get to => 'பெறுநர்';

  @override
  String get receiptDetails => 'பற்றுச்சீட்டு';

  @override
  String get acceptedBy => 'ஏற்றவர்';

  @override
  String get senderName => 'அனுப்புநர்';

  @override
  String get weight => 'நிறை';

  @override
  String get paidBy => 'கொடுப்பனவு';

  @override
  String get tariff => 'கட்டண அட்டவணை';

  @override
  String get labelPrints => 'லேபல் அச்சுகள்';

  @override
  String get senderTracking => 'அனுப்புநரின் கண்காணிப்பு QR';

  @override
  String get senderTrackingHint =>
      'பற்றுச்சீட்டில் அச்சிடப்படும். அனுப்புநர் இதைக் கொண்டு கடிதத்தைக் கண்காணிக்கலாம்.';

  @override
  String get copyLink => 'இணைப்பை நகலெடு';

  @override
  String get linkCopied => 'இணைப்பு நகலெடுக்கப்பட்டது';

  @override
  String get verifyLabel => 'அச்சிட்ட லேபலைச் சரிபார்';

  @override
  String get verifyLabelInstruction =>
      'உறையில் ஒட்டிய லேபலின் பார்கோடை ஸ்கேன் செய்யவும்';

  @override
  String get labelVerified =>
      'லேபல் சரிபார்க்கப்பட்டது – அச்சிட்ட லேபல் இந்தப் பொருளுடன் பொருந்துகிறது.';

  @override
  String labelMismatch(String id) {
    return 'ஸ்கேன் செய்த லேபல் $id ஐக் காட்டுகிறது, இந்தப் பொருள் அல்ல. லேபலை மீண்டும் அச்சிடவும்.';
  }

  @override
  String get markPrinted => 'லேபல் அச்சிடப்பட்டதாகக் குறி';

  @override
  String get recordReprint => 'மறு அச்சைப் பதிவுசெய்';

  @override
  String get reprintTitle => 'லேபலை மீண்டும் அச்சிடவா?';

  @override
  String get reprintBody =>
      'மறு அச்சு புதிய பொருளை உருவாக்காது. லேபல் ஏன் மீண்டும் அச்சிடப்படுகிறது எனக் கூறவும்.';

  @override
  String get printRecorded => 'லேபல் அச்சு பதிவுசெய்யப்பட்டது';

  @override
  String get reprintRecorded => 'மறு அச்சு பதிவுசெய்யப்பட்டது';

  @override
  String get printNote =>
      'கருமபீடக் கணினியிலிருந்து (வலைச் செயலி) அல்லது இணைக்கப்பட்ட லேபல் அச்சுப்பொறியிலிருந்து லேபலை அச்சிட்டு, இங்கே பதிவுசெய்யவும்.';

  @override
  String get openItem => 'பொருளின் விவரங்களைத் திற';

  @override
  String get registerAnother => 'இன்னொரு கடிதத்தைப் பதிவுசெய்';

  @override
  String get findItem => 'கண்காணிப்பு இலக்கம்';

  @override
  String get findItemHint => 'இலக்கம் முழுமையாக அல்லது பகுதியாக';

  @override
  String get status => 'நிலை';

  @override
  String get allStatuses => 'அனைத்து நிலைகளும்';

  @override
  String get scanToFind => 'கண்டறிய லேபலை ஸ்கேன் செய்';

  @override
  String get noItemsFound => 'பொருட்கள் எதுவும் கிடைக்கவில்லை';

  @override
  String itemsShown(int count) {
    return '$count பொருட்கள்';
  }

  @override
  String acceptedAt(String time) {
    return 'ஏற்கப்பட்டது $time';
  }

  @override
  String get itemDetails => 'பொருளின் விவரங்கள்';

  @override
  String get copyId => 'கண்காணிப்பு இலக்கத்தை நகலெடு';

  @override
  String get idCopied => 'கண்காணிப்பு இலக்கம் நகலெடுக்கப்பட்டது';

  @override
  String get recordAScan => 'ஸ்கேனைப் பதிவுசெய்';

  @override
  String get assignPostman => 'தபால்காரரை ஒதுக்கு';

  @override
  String assignedTo(String user) {
    return '$user க்கு ஒதுக்கப்பட்டது';
  }

  @override
  String get noPostmenAtOffice =>
      'சேருமிட அலுவலகத்தில் செயலிலுள்ள தபால்காரர் இல்லை.';

  @override
  String get details => 'விவரங்கள்';

  @override
  String byWorker(String worker, String role) {
    return '$worker ($role)';
  }

  @override
  String locationAccuracy(int metres) {
    return 'இருப்பிடத் துல்லியம் ± $metres மீ';
  }

  @override
  String distanceFromZone(int metres) {
    return 'குறிப்புப் பகுதியிலிருந்து $metres மீ';
  }

  @override
  String savedOffline(int seconds) {
    return 'இணைப்பின்றிச் சேமிக்கப்பட்டது, $seconds வினாடிகள் கழித்துப் பதிவேற்றப்பட்டது';
  }

  @override
  String ackLine(String type, String name) {
    return 'ஒப்புகை: $type $name';
  }

  @override
  String reviewNote(String user, String reason) {
    return '$user மீளாய்வு செய்தார்: $reason';
  }

  @override
  String get flagged => 'குறிக்கப்பட்டது';

  @override
  String heldTab(int count) {
    return 'நிறுத்திவைத்தவை ($count)';
  }

  @override
  String flaggedTab(int count) {
    return 'குறிக்கப்பட்டவை ($count)';
  }

  @override
  String get heldIntro =>
      'இந்த ஸ்கேன்கள் நிலையை மாற்றவில்லை. காரணங்களைச் சரிபார்த்து ஒவ்வொன்றையும் அங்கீகரிக்கவும் அல்லது நிராகரிக்கவும்.';

  @override
  String get flaggedIntro =>
      'கடந்த 14 நாட்களில் கவனத்துக்காகக் குறிக்கப்பட்ட ஏற்கப்பட்ட ஸ்கேன்கள் (உதா: உறுதியற்ற இருப்பிடம்). நடவடிக்கை தேவையில்லை.';

  @override
  String get noHeldScans => 'மீளாய்வுக்குக் காத்திருக்கும் ஸ்கேன்கள் இல்லை';

  @override
  String get noFlaggedScans => 'குறிக்கப்பட்ட ஸ்கேன்கள் இல்லை';

  @override
  String requestedStatus(String status) {
    return 'கோரப்பட்டது: $status';
  }

  @override
  String get mockLocation => 'போலி இருப்பிடம்';

  @override
  String get offlineScan => 'இணைப்பின்றிச் சேமிக்கப்பட்டது';

  @override
  String get approve => 'அங்கீகரி';

  @override
  String get reject => 'நிராகரி';

  @override
  String get approveScanTitle => 'இந்த ஸ்கேனை அங்கீகரிக்கவா?';

  @override
  String get approveScanBody =>
      'நிலை மாறும், அனுப்புநருக்கு அறிவிக்கப்படும். ஏன் அங்கீகரிக்கிறீர்கள் எனக் கூறவும்.';

  @override
  String get rejectScanTitle => 'இந்த ஸ்கேனை நிராகரிக்கவா?';

  @override
  String get rejectScanBody =>
      'ஸ்கேன் வரலாற்றில் இருக்கும், ஆனால் நிலையை மாற்றாது. ஏன் நிராகரிக்கிறீர்கள் எனக் கூறவும்.';

  @override
  String get scanApproved => 'ஸ்கேன் அங்கீகரிக்கப்பட்டது';

  @override
  String get scanRejected => 'ஸ்கேன் நிராகரிக்கப்பட்டது';

  @override
  String get messagesIntro =>
      'அனுப்புநர்களுக்கான நிலைச் செய்திகள். தோல்வியடைந்தவற்றை மீண்டும் அனுப்பவும், அல்லது அனுப்புநரைத் தொடர்புகொண்ட பின் தீர்க்கப்பட்டதாகக் குறிக்கவும்.';

  @override
  String get noMessages => 'செய்திகள் இல்லை';

  @override
  String attemptsAndTime(int attempts, String time) {
    return '$attempts முயற்சி(கள்) · உருவாக்கப்பட்டது $time';
  }

  @override
  String get preview => 'முன்னோட்டம்';

  @override
  String get messagePreview => 'செய்தி';

  @override
  String get markResolved => 'தீர்க்கப்பட்டதாகக் குறி';

  @override
  String get retryMessageTitle => 'இந்தச் செய்தியை மீண்டும் அனுப்பவா?';

  @override
  String get retryMessageBody => 'செய்தி மீண்டும் அனுப்பப்படும்.';

  @override
  String get resolveMessageTitle => 'செய்தியைத் தீர்க்கப்பட்டதாகக் குறிக்கவா?';

  @override
  String get resolveMessageBody =>
      'வேறு வழியில் அனுப்புநருக்குத் தெரிவித்த பின் இதைப் பயன்படுத்தவும்.';

  @override
  String get devicesIntro =>
      'தராசு கடிதங்களை நிறுக்கிறது, அதன் கமரா உறைகளைப் புகைப்படம் எடுக்கிறது. ஒவ்வொரு மறுதொடக்கத்துக்குப் பின்னும் வெற்றுத் தராசைப் பூஜ்ஜியமாக்கவும்.';

  @override
  String get noDevices => 'உங்கள் அலுவலகத்துக்குத் தராசு பதிவுசெய்யப்படவில்லை';

  @override
  String get online => 'இணைப்பில்';

  @override
  String get offline => 'இணைப்பில் இல்லை';

  @override
  String calibrationStatus(String value) {
    return 'அளவுத்திருத்தம்: $value';
  }

  @override
  String get firmware => 'நிலைபொருள்';

  @override
  String get cameraOk => 'கமரா தயார்';

  @override
  String get cameraFault => 'கமரா கோளாறு';

  @override
  String get stable => 'நிலையானது';

  @override
  String get loaded => 'தராசில் பொருள் உள்ளது';

  @override
  String get needsTare => 'பூஜ்ஜியமாக்க வேண்டும்';

  @override
  String get notReadyToWeigh => 'நிறுக்கத் தயாராக இல்லை';

  @override
  String get actions => 'செயல்கள்';

  @override
  String get tareHint =>
      'தளம் வெறுமையாக இருக்கும்போது பூஜ்ஜியமாக்கவும். தெரிந்த குறிப்பு நிறையுடன் அளவுத்திருத்தம் செய்யவும்.';

  @override
  String get tare => 'பூஜ்ஜியமாக்கு';

  @override
  String get calibrate => 'அளவுத்திருத்தம் செய்';

  @override
  String get identify => 'அடையாளம் காட்டு (விளக்கு மின்னும்)';

  @override
  String get testPhoto => 'சோதனைப் புகைப்படம் எடு';

  @override
  String get commandSent => 'கட்டளை தராசுக்கு அனுப்பப்பட்டது';

  @override
  String get calibrateTitle => 'தராசை அளவுத்திருத்தம் செய்';

  @override
  String get calibrateBody =>
      'முதலில் தளத்தை வெறுமையாக்கி \'பூஜ்ஜியமாக்கு\' என்பதை அழுத்தவும். பின்னர் தெரிந்த குறிப்பு நிறையைத் தளத்தில் வைத்து அதன் நிறையை உள்ளிடவும்.';

  @override
  String get referenceMass => 'குறிப்பு நிறை (கிராம், 10–1000)';

  @override
  String get office => 'அலுவலகம்';

  @override
  String get wifiSignal => 'Wi-Fi சமிக்ஞை';

  @override
  String get lastSeen => 'கடைசியாகக் காணப்பட்டது';

  @override
  String get calibration => 'அளவுத்திருத்தம்';

  @override
  String get uncertainty => 'நிச்சயமின்மை';

  @override
  String get recentCommands => 'சமீபத்திய கட்டளைகள்';

  @override
  String get cmdQueued => 'வரிசையில்';

  @override
  String get cmdSent => 'தராசுக்கு அனுப்பப்பட்டது';

  @override
  String get cmdDone => 'முடிந்தது';

  @override
  String get cmdFailed => 'தோல்வி';

  @override
  String get cmdExpired => 'காலாவதியானது';

  @override
  String get wpNoReading => 'தராசு இன்னும் அளவீட்டை அனுப்பவில்லை.';

  @override
  String get wpStale =>
      'கடைசி அளவீடு மிகப் பழையது – தராசின் Wi-Fi ஐச் சரிபார்க்கவும்.';

  @override
  String get wpSensorFault =>
      'சுமைக் கல பெருக்கி பதிலளிக்கவில்லை – HX711 இணைப்புகளைச் சரிபார்க்கவும்.';

  @override
  String get wpNeedsTare =>
      'தராசு மறுதொடக்கம் செய்யப்பட்டது. தளத்தை வெறுமையாக்கி தராசுப் பக்கத்தில் \'பூஜ்ஜியமாக்கு\' என்பதை அழுத்தவும்.';

  @override
  String get wpUncalibrated => 'தராசு அளவுத்திருத்தம் செய்யப்படவில்லை.';

  @override
  String get wpEmpty => 'தளத்தில் எதுவும் இல்லை.';

  @override
  String get wpUnstable =>
      'அளவீடு இன்னும் நிலையாகவில்லை – கடிதம் நிலைபெறும் வரை காத்திருக்கவும்.';

  @override
  String get wpNegative =>
      'எதிர்மறை நிறை – தளத்தை வெறுமையாக்கிப் பூஜ்ஜியமாக்கவும்.';

  @override
  String get officesIntro =>
      'ஸ்கேன்கள் எங்கே செய்யப்பட்டன என்பதைச் சரிபார்க்க ஒவ்வொரு அலுவலகத்தின் குறிப்புப் புள்ளியும் ஆரையும் பயன்படுகின்றன.';

  @override
  String get referencePoint => 'குறிப்புப் புள்ளி';

  @override
  String get zoneRadius => 'அலுவலக வலய ஆரை (மீ)';

  @override
  String get serviceRadius => 'விநியோகப் பகுதி ஆரை';

  @override
  String get provenance => 'மூலம் (புள்ளி எவ்வாறு அளக்கப்பட்டது)';

  @override
  String get provenanceHint =>
      'அவசியம். இது புள்ளியுடன் சேமிக்கப்பட்டுப் பதிவுசெய்யப்படும்.';

  @override
  String provenanceDefault(String date, int metres) {
    return '$date அன்று இடத்திலேயே தொலைபேசி GPS மூலம் அளக்கப்பட்டது, துல்லியம் ± $metres மீ';
  }

  @override
  String get useMyLocation =>
      'எனது இருப்பிடத்தைக் குறிப்புப் புள்ளியாகப் பயன்படுத்து';

  @override
  String get setReferencePoint => 'குறிப்புப் புள்ளியை அமை';

  @override
  String setReferencePointBody(String office) {
    return '$office இன் நுழைவாயிலில் நிற்கவும். இந்த இருப்பிடம் அலுவலகத்தின் குறிப்புப் புள்ளியாகும்:';
  }

  @override
  String get poorAccuracy =>
      'இருப்பிடம் துல்லியமாக இல்லை. வெளியே அல்லது ஜன்னலுக்கு அருகில் சென்று மீண்டும் முயலவும்.';

  @override
  String get officeUpdated => 'அலுவலகக் குறிப்புப் புள்ளி சேமிக்கப்பட்டது';

  @override
  String get registeredItems => 'பதிவுசெய்த பொருட்கள்';

  @override
  String get waitingReview => 'மீளாய்வுக்குக் காத்திருப்பவை';

  @override
  String get openDrafts => 'திறந்த வரைவுகள்';

  @override
  String get itemsByStatus => 'நிலை வாரியாகப் பொருட்கள்';

  @override
  String get messagesByState => 'நிலை வாரியாக அனுப்புநர் செய்திகள்';

  @override
  String get reportsOnWeb =>
      'மதிப்பீட்டுக்கான CSV ஏற்றுமதிகள் வலைச் செயலியின் அறிக்கைகள் பக்கத்தில் உள்ளன.';

  @override
  String get auditTarget => 'பதிவு';

  @override
  String get auditTargetHint =>
      'கண்காணிப்பு இலக்கம், வரைவு இலக்கம், சாதனம் அல்லது பயனர் பெயர்';

  @override
  String get severity => 'நிலை';

  @override
  String get allSeverities => 'அனைத்து நிலைகளும்';

  @override
  String get noAuditEntries => 'கணக்காய்வுப் பதிவுகள் இல்லை';

  @override
  String get account => 'உங்கள் கணக்கு';

  @override
  String get name => 'பெயர்';

  @override
  String get role => 'பணிநிலை';

  @override
  String get connection => 'இணைப்பு';

  @override
  String get thisDevice => 'இந்தத் தொலைபேசியின் அடையாளம்';

  @override
  String get changeServerHint =>
      'வேறு சேவையகத்தைப் பயன்படுத்த, வெளியேறி உள்நுழைவுத் திரையில் அதை மாற்றவும்.';

  @override
  String get offlineData => 'இந்தத் தொலைபேசியில் உள்ள தரவு';

  @override
  String get waitingToUpload => 'பதிவேற்றக் காத்திருக்கும் ஸ்கேன்கள்';

  @override
  String get offlineDataHint =>
      'சேவையகத்தின் பதிலைச் சரிபார்க்க பதிவேற்றிய ஸ்கேன்கள் 14 நாட்கள் வைக்கப்படும். பதிவேற்றக் காத்திருக்கும் ஸ்கேன்கள் ஒருபோதும் நீக்கப்படாது.';

  @override
  String get clearUploadedHistory => 'பதிவேற்றிய ஸ்கேன் வரலாற்றை நீக்கு';

  @override
  String historyCleared(int count) {
    return 'பதிவேற்றிய $count ஸ்கேன்(கள்) இந்தத் தொலைபேசியிலிருந்து நீக்கப்பட்டன';
  }

  @override
  String get cannotSignOutTitle =>
      'வெளியேறும் முன் உங்கள் ஸ்கேன்களைப் பதிவேற்றவும்';

  @override
  String cannotSignOutBody(int count) {
    return '$count ஸ்கேன்கள் இன்னும் இந்தத் தொலைபேசியில் உள்ளன. நீங்கள் உள்நுழைந்திருக்கும்போது மட்டுமே அவற்றைப் பதிவேற்ற முடியும்.';
  }

  @override
  String get signOut => 'வெளியேறு';

  @override
  String get signOutTitle => 'வெளியேறவா?';

  @override
  String get signOutBody => 'மீண்டும் உள்நுழைய உங்கள் கடவுச்சொல் தேவைப்படும்.';

  @override
  String get prototypeTitle => 'ஆய்வு முன்மாதிரி';

  @override
  String get prototypeBody =>
      'இது SLIIT ஆய்வு முன்மாதிரி (திட்டம் J26-IT-372), இலங்கை தபாலின் உத்தியோகபூர்வ சேவை அல்ல. சோதனை அங்கீகரிக்கப்படாவிட்டால் உண்மையான வாடிக்கையாளர் தபால்களுடன் பயன்படுத்த வேண்டாம்.';

  @override
  String get aboutTitle => 'இந்தச் செயலி பற்றி';

  @override
  String get aboutBody =>
      'PostAssist LK உள்நாட்டுப் பதிவுக் கடிதங்களை ஏற்க, லேபலிட, கண்காணிக்க தபால் ஊழியர்களுக்கு உதவுகிறது. கருமபீட அலுவலர்கள் உதவியுடனான முகவரி வாசிப்பு மற்றும் IoT தராசுடன் கடிதங்களைப் பதிவுசெய்கிறார்கள்; தபால்காரர்களும் பரிமாற்ற மைய அலுவலர்களும் தொலைபேசியின் இருப்பிடத்துடன் ஒவ்வொரு கையளிப்பையும் பதிவுசெய்கிறார்கள்; தபால் அதிபர்கள் விதிவிலக்குகளையும் அனுப்புநர் செய்திகளையும் மீளாய்வு செய்கிறார்கள்.';

  @override
  String version(String version) {
    return 'பதிப்பு $version';
  }

  @override
  String get privacyTitle => 'தனியுரிமை அறிவிப்பு';

  @override
  String get privacyIntro => 'இந்தச் செயலி சேகரிப்பவையும் அதற்கான காரணமும்:';

  @override
  String get privacyLocation =>
      'இருப்பிடம்: ஸ்கேனைச் சேமிக்கும்போது ஒருமுறை படிக்கப்படும், அதன் துல்லியம், வயது, போலியானதா என்பதுடன். பின்னணியில் ஒருபோதும் கண்காணிக்கப்படாது.';

  @override
  String get privacyCamera =>
      'கமரா: லேபல்களை ஸ்கேன் செய்யவும் கருமபீடத்தில் உறைகளைப் புகைப்படம் எடுக்கவும் மட்டும். புகைப்படங்கள் PostAssist சேவையகத்துக்கு அனுப்பப்படும், தொலைபேசியின் காட்சியகத்தில் சேமிக்கப்படாது.';

  @override
  String get privacyStorage =>
      'இந்தத் தொலைபேசியில்: உங்கள் உள்நுழைவு டோக்கன் (மறையாக்கப்பட்ட சேமிப்பு), உங்கள் ஸ்கேன்கள் பதிவேற்றப்படும் வரை, பின்னர் 14 நாட்கள்.';

  @override
  String get privacyServer =>
      'தரவு உள்நுழைவில் உள்ளிட்ட PostAssist சேவையக முகவரிக்கு மட்டுமே அனுப்பப்படும்.';

  @override
  String get privacyAudit =>
      'ஒவ்வொரு உள்நுழைவும், ஸ்கேனும், முடிவும் உங்கள் பயனர் பெயருடன் கணக்காய்வுப் பதிவில் எழுதப்படும்.';

  @override
  String get accessibilityTitle => 'அணுகல்தன்மை அறிக்கை';

  @override
  String get accessibilityBody =>
      'தபால் கருமபீடத்தில் பணிபுரியும் அல்லது தபால் விநியோகிக்கும் அனைவரும் இந்தச் செயலியைப் பயன்படுத்த முடிய வேண்டும்.';

  @override
  String get a11yLanguages =>
      'செயலியைச் சிங்களம், தமிழ் அல்லது ஆங்கிலத்தில் பயன்படுத்தவும் (அமைப்புகள் → மொழி).';

  @override
  String get a11yText =>
      'எழுத்துகள் உங்கள் தொலைபேசியின் எழுத்து அளவைப் பின்பற்றும், 200 % வரை.';

  @override
  String get a11yContrast =>
      'எழுத்துகளும் கட்டுப்பாடுகளும் WCAG 2.2 AA வேறுபாட்டைப் பூர்த்திசெய்கின்றன; நிலை சொற்கள், சின்னங்களுடன் காட்டப்படும், நிறம் மட்டும் அல்ல.';

  @override
  String get a11yTargets =>
      'பொத்தான்களும் கட்டுப்பாடுகளும் குறைந்தது 48 × 48 dp.';

  @override
  String get a11yScreenReader =>
      'TalkBack, VoiceOver உடன் இயங்கும்: புலங்கள், பொத்தான்கள், முன்னேற்றம் பெயரிடப்பட்டுள்ளன.';

  @override
  String get standardsTitle => 'வடிவமைப்புத் தரநிலைகள்';

  @override
  String get standardsBody =>
      'இடைமுகம் இலங்கை டிஜிட்டல் வடிவமைப்பு முறைமையின் (SLDDS, டிஜிட்டல் பொருளாதார அமைச்சு, 2026 பொதுமக்கள் கருத்துக்கான வரைவு) கொள்கைகளைப் பின்பற்றுகிறது: எளிய மொழி, மூன்று உத்தியோகபூர்வ மொழிகள், கைபேசி-முதன்மை வடிவமைப்புகள், சீரான கூறுகள், WCAG 2.2 AA அணுகல்தன்மை. இது அரச நிறுவனத்தால் முறையாக மதிப்பிடப்படவோ அங்கீகரிக்கப்படவோ இல்லை.';
}
