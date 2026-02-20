import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Importações do Firebase e helpers de autenticação
import {
  auth,
  createUserWithEmailAndPassword,
  seedInitialFirestoreData,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithGoogle,
  updateProfile,
} from '../firebaseConfig';
import theme from '../theme';

export default function AuthScreen() {
  // 'login' | 'register' | 'forgot'
  const [viewMode, setViewMode] = useState('login'); 
  
  // Estados dos inputs (Segurança de Dados: prontos para validação robusta no Backend)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Manipulador de Ação de Submit
  const handleAction = async () => {
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      if (viewMode === 'login') {
        if (!email || !password) throw new Error("Por favor, preencha e-mail e senha.");
        await signInWithEmailAndPassword(auth, email, password);
      } else if (viewMode === 'register') {
        if (!fullName || !email || !password) throw new Error("Por favor, preencha todos os campos.");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: fullName });
        // Popula dados iniciais (ligas favoritas, etc.) para o novo usuário
        await seedInitialFirestoreData(userCredential.user.uid);
      } else { // 'forgot'
        if (!email) throw new Error("Por favor, digite seu e-mail.");
        await sendPasswordResetEmail(auth, email);
        Alert.alert("Verifique seu e-mail", "Um link para redefinir sua senha foi enviado.");
        setViewMode('login');
      }
      // O observador onAuthStateChanged em App.jsx cuidará da navegação
    } catch (e) {
      switch (e.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          setError('E-mail ou senha inválidos.');
          break;
        case 'auth/email-already-in-use':
          setError('Este e-mail já está em uso.');
          break;
        case 'auth/invalid-email':
          setError('O formato do e-mail é inválido.');
          break;
        case 'auth/weak-password':
          setError('A senha deve ter no mínimo 6 caracteres.');
          break;
        default:
          setError(e.message || 'Ocorreu um erro. Tente novamente.');
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const { success, user, error } = await signInWithGoogle();

      if (success && user) {
        // Opcional: verificar se é um novo usuário para popular dados.
        // A lógica para isso precisaria ser ajustada, pois signInWithPopup não retorna `isNewUser` diretamente.
        // Uma abordagem seria verificar no Firestore se os dados do usuário já existem.
        // Por simplicidade, a função seedInitialFirestoreData já verifica antes de popular.
        await seedInitialFirestoreData(user.uid);
      } else if (error) {
        // Evita mostrar erro se o usuário simplesmente fechou o popup.
        if (error.code !== 'auth/popup-closed-by-user') {
          setError('Ocorreu um erro com o login do Google.');
          console.error("Google Sign-In Error:", error);
        }
      }
    } catch (error) {
      setError('Ocorreu um erro com o login do Google.');
      console.error("Google Sign-In Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={['rgba(19, 91, 236, 0.05)', 'rgba(19, 91, 236, 0)', 'rgba(19, 91, 236, 0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Header & Voltar (Somente Variante 5) */}
          {viewMode === 'forgot' && (
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.backButton} onPress={() => setViewMode('login')}>
                <Feather name="arrow-left" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
          )}

          {/* Wrapper Principal */}
          <View style={[styles.mainWrapper, viewMode === 'forgot' && { paddingTop: 24 }]}>
            
            {/* Ícone Global do App */}
            <View style={styles.iconContainerMargin}>
              <View style={styles.iconOverlay}>
                <View style={styles.iconBox}>
                  <Feather name="layers" size={20} color="#FFFFFF" />
                </View>
              </View>
            </View>

            {/* Títulos Dinâmicos */}
            <View style={styles.headerTexts}>
              <Text style={styles.title}>
                {viewMode === 'login' && 'Bem-vindo de volta'}
                {viewMode === 'register' && 'Crie sua conta'}
                {viewMode === 'forgot' && 'Recuperar senha'}
              </Text>
              <Text style={styles.subtitle}>
                {viewMode === 'login' && 'Insira seus dados para acessar o sistema.'}
                {viewMode === 'register' && 'Preencha os campos abaixo para iniciar.'}
                {viewMode === 'forgot' && 'Digite seu e-mail e enviaremos um link de recuperação.'}
              </Text>
            </View>

            {/* Exibição de Erro */}
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            {/* Formulário */}
            <View style={styles.formContainer}>
              
              {/* Input: Nome Completo (Apenas Cadastro) */}
              {viewMode === 'register' && (
                <View style={styles.inputWrapper}>
                  <Feather name="user" size={16} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nome Completo"
                    placeholderTextColor="#94A3B8"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              {/* Input: E-mail */}
              <View style={styles.inputWrapper}>
                <Feather name="mail" size={16} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Input: Senha (Login e Cadastro) */}
              {viewMode !== 'forgot' && (
                <View style={styles.inputWrapper}>
                  <Feather name="lock" size={16} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={viewMode === 'register' ? 'Crie uma senha' : 'Sua senha'}
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!isPasswordVisible}
                  />
                  <TouchableOpacity 
                    style={styles.eyeIcon} 
                    onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  >
                    <Feather name={isPasswordVisible ? 'eye' : 'eye-off'} size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Esqueci a Senha Link (Somente Login) */}
              {viewMode === 'login' && (
                <View style={styles.forgotPasswordContainer}>
                  <TouchableOpacity onPress={() => setViewMode('forgot')}>
                    <Text style={styles.forgotPasswordText}>Esqueci a senha</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Botão Principal */}
              <TouchableOpacity style={styles.primaryButton} onPress={handleAction}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {viewMode === 'login' && 'Entrar'}
                    {viewMode === 'register' && 'Cadastrar'}
                    {viewMode === 'forgot' && 'Enviar link'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Divisor e Redes Sociais (Login e Cadastro) */}
            {viewMode !== 'forgot' && (
              <View style={styles.socialSection}>
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <View style={styles.dividerBadge}>
                    <Text style={styles.dividerText}>ou continue com</Text>
                  </View>
                </View>

                <View style={styles.socialButtonsContainer}>
                  <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignIn}>
                    <FontAwesome5 name="google" size={18} color="#EA4335" />
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Alternância de Telas (Rodapé) */}
            <View style={[styles.footer, viewMode === 'forgot' && { flex: 1, justifyContent: 'flex-end', paddingBottom: 40 }]}>
              {viewMode === 'login' && (
                <Text style={styles.footerText}>
                  Não tem uma conta?{' '}
                  <Text style={styles.footerLink} onPress={() => setViewMode('register')}>
                    Inscreva-se
                  </Text>
                </Text>
              )}
              {viewMode === 'register' && (
                <Text style={styles.footerText}>
                  Já tem uma conta?{' '}
                  <Text style={styles.footerLink} onPress={() => setViewMode('login')}>
                    Faça login
                  </Text>
                </Text>
              )}
              {viewMode === 'forgot' && (
                <Text style={styles.footerText}>
                  Lembrou a senha?{' '}
                  <Text style={styles.footerLink} onPress={() => setViewMode('login')}>
                    Voltar para login
                  </Text>
                </Text>
              )}
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Estilos Semânticos e Organizados, garantindo a Estética Visual ("Bonito") e Usabilidade exigida.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F6F8',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 16,
    alignItems: 'flex-start',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    ...theme.SHADOWS.sm,
  },
  mainWrapper: {
    width: '100%',
    maxWidth: 448,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconContainerMargin: {
    marginBottom: 24,
  },
  iconOverlay: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(19, 91, 236, 0.1)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBox: {
    width: 30,
    height: 30,
    backgroundColor: '#135BEC',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTexts: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '800',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.75,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 24,
    color: '#64748B',
    textAlign: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    width: '100%',
  },
  formContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  inputWrapper: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    ...theme.SHADOWS.sm,
  },
  inputIcon: {
    paddingLeft: 16,
    paddingRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '400',
    fontSize: 16,
    color: '#0F172A',
  },
  eyeIcon: {
    paddingHorizontal: 16,
  },
  forgotPasswordContainer: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 16,
    marginTop: -8,
  },
  forgotPasswordText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '600',
    fontSize: 14,
    color: '#135BEC',
  },
  primaryButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#135BEC',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.SHADOWS.sm,
  },
  primaryButtonText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '700',
    fontSize: 16,
    color: '#FFFFFF',
  },
  socialSection: {
    width: '100%',
    marginBottom: 32,
  },
  dividerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerBadge: {
    backgroundColor: '#F6F6F8',
    paddingHorizontal: 12,
  },
  dividerText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '500',
    fontSize: 14,
    color: '#64748B',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
  },
  socialButton: {
    flex: 1,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...theme.SHADOWS.sm,
  },
  socialButtonText: {
    marginLeft: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '600',
    fontSize: 14,
    color: '#0F172A',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '400',
    fontSize: 14,
    color: '#64748B',
  },
  footerLink: {
    fontWeight: '700',
    color: '#135BEC',
  },
});