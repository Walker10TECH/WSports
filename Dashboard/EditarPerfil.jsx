import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    auth,
    deleteFileByUrl,
    updateProfile,
    uploadFile,
} from '../firebaseConfig';

export default function EditarPerfilScreen() {
  const navigation = useNavigation();
  const user = auth.currentUser;
  const { width } = useWindowDimensions();

  const [name, setName] = useState(user?.displayName || '');
  const [imageUri, setImageUri] = useState(user?.photoURL || null);
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const isLargeScreen = width > 768;

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à sua galeria para alterar a foto de perfil.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5, // Comprime a imagem para uploads mais rápidos
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setNameError('');
    const trimmedName = name.trim();

    // Validação Robusta
    if (!trimmedName) {
      setNameError('O nome não pode ficar em branco.');
      return;
    }
    if (trimmedName.length < 3 || trimmedName.length > 30) {
      setNameError('O nome deve ter entre 3 e 30 caracteres.');
      return;
    }
    // Regex permite letras (incluindo acentos), espaços e apóstrofos.
    const nameRegex = /^[a-zA-Z\u00C0-\u017F' ]+$/;
    if (!nameRegex.test(trimmedName)) {
      setNameError('O nome pode conter apenas letras, espaços e apóstrofos.');
      return;
    }
    if (/\s{2,}/.test(trimmedName)) {
      setNameError('O nome não pode conter espaços múltiplos.');
      return;
    }

    setLoading(true);
    try {
      let newPhotoURL = user.photoURL;
      let profileNeedsUpdate = false;

      // 1. Se a imagem foi alterada, faz o upload
      if (imageUri && imageUri !== user.photoURL) {        
        const imagePath = `avatars/${user.uid}/profile.jpg`;
        
        // Deleta a foto antiga se ela existir no nosso storage
        if (user.photoURL && user.photoURL.includes('firebasestorage.googleapis.com')) {
          await deleteFileByUrl(user.photoURL);
        }

        newPhotoURL = await uploadFile(imageUri, imagePath);
        profileNeedsUpdate = true;
      }

      // 2. Verifica se o nome foi alterado
      if (trimmedName !== user.displayName) {
        profileNeedsUpdate = true;
      }

      // 3. Atualiza o perfil do usuário no Firebase Auth apenas se houver mudanças
      if (profileNeedsUpdate) {
        await updateProfile(user, {
          displayName: trimmedName,
          photoURL: newPhotoURL,
        });
      }
      
      Alert.alert('Sucesso!', 'Seu perfil foi atualizado.');
      navigation.goBack();

    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      Alert.alert('Erro', 'Não foi possível atualizar seu perfil. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={[styles.container, isLargeScreen && styles.containerLarge]}>
          
          {/* Seção do Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer}>
              <Image
                source={{ uri: imageUri || `https://i.pravatar.cc/150?u=${user?.uid}` }}
                style={styles.avatar}
              />
              <View style={styles.editIcon}>
                <Feather name="camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Formulário */}
          <View style={styles.formSection}>
            <Text style={styles.label}>Nome de Exibição</Text>
            <TextInput
              style={[styles.input, nameError ? styles.inputError : null]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError('');
              }}
              placeholder="Seu nome"
              placeholderTextColor="#94A3B8"
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
          </View>

          {/* Botão de Salvar */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar Alterações</Text>
            )}
          </TouchableOpacity>
        </View>
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
    paddingTop: 32,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    paddingHorizontal: 24,
  },
  containerLarge: {
    paddingHorizontal: 0,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#135BEC',
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#135BEC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  formSection: {
    marginBottom: 24,
  },
  label: {
    fontWeight: '600',
    fontSize: 14,
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 6,
    paddingLeft: 4,
    fontWeight: '500',
  },
  saveButton: {
    height: 50,
    backgroundColor: '#135BEC',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    fontWeight: '700',
    fontSize: 16,
    color: '#FFFFFF',
  },
});