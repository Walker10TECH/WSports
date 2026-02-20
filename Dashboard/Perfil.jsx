import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  auth,
  downloadAllUserDataAsJson,
  signOut,
  uploadUserDataFromJson,
} from '../firebaseConfig';

// Componente para cada item do menu
const MenuItem = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuItemContent}>
      <Feather name={icon} size={20} color={'#475569'} />
      <Text style={styles.menuLabel}>{label}</Text>
    </View>
    <Feather name="chevron-right" size={16} color="#94A3B8" />
  </TouchableOpacity>
);

export default function PerfilScreen() {
  const user = auth.currentUser;
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  // Define se a tela é grande (web) para responsividade
  const isLargeScreen = width > 768;

  const handleSignOut = () => {
    const performLogout = () => {
      signOut(auth).catch((error) => {
        console.error("Erro ao fazer logout:", error);
        Alert.alert("Erro", "Não foi possível sair da sua conta. Tente novamente.");
      });
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Você tem certeza que deseja sair?")) {
        performLogout();
      }
    } else {
      Alert.alert("Confirmar Saída", "Você tem certeza que deseja sair?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: performLogout },
      ]);
    }
  };

  const handleBackup = async () => {
    setLoading(true);
    Alert.alert("Backup de Dados", "Iniciando a geração do arquivo de backup. Isso pode levar um momento.");
    
    const result = await downloadAllUserDataAsJson();
    
    if (result.success && result.uri) {
      try {
        if (Platform.OS === 'web') {
          // Na web, cria um link para download
          const link = document.createElement('a');
          link.href = result.uri;
          const date = new Date().toISOString().split('T')[0];
          link.download = `w3sports_backup_${user.uid}_${date}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(result.uri); // Libera a memória
          Alert.alert("Sucesso", "O download do seu backup foi iniciado.");
        } else {
          // No mobile, usa o compartilhamento
          if (!(await Sharing.isAvailableAsync())) {
            Alert.alert("Erro", "O compartilhamento não está disponível neste dispositivo.");
            return;
          }
          const fileUri = result.uri;
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Compartilhe seu backup',
          });
        }
      } catch (error) {
        console.error("Erro ao processar backup:", error);
        Alert.alert("Erro", "Não foi possível processar o arquivo de backup.");
      }
    } else {
      Alert.alert("Erro", result.error?.message || "Não foi possível gerar o backup. Verifique se há dados para exportar.");
    }
    setLoading(false);
  };

  const handleRestore = async () => {
    Alert.alert(
      "Restaurar Backup",
      "Isso substituirá suas configurações atuais (ligas e times favoritos, etc.) pelos dados do arquivo. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Continuar",
          onPress: async () => {
            setLoading(true);
            try {
              const pickerResult = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
              });

              if (pickerResult.canceled === false && pickerResult.assets && pickerResult.assets.length > 0) {
                const fileUri = pickerResult.assets[0].uri;
                const jsonString = await FileSystem.readAsStringAsync(fileUri);
                
                const restoreResult = await uploadUserDataFromJson(jsonString);
                
                if (restoreResult.success) {
                  Alert.alert("Sucesso!", "Seus dados foram restaurados. O aplicativo será recarregado para aplicar as mudanças.", [
                    { text: "OK" } // Idealmente, forçar um recarregamento do estado global do app aqui.
                  ]);
                } else {
                  throw restoreResult.error || new Error("Falha na restauração.");
                }
              }
            } catch (error) {
              console.error("Erro ao restaurar:", error);
              Alert.alert("Erro", `Não foi possível restaurar o backup: ${error.message}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={[styles.container, isLargeScreen && styles.containerLarge]}>
          
          {/* Cabeçalho do Perfil */}
          <View style={styles.profileHeader}>
            <Image
              source={{ uri: user?.photoURL || `https://i.pravatar.cc/150?u=${user?.uid}` }}
              style={styles.avatar}
            />
            <Text style={styles.profileName}>{user?.displayName || 'Usuário'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>

          {/* Seção de Menu */}
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>CONTA</Text>
            <View style={styles.menuGroup}>
              <MenuItem icon="user" label="Editar Perfil" onPress={() => navigation.navigate('EditarPerfil')} />
              <MenuItem icon="settings" label="Preferências" onPress={() => navigation.navigate('Preferencias')} />
            </View>
          </View>

          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>DADOS</Text>
            <View style={styles.menuGroup}>
              <MenuItem icon="download" label="Fazer Backup" onPress={handleBackup} />
              <MenuItem icon="upload" label="Restaurar Backup" onPress={handleRestore} />
            </View>
          </View>

          {/* Botão de Sair */}
          <View style={styles.logoutSection}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
              <Feather name="log-out" size={20} color="#EF4444" />
              <Text style={styles.logoutButtonText}>Sair da Conta</Text>
            </TouchableOpacity>
          </View>

          {/* Versão do App */}
          <Text style={styles.appVersion}>Versão do App 1.0.0</Text>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Processando...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F6F8',
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 24,
  },
  container: {
    width: '100%',
    maxWidth: 500, // Limita a largura em telas grandes
    paddingHorizontal: 24,
  },
  containerLarge: {
    paddingHorizontal: 0, // Remove padding lateral no modo web para centralizar
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#135BEC',
    marginBottom: 16,
  },
  profileName: {
    fontWeight: '700',
    fontSize: 22,
    color: '#0F172A',
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: Platform.OS === 'web' ? 0 : 8,
  },
  menuGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuLabel: {
    fontWeight: '600',
    fontSize: 16,
    color: '#334155',
  },
  logoutSection: {
    marginTop: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    paddingVertical: 16,
    borderRadius: 12,
  },
  logoutButtonText: {
    fontWeight: '700',
    fontSize: 16,
    color: '#EF4444',
  },
  appVersion: {
    textAlign: 'center',
    marginTop: 32,
    color: '#94A3B8',
    fontSize: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});