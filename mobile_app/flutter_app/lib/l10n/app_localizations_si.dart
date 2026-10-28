// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Sinhala Sinhalese (`si`).
class AppLocalizationsSi extends AppLocalizations {
  AppLocalizationsSi([String locale = 'si']) : super(locale);

  @override
  String get appName => 'PostAssist LK';

  @override
  String get appSubtitle => 'ලියාපදිංචි තැපැල් භාරගැනීම සහ ලුහුබැඳීම';

  @override
  String get officialUseStrip =>
      'නිල භාවිතය – බලයලත් තැපැල් කාර්ය මණ්ඩලයට පමණි';

  @override
  String get officialUseTitle => 'නිල භාවිතය';

  @override
  String get officialUseBody =>
      'මෙම යෙදුම බලයලත් තැපැල් කාර්ය මණ්ඩලය සඳහා ය. සෑම පුරනය වීමක්ම සහ වාර්තාවකට කරන සෑම වෙනසක්ම සටහන් වේ. මෙය පර්යේෂණ මූලාකෘතියකි: අත්හදා බැලීම අනුමත කර නොමැති නම් කෘත්‍රිම තැපැල් පමණක් භාවිත කරන්න.';

  @override
  String get publicServiceStrip => 'PostAssist LK – ලියාපදිංචි ලිපි ලුහුබැඳීම';

  @override
  String get publicServiceTitle => 'ලිපි ලුහුබැඳීම';

  @override
  String get publicServiceBody =>
      'මෙම පිටුව ලියාපදිංචි ලිපියක ප්‍රගතිය එය යැවූ අයට පෙන්වයි. ස්ථාන පෙන්වන්නේ කාර්යාල නම් ලෙස පමණි; කාර්ය මණ්ඩල නම් සහ සිතියම් පිහිටීම් කිසිවිටෙක නොපෙන්වයි.';

  @override
  String get close => 'වසන්න';

  @override
  String get cancel => 'අවලංගු කරන්න';

  @override
  String get back => 'ආපසු';

  @override
  String get next => 'ඊළඟ';

  @override
  String get done => 'අවසන්';

  @override
  String get save => 'සුරකින්න';

  @override
  String get search => 'සොයන්න';

  @override
  String get retry => 'නැවත උත්සාහ කරන්න';

  @override
  String get tryAgain => 'නැවත උත්සාහ කරන්න';

  @override
  String get loading => 'පූරණය වෙමින්…';

  @override
  String get saving => 'සුරකිමින්…';

  @override
  String get optional => 'අත්‍යවශ්‍ය නොවේ';

  @override
  String get thereIsAProblem => 'ගැටලුවක් ඇත';

  @override
  String get somethingWentWrong => 'යමක් වැරදී ඇත';

  @override
  String get errorNetwork =>
      'සේවාදායකය පිළිතුරු දුන්නේ නැත. දුරකථනය PostAssist සේවාදායකය ඇති ජාලයටම සම්බන්ධ දැයි සහ ලිපිනය නිවැරදි දැයි පරීක්ෂා කරන්න.';

  @override
  String get errorSessionExpired => 'ඔබේ සැසිය අවසන් වී ඇත. නැවත පුරනය වන්න.';

  @override
  String get errorForbidden => 'ඔබට මෙය කිරීමට අවසර නැත.';

  @override
  String get reason => 'හේතුව';

  @override
  String reasonTooShort(int min) {
    return 'අවම වශයෙන් අක්ෂර $minක් ඇතුළත් කරන්න';
  }

  @override
  String get language => 'භාෂාව';

  @override
  String get languageHint => 'යෙදුමේ භාෂාව තෝරන්න.';

  @override
  String get usePhoneLanguage => 'දුරකථනයේ භාෂාව භාවිත කරන්න';

  @override
  String get progress => 'ප්‍රගතිය';

  @override
  String get complete => 'සම්පූර්ණයි';

  @override
  String get notComplete => 'සම්පූර්ණ නැත';

  @override
  String get signInTitle => 'කාර්ය මණ්ඩල පුරනය';

  @override
  String get serverAddress => 'සේවාදායක ලිපිනය';

  @override
  String get serverAddressHint =>
      'PostAssist සේවාදායකය ක්‍රියාත්මක වන පරිගණකය, උදා: http://192.168.1.10:8000';

  @override
  String get testConnection => 'සම්බන්ධතාවය පරීක්ෂා කරන්න';

  @override
  String get connectionOk => 'සේවාදායකය හමු විය';

  @override
  String get connectionFailed => 'පිළිතුරක් නැත';

  @override
  String get insecureConnectionWarning =>
      'මෙම සම්බන්ධතාවය සංකේතනය කර නැත (http). එය සංවෘත විද්‍යාගාර ජාලයක පමණක් භාවිත කරන්න; සජීවී සේවාවක් https භාවිත කළ යුතුය.';

  @override
  String get username => 'පරිශීලක නාමය';

  @override
  String get password => 'මුරපදය';

  @override
  String get showPassword => 'මුරපදය පෙන්වන්න';

  @override
  String get hidePassword => 'මුරපදය සඟවන්න';

  @override
  String get signIn => 'පුරනය වන්න';

  @override
  String get staffOnlyNotice =>
      'බලයලත් තැපැල් කාර්ය මණ්ඩලය සඳහා. පුරනය වීම් විගණනය සඳහා සටහන් වේ.';

  @override
  String get errServerRequired => 'සේවාදායක ලිපිනය ඇතුළත් කරන්න';

  @override
  String get errServerInvalid => 'සේවාදායක ලිපිනය වලංගු නැත';

  @override
  String get errUsernameRequired => 'ඔබේ පරිශීලක නාමය ඇතුළත් කරන්න';

  @override
  String get errPasswordRequired => 'ඔබේ මුරපදය ඇතුළත් කරන්න';

  @override
  String get errWrongCredentials => 'පරිශීලක නාමය හෝ මුරපදය වැරදියි';

  @override
  String get sessionExpiredTitle => 'සැසිය අවසන් විය';

  @override
  String get sessionExpiredBody =>
      'ආරක්ෂාව සඳහා ඔබව ඉවත් කරන ලදී. නැවත පුරනය වන්න – මෙම දුරකථනයේ සුරකින ලද ස්කෑන් රැඳී පවතී.';

  @override
  String get trackLetterPublic => 'ලියාපදිංචි ලිපියක් යැව්වාද?';

  @override
  String get trackLetterPublicHint =>
      'රිසිට්පතක් ඇති ඕනෑම අයෙකුට ලිපියේ ප්‍රගතිය බැලිය හැක – පුරනය වීම අවශ්‍ය නැත.';

  @override
  String get trackALetter => 'ලිපියක් ලුහුබඳින්න';

  @override
  String get aboutAndPrivacy => 'යෙදුම ගැන, රහස්‍යතාව සහ ප්‍රවේශ්‍යතාව';

  @override
  String get settings => 'සැකසුම්';

  @override
  String welcome(String name) {
    return 'ආයුබෝවන්, $name';
  }

  @override
  String get groupDaily => 'දෛනික කටයුතු';

  @override
  String get groupSupervision => 'අධීක්ෂණය';

  @override
  String get groupSetup => 'සැකසුම් සහ මෙවලම්';

  @override
  String get scanALetter => 'ලියාපදිංචි ලිපියක් ස්කෑන් කරන්න';

  @override
  String get auditFooter =>
      'පුරනය වීම් සහ වාර්තා වෙනස් කිරීම් විගණනය සඳහා සටහන් වේ.';

  @override
  String reviewWaiting(int count) {
    return 'ස්කෑන් $countක් ඔබේ සමාලෝචනය සඳහා රැඳී ඇත';
  }

  @override
  String get openReviewQueue => 'සමාලෝචන පෝලිම විවෘත කරන්න';

  @override
  String get offlineScansTitle => 'මෙම දුරකථනයේ ස්කෑන්';

  @override
  String get networkAvailable => 'ජාලය ඇත';

  @override
  String get networkOffline => 'ජාලය නැත – ස්කෑන් මෙම දුරකථනයේ සුරැකේ';

  @override
  String pendingCount(int count) {
    return 'උඩුගත කිරීමට $countක් රැඳී ඇත';
  }

  @override
  String heldCount(int count) {
    return 'රඳවා ඇති $count';
  }

  @override
  String rejectedCount(int count) {
    return 'ප්‍රතික්ෂේප $count';
  }

  @override
  String lastUploadFailed(String error) {
    return 'අවසන් උඩුගත කිරීම අසාර්ථකයි: $error';
  }

  @override
  String get lastUploadFailedNetwork =>
      'අවසන් උඩුගත කිරීම අසාර්ථකයි: සේවාදායකයට සම්බන්ධතාවයක් නැත. ස්කෑන් ස්වයංක්‍රීයව උඩුගත වේ.';

  @override
  String get uploadNow => 'දැන් උඩුගත කරන්න';

  @override
  String get uploading => 'උඩුගත වෙමින්…';

  @override
  String get taskRegister => 'ලිපියක් ලියාපදිංචි කරන්න';

  @override
  String get taskRegisterHint => 'පියවර පහකින් කවුළු භාරගැනීම';

  @override
  String get taskScan => 'ලිපියක් ස්කෑන් කරන්න';

  @override
  String get taskScanHint => 'යැවීම, ප්‍රවාහනය හෝ බෙදාහැරීම සටහන් කරන්න';

