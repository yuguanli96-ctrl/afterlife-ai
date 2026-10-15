import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../utils/app_logger.dart';
import '../utils/env_config.dart';
import 'base_service.dart';

enum ChatContext { general, character, interview }

/// First-phase DeepSeek integration for Afterlife.
///
/// IMPORTANT: This is a *personal testing / bring-your-own-key* adapter.
/// It temporarily reads the DeepSeek API key from the EXISTING Settings key
/// field (which is still named OPENROUTER_API_KEY in EnvConfig).
/// Do not publish a shared API key in a Flutter web build or Android APK.
/// For public/multi-user deployment, move requests to an authenticated backend.
class UnifiedChatService {
  static const String _deepSeekUrl =
      'https://api.deepseek.com/chat/completions';
  static const Duration _requestTimeout = Duration(seconds: 120);

  static const String _defaultGeneralModel = 'deepseek-flash';
  static const String _defaultCharacterModel = 'deepseek-flash';
  static const String _defaultInterviewModel = 'deepseek-flash';

  static const double _defaultTemperature = 0.7;
  static const int _defaultMaxTokens = 4096;

  static bool _isInitialized = false;
  static String? _apiKey;
  static bool _isUsingDefaultKey = false;

  static Future<void> initialize() async {
    await StaticServiceInitializer.initializeService(
      serviceName: 'UnifiedChatService',
      isInitialized: () => _isInitialized,
      markInitialized: () => _isInitialized = true,
      dependencies: [() => EnvConfig.initialize()],
      initializeLogic: () async {
        await refreshApiKey();
        if ((_apiKey == null || _apiKey!.isEmpty) && kDebugMode) {
          AppLogger.warning(
            'No DeepSeek API key: enter your own key in the existing API key field in Settings.',
            tag: 'UnifiedChatService',
          );
        }
      },
    );
  }

  static Future<void> refreshApiKey() async {
    try {
      // Compatibility bridge: existing Settings UI saves into this key.
      // It must contain a DEEPSEEK API key, not an OpenRouter key.
      _apiKey = EnvConfig.get('OPENROUTER_API_KEY')?.trim();
      _isUsingDefaultKey = !(await EnvConfig.hasUserApiKey());
    } catch (e) {
      if (kDebugMode) {
        AppLogger.error(
          'Failed to refresh API key',
          tag: 'UnifiedChatService',
          error: e,
        );
      }
    }
  }

  static Future<String?> sendMessage({
    required ChatContext context,
    String? message,
    List<Map<String, dynamic>>? history,
    List<Map<String, dynamic>>? messages,
    String? systemPrompt,
    String? model,
    String? characterId,
    double? temperature,
    int? maxTokens,
  }) async {
    try {
      if (!_isInitialized) await initialize();
      await refreshApiKey();

      if (_apiKey == null || _apiKey!.isEmpty) {
        return 'Error: No DeepSeek API key configured. Enter your DeepSeek key in the existing API key field in Settings.';
      }
      if (!_isValidDeepSeekApiKeyFormat(_apiKey!)) {
        return 'Error: This is not a valid-looking DeepSeek API key. Do not use an OpenRouter key; enter a DeepSeek key in Settings.';
      }

      switch (context) {
        case ChatContext.general:
          if (message == null) return 'Error: Missing message.';
          return await _sendGeneralMessage(
            message: message,
            history: history ?? [],
            systemPrompt: systemPrompt,
            model: model,
          );
        case ChatContext.character:
          if (message == null || systemPrompt == null || characterId == null) {
            return 'Error: Missing character conversation information.';
          }
          return await _sendCharacterMessage(
            characterId: characterId,
            message: message,
            systemPrompt: systemPrompt,
            chatHistory: history ?? [],
            model: model,
          );
        case ChatContext.interview:
          if (messages == null) return 'Error: Missing interview messages.';
          return await _sendInterviewMessage(
            messages: messages,
            systemPrompt: systemPrompt,
            model: model,
            temperature: temperature,
            maxTokens: maxTokens,
          );
      }
    } catch (e) {
      if (kDebugMode) {
        AppLogger.error(
          'Failed to send chat message',
          tag: 'UnifiedChatService',
          error: e,
        );
      }
      return 'Error: Unable to connect to DeepSeek. Please try again.';
    }
  }

  static Future<String?> _sendGeneralMessage({
    required String message,
    required List<Map<String, dynamic>> history,
    String? systemPrompt,
    String? model,
  }) async {
    return _makeApiRequest(
      _createBody(
        model: _resolveModel(model, _defaultGeneralModel),
        messages: [
          if (systemPrompt != null && systemPrompt.isNotEmpty)
            {'role': 'system', 'content': systemPrompt},
          ..._formatHistory(history),
          {'role': 'user', 'content': message},
        ],
      ),
      'general_chat',
    );
  }

  static Future<String?> _sendCharacterMessage({
    required String characterId,
    required String message,
    required String systemPrompt,
    required List<Map<String, dynamic>> chatHistory,
    String? model,
  }) async {
    // The characterId remains part of the public API; the original service
    // also passed the personality through systemPrompt rather than characterId.
    return _makeApiRequest(
      _createBody(
        model: _resolveModel(model, _defaultCharacterModel),
        messages: [
          {'role': 'system', 'content': systemPrompt},
          ..._formatHistory(chatHistory),
          {'role': 'user', 'content': message},
        ],
      ),
      'character_chat',
    );
  }

  static Future<String?> _sendInterviewMessage({
    required List<Map<String, dynamic>> messages,
    String? systemPrompt,
    String? model,
    double? temperature,
    int? maxTokens,
  }) async {
    return _makeApiRequest(
      _createBody(
        model: _resolveModel(model, _defaultInterviewModel),
        messages: [
          if (systemPrompt != null && systemPrompt.isNotEmpty)
            {'role': 'system', 'content': systemPrompt},
          ..._formatHistory(messages),
        ],
        temperature: temperature,
        maxTokens: maxTokens,
      ),
      'character_interview',
    );
  }

  static Map<String, dynamic> _createBody({
    required String model,
    required List<Map<String, String>> messages,
    double? temperature,
    int? maxTokens,
  }) {
    final requestedTokens = maxTokens ?? _defaultMaxTokens;
    return {
      'model': model,
      'messages': messages,
      // Explicitly select fast, conversational non-thinking responses.
      'thinking': {'type': 'disabled'},
      'temperature': (temperature ?? _defaultTemperature).clamp(0.0, 2.0),
      'max_tokens': requestedTokens.clamp(1, 8192),
      'stream': false,
    };
  }

  /// Ignore legacy Claude/Gemini model selections that cannot be used at the
  /// DeepSeek endpoint. Both supported official IDs remain selectable.
  static String _resolveModel(String? selected, String fallback) {
    if (selected == 'deepseek-flash' || selected == 'deepseek-v4-pro') {
      return selected!;
    }
    return fallback;
  }

  static List<Map<String, String>> _formatHistory(
    List<Map<String, dynamic>> history,
  ) {
    final result = <Map<String, String>>[];
    for (final entry in history) {
      final content = entry['content'];
      if (content is! String || content.isEmpty) continue;

      final rawRole = entry['role'];
      String role;
      if (rawRole == 'system' || rawRole == 'user' || rawRole == 'assistant') {
        role = rawRole as String;
      } else if (entry['isUser'] == false) {
        role = 'assistant';
      } else {
        role = 'user';
      }
      result.add({'role': role, 'content': content});
    }
    return result;
  }

