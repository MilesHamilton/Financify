import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radius, space, type } from '@/constants/theme';
import { ApiError, login } from '@/lib/api';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429
          ? 'Too many attempts. Try again in a few minutes.'
          : e instanceof ApiError && e.status === 401
            ? 'Incorrect username or password.'
            : "Couldn't reach Financify. Check your connection.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <View style={styles.form}>
        <View style={styles.brand}>
          <Image source={require('../../../assets/logo-mark.png')} style={styles.mark} accessibilityIgnoresInvertColors />
          <Text style={styles.title} accessibilityRole="header">
            Financify
          </Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          value={username}
          onChangeText={setUsername}
          accessibilityLabel="Username"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textSubtle}
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          accessibilityLabel="Password"
        />
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        <Pressable
          style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.brandPressed }]}
          onPress={submit}
          disabled={busy || !username || !password}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>Log in</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
  form: { paddingHorizontal: space(6), gap: space(3) },
  brand: { alignItems: 'center', gap: space(3), marginBottom: space(6) },
  mark: { width: 72, height: 72 },
  title: { ...type.headingL, fontWeight: '600' },
  input: {
    backgroundColor: colors.input,
    borderColor: colors.input,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
  },
  error: { ...type.paragraph, color: colors.warning },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.round,
    alignItems: 'center',
    paddingVertical: space(4),
    marginTop: space(2),
  },
  buttonText: { ...type.label, color: colors.text },
});