  @override
  String get taskItems => 'ලියාපදිංචි අයිතම';

  @override
  String get taskItemsHint => 'අයිතමයක් සොයා එහි ඉතිහාසය බලන්න';

  @override
  String get taskHistory => 'මගේ ස්කෑන්';

  @override
  String get taskHistoryHint => 'සුරකින ලද ස්කෑන් සහ උඩුගත තත්ත්වය';

  @override
  String get taskReview => 'සමාලෝචන පෝලිම';

  @override
  String get taskReviewHint => 'රඳවා ඇති ස්කෑන් අනුමත හෝ ප්‍රතික්ෂේප කරන්න';

  @override
  String get taskMessages => 'යවන්නාට පණිවිඩ';

  @override
  String get taskMessagesHint => 'යවන්නන්ට ඊමේල් සහ SMS යාවත්කාලීන';

  @override
  String get taskSummary => 'සාරාංශය';

  @override
  String get taskSummaryHint => 'අයිතම, සමාලෝචන සහ පණිවිඩ එක බැල්මකින්';

  @override
  String get taskAudit => 'විගණන සටහන';

  @override
  String get taskAuditHint => 'කවුද, කුමක්ද, කවදාද';

  @override
  String get taskDevices => 'තරාදිය සහ කැමරාව';

  @override
  String get taskDevicesHint => 'IoT තරාදියේ තත්ත්වය, ශුන්‍ය කිරීම, ක්‍රමාංකනය';

  @override
  String get taskOffices => 'කාර්යාල සහ කලාප';

  @override
  String get taskOfficesHint => 'ස්ථාන පරීක්ෂාව සඳහා යොමු ලක්ෂ්‍ය';

  @override
  String get taskTrack => 'ලිපියක් ලුහුබඳින්න';

  @override
  String get taskTrackHint => 'අයිතමයක් යවන්නාට පෙනෙන ආකාරය';

  @override
  String get stAccepted => 'කවුළුවේදී භාරගන්නා ලදී';

  @override
  String get stDispatched => 'යවන ලදී';

  @override
  String get stInTransit => 'ප්‍රවාහනයේ';

  @override
  String get stAtDestination => 'ගමනාන්ත කාර්යාලයේ';

  @override
  String get stOutForDelivery => 'බෙදාහැරීමට රැගෙන ගොස් ඇත';

  @override
  String get stDeliveryAttempted => 'බෙදාහැරීමට උත්සාහ කළා';

  @override
  String get stDelivered => 'බෙදා දෙන ලදී';

  @override
  String get stReturnStarted => 'ආපසු යැවීම ආරම්භ විය';

  @override
  String get stReturnedToSender => 'යවන්නාට ආපසු භාර දෙන ලදී';

  @override
  String get roleAdmin => 'පරිපාලක';

  @override
  String get rolePostmaster => 'තැපැල්පති';

  @override
  String get roleCounter => 'කවුළු නිලධාරී';

  @override
  String get roleHub => 'හුවමාරු මධ්‍යස්ථාන නිලධාරී';

  @override
  String get rolePostman => 'තැපැල් භාරකරු';

  @override
  String get decAccepted => 'පිළිගත්තා';

  @override
  String get decAcceptedAfterReview => 'සමාලෝචනයෙන් පසු පිළිගත්තා';

  @override
  String get decHeld => 'සමාලෝචනය සඳහා රඳවා ඇත';

  @override
  String get decRejected => 'ප්‍රතික්ෂේප විය';

  @override
  String get decRejectedAfterReview => 'සමාලෝචනයෙන් පසු ප්‍රතික්ෂේප විය';

  @override
  String get decDuplicate => 'දැනටමත් සටහන් කර ඇත';

  @override
  String get decPending => 'උඩුගත කිරීමට රැඳී ඇත';

  @override
  String get locConsistent => 'ස්ථානය ගැළපේ';

  @override
  String get locUncertain => 'ස්ථානය අවිනිශ්චිතයි';

  @override
  String get locMismatch => 'ස්ථානය නොගැළපේ';

  @override
  String get locUnlocated => 'ස්ථානයක් යවා නැත';

  @override
  String get locNotAssessed => 'ස්ථානය පරීක්ෂා නොකළා';

  @override
  String get locDenied =>
      'ස්ථාන අවසරය ප්‍රතික්ෂේප විය – ස්කෑන් එක ස්ථානය නොමැතිව සුරකින ලදී';

  @override
  String get locTimeout =>
      'නියමිත වේලාවට ස්ථානය ලැබුණේ නැත – ස්කෑන් එක ස්ථානය නොමැතිව සුරකින ලදී';

  @override
  String get locUnavailable => 'ස්ථාන සේවාව අක්‍රිය හෝ නොමැත';

  @override
  String get obQueued => 'පෝලිමේ';

  @override
  String get obRetry => 'නැවත උත්සාහයට රැඳී ඇත';

  @override
  String get obSending => 'යවමින්';

  @override
  String get obSent => 'යවන ලදී';

  @override
  String get obAmbiguous => 'අපැහැදිලියි – පරීක්ෂා කරන්න';

  @override
  String get obFailed => 'අසාර්ථකයි';

  @override
  String get obResolved => 'අතින් විසඳන ලදී';

  @override
  String get channelNone => 'පණිවිඩ නැත (රිසිට්පත පමණි)';

  @override
  String get channelEmail => 'ඊමේල්';

  @override
  String get channelSms => 'SMS (දොරටුවක් අනුමත නම් පමණි)';

  @override
  String get sevInfo => 'තොරතුරු';

  @override
  String get sevWarning => 'අවවාදය';

  @override
  String get sevSecurity => 'ආරක්ෂාව';

  @override
  String get scanLabel => 'ලේබලය ස්කෑන් කරන්න';

  @override
  String get scanInstruction =>
      'කැමරාව ලේබලයේ තීරු කේතයට හෝ QR කේතයට යොමු කරන්න';

  @override
  String get torch => 'විදුලි පන්දම';

  @override
  String get cameraPermissionNeeded =>
      'ලේබල ස්කෑන් කිරීමට කැමරා අවසරය අවශ්‍යයි. දුරකථන සැකසුම්වලින් එය ලබා දෙන්න, නැතහොත් පහත අංකය ටයිප් කරන්න.';

  @override
  String get cameraUnavailable =>
      'කැමරාව ආරම්භ කළ නොහැකි විය. පහත අංකය ටයිප් කරන්න.';

  @override
  String get notAPostAssistCode =>
      'මෙම කේතය PostAssist ලේබලයක් නොවේ. නැවත උත්සාහ කරන්න හෝ අංකය ටයිප් කරන්න.';

  @override
  String get typeTrackingId => 'ලේබලය හානි වී ද? ලුහුබැඳීමේ අංකය ටයිප් කරන්න';

  @override
  String get typeTrackingIdHint => 'එය තීරු කේතයට පහළින් මුද්‍රණය කර ඇත.';

  @override
  String get useTypedId => 'ටයිප් කළ අංකය භාවිත කරන්න';

  @override
  String get errTrackingIdInvalid =>
      'මෙය වලංගු ලුහුබැඳීමේ අංකයක් නොවේ – එක් එක් අක්ෂරය පරීක්ෂා කරන්න (උදා: PA-DEMO-7K3M9Q2XRH4)';

  @override
  String get recordStatus => 'තත්ත්වය සටහන් කරන්න';

  @override
  String get scanSaved => 'ස්කෑන් එක සුරකින ලදී';

  @override
  String get lookingUpItem => 'අයිතමය සොයමින්…';

  @override
  String get offlineModeTitle => 'ජාලයෙන් තොරව ක්‍රියා කරමින්';

  @override
  String get offlineModeBody =>
      'අයිතමයේ විස්තර ලබාගත නොහැකි විය. ඔබට තවමත් ස්කෑන් එක සටහන් කළ හැක; උඩුගත වූ විට සේවාදායකය එය පරීක්ෂා කරයි.';

  @override
  String get destinationOffice => 'ගමනාන්ත කාර්යාලය';

  @override
  String get destinationTown => 'ගමනාන්ත නගරය';

  @override
  String get assignedPostman => 'පවරා ඇති තැපැල් භාරකරු';

  @override
  String get deliverTo => 'බෙදා දිය යුත්තේ';

  @override
  String get nothingToRecordTitle => 'සටහන් කිරීමට කිසිවක් නැත';

  @override
  String get nothingToRecordBody =>
      'ඔබට දැන් මෙම අයිතමය සඳහා නව තත්ත්වයක් සටහන් කළ නොහැක.';

  @override
  String get newStatus => 'නව තත්ත්වය';

  @override
  String get newStatusHint =>
      'මෙම අයිතමය සඳහා ඔබට සටහන් කළ හැකි තත්ත්ව පමණක් පෙන්වයි.';

  @override
  String get reasonTitle => 'හේතුව';

  @override
  String get reasonHint => 'ලිපිය බෙදා දිය නොහැකි වූයේ ඇයි.';

  @override
  String get reasonNotAvailable => 'ලබන්නා නොසිටියි';

  @override
  String get reasonClosed => 'ස්ථානය වසා ඇත';

  @override
  String get reasonAddressNotFound => 'ලිපිනය සොයාගත නොහැක';

  @override
  String get reasonRefused => 'ලබන්නා ප්‍රතික්ෂේප කළා';

  @override
  String get reasonUnsafe => 'ප්‍රවේශය අනාරක්ෂිතයි';

  @override
  String get otherReason => 'ඔබේම වචනවලින් හේතුව';

  @override
  String get ackTitle => 'බෙදාහැරීම පිළිගැනීම';

  @override
  String get ackHint =>
      'බෙදා දුන් ලිපියකට අවශ්‍යයි: ලබන්නා එය පිළිගත්තේ කෙසේද?';

  @override
  String get ackSignature => 'අත්සන';

  @override
  String get ackNameOnly => 'නම පමණි';

  @override
  String get ackSheet => 'බෙදාහැරීම් පත්‍රය';

  @override
  String get receivedBy => 'භාරගත් අයගේ නම';

  @override
  String get relationship => 'ලිපිනකරුට ඇති සම්බන්ධය';

  @override
  String get relationshipHint => 'උදා: තමා, කලත්‍රයා, ආරක්ෂක නිලධාරී';

  @override
  String get sheetNumber => 'බෙදාහැරීම් පත්‍රයේ / පිටුවේ අංකය';

  @override
  String get signature => 'ලබන්නාගේ අත්සන';

  @override
  String get signatureHint => 'කොටුව තුළ අත්සන් කරන ලෙස ලබන්නාගෙන් ඉල්ලන්න.';

  @override
  String get signatureArea => 'අත්සන් කලාපය. එක් ඇඟිල්ලකින් අත්සන අඳින්න.';

  @override
  String get signHere => 'ඇඟිල්ලෙන් මෙහි අත්සන් කරන්න';

  @override
  String get clearSignature => 'අත්සන මකන්න';

  @override
  String get noAckPossible => 'පිළිගැනීමක් ලබාගත නොහැක';

  @override
  String get noAckPossibleHint =>
      'අනුමත ව්‍යතිරේකය විස්තර කරන්න. ස්කෑන් එක තැපැල්පති සඳහා රඳවා තබනු ඇත.';

  @override
  String get exceptionReason => 'ව්‍යතිරේකයට හේතුව';

  @override
  String get notes => 'සටහන්';

  @override
  String get locationNotice =>
      'ඔබ සුරකින්න එබූ විට පමණක් ඔබේ ස්ථානය එක් වරක් කියවනු ලැබේ. තැපැල්පතිට එය සාක්ෂියක ගුණාත්මකභාවය ලෙස පෙනේ – එය බෙදාහැරීමේ සාධකයක් නොවේ.';

  @override
  String get saveScan => 'ස්කෑන් එක සුරකින්න';

  @override
  String get readingLocation => 'ස්ථානය කියවමින්…';

  @override
  String get errChooseStatus => 'නව තත්ත්වය තෝරන්න';

  @override
  String get errReasonRequired => 'හේතුවක් තෝරන්න හෝ ටයිප් කරන්න';

  @override
  String get errExceptionTooShort =>
      'ව්‍යතිරේකය අවම වශයෙන් අක්ෂර 5කින් විස්තර කරන්න';

  @override
  String get errRecipientNameRequired =>
      'ලිපිය භාරගත් පුද්ගලයාගේ නම ඇතුළත් කරන්න';

  @override
  String get errSignatureRequired => 'අත්සන් කරන ලෙස ලබන්නාගෙන් ඉල්ලන්න';

  @override
  String get errSheetRequired =>
      'බෙදාහැරීම් පත්‍රයේ හෝ පිටුවේ අංකය ඇතුළත් කරන්න';

  @override
  String get outcomeAcceptedTitle => 'පිළිගත්තා';

  @override
  String get outcomeAcceptedBody =>
      'සේවාදායකය ස්කෑන් එක පිළිගෙන තත්ත්වය යාවත්කාලීන කළේය.';

  @override
  String get outcomeDuplicateTitle => 'දැනටමත් සටහන් කර ඇත';

  @override
  String get outcomeDuplicateBody =>
      'සේවාදායකයේ මෙම ස්කෑන් එක දැනටමත් තිබුණි. කිසිවක් දෙවරක් එකතු වූයේ නැත.';

  @override
  String get outcomeHeldTitle => 'සුරකින ලදී – සමාලෝචනය සඳහා රඳවා ඇත';

  @override
  String get outcomeHeldBody =>
      'ස්කෑන් එක ගබඩා කර ඇත, නමුත් තැපැල්පති අනුමත කළ පසුව පමණක් තත්ත්වය වෙනස් වේ.';

  @override
  String get outcomeRejectedTitle => 'පිළිගත්තේ නැත';

  @override
  String get outcomeRejectedBody => 'සේවාදායකය මෙම ස්කෑන් එක පිළිගත්තේ නැත:';

  @override
  String get outcomePendingTitle => 'මෙම දුරකථනයේ සුරකින ලදී';

  @override
  String get outcomePendingBody =>
      'ජාලය නැවත ලැබුණු විට එය ස්වයංක්‍රීයව උඩුගත වේ.';

  @override
  String get statusRecorded => 'සටහන් කළ තත්ත්වය';

  @override
  String get locationEvidence => 'ස්ථාන සාක්ෂිය';

  @override
  String locationQuality(int metres, int seconds) {
    return '± මී. $metres, තත්පර $secondsක් පැරණි';
  }

  @override
  String get mockLocationWarning =>
      'දුරකථනය අනුකරණය කළ (ව්‍යාජ) ස්ථානයක් වාර්තා කළේය. ස්කෑන් එක සමාලෝචනය සඳහා රඳවා තබනු ඇත.';

  @override
  String get scanNext => 'ඊළඟ ලිපිය ස්කෑන් කරන්න';

  @override
  String get scanAnother => 'වෙනත් ලිපියක් ස්කෑන් කරන්න';

  @override
  String get itemNotFoundTitle => 'අයිතමය හමු නොවීය';

  @override
  String get notAllowedTitle => 'ඔබට මෙම අයිතමය ස්කෑන් කළ නොහැක';

  @override
  String get historyIntro =>
      'ස්කෑන් මුලින්ම මෙම දුරකථනයේ සුරකින අතර ජාලය ඇති විට උඩුගත වේ. උඩුගත කිරීමට රැඳී ඇති ස්කෑන් කිසිවිටෙක මැකෙන්නේ නැත.';

  @override
  String get noScansYet => 'මෙම දුරකථනයේ තවම ස්කෑන් නැත';

  @override
  String waitingForUser(String user) {
    return '$user පුරනය වන තෙක් රැඳී ඇත';
  }

  @override
  String retryPending(int attempts) {
    return 'උඩුගත කිරීම අවසන් නැත – උත්සාහ $attempts, නැවත උත්සාහ කරයි';
  }

  @override
  String get trackIntro =>
      'යවන්නන්ට ඔවුන්ගේ රිසිට්පතේ ඇති QR කේතයෙන් හෝ ලුහුබැඳීමේ අංකය සහ ප්‍රවේශ කේතයෙන් ලියාපදිංචි ලිපියක් ලුහුබැඳිය හැක.';

  @override
  String get scanReceiptQr => 'රිසිට්පතේ QR කේතය ස්කෑන් කරන්න';

  @override
  String get scanReceipt => 'රිසිට්පත ස්කෑන් කරන්න';

  @override
  String get scanReceiptInstruction =>
      'කැමරාව යවන්නාගේ රිසිට්පතේ QR කේතයට යොමු කරන්න';

  @override
  String get orTypeDetails => 'නැතහොත් රිසිට්පතේ විස්තර ටයිප් කරන්න';

  @override
  String get trackingId => 'ලුහුබැඳීමේ අංකය';

  @override
  String get trackingIdHint =>
      'තීරු කේතයට පහළින් මුද්‍රණය කර ඇත, උදා: PA-DEMO-7K3M9Q2XRH4';

  @override
  String get accessCode => 'ප්‍රවේශ කේතය';

  @override
  String get accessCodeHint =>
      'රිසිට්පතේ ලුහුබැඳීමේ සබැඳියේ කොටසක් (#t= ට පසු)';

  @override
  String get errAccessCodeRequired => 'රිසිට්පතේ ප්‍රවේශ කේතය ඇතුළත් කරන්න';

  @override
  String get showStatus => 'තත්ත්වය පෙන්වන්න';

  @override
  String get trackNotFoundTitle => 'ලුහුබැඳීමේ වාර්තාවක් හමු නොවීය';

  @override
  String get trackNotFoundBody =>
      'රිසිට්පතේ ලුහුබැඳීමේ අංකය සහ ප්‍රවේශ කේතය පරීක්ෂා කරන්න. ඔබේ ආරක්ෂාව සඳහා වැරදි කුමක්දැයි අපි නොකියමු.';

  @override
  String get acceptedOn => 'භාරගත් දිනය';

  @override
  String get fromOffice => 'යවන කාර්යාලය';

  @override
  String get history => 'ඉතිහාසය';

  @override
  String syncedLater(String time) {
    return 'පසුව උඩුගත විය, $time';
  }

  @override
  String get historyOnly => 'ඉතිහාසයේ පමණක් තබා ඇත';

  @override
  String get trackPrivacyNotice =>
      'බලයලත් කාර්ය මණ්ඩලය ලිපිය ස්කෑන් කරන විට තත්ත්වය සටහන් වේ. ස්ථාන කාර්යාල නම් පමණි; ස්කෑන් එකක පිහිටීම බෙදාහැරීමේ සාධකයක් නොවේ.';

  @override
  String get intakeIntro =>
      'ලියාපදිංචි ලිපියක් පියවර පහකින් ලියාපදිංචි කරන්න: ඡායාරූපය, ලිපින, තහවුරු කිරීම, බර කිරීම, ගාස්තුව.';

  @override
  String get registerNewLetter => 'නව ලිපියක් ලියාපදිංචි කරන්න';

  @override
  String get ocrUnavailableTitle => 'ලිපිනය කියවීම නොමැත';

  @override
  String get ocrUnavailableBody =>
      'සේවාදායකයේ OCR එන්ජිමක් හෝ අත්අකුරු ආකෘතියක් ස්ථාපනය කර නැත. ඒ වෙනුවට ලිපිනය ටයිප් කරන්න හෝ අලවන්න.';

  @override
  String get draftsInProgress => 'ක්‍රියාත්මක ලියාපදිංචි කිරීම්';

  @override
  String get noDrafts => 'ක්‍රියාත්මක ලියාපදිංචි කිරීම් නැත';

  @override
  String get noDraftsHint =>
      'ආරම්භ කිරීමට \'නව ලිපියක් ලියාපදිංචි කරන්න\' ඔබන්න.';

  @override
  String stepsDone(int done, int total) {
    return 'පියවර $totalන් $doneක්';
  }

  @override
  String get noAddressYet => 'තවම ලිපිනයක් නැත';

  @override
  String startedAt(String time) {
    return 'ආරම්භ කළේ $time';
  }

  @override
  String get continueDraft => 'ඉදිරියට';

  @override
  String get deleteDraft => 'කෙටුම්පත මකන්න';

  @override
  String get deleteDraftTitle => 'මෙම කෙටුම්පත මකන්නද?';

  @override
  String get deleteDraftBody =>
      'කෙටුම්පත අවලංගු වන අතර එහි තරාදි කියවීම නිදහස් වේ. මෙය අහෝසි කළ නොහැක.';

  @override
  String get registerALetter => 'ලිපියක් ලියාපදිංචි කරන්න';

  @override
  String get moreActions => 'තවත් ක්‍රියා';

  @override
  String get clearForm => 'පෝරමය හිස් කරන්න';

  @override
  String get clearFormTitle => 'පෝරමය හිස් කරන්නද?';

  @override
  String get clearFormBody =>
      'ලබන්නා, යවන්නා, ගමනාන්ත කාර්යාලය සහ සම්බන්ධතා ක්ෂේත්‍ර හිස් කරන්නද?';

  @override
  String get openingDraft => 'කෙටුම්පත විවෘත කරමින්…';

  @override
  String get draft => 'කෙටුම්පත';

  @override
  String get unsavedChanges => 'නොසුරැකි වෙනස්කම්';

  @override
  String get allChangesSaved => 'සියලු වෙනස්කම් සුරකින ලදී';

  @override
  String stepOf(int step, int total) {
    return 'පියවර $totalන් $step';
  }

  @override
  String get stepPhoto => 'ඡායාරූපය';

  @override
  String get stepAddresses => 'ලිපින';

  @override
  String get stepConfirm => 'තහවුරු';

  @override
  String get stepWeigh => 'බර';

  @override
  String get stepPay => 'ගාස්තුව';

  @override
  String get alreadyAcceptedTitle => 'දැනටමත් භාරගෙන ඇත';

  @override
  String alreadyAcceptedBody(String id) {
    return 'මෙම කෙටුම්පත ලියාපදිංචි අයිතමය $id බවට පත් විය.';
  }

  @override
  String get openReceipt => 'ලේබලය සහ රිසිට්පත විවෘත කරන්න';

  @override
  String get draftClosedTitle => 'කෙටුම්පත වසා ඇත';

  @override
  String get draftClosedBody =>
      'මෙම කෙටුම්පත අවලංගු කරන ලදී. කවුළු තිරයෙන් නව ලියාපදිංචියක් ආරම්භ කරන්න.';

  @override
  String get stepPhotoTitle => 'පියවර 1/5: ලියුම් කවරය ඡායාරූපගත කරන්න';

  @override
  String get nextPhoto =>
      'ලියුම් කවරයේ ඡායාරූපයක් ගෙන \'ලිපිනය කියවන්න\' ඔබන්න. ඔබට ලිපිනය ටයිප් කිරීමටද හැක.';

  @override
  String get captureMode => 'ග්‍රහණ ක්‍රමය (පර්යේෂණ)';

  @override
  String get captureModeHint =>
      'P1 සහාය සහිත ක්‍රමයයි. B1 සහ B0 ඇගයීම සඳහා මූලික රේඛා වේ.';

  @override
  String get modeP1 => 'P1 – සහාය සහිත ග්‍රහණය (නිර්දේශිත)';

  @override
  String get modeB1 => 'B1 – මූලික OCR + නීති';

  @override
  String get modeB0 => 'B0 – අතින් ඇතුළත් කිරීම (මූලික)';

  @override
  String get envelopePhoto => 'ලියුම් කවරයේ ඡායාරූපය';

  @override
  String get envelopePhotoHint =>
      'ලියුම් කවරයේ ඉදිරිපස, සමතලව සහ හොඳ ආලෝකයක් යටතේ ඡායාරූපගත කරන්න.';

  @override
  String get photoOptionalB0 => 'අතින් ඇතුළත් කිරීමේදී (B0) අත්‍යවශ්‍ය නොවේ.';

  @override
  String get takePhoto => 'ඡායාරූපයක් ගන්න';

  @override
  String get chooseFromGallery => 'ඡායාරූපයක් තෝරන්න';

  @override
  String get captureFromScale => 'තරාදි කැමරාවෙන් ගන්න';

  @override
  String get noPhotoYet => 'තවම ඡායාරූපයක් නැත';

  @override
  String get noPhotoYetHint => 'ලියුම් කවරයේ ඉදිරිපස ඡායාරූපයක් ගන්න.';

  @override
  String get photoNotLoaded => 'ඡායාරූපය පෙන්විය නොහැකි විය.';

  @override
  String get rotateLeft => 'වමට කරකවන්න';

  @override
  String get rotateRight => 'දකුණට කරකවන්න';

  @override
  String get photoQualityTitle => 'ඡායාරූපයේ ගුණාත්මකභාවය';

  @override
  String get qLowResolution => 'ඡායාරූපය ඉතා කුඩායි – ළඟට යන්න.';

  @override
  String get qBlurry => 'ඡායාරූපය බොඳයි – දුරකථනය නොසෙල්වා තබා නැවත ගන්න.';

  @override
  String get qTooDark => 'ඡායාරූපය ඉතා අඳුරුයි – ආලෝකය වැඩි කරන්න.';

  @override
  String get qTooBright => 'ඡායාරූපය ඉතා දීප්තිමත්ය.';

  @override
  String get qLowContrast => 'අකුරුවල වෙනස අඩුයි.';

  @override
  String get qGlare =>
      'ලියුම් කවරය මත දිදුලීමක් ඇත – එය ඇල කරන්න හෝ ෆ්ලෑෂ් එක නිවා දමන්න.';

  @override
  String get readAddressTitle => 'ලිපිනය කියවන්න';

  @override
  String get readAddressHint =>
      'සේවාදායකය ඡායාරූපය කියවා ක්ෂේත්‍ර යෝජනා කරයි. ඔබ ඒවා පියවර 2 හිදී පරීක්ෂා කරයි.';

  @override
  String get readFor => 'කාගේ ලිපිනය කියවිය යුතුද';

  @override
  String get recipient => 'ලබන්නා';

  @override
  String get sender => 'යවන්නා';

  @override
  String get handwriting => 'අත්අකුරු';

  @override
  String get writingAuto => 'ස්වයංක්‍රීය';

  @override
  String get writingHand => 'අතින් ලියූ';

  @override
  String get writingPrinted => 'මුද්‍රිත';

  @override
  String get addressLanguage => 'ලිපිනයේ භාෂාව';

  @override
  String get detectAutomatically => 'ස්වයංක්‍රීයව හඳුනාගන්න';

  @override
  String get readAddress => 'ලිපිනය කියවන්න';

  @override
  String get typeOrPaste => 'ලිපිනය ටයිප් කරන්න හෝ අලවන්න';

  @override
  String get typeOrPasteHint =>
      'ඡායාරූපයක් නැති විට හෝ කියවනයට එය කියවිය නොහැකි වූ විට මෙය භාවිත කරන්න.';

  @override
  String get fillFromText => 'පාඨයෙන් ක්ෂේත්‍ර පුරවන්න';

  @override
  String get readResultTitle => 'කියවනය සොයාගත් දේ';

  @override
  String fieldConfidence(int percent) {
    return 'ක්ෂේත්‍ර විශ්වාසය $percent %';
  }

  @override
  String get noFlags => 'සලකුණු කළ ක්ෂේත්‍ර නැත';

  @override
  String fieldsToCheck(int count) {
    return 'පරීක්ෂා කිරීමට ක්ෂේත්‍ර $count';
  }

  @override
  String get handwritingModel => 'අත්අකුරු ආකෘතිය';

  @override
  String get printedTextReader => 'මුද්‍රිත පාඨ කියවනය';

  @override
  String get readResultNext =>
      'හිස් ක්ෂේත්‍ර මෙම ප්‍රතිඵලයෙන් පුරවන ලදී. ඒවා පරීක්ෂා කිරීමට ඊළඟ පියවරට යන්න.';

  @override
  String get stepAddressesTitle => 'පියවර 2/5: ලිපින පරීක්ෂා කරන්න';

