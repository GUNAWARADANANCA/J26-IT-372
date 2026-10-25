import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';
import '../../widgets/language_switcher.dart';
import '../settings/about_screen.dart';
import '../tracking/public_track_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late final AppState _state = context.read<AppState>();
  late final _server = TextEditingController(text: _state.server);
  late final _username = TextEditingController(text: _state.lastUsername);
  final _password = TextEditingController();
  final _scroll = ScrollController();
  bool _showPassword = false;
  bool _busy = false;
  bool _testing = false;
  bool? _connectionOk;
  Map<String, String> _fieldErrors = {};
  String? _error;

  /// The server panel starts open on first use (default address, nobody signed in yet)
  /// and stays folded away afterwards, so daily sign-in is just name and password.
  late bool _serverOpen = _state.server == AppState.defaultServer || _state.lastUsername.isEmpty;

  @override
  void dispose() {
    _server.dispose();
    _username.dispose();
    _password.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _test() async {
    setState(() {
      _testing = true;
      _connectionOk = null;
    });
    final ok = await _state.testConnection(_server.text);
    if (mounted) {
      setState(() {
        _testing = false;
        _connectionOk = ok;
      });
    }
  }

  Future<void> _submit() async {
    final l = context.l10n;
    final errors = <String, String>{
      if (_server.text.trim().isEmpty) 'server': l.errServerRequired,
      if (_username.text.trim().isEmpty) 'username': l.errUsernameRequired,
      if (_password.text.isEmpty) 'password': l.errPasswordRequired,
    };
    setState(() {
      _fieldErrors = errors;
      _error = null;
      if (errors.containsKey('server')) _serverOpen = true;
    });
    if (errors.isNotEmpty) return scrollToTop(_scroll);
    setState(() => _busy = true);
    try {
      await _state.login(_server.text, _username.text, _password.text);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.isNetwork ? l.errorNetwork : (e.status == 401 ? l.errWrongCredentials : describeError(context, e));
        if (e.isNetwork) _serverOpen = true;
      });
      scrollToTop(_scroll);
    } on FormatException {
      if (mounted) {
        setState(() {
          _error = l.errServerInvalid;
          _serverOpen = true;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final summary = [..._fieldErrors.values, ?_error];

    return Scaffold(
      body: AutofillGroup(
        child: ListView(
          controller: _scroll,
          padding: EdgeInsets.zero,
          children: [
            HeroHeader(
              bottomPadding: 64,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        width: 62,
                        height: 62,
                        decoration: BoxDecoration(
                          color: GovColors.white,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: GovColors.accent, width: 3),
                          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 16, offset: const Offset(0, 6))],
                        ),
                        child: const Icon(Icons.local_post_office_rounded, color: GovColors.navy800, size: 34),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(l.appName,
                                style: t.headlineSmall?.copyWith(color: GovColors.white, fontWeight: FontWeight.w800)),
                            Text(l.appSubtitle, style: t.bodyMedium?.copyWith(color: GovColors.navy100)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Transform.translate(
              offset: const Offset(0, -42),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Semantics(header: true, child: Text(l.signInTitle, style: t.titleLarge)),
                            const SizedBox(height: 14),
                            const LanguageSwitcher(),
                            const SizedBox(height: 16),
                            if (context.select<AppState, bool>((s) => s.sessionExpired)) ...[
                              GovNotice(tone: Tone.warning, title: l.sessionExpiredTitle, message: l.sessionExpiredBody),
                              const SizedBox(height: 14),
                            ],
                            if (summary.isNotEmpty) ...[ProblemSummary(errors: summary), const SizedBox(height: 14)],
                            _serverPanel(l, t),
                            const SizedBox(height: 18),
                            GovTextField(
                              label: l.username,
                              controller: _username,
                              errorText: _fieldErrors['username'],
                              autofillHints: const [AutofillHints.username],
                              autocorrect: false,
                              textInputAction: TextInputAction.next,
                            ),
                            const SizedBox(height: 16),
                            GovTextField(
                              label: l.password,
                              controller: _password,
                              errorText: _fieldErrors['password'],
                              obscureText: !_showPassword,
                              autofillHints: const [AutofillHints.password],
                              textInputAction: TextInputAction.done,
                              onSubmitted: (_) => _submit(),
                              suffix: IconButton(
                                tooltip: _showPassword ? l.hidePassword : l.showPassword,
                                icon: Icon(_showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                                onPressed: () => setState(() => _showPassword = !_showPassword),
                              ),
                            ),
                            const SizedBox(height: 22),
                            PrimaryButton(label: l.signIn, icon: Icons.login_rounded, busy: _busy, onPressed: _submit),
                            const SizedBox(height: 12),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.verified_user_outlined, size: 18, color: GovColors.grey600),
                                const SizedBox(width: 8),
                                Expanded(child: Text(l.staffOnlyNotice, style: t.bodySmall)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    SectionCard(
                      icon: Icons.travel_explore_rounded,
                      hue: Hue.teal,
                      title: l.trackLetterPublic,
                      subtitle: l.trackLetterPublicHint,
                      child: SecondaryButton(
                        label: l.trackALetter,
                        icon: Icons.search_rounded,
                        onPressed: () {
                          _state.setServer(_server.text);
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const PublicTrackScreen()));
                        },
                      ),
                    ),
                    const SizedBox(height: 6),
                    Center(
                      child: TextButton(
                        onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AboutScreen())),
                        child: Text(l.aboutAndPrivacy),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Server address in a fold-away panel: the header always shows which server is
  /// used and whether it answered, the fields open on tap (or on any server problem).
  Widget _serverPanel(AppLocalizations l, TextTheme t) {
    final insecure = _server.text.trim().toLowerCase().startsWith('http://') || !_server.text.contains('://');
    final (Color dot, String? state) = switch (_connectionOk) {
      true => (GovColors.success, l.connectionOk),
      false => (GovColors.error, l.connectionFailed),
      null => (GovColors.grey500, null),
    };
    return Container(
      decoration: BoxDecoration(
        color: GovColors.navy50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _fieldErrors['server'] != null ? GovColors.error : GovColors.navy200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            expanded: _serverOpen,
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => setState(() => _serverOpen = !_serverOpen),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    const IconBadge(Icons.dns_outlined, hue: Hue(GovColors.navy700, GovColors.white), size: 40),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(l.serverAddress, style: t.labelMedium),
                          Text(_server.text.trim().isEmpty ? '—' : _server.text.trim(),
                              style: t.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                          if (state != null)
                            Row(
                              children: [
                                Container(
                                    width: 9, height: 9, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(state,
                                      style: t.labelSmall?.copyWith(color: dot), maxLines: 1, overflow: TextOverflow.ellipsis),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                    Icon(_serverOpen ? Icons.expand_less_rounded : Icons.expand_more_rounded, color: GovColors.navy700),
                  ],
                ),
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
            alignment: Alignment.topCenter,
            child: !_serverOpen
                ? const SizedBox(width: double.infinity)
                : Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        GovTextField(
                          label: l.serverAddress,
                          hint: l.serverAddressHint,
                          controller: _server,
                          errorText: _fieldErrors['server'],
                          keyboardType: TextInputType.url,
                          autocorrect: false,
                          onChanged: (_) => setState(() => _connectionOk = null),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 10,
                          runSpacing: 8,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(48, 46), backgroundColor: GovColors.white),
                              onPressed: _testing ? null : _test,
                              icon: _testing
                                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                                  : const Icon(Icons.wifi_tethering_rounded),
                              label: Text(l.testConnection),
                            ),
                            if (_connectionOk == true) StatusTag(l.connectionOk, tone: Tone.success, icon: Icons.check),
                            if (_connectionOk == false) StatusTag(l.connectionFailed, tone: Tone.error, icon: Icons.close),
                          ],
                        ),
                        if (insecure) ...[
                          const SizedBox(height: 10),
                          GovNotice(tone: Tone.warning, message: l.insecureConnectionWarning),
                        ],
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