  static Future<String?> _makeApiRequest(
    Map<String, dynamic> body,
    String debugPrefix,
  ) async {
    try {
      final response = await http
          .post(
            Uri.parse(_deepSeekUrl),
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': 'Bearer $_apiKey',
              'Accept': 'application/json',
            },
            body: jsonEncode(body),
          )
          .timeout(_requestTimeout);

      if (response.statusCode == 200) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        if (data is Map<String, dynamic>) {
          final choices = data['choices'];
          if (choices is List && choices.isNotEmpty && choices.first is Map) {
            final choice = choices.first as Map;
            final reply = choice['message'];
            if (reply is Map) {
              final content = reply['content'];
              if (content is String && content.trim().isNotEmpty) {
                return content;
              }
            }
          }
        }
        return 'Error: DeepSeek returned an empty or unexpected response.';
      }

      if (kDebugMode) {
        AppLogger.warning(
          'DeepSeek request $debugPrefix failed (HTTP ${response.statusCode})',
          tag: 'UnifiedChatService',
        );
      }
      switch (response.statusCode) {
        case 400:
          return 'Error: DeepSeek rejected the request (400). Please check model/settings.';
        case 401:
          return 'Error: DeepSeek API key was rejected (401). Check the key in Settings.';
        case 402:
          return 'Error: Insufficient DeepSeek account balance (402).';
        case 403:
          return 'Error: DeepSeek account is not authorized for this request (403).';
        case 429:
          return 'Error: DeepSeek request limit reached (429). Please try again later.';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'Error: DeepSeek is temporarily unavailable. Try again later.';
        default:
          return 'Error: DeepSeek returned HTTP ${response.statusCode}.';
      }
    } on TimeoutException {
      return 'Error: DeepSeek request timed out. Please try again.';
    } on http.ClientException {
      return 'Error: Network connection failed. Check connectivity; Flutter Web may require a backend due to CORS.';
    } on FormatException {
      return 'Error: DeepSeek returned invalid JSON.';
    } catch (e) {
      if (kDebugMode) {
        AppLogger.error(
          'DeepSeek request $debugPrefix failed',
          tag: 'UnifiedChatService',
          error: e,
        );
      }
      return 'Error: AI request failed. Please try again.';
    }
  }

  static bool _isValidDeepSeekApiKeyFormat(String apiKey) {
    final value = apiKey.trim();
    return value.length >= 10 &&
        value.startsWith('sk-') &&
        !value.startsWith('sk-or-') &&
        !value.contains(RegExp(r'\s'));
  }

  // Keep existing callers compatible.
  static Future<String?> sendGeneralMessage({
    required String message,
    required List<Map<String, String>> history,
    String? systemPrompt,
    String? model,
  }) async {
    return sendMessage(
      context: ChatContext.general,
      message: message,
      history: history.map((msg) => Map<String, dynamic>.from(msg)).toList(),
      systemPrompt: systemPrompt,
      model: model,
    );
  }

  static Future<String?> sendMessageToCharacter({
    required String characterId,
    required String message,
    required String systemPrompt,
    required List<Map<String, dynamic>> chatHistory,
    String? model,
  }) async {
    return sendMessage(
      context: ChatContext.character,
      characterId: characterId,
      message: message,
      systemPrompt: systemPrompt,
      history: chatHistory,
      model: model,
    );
  }

  static Future<String?> sendInterviewMessage({
    required List<Map<String, dynamic>> messages,
    String? systemPrompt,
    String? model,
    double? temperature,
    int? maxTokens,
  }) async {
    return sendMessage(
      context: ChatContext.interview,
      messages: messages,
      systemPrompt: systemPrompt,
      model: model,
      temperature: temperature,
      maxTokens: maxTokens,
    );
  }

  static void logDiagnostics() {
    if (!kDebugMode) return;
    AppLogger.debug(
      'UnifiedChatService initialized=$_isInitialized; '
      'hasKey=${_apiKey?.isNotEmpty ?? false}; '
      'usingDefaultKey=$_isUsingDefaultKey; provider=DeepSeek',
      tag: 'UnifiedChatService',
    );
  }

  // Keep old public utility in case another source file uses it.
  static int min(int a, int b) => a < b ? a : b;
}