  @override
  String get nextAddresses =>
      'සෑම ක්ෂේත්‍රයක්ම ලියුම් කවරය සමඟ සසඳන්න. වැරදි ඕනෑම දෙයක් නිවැරදි කරන්න.';

  @override
  String get recipientTo => 'ලබන්නා (වෙත)';

  @override
  String get recipientHint =>
      'ලිපිය යොමු කර ඇත්තේ කාටද. නම සහ තැපැල් නගරය අවශ්‍යයි.';

  @override
  String get senderFrom => 'යවන්නා (වෙතින්)';

  @override
  String get senderHint => 'ලිපිය තැපැල් කරන්නේ කවුද (රිසිට්පතේ මුද්‍රණය වේ).';

  @override
  String get useAllSuggestions => 'සියලු යෝජනා භාවිත කරන්න';

  @override
  String get confidenceLegend =>
      'ප්‍රතිශත මගින් කියවනය කෙතරම් විශ්වාසදැයි පෙන්වයි. රතු පාටින් සලකුණු කළ ක්ෂේත්‍ර හොඳින් පරීක්ෂා කරන්න.';

  @override
  String get fName => 'නම';

  @override
  String get fHouse => 'නිවස / ඒකක අංකය';

  @override
  String get fStreet => 'වීදිය / පාර';

  @override
  String get fLocality => 'ගම / ප්‍රදේශය';

  @override
  String get fCity => 'තැපැල් නගරය';

  @override
  String get fPostcode => 'තැපැල් කේතය';

  @override
  String get fRegion => 'දිස්ත්‍රික්කය / පළාත';

  @override
  String modelConfidence(int percent) {
    return 'කියවන විශ්වාසය ප්‍රතිශත $percent';
  }

  @override
  String get lowConfidenceCheck =>
      'අඩු විශ්වාසය – ලියුම් කවරය සමඟ පරීක්ෂා කරන්න';

  @override
  String suggestedValue(String value) {
    return 'යෝජිත: $value';
  }

  @override
  String get use => 'භාවිත කරන්න';

  @override
  String postcodeDerived(String postcode) {
    return 'නගරයෙන් තැපැල් කේතය $postcode ලබාගත හැක. භාවිතයට පෙර පරීක්ෂා කරන්න.';
  }

  @override
  String get useIt => 'එය භාවිත කරන්න';

  @override
  String get townPostcodeOk => 'නගරය සහ තැපැල් කේතය නාමාවලිය සමඟ ගැළපේ.';

  @override
  String get townPostcodeCheck => 'නගර සහ තැපැල් කේත පරීක්ෂාව';

  @override
  String get townPostcodeMismatch => 'තැපැල් කේතය වෙනත් නගරයකට අයත්ය.';

  @override
  String get townUnknown => 'නගරය යොමු ලැයිස්තුවේ නැත.';

  @override
  String get postcodeUnknown => 'තැපැල් කේතය යොමු ලැයිස්තුවේ නැත.';

  @override
  String expectedValues(String values) {
    return 'අපේක්ෂිත: $values';
  }

  @override
  String get stepConfirmTitle => 'පියවර 3/5: විස්තර තහවුරු කරන්න';

  @override
  String get nextConfirm =>
      'ගමනාන්ත කාර්යාලය සහ යවන්නාට යාවත්කාලීන ලැබෙන ආකාරය තෝරා තහවුරු කරන්න.';

  @override
  String get destinationOfficeHint =>
      'ලබන්නාගේ ලිපිනයට බෙදාහරින තැපැල් කාර්යාලය.';

  @override
  String get deliveryOffice => 'බෙදාහැරීමේ කාර්යාලය';

  @override
  String get choose => 'තෝරන්න';

  @override
  String get senderUpdates => 'යවන්නාට යාවත්කාලීන';

  @override
  String get senderUpdatesHint =>
      'තත්ත්වය වෙනස් වන විට යවන්නාට යවන අත්‍යවශ්‍ය නොවන පණිවිඩ.';

  @override
  String get sendUpdatesBy => 'තත්ත්ව යාවත්කාලීන යවන ආකාරය';

  @override
  String get senderEmail => 'යවන්නාගේ ඊමේල්';

  @override
  String get senderMobile => 'යවන්නාගේ ජංගම අංකය';

  @override
  String get mobileFormat => 'ආකෘතිය: 07XXXXXXXX';

  @override
  String get messageLanguage => 'පණිවිඩයේ භාෂාව';

  @override
  String get whichUpdates => 'කුමන යාවත්කාලීනද';

  @override
  String get updatesKey =>
      'ප්‍රධාන යාවත්කාලීන පමණි (භාරගැනීම, බෙදාහැරීමට රැගෙන යාම, බෙදාදීම, ගැටලු)';

  @override
  String get updatesAll => 'පිළිගත් සෑම ස්කෑන් එකක්ම';

  @override
  String get smsGatewayNote =>
      'අත්හදා බැලීම සඳහා SMS දොරටුවක් අනුමත කර ඇත්නම් පමණක් SMS යවනු ලැබේ.';

  @override
  String detailsConfirmedBy(String user) {
    return '$user විසින් විස්තර තහවුරු කරන ලදී';
  }

  @override
  String reviewStats(int suggested, int kept, int corrected, int typed) {
    return 'යෝජිත $suggested · තබාගත් $kept · නිවැරදි කළ $corrected · ටයිප් කළ $typed';
  }

  @override
  String get reconfirmNeeded =>
      'තහවුරු කිරීමෙන් පසු ඔබ විස්තර වෙනස් කළා. ඒවා නැවත තහවුරු කරන්න.';

  @override
  String get confirmDetails =>
      'මම ලියුම් කවරය පරීක්ෂා කළෙමි – විස්තර තහවුරු කරන්න';

  @override
  String get confirmDetailsHint =>
      'සෑම ක්ෂේත්‍රයක්ම ලියුම් කවරය සමඟ සැසඳීමෙන් පසුව පමණක් තහවුරු කරන්න.';

  @override
  String errPartyName(String party) {
    return '$party: නම ඇතුළත් කරන්න';
  }

  @override
  String errPartyCity(String party) {
    return '$party: තැපැල් නගරය ඇතුළත් කරන්න';
  }

  @override
  String errPartyAddress(String party) {
    return '$party: නිවසේ අංකයක්, වීදියක් හෝ ගමක් ඇතුළත් කරන්න';
  }

  @override
  String get errDestinationRequired => 'ගමනාන්ත කාර්යාලය තෝරන්න';

  @override
  String get errEmailInvalid =>
      'වලංගු ඊමේල් ලිපිනයක් ඇතුළත් කරන්න, උදා: name@example.com';

  @override
  String get errPhoneInvalid =>
      'ශ්‍රී ලංකා ජංගම අංකයක් ඇතුළත් කරන්න, උදා: 0771234567';

  @override
  String get stepWeighTitle => 'පියවර 4/5: ලිපිය බර කරන්න';

  @override
  String get nextWeigh =>
      'ලිපිය තරාදිය මත තබන්න. කියවීම ස්ථාවර වූ විට \'මෙම බර භාවිත කරන්න\' ඔබන්න.';

  @override
  String weightRecorded(String weight) {
    return 'සටහන් කළ බර: $weight';
  }

  @override
  String weightFromScale(String device, String uncertainty) {
    return 'තරාදිය $device වෙතින්, අවිනිශ්චිතතාව ± ග්‍රෑ. $uncertainty';
  }

  @override
  String weightManual(String instrument) {
    return 'අතින් ඇතුළත් කළා – $instrument';
  }

  @override
  String get iotScale => 'IoT තරාදිය';

  @override
  String get iotScaleHint =>
      'ලිපිය තරාදිය මත තබා කියවීම ස්ථාවර වන තෙක් රැඳී සිටින්න.';

  @override
  String get noScaleForOffice =>
      'ඔබේ කාර්යාලයට IoT තරාදියක් ලියාපදිංචි කර නැත. පහතින් බර අතින් ඇතුළත් කරන්න.';

  @override
  String get scale => 'තරාදිය';

  @override
  String get noReading => 'කියවීමක් නැත';

  @override
  String get currentReading => 'වත්මන් කියවීම';

  @override
  String get stableReady => 'ස්ථාවරයි – සූදානම්';

  @override
  String get settling => 'ස්ථාවර වෙමින්…';

  @override
  String spread(String grams) {
    return 'විචලනය ග්‍රෑ. $grams';
  }

  @override
  String get useThisWeight => 'මෙම බර භාවිත කරන්න';

  @override
  String get manualWeightTitle => 'බර අතින් ඇතුළත් කරන්න';

  @override
  String get manualWeightHint =>
      'IoT තරාදිය භාවිත කළ නොහැකි විට පමණි. මෙය විගණනය සඳහා සටහන් වේ.';

  @override
  String get weightGrams => 'බර (ග්‍රෑම්)';

  @override
  String get instrument => 'භාවිත කළ තරාදිය';

  @override
  String get instrumentHint => 'උදා: අනුමත කවුළු තරාදිය අංක 2';

  @override
  String get manualReasonHint => 'IoT තරාදිය භාවිත කළ නොහැකි වූයේ ඇයි';

  @override
  String get recordManualWeight => 'අතින් බර සටහන් කරන්න';

  @override
  String get errGrams => 'බර ග්‍රෑම්වලින් ඇතුළත් කරන්න (0ට වැඩි, 5000 දක්වා)';

  @override
  String get errInstrument => 'භාවිත කළ තරාදිය ඇතුළත් කරන්න';

  @override
  String get errManualReason =>
      'IoT තරාදිය භාවිත නොකළේ ඇයිදැයි සඳහන් කරන්න (අවම අක්ෂර 5)';

  @override
  String get stepPayTitle => 'පියවර 5/5: ගාස්තුව සහ භාරගැනීම';

  @override
  String get nextPay => 'ගාස්තුව ගණනය කර, ගෙවීම ලබාගෙන, ලිපිය භාරගන්න.';

  @override
  String get extraServices => 'අමතර සේවා';

  @override
  String get adviceOfDelivery => 'බෙදාහැරීමේ දැන්වීම';

  @override
  String get adviceOfDeliveryHint =>
      'යවන්නාට අත්සන් කළ බෙදාහැරීමේ කාඩ්පතක් ලැබේ (අමතර ගාස්තුවක්).';

  @override
  String get insuredValue => 'රක්ෂිත වටිනාකම (රු.)';

  @override
  String get insuredValueHint =>
      'යවන්නාට රක්ෂණය අවශ්‍ය නම්, අන්තර්ගතයේ ප්‍රකාශිත වටිනාකම';

  @override
  String get errInsuredValue =>
      'රක්ෂිත වටිනාකම රුපියල් ගණනක් ලෙස ඇතුළත් කරන්න, නැතහොත් හිස්ව තබන්න';

  @override
  String get calculateCharge => 'ගාස්තුව ගණනය කරන්න';

  @override
  String get weighFirst => 'පළමුව පියවර 4 හි බර සටහන් කරන්න.';

  @override
  String get reweighRequired => 'නැවත බර කිරීම අවශ්‍යයි';

  @override
  String get cannotQuote => 'ගාස්තුව ගණනය කළ නොහැක';

  @override
  String get charge => 'ගාස්තුව';

  @override
  String tariffLine(String version, String weight, String uncertainty) {
    return 'ගාස්තු ලේඛනය $version · බර ග්‍රෑ. $weight ± $uncertainty';
  }

  @override
  String get tariffNotApproved => 'ගාස්තු ලේඛනය තවම අනුමත නැත – පර්යේෂණ භාවිතය';

  @override
  String get qPostage => 'ලිපි තැපැල් ගාස්තුව';

  @override
  String get qRegistration => 'ලියාපදිංචි ගාස්තුව';

  @override
  String get qInsurance => 'රක්ෂණය';

  @override
  String get total => 'එකතුව';

  @override
  String get beforeAccepting => 'භාරගැනීමට පෙර';

  @override
  String get checkConfirmed => 'විස්තර තහවුරු කළා (පියවර 3)';

  @override
  String get checkWeight => 'බර සටහන් කළා (පියවර 4)';

  @override
  String get checkCharge => 'ගාස්තුව ගණනය කළා';

  @override
  String get payment => 'ගෙවීම';

  @override
  String get paymentMethod => 'ගෙවීමේ ක්‍රමය';

  @override
  String get payCash => 'මුදල්';

  @override
  String get payCard => 'කාඩ්පත';

  @override
  String get payOther => 'වෙනත් (අනුමත)';

  @override
  String get receiptReference => 'රිසිට්පත් හෝ යොමු අංකය';

  @override
  String receivedAndAccept(String amount) {
    return '$amount ලැබුණා – ලිපිය භාරගන්න';
  }

  @override
  String get confirmFirst => 'භාරගැනීමට පෙර විස්තර තහවුරු කරන්න (පියවර 3).';

  @override
  String get acceptLetter => 'ලිපිය භාරගන්න';

  @override
  String get acceptLetterTitle => 'මෙම ලිපිය භාරගන්නද?';

  @override
  String acceptLetterBody(String amount) {
    return 'ඔබට යවන්නාගෙන් $amount ලැබුණු බව තහවුරු කරන්න. ලුහුබැඳීමේ අංකයක් සෑදෙන අතර එය ඉවත් කළ නොහැක.';
  }

  @override
  String get labelAndReceipt => 'ලේබලය සහ රිසිට්පත';

  @override
  String get letterAccepted => 'ලිපිය භාරගන්නා ලදී';

  @override
  String get letterAcceptedBody =>
      'ලේබලය මුද්‍රණය කර ලියුම් කවරයේ අලවා, තහවුරු කිරීමට එය ස්කෑන් කරන්න. රිසිට්පත යවන්නාට දෙන්න.';

  @override
  String get registeredLetter => 'ලියාපදිංචි ලිපිය';

  @override
  String get to => 'වෙත';

  @override
  String get receiptDetails => 'රිසිට්පත';

  @override
  String get acceptedBy => 'භාරගත්තේ';

  @override
  String get senderName => 'යවන්නා';

  @override
  String get weight => 'බර';

  @override
  String get paidBy => 'ගෙවීම';

  @override
  String get tariff => 'ගාස්තු ලේඛනය';

  @override
  String get labelPrints => 'ලේබල මුද්‍රණ';

  @override
  String get senderTracking => 'යවන්නාගේ ලුහුබැඳීමේ QR';

  @override
  String get senderTrackingHint =>
      'රිසිට්පතේ මුද්‍රණය වේ. යවන්නාට එමගින් ලිපිය ලුහුබැඳිය හැක.';

  @override
  String get copyLink => 'සබැඳිය පිටපත් කරන්න';

  @override
  String get linkCopied => 'සබැඳිය පිටපත් කළා';

  @override
  String get verifyLabel => 'මුද්‍රිත ලේබලය තහවුරු කරන්න';

  @override
  String get verifyLabelInstruction =>
      'ලියුම් කවරයේ ඇලවූ ලේබලයේ තීරු කේතය ස්කෑන් කරන්න';

  @override
  String get labelVerified =>
      'ලේබලය තහවුරු විය – මුද්‍රිත ලේබලය මෙම අයිතමයට ගැළපේ.';

  @override
  String labelMismatch(String id) {
    return 'ස්කෑන් කළ ලේබලයේ ඇත්තේ $id, මෙම අයිතමය නොවේ. ලේබලය නැවත මුද්‍රණය කරන්න.';
  }

  @override
  String get markPrinted => 'ලේබලය මුද්‍රණය කළ බව සලකුණු කරන්න';

  @override
  String get recordReprint => 'නැවත මුද්‍රණයක් සටහන් කරන්න';

  @override
  String get reprintTitle => 'ලේබලය නැවත මුද්‍රණය කරන්නද?';

  @override
  String get reprintBody =>
      'නැවත මුද්‍රණය නව අයිතමයක් සාදන්නේ නැත. ලේබලය නැවත මුද්‍රණය කරන්නේ ඇයිදැයි සඳහන් කරන්න.';

  @override
  String get printRecorded => 'ලේබල මුද්‍රණය සටහන් කළා';

  @override
  String get reprintRecorded => 'නැවත මුද්‍රණය සටහන් කළා';

  @override
  String get printNote =>
      'කවුළු පරිගණකයෙන් (වෙබ් යෙදුම) හෝ සම්බන්ධ ලේබල මුද්‍රකයකින් ලේබලය මුද්‍රණය කර, මෙහි සටහන් කරන්න.';

  @override
  String get openItem => 'අයිතමයේ විස්තර විවෘත කරන්න';

  @override
  String get registerAnother => 'තවත් ලිපියක් ලියාපදිංචි කරන්න';

  @override
  String get findItem => 'ලුහුබැඳීමේ අංකය';

  @override
  String get findItemHint => 'අංකය සම්පූර්ණයෙන් හෝ කොටසක්';

  @override
  String get status => 'තත්ත්වය';

  @override
  String get allStatuses => 'සියලු තත්ත්ව';

  @override
  String get scanToFind => 'සොයා ගැනීමට ලේබලයක් ස්කෑන් කරන්න';

  @override
  String get noItemsFound => 'අයිතම හමු නොවීය';

  @override
  String itemsShown(int count) {
    return 'අයිතම $count';
  }

  @override
  String acceptedAt(String time) {
    return 'භාරගත්තේ $time';
  }

  @override
  String get itemDetails => 'අයිතමයේ විස්තර';

  @override
  String get copyId => 'ලුහුබැඳීමේ අංකය පිටපත් කරන්න';

  @override
  String get idCopied => 'ලුහුබැඳීමේ අංකය පිටපත් කළා';

  @override
  String get recordAScan => 'ස්කෑන් එකක් සටහන් කරන්න';

  @override
  String get assignPostman => 'තැපැල් භාරකරු පවරන්න';

  @override
  String assignedTo(String user) {
    return '$user වෙත පවරන ලදී';
  }

  @override
  String get noPostmenAtOffice =>
      'ගමනාන්ත කාර්යාලයේ ක්‍රියාකාරී තැපැල් භාරකරුවෙක් නැත.';

  @override
  String get details => 'විස්තර';

  @override
  String byWorker(String worker, String role) {
    return '$worker ($role) විසින්';
  }

  @override
  String locationAccuracy(int metres) {
    return 'ස්ථාන නිරවද්‍යතාව ± මී. $metres';
  }

  @override
  String distanceFromZone(int metres) {
    return 'යොමු ප්‍රදේශයේ සිට මී. $metres';
  }

  @override
  String savedOffline(int seconds) {
    return 'ජාලයෙන් තොරව සුරකින ලදී, තත්පර $secondsකට පසු උඩුගත විය';
  }

  @override
  String ackLine(String type, String name) {
    return 'පිළිගැනීම: $type $name';
  }

  @override
  String reviewNote(String user, String reason) {
    return '$user සමාලෝචනය කළා: $reason';
  }

  @override
  String get flagged => 'සලකුණු කළා';

  @override
  String heldTab(int count) {
    return 'රඳවා ඇති ($count)';
  }

  @override
  String flaggedTab(int count) {
    return 'සලකුණු කළ ($count)';
  }

  @override
  String get heldIntro =>
      'මෙම ස්කෑන් මගින් තත්ත්වය වෙනස් වූයේ නැත. හේතු පරීක්ෂා කර එක් එක් ස්කෑන් එක අනුමත හෝ ප්‍රතික්ෂේප කරන්න.';

  @override
  String get flaggedIntro =>
      'පසුගිය දින 14 තුළ අවධානයට සලකුණු කළ පිළිගත් ස්කෑන් (උදා: අවිනිශ්චිත ස්ථානය). ක්‍රියාමාර්ගයක් අවශ්‍ය නැත.';

  @override
  String get noHeldScans => 'සමාලෝචනයට රැඳී ඇති ස්කෑන් නැත';

  @override
  String get noFlaggedScans => 'සලකුණු කළ ස්කෑන් නැත';

  @override
  String requestedStatus(String status) {
    return 'ඉල්ලූ තත්ත්වය: $status';
  }

  @override
  String get mockLocation => 'අනුකරණ ස්ථානය';

  @override
  String get offlineScan => 'ජාලයෙන් තොරව සුරකින ලදී';

  @override
  String get approve => 'අනුමත කරන්න';

  @override
  String get reject => 'ප්‍රතික්ෂේප කරන්න';

  @override
  String get approveScanTitle => 'මෙම ස්කෑන් එක අනුමත කරන්නද?';

  @override
  String get approveScanBody =>
      'තත්ත්වය වෙනස් වන අතර යවන්නාට දැනුම් දෙනු ලැබේ. ඔබ එය අනුමත කරන්නේ ඇයිදැයි සඳහන් කරන්න.';

  @override
  String get rejectScanTitle => 'මෙම ස්කෑන් එක ප්‍රතික්ෂේප කරන්නද?';

  @override
  String get rejectScanBody =>
      'ස්කෑන් එක ඉතිහාසයේ රැඳෙන නමුත් තත්ත්වය වෙනස් නොකරයි. ඔබ එය ප්‍රතික්ෂේප කරන්නේ ඇයිදැයි සඳහන් කරන්න.';

  @override
  String get scanApproved => 'ස්කෑන් එක අනුමත කළා';

  @override
  String get scanRejected => 'ස්කෑන් එක ප්‍රතික්ෂේප කළා';

  @override
  String get messagesIntro =>
      'යවන්නන්ට යවන තත්ත්ව පණිවිඩ. අසාර්ථක ඒවා නැවත යවන්න, නැතහොත් යවන්නා සම්බන්ධ කරගත් පසු විසඳූ බව සලකුණු කරන්න.';

  @override
  String get noMessages => 'පණිවිඩ නැත';

  @override
  String attemptsAndTime(int attempts, String time) {
    return 'උත්සාහ $attempts · සෑදුවේ $time';
  }

  @override
  String get preview => 'පෙරදසුන';

  @override
  String get messagePreview => 'පණිවිඩය';

  @override
  String get markResolved => 'විසඳූ බව සලකුණු කරන්න';

  @override
  String get retryMessageTitle => 'මෙම පණිවිඩය නැවත යවන්නද?';

  @override
  String get retryMessageBody => 'පණිවිඩය නැවත යවනු ලැබේ.';

  @override
  String get resolveMessageTitle => 'පණිවිඩය විසඳූ බව සලකුණු කරන්නද?';

  @override
  String get resolveMessageBody =>
      'වෙනත් ක්‍රමයකින් යවන්නාට දැනුම් දුන් පසු මෙය භාවිත කරන්න.';

  @override
  String get devicesIntro =>
      'තරාදිය ලිපි බර කරන අතර එහි කැමරාව ලියුම් කවර ඡායාරූපගත කරයි. සෑම නැවත ආරම්භයකින් පසුම හිස් තරාදිය ශුන්‍ය කරන්න.';

  @override
  String get noDevices => 'ඔබේ කාර්යාලයට තරාදියක් ලියාපදිංචි කර නැත';

  @override
  String get online => 'සම්බන්ධයි';

  @override
  String get offline => 'සම්බන්ධ නැත';

  @override
  String calibrationStatus(String value) {
    return 'ක්‍රමාංකනය: $value';
  }

  @override
  String get firmware => 'ස්ථිරාංග';

  @override
  String get cameraOk => 'කැමරාව සූදානම්';

  @override
  String get cameraFault => 'කැමරා දෝෂයක්';

  @override
  String get stable => 'ස්ථාවරයි';

  @override
  String get loaded => 'තරාදිය මත අයිතමයක් ඇත';

  @override
  String get needsTare => 'ශුන්‍ය කිරීම අවශ්‍යයි';

  @override
  String get notReadyToWeigh => 'බර කිරීමට සූදානම් නැත';

  @override
  String get actions => 'ක්‍රියා';

  @override
  String get tareHint =>
      'වේදිකාව හිස්ව තිබියදී ශුන්‍ය කරන්න. දන්නා යොමු ස්කන්ධයකින් ක්‍රමාංකනය කරන්න.';

  @override
  String get tare => 'ශුන්‍ය කරන්න';

  @override
  String get calibrate => 'ක්‍රමාංකනය කරන්න';

  @override
  String get identify => 'හඳුනාගන්න (ආලෝකය දැල්වීම)';

  @override
  String get testPhoto => 'පරීක්ෂණ ඡායාරූපයක් ගන්න';

  @override
  String get commandSent => 'විධානය තරාදියට යවන ලදී';

  @override
  String get calibrateTitle => 'තරාදිය ක්‍රමාංකනය කරන්න';

  @override
  String get calibrateBody =>
      'මුලින්ම වේදිකාව හිස් කර \'ශුන්‍ය කරන්න\' ඔබන්න. ඉන්පසු දන්නා යොමු ස්කන්ධයක් වේදිකාව මත තබා එහි බර ඇතුළත් කරන්න.';

  @override
  String get referenceMass => 'යොමු ස්කන්ධය (ග්‍රෑම්, 10–1000)';

  @override
  String get office => 'කාර්යාලය';

  @override
  String get wifiSignal => 'Wi-Fi සංඥාව';

  @override
  String get lastSeen => 'අවසන් වරට දුටුවේ';

  @override
  String get calibration => 'ක්‍රමාංකනය';

  @override
  String get uncertainty => 'අවිනිශ්චිතතාව';

  @override
  String get recentCommands => 'මෑත විධාන';

  @override
  String get cmdQueued => 'පෝලිමේ';

  @override
  String get cmdSent => 'තරාදියට යවන ලදී';

  @override
  String get cmdDone => 'අවසන්';

  @override
  String get cmdFailed => 'අසාර්ථකයි';

  @override
  String get cmdExpired => 'කල් ඉකුත් විය';

  @override
  String get wpNoReading => 'තරාදිය තවම කියවීමක් එවා නැත.';

  @override
  String get wpStale =>
      'අවසන් කියවීම ඉතා පැරණියි – තරාදියේ Wi-Fi පරීක්ෂා කරන්න.';

  @override
  String get wpSensorFault =>
      'භාර සෛල වර්ධකය ප්‍රතිචාර නොදක්වයි – HX711 රැහැන් පරීක්ෂා කරන්න.';

  @override
  String get wpNeedsTare =>
      'තරාදිය නැවත ආරම්භ විය. වේදිකාව හිස් කර තරාදි පිටුවේ \'ශුන්‍ය කරන්න\' ඔබන්න.';

  @override
  String get wpUncalibrated => 'තරාදිය ක්‍රමාංකනය කර නැත.';

  @override
  String get wpEmpty => 'වේදිකාව මත කිසිවක් නැත.';

  @override
  String get wpUnstable =>
      'කියවීම තවම ස්ථාවර නැත – ලිපිය ස්ථාවර වන තෙක් රැඳී සිටින්න.';

  @override
  String get wpNegative => 'සෘණ බරක් – වේදිකාව හිස් කර ශුන්‍ය කරන්න.';

  @override
  String get officesIntro =>
      'ස්කෑන් කළ ස්ථානය පරීක්ෂා කිරීමට එක් එක් කාර්යාලයේ යොමු ලක්ෂ්‍යය සහ අරය භාවිත වේ.';

  @override
  String get referencePoint => 'යොමු ලක්ෂ්‍යය';

  @override
  String get zoneRadius => 'කාර්යාල කලාපයේ අරය (මී.)';

  @override
  String get serviceRadius => 'බෙදාහැරීමේ ප්‍රදේශයේ අරය';

  @override
  String get provenance => 'මූලාශ්‍රය (ලක්ෂ්‍යය මැන්නේ කෙසේද)';

  @override
  String get provenanceHint => 'අවශ්‍යයි. එය ලක්ෂ්‍යය සමඟ ගබඩා කර සටහන් වේ.';

  @override
  String provenanceDefault(String date, int metres) {
    return '$date දින ස්ථානයේදී දුරකථන GPS මගින් මනින ලදී, නිරවද්‍යතාව ± මී. $metres';
  }

  @override
  String get useMyLocation => 'මගේ ස්ථානය යොමු ලක්ෂ්‍යය ලෙස භාවිත කරන්න';

  @override
  String get setReferencePoint => 'යොමු ලක්ෂ්‍යය සකසන්න';

  @override
  String setReferencePointBody(String office) {
    return '$office හි ප්‍රවේශ දොරටුව අසල සිටින්න. මෙම පිහිටීම කාර්යාලයේ යොමු ලක්ෂ්‍යය වේ:';
  }

  @override
  String get poorAccuracy =>
      'ස්ථානය නිවැරදි නැත. එළියට හෝ ජනේලයක් අසලට ගොස් නැවත උත්සාහ කරන්න.';

  @override
  String get officeUpdated => 'කාර්යාලයේ යොමු ලක්ෂ්‍යය සුරකින ලදී';

  @override
  String get registeredItems => 'ලියාපදිංචි අයිතම';

  @override
  String get waitingReview => 'සමාලෝචනයට රැඳී ඇත';

  @override
  String get openDrafts => 'විවෘත කෙටුම්පත්';

  @override
  String get itemsByStatus => 'තත්ත්වය අනුව අයිතම';

  @override
  String get messagesByState => 'තත්ත්වය අනුව යවන්නාට පණිවිඩ';

  @override
  String get reportsOnWeb =>
      'ඇගයීම සඳහා CSV අපනයන වෙබ් යෙදුමේ වාර්තා පිටුවේ ඇත.';

  @override
  String get auditTarget => 'වාර්තාව';

  @override
  String get auditTargetHint =>
      'ලුහුබැඳීමේ අංකය, කෙටුම්පත් අංකය, උපාංගය හෝ පරිශීලක නාමය';

  @override
  String get severity => 'මට්ටම';

  @override
  String get allSeverities => 'සියලු මට්ටම්';

  @override
  String get noAuditEntries => 'විගණන සටහන් නැත';

  @override
  String get account => 'ඔබේ ගිණුම';

  @override
  String get name => 'නම';

  @override
  String get role => 'භූමිකාව';

  @override
  String get connection => 'සම්බන්ධතාවය';

  @override
  String get thisDevice => 'මෙම දුරකථනයේ හැඳුනුම';

  @override
  String get changeServerHint =>
      'වෙනත් සේවාදායකයක් භාවිත කිරීමට, ඉවත් වී පුරනය වීමේ තිරයේදී එය වෙනස් කරන්න.';

  @override
  String get offlineData => 'මෙම දුරකථනයේ දත්ත';

  @override
  String get waitingToUpload => 'උඩුගත කිරීමට රැඳී ඇති ස්කෑන්';

  @override
  String get offlineDataHint =>
      'සේවාදායකයේ පිළිතුර පරීක්ෂා කිරීමට උඩුගත කළ ස්කෑන් දින 14ක් තබා ගැනේ. උඩුගත කිරීමට රැඳී ඇති ස්කෑන් කිසිවිටෙක මැකෙන්නේ නැත.';

  @override
  String get clearUploadedHistory => 'උඩුගත කළ ස්කෑන් ඉතිහාසය මකන්න';

  @override
  String historyCleared(int count) {
    return 'උඩුගත කළ ස්කෑන් $countක් මෙම දුරකථනයෙන් මකා දමන ලදී';
  }

  @override
  String get cannotSignOutTitle => 'ඉවත් වීමට පෙර ඔබේ ස්කෑන් උඩුගත කරන්න';

  @override
  String cannotSignOutBody(int count) {
    return 'ස්කෑන් $countක් තවමත් මෙම දුරකථනයේ ඇත. ඔබ පුරනය වී සිටින විට පමණක් ඒවා උඩුගත කළ හැක.';
  }

  @override
  String get signOut => 'ඉවත් වන්න';

  @override
  String get signOutTitle => 'ඉවත් වන්නද?';

  @override
  String get signOutBody => 'නැවත පුරනය වීමට ඔබට මුරපදය අවශ්‍ය වේ.';

  @override
  String get prototypeTitle => 'පර්යේෂණ මූලාකෘතිය';

  @override
  String get prototypeBody =>
      'මෙය SLIIT පර්යේෂණ මූලාකෘතියකි (ව්‍යාපෘතිය J26-IT-372), ශ්‍රී ලංකා තැපැල් නිල සේවාවක් නොවේ. අත්හදා බැලීම අනුමත නොකළහොත් සැබෑ පාරිභෝගික තැපැල් සමඟ එය භාවිත නොකරන්න.';

  @override
  String get aboutTitle => 'මෙම යෙදුම ගැන';

  @override
  String get aboutBody =>
      'PostAssist LK දේශීය ලියාපදිංචි ලිපි භාරගැනීමට, ලේබල් කිරීමට සහ ලුහුබැඳීමට තැපැල් කාර්ය මණ්ඩලයට උදව් කරයි. කවුළු නිලධාරීන් සහාය සහිත ලිපින කියවීම සහ IoT තරාදියක් සමඟ ලිපි ලියාපදිංචි කරයි; තැපැල් භාරකරුවන් සහ හුවමාරු මධ්‍යස්ථාන නිලධාරීන් දුරකථනයේ ස්ථානය සමඟ සෑම භාරදීමක්ම සටහන් කරයි; තැපැල්පතිවරුන් ව්‍යතිරේක සහ යවන්නාට පණිවිඩ සමාලෝචනය කරයි.';

  @override
  String version(String version) {
    return 'අනුවාදය $version';
  }

  @override
  String get privacyTitle => 'රහස්‍යතා දැන්වීම';

  @override
  String get privacyIntro => 'මෙම යෙදුම රැස් කරන දේ සහ ඒ ඇයි:';

  @override
  String get privacyLocation =>
      'ස්ථානය: ඔබ ස්කෑන් එකක් සුරකින විට එක් වරක් කියවයි, එහි නිරවද්‍යතාව, වයස සහ එය අනුකරණය කළ එකක්ද යන්න සමඟ. පසුබිමේ කිසිවිටෙක ලුහුබඳින්නේ නැත.';

  @override
  String get privacyCamera =>
      'කැමරාව: ලේබල ස්කෑන් කිරීමට සහ කවුළුවේදී ලියුම් කවර ඡායාරූපගත කිරීමට පමණක් භාවිත වේ. ඡායාරූප PostAssist සේවාදායකයට යවන අතර දුරකථනයේ ගැලරියේ ගබඩා නොවේ.';

  @override
  String get privacyStorage =>
      'මෙම දුරකථනයේ: ඔබේ පුරනය වීමේ ටෝකනය (සංකේතිත ගබඩාව) සහ ඔබේ ස්කෑන් උඩුගත වන තෙක්, ඉන්පසු දින 14ක්.';

  @override
  String get privacyServer =>
      'දත්ත යවන්නේ පුරනය වීමේදී ඇතුළත් කළ PostAssist සේවාදායක ලිපිනයට පමණි.';

  @override
  String get privacyAudit =>
      'සෑම පුරනය වීමක්, ස්කෑන් එකක් සහ තීරණයක්ම ඔබේ පරිශීලක නාමය සමඟ විගණන සටහනක ලියැවේ.';

  @override
  String get accessibilityTitle => 'ප්‍රවේශ්‍යතා ප්‍රකාශය';

  @override
  String get accessibilityBody =>
      'තැපැල් කවුළුවක සේවය කරන හෝ තැපැල් බෙදාහරින සෑම කෙනෙකුටම මෙම යෙදුම භාවිත කිරීමට හැකි විය යුතුය.';

  @override
  String get a11yLanguages =>
      'යෙදුම සිංහල, දෙමළ හෝ ඉංග්‍රීසියෙන් භාවිත කරන්න (සැකසුම් → භාෂාව).';

  @override
  String get a11yText =>
      'අකුරු ඔබේ දුරකථනයේ අකුරු ප්‍රමාණය අනුගමනය කරයි, 200 % දක්වා.';

  @override
  String get a11yContrast =>
      'අකුරු සහ පාලන WCAG 2.2 AA වෙනස සපුරාලයි; තත්ත්වය වචන සහ අයිකන සමඟ පෙන්වයි, කිසිවිටෙක වර්ණයෙන් පමණක් නොවේ.';

  @override
  String get a11yTargets => 'බොත්තම් සහ පාලන අවම වශයෙන් 48 × 48 dp වේ.';

  @override
  String get a11yScreenReader =>
      'TalkBack සහ VoiceOver සමඟ ක්‍රියා කරයි: ක්ෂේත්‍ර, බොත්තම් සහ ප්‍රගතිය නම් කර ඇත.';

  @override
  String get standardsTitle => 'නිර්මාණ ප්‍රමිති';

  @override
  String get standardsBody =>
      'අතුරුමුහුණත ශ්‍රී ලංකා ඩිජිටල් නිර්මාණ පද්ධතියේ (SLDDS, ඩිජිටල් ආර්ථික අමාත්‍යාංශය, 2026 මහජන අදහස් විමසීමේ කෙටුම්පත) මූලධර්ම අනුගමනය කරයි: සරල භාෂාව, නිල භාෂා තුන, ජංගම-ප්‍රමුඛ පිරිසැලසුම්, ස්ථාවර සංරචක සහ WCAG 2.2 AA ප්‍රවේශ්‍යතාව. එය රජයේ ආයතනයක් විසින් විධිමත්ව ඇගයීමට හෝ අනුමත කිරීමට ලක් කර නැත.';
}
