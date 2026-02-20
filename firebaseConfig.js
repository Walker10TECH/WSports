import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { initializeApp } from "firebase/app";
import {
    createUserWithEmailAndPassword,
    initializeAuth,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
    GoogleAuthProvider,
    signInWithCredential
} from 'firebase/auth';
import {
    indexedDBLocalPersistence,
    browserLocalPersistence
} from 'firebase/auth';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch
} from 'firebase/firestore';
import {
    deleteObject,
    getDownloadURL,
    getStorage,
    ref,
    uploadBytes
} from 'firebase/storage';

// ========================================================================
// CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE (W3Labs-Sports)
// ========================================================================

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

// Inicialização dos serviços (Singleton)
let auth;
if (Platform.OS === 'web') {
  // For web, use indexedDB for persistence.
  auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  });
} else {
  // For React Native, dynamically require and use AsyncStorage persistence.
  const { getReactNativePersistence } = require('firebase/auth');
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}
export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);

// ========================================================================
// SERVIÇOS DE AUTENTICAÇÃO (INCLUINDO GOOGLE SIGN-IN)
// ========================================================================

/**
 * Realiza o login com Google, abstraindo a lógica para Web e Mobile.
 * Na Web, usa o popup do Firebase.
 * No Mobile, usa o @react-native-google-signin/google-signin para obter o token
 * e depois autentica com o Firebase.
 * @returns {Promise<{success: boolean, user?: import('firebase/auth').User, error?: Error}>}
 */
export async function signInWithGoogle() {
    // NOTA: A biblioteca @react-native-google-signin/google-signin foi removida.
    // Esta função agora usa apenas o fluxo de login web (popup) do Firebase.
    // Para suportar o login nativo no Mobile, considere usar a biblioteca `expo-auth-session`.
    try {
        const provider = new GoogleAuthProvider();
        // Adiciona escopos se necessário, como ler os contatos do usuário
        // provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
        const result = await signInWithPopup(auth, provider);
        console.log('[Auth] Usuário logado com Google:', result.user.uid);
        return { success: true, user: result.user };
    } catch (error) {
        console.error("[Google Sign-In Error]", error);
        return { success: false, error };
    }
}

export {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    GoogleAuthProvider,
    signInWithCredential,
    signInWithPopup
};

// ========================================================================
// SERVIÇO DO FIRESTORE (CRUD + REAL-TIME)
// ========================================================================

/**
 * Busca todos os documentos de uma coleção específica do usuário.
 * Garante isolamento de dados por UID.
 * @param {string} collectionName - O nome da coleção (ex: 'favoriteTeams').
 * @returns {Promise<{success: boolean, data?: any[], error?: Error}>} Objeto com o resultado.
 */
export async function getItems(collectionName) {
    const userUid = auth.currentUser?.uid;
    if (!userUid) return { success: false, error: new Error("Usuário não autenticado.") };

    try {
        const collectionRef = collection(db, 'users', userUid, collectionName);
        const q = query(collectionRef);
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { success: true, data };
    } catch (error) {
        console.error(`[Firestore Error] ao buscar itens de ${collectionName}:`, error);
        return { success: false, error };
    }
}

/**
 * Cria ou atualiza um documento em uma coleção específica do usuário.
 * Implementa lógica de 'Upsert' e timestamps automáticos.
 * @param {string} collectionName - O nome da coleção (ex: 'matchReminders').
 * @param {object} itemData - O objeto de dados a ser salvo.
 * @param {boolean} isEditing - True se for uma atualização.
 * @returns {Promise<{success: boolean, id?: string, error?: Error}>} Objeto com o resultado.
 */
export async function addOrUpdateItem(collectionName, itemData, isEditing) {
    const userUid = auth.currentUser?.uid;
    if (!userUid) return { success: false, error: new Error("Usuário não autenticado.") };
    try {
        
        let docRef;
        let docId;

        if (isEditing) {
            docId = itemData.id;
            if (!docId) {
                console.error(`[Firestore Error] Tentativa de atualização sem ID em ${collectionName}.`, itemData);
                return { success: false, error: new Error("ID do item é inválido ou não fornecido para atualização.") };
            }
            docRef = doc(db, 'users', userUid, collectionName, docId);
        } else {
            // Firestore V9: para gerar um ID automaticamente, criamos uma referência a um novo documento
            docRef = doc(collection(db, 'users', userUid, collectionName));
            docId = docRef.id;
        }

        const dataToSave = {
            ...itemData,
            id: docId, // Garante que o ID do documento seja salvo no próprio corpo do documento para integridade
            userUid,
            atualizadoEm: serverTimestamp(),
        };

        if (isEditing) {
            await updateDoc(docRef, dataToSave);
            console.log(`[Firestore] Documento ${docId} atualizado em ${collectionName}.`);
        } else {
            dataToSave.criadoEm = serverTimestamp();
            await setDoc(docRef, dataToSave);
            console.log(`[Firestore] Documento ${docId} criado em ${collectionName}.`);
        }
        return { success: true, id: docId };
    } catch (error) {
        console.error(`[Firestore Error] em ${collectionName}:`, error);
        return { success: false, error };
    }
}

/**
 * Deleta um documento do Firestore.
 * @param {string} collectionName - O nome da coleção.
 * @param {string} itemId - O ID do documento a ser deletado.
 * @returns {Promise<{success: boolean, error?: Error}>} Objeto com o resultado.
 */
export async function deleteItem(collectionName, itemId) {
    const userUid = auth.currentUser?.uid;
    if (!userUid) return { success: false, error: new Error("Usuário não autenticado.") };

    try {
        const docRef = doc(db, 'users', userUid, collectionName, itemId);
        await deleteDoc(docRef);
        console.log(`[Firestore] Documento ${itemId} deletado de ${collectionName}.`);
        return { success: true };
    } catch (error) {
        console.error(`[Firestore Error] ao deletar de ${collectionName}:`, error);
        return { success: false, error };
    }
}

/**
 * Inscreve-se para escutar atualizações em tempo real de uma coleção.
 * Essencial para UX reativa no Frontend (Placares ao vivo, por exemplo).
 * @param {string} collectionName - O nome da coleção a ser observada.
 * @param {function} callback - Função a ser chamada com os novos dados. A função recebe um array de documentos.
 * @returns {function} Uma função para cancelar a inscrição (unsubscribe).
 */
export function subscribeToCollection(collectionName, callback) {
    const userUid = auth.currentUser?.uid;
    if (!userUid) {
        console.error("Usuário não autenticado para inscrição em tempo real.");
        return () => {}; // Retorna uma função vazia para evitar crash ao tentar chamar unsubscribe
    }

    const collectionRef = collection(db, 'users', userUid, collectionName);
    const q = query(collectionRef);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => {
        console.error(`[Firestore Real-time Error] em ${collectionName}:`, error);
    });

    return unsubscribe;
}

/**
 * Fetches data from a URL, with caching support using AsyncStorage.
 * @param {string} cacheKey - A unique key for storing the data.
 * @param {string} url - The URL to fetch data from.
 * @param {number} duration - Cache duration in milliseconds. Defaults to 15 minutes.
 * @returns {Promise<any>} The JSON data from the cache or network.
 */
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
export async function fetchAndCache(cacheKey, url, duration = CACHE_DURATION) {
  try {
    // 1. Try to get data from cache
    const cachedItem = await AsyncStorage.getItem(cacheKey);
    if (cachedItem) {
      const { timestamp, data } = JSON.parse(cachedItem);
      // 2. Check if cache is still valid
      if (Date.now() - timestamp < duration) {
        console.log(`[Cache] HIT for key: ${cacheKey}`);
        return data;
      }
    }

    // 3. If no valid cache, fetch from network
    console.log(`[Cache] MISS for key: ${cacheKey}. Fetching from network...`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Network response was not ok for ${url}`);
    }
    const freshData = await response.json();

    // 4. Store fresh data and timestamp in cache
    const itemToCache = {
      timestamp: Date.now(),
      data: freshData,
    };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(itemToCache));

    return freshData;
  } catch (error) {
    console.error(`[Fetch & Cache Error] for key ${cacheKey}:`, error);
    throw error; // Re-throw to be handled by the calling component
  }
}

// ========================================================================
// SERVIÇO DE ARMAZENAMENTO (STORAGE)
// ========================================================================

/**
 * Faz upload de um arquivo para o Firebase Storage.
 * @param {string} fileUri - O URI local do arquivo (ex: de expo-image-picker).
 * @param {string} path - O caminho no Storage (ex: 'avatars/perfil.jpg').
 * @returns {Promise<string>} A URL de download do arquivo.
 * @throws Lança um erro se o usuário não estiver autenticado ou se o upload falhar.
 */
export const uploadFile = async (fileUri, path) => {
    const userUid = auth.currentUser?.uid;
    if (!userUid) throw new Error("Usuário não autenticado.");

    try {
        const storageRef = ref(storage, `users/${userUid}/${path}`);
        // Converte o URI local em um blob de dados para upload
        const response = await fetch(fileUri);
        const blob = await response.blob();
        await uploadBytes(storageRef, blob);
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error("Erro no upload do arquivo:", error);
        throw error;
    }
};

/**
 * Deleta um arquivo do Firebase Storage a partir da sua URL de download.
 * @param {string} fileUrl - A URL completa do arquivo a ser deletado.
 */
export const deleteFileByUrl = async (fileUrl) => {
    if (!fileUrl) return;
    try {
        const storageRef = ref(storage, fileUrl);
        await deleteObject(storageRef);
    } catch (error) {
        // Ignora o erro se o objeto não for encontrado
        if (error.code !== 'storage/object-not-found') {
            console.error("Erro ao deletar o arquivo:", error);
        }
    }
};

// ========================================================================
// SERVIÇO DE DADOS INICIAIS (SEED) & BACKUP PARA ESPORTES
// ========================================================================

/**
 * Cria as preferências iniciais de esportes no Firestore para um novo usuário.
 * Utiliza um documento de metadados para garantir idempotência.
 * @param {string} userUid - O UID do usuário.
 */
export const seedInitialFirestoreData = async (userUid) => {
    try {
        const docRef = doc(db, 'users', userUid, 'appMetadata', 'initialSeed');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().sportsPreferencesSeeded) {
            console.log('Dados iniciais de esportes já populados para este usuário.');
            return;
        }

        console.log('Populando ligas favoritas padrão no Firestore para novo usuário...');
        
        // Ligas/Esportes padrão para um novo usuário do app
        const defaultLeagues = [
            { nome: 'Brasileirão Série A', apiId: 'bra.1', esporte: 'soccer', ativa: true },
            { nome: 'Copa do Brasil', apiId: 'bra.copa_do_brazil', esporte: 'soccer', ativa: true },
            { nome: 'Premier League', apiId: 'eng.1', esporte: 'soccer', ativa: true },
            { nome: 'Champions League', apiId: 'uefa.champions', esporte: 'soccer', ativa: true },
            { nome: 'Libertadores', apiId: 'conmebol.libertadores', esporte: 'soccer', ativa: true },
            { nome: 'La Liga', apiId: 'esp.1', esporte: 'soccer', ativa: false }
            
        ];

        const batch = writeBatch(db);
        const timestamp = serverTimestamp();

        defaultLeagues.forEach(league => {
            const newDocRef = doc(collection(db, 'users', userUid, 'favoriteLeagues'));
            batch.set(newDocRef, {
                ...league,
                id: newDocRef.id,
                userUid,
                criadoEm: timestamp,
                atualizadoEm: timestamp,
            });
        });

        // Marca que o seed foi concluído para não executar novamente
        batch.set(docRef, { sportsPreferencesSeeded: true, timestamp: serverTimestamp() });

        await batch.commit();
        console.log('Criação de ligas favoritas iniciais concluída.');
    } catch (error) {
        console.error("Erro ao criar dados iniciais de esportes:", error);
    }
};

/**
 * Gera um backup JSON de todas as coleções do usuário relacionadas a esportes.
 * @returns {Promise<{success: boolean, uri?: string, error?: Error}>}
 */
export const downloadAllUserDataAsJson = async () => {
    const userUid = auth.currentUser?.uid;
    if (!userUid) {
        return { success: false, error: new Error("Usuário não autenticado.") };
    }

    // Coleções focadas no app de Esportes
    const collectionsToBackup = [
        'userSettings', 
        'favoriteLeagues', 
        'favoriteTeams', 
        'favoritePlayers', 
        'matchReminders',
        'customScoreboards'
    ];

    const allData = {};

    try {
        for (const collectionName of collectionsToBackup) {
            const result = await getItems(collectionName);
            if (result.success && result.data.length > 0) {
                allData[collectionName] = result.data;
            }
        }

        const jsonString = JSON.stringify(allData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const uri = URL.createObjectURL(blob);
        return { success: true, uri };
    } catch (error) {
        console.error("Erro ao gerar backup de dados esportivos:", error);
        return { success: false, error };
    }
};

/**
 * Faz upload de um backup JSON para o Firestore, restaurando as preferências esportivas.
 * Gerencia o limite de 500 operações por batch do Firestore.
 * @param {string} jsonString - A string contendo os dados de backup em formato JSON.
 * @returns {Promise<{success: boolean, error?: Error}>} Objeto com o resultado.
 */
export const uploadUserDataFromJson = async (jsonString) => {
    const userUid = auth.currentUser?.uid;
    if (!userUid) {
        return { success: false, error: new Error("Usuário não autenticado.") };
    }

    try {
        const data = JSON.parse(jsonString);
        let batch = writeBatch(db);
        let operationCount = 0;

        for (const collectionName in data) {
            if (Object.prototype.hasOwnProperty.call(data, collectionName)) {
                const items = data[collectionName];
                if (Array.isArray(items)) {
                    for (const item of items) {
                        if (item.id) {
                            const docRef = doc(db, 'users', userUid, collectionName, item.id);
                            batch.set(docRef, item);
                            operationCount++;

                            // O Firestore tem um limite estrito de 500 operações por lote.
                            if (operationCount >= 499) {
                                await batch.commit();
                                batch = writeBatch(db);
                                operationCount = 0;
                            }
                        }
                    }
                }
            }
        }

        if (operationCount > 0) {
            await batch.commit();
        }

        return { success: true };
    } catch (error) {
        console.error("Erro ao restaurar backup de dados esportivos:", error);
        return { success: false, error };
    }
};

/**
 * Configura o comportamento das notificações e solicita permissão.
 * @returns {Promise<string|null>} O ExpoPushToken do dispositivo ou null.
 */
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    alert('Falha ao obter o token de push para notificações!');
    return null;
  }
  
  try {
    // IMPORTANTE: Adicione seu Project ID do EAS no arquivo .env
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    })).data;
    console.log('[Notifications] Expo Push Token:', token);
  } catch (e) {
    console.error("Erro ao obter o Expo Push Token:", e);
  }

  return token;
}

/**
 * Salva ou atualiza o token de push do usuário no Firestore.
 * @param {string} userUid - O UID do usuário.
 * @param {string} token - O ExpoPushToken.
 */
export async function saveUserPushToken(userUid, token) {
  if (!userUid || !token) return;
  const tokenRef = doc(db, 'users', userUid, 'private', 'pushToken');
  await setDoc(tokenRef, { token: token, updatedAt: serverTimestamp() }, { merge: true });
}
// ========================================================================
// CONFIGURAÇÕES DE DADOS DE ESPORTES (W3Labs-Sports)
// ========================================================================

export const SPORTS_DB = {
    "soccer": {
        name: "Futebol",
        logo: "https://cdn-icons-png.flaticon.com/512/53/53283.png",
        views: [
            { id: 'matches', name: 'Jogos', icon: 'calendar-days' },
            { id: 'standings', name: 'Classificação', icon: 'trophy' },
            { id: 'knockout', name: 'Mata-Mata', icon: 'network' },
            { id: 'scorers', name: 'Artilharia', icon: 'target' },
            { id: 'news', name: 'Notícias', icon: 'zap' }
        ],
        leagues: {
            "brasileirao": {
                id: "bra.1", apiFootballId: 71, seasonId: 2026, name: "Brasileirão Série A",
                logo: "https://upload.wikimedia.org/wikipedia/pt/7/75/Campeonato_Brasileiro_de_Futebol_de_2024_-_S%C3%A9rie_A.png",
                bg: "https://s2-globo-play.glbimg.com/rHTMAA96-XWwbs6h4pEWeZXlREw=/https://s2.glbimg.com/aNGo_xeD86fO2XMCGBRlpe7rmmg=/i.s3.glbimg.com/v1/AUTH_c3c606ff68e7478091d1ca496f9c5625/internal_photos/bs/2025/L/P/Y3zKUbSTWAUtZN86BTzg/2025-4731-brasileirao-background.jpg",
                clubs: ["Clube_Atlético_Mineiro", "Esporte_Clube_Bahia", "Botafogo_de_Futebol_e_Regatas", "Ceará_Sporting_Club", "Sport_Club_Corinthians_Paulista", "Cruzeiro_Esporte_Clube", "Clube_de_Regatas_do_Flamengo", "Fluminense_Football_Club", "Fortaleza_Esporte_Clube", "Grêmio_Foot-Ball_Porto_Alegrense", "Sport_Club_Internacional", "Esporte_Clube_Juventude", "Mirassol_Futebol_Clube", "Sociedade_Esportiva_Palmeiras", "Red_Bull_Bragantino", "Santos_Futebol_Clube", "São_Paulo_Futebol_Clube", "Sport_Club_do_Recife", "Club_de_Regatas_Vasco_da_Gama", "Esporte_Clube_Vitória"]
            },
            "copadobrasil": {
                id: "bra.copa_do_brazil", apiFootballId: 73, seasonId: 2026, name: "Copa do Brasil",
                logo: "https://cdn-img.zerozero.pt/img/logos/competicoes/260_imgbank_cb_20250227155245.png",
                bg: "https://s2-globo-play.glbimg.com/rHTMAA96-XWwbs6h4pEWeZXlREw=/https://s2.glbimg.com/aNGo_xeD86fO2XMCGBRlpe7rmmg=/i.s3.glbimg.com/v1/AUTH_c3c606ff68e7478091d1ca496f9c5625/internal_photos/bs/2025/L/P/Y3zKUbSTWAUtZN86BTzg/2025-4731-brasileirao-background.jpg",
                clubs: ["Clube_Atlético_Mineiro", "Esporte_Clube_Bahia", "Botafogo_de_Futebol_e_Regatas", "Ceará_Sporting_Club", "Sport_Club_Corinthians_Paulista", "Cruzeiro_Esporte_Clube", "Clube_de_Regatas_do_Flamengo", "Fluminense_Football_Club", "Fortaleza_Esporte_Clube", "Grêmio_Foot-Ball_Porto_Alegrense", "Sport_Club_Internacional", "Esporte_Clube_Juventude", "Mirassol_Futebol_Clube", "Sociedade_Esportiva_Palmeiras", "Red_Bull_Bragantino", "Santos_Futebol_Clube", "São_Paulo_Futebol_Clube", "Sport_Club_do_Recife", "Club_de_Regatas_Vasco_da_Gama", "Esporte_Clube_Vitória", "Cuiabá_Esporte_Clube"],
                logoOverrides: {
                    "Atlético-MG": "https://a.espncdn.com/i/teamlogos/soccer/500/3445.png",
                    "Bahia": "https://a.espncdn.com/i/teamlogos/soccer/500/3441.png",
                    "Botafogo": "https://a.espncdn.com/i/teamlogos/soccer/500/205.png",
                    "Ceará SC": "https://a.espncdn.com/i/teamlogos/soccer/500/3442.png",
                    "Corinthians": "https://a.espncdn.com/i/teamlogos/soccer/500/874.png",
                    "Cruzeiro": "https://a.espncdn.com/i/teamlogos/soccer/500/2026.png",
                    "Flamengo": "https://a.espncdn.com/i/teamlogos/soccer/500/819.png",
                    "Fluminense": "https://a.espncdn.com/i/teamlogos/soccer/500/206.png",
                    "Fortaleza": "https://a.espncdn.com/i/teamlogos/soccer/500/3443.png",
                    "Grêmio": "https://a.espncdn.com/i/teamlogos/soccer/500/824.png",
                    "Internacional": "https://a.espncdn.com/i/teamlogos/soccer/500/826.png",
                    "Juventude": "https://a.espncdn.com/i/teamlogos/soccer/500/3450.png",
                    "Mirassol": "https://a.espncdn.com/i/teamlogos/soccer/500/4433.png",
                    "Palmeiras": "https://a.espncdn.com/i/teamlogos/soccer/500/2029.png",
                    "Red Bull Bragantino": "https://a.espncdn.com/i/teamlogos/soccer/500/3447.png",
                    "Santos": "https://a.espncdn.com/i/teamlogos/soccer/500/837.png",
                    "São Paulo": "https://a.espncdn.com/i/teamlogos/soccer/500/2030.png",
                    "Sport Recife": "https://a.espncdn.com/i/teamlogos/soccer/500/838.png",
                    "Vasco da Gama": "https://a.espncdn.com/i/teamlogos/soccer/500/2031.png",
                    "Vitória": "https://a.espncdn.com/i/teamlogos/soccer/500/3454.png",
                    "Cuiabá": "https://a.espncdn.com/i/teamlogos/soccer/500/10091.png"
                }
            },
            "premier": {
                id: "eng.1", apiFootballId: 39, seasonId: 2026, name: "Premier League",
                logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",
                bg: "https://t4.ftcdn.net/jpg/05/99/15/97/360_F_599159727_pFIXrrEiyZnuSw5h0qOjAuVMeQfTYpQM.jpg",
                clubs: ["Arsenal_Football_Club", "Aston_Villa_Football_Club", "A.F.C._Bournemouth", "Brentford_Football_Club", "Brighton_&_Hove_Albion_Football_Club", "Chelsea_Football_Club", "Crystal_Palace_Football_Club", "Everton_Football_Club", "Fulham_Football_Club", "Ipswich_Town_Football_Club", "Leicester_City_Football_Club", "Liverpool_Football_Club", "Manchester_City_Football_Club", "Manchester_United_Football_Club", "Newcastle_United_Football_Club", "Nottingham_Forest_Football_Club", "Southampton_Football_Club", "Tottenham_Hotspur_Football_Club", "West_Ham_United_Football_Club", "Wolverhampton_Wanderers_Football_Club"]
            },
            "laliga": {
                id: "esp.1", apiFootballId: 140, seasonId: 2026, name: "La Liga",
                logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png",
                bg: "https://assets.goal.com/images/v3/blt054a5ddddf1e5a2b/158f203189e94419d7010667f379da35bcf16d8e.jpg",
                clubs: ["Deportivo_Alavés", "Athletic_Club", "Atlético_de_Madrid", "Futbol_Club_Barcelona", "Real_Betis_Balompié", "Real_Club_Celta_de_Vigo", "Real_Club_Deportivo_Espanyol_de_Barcelona", "Getafe_Club_de_Fútbol", "Girona_Futbol_Club", "Unión_Deportiva_Las_Palmas", "Club_Deportivo_Leganés", "Real_Club_Deportivo_Mallorca", "Club_Atlético_Osasuna", "Rayo_Vallecano_de_Madrid", "Real_Madrid_Club_de_Fútbol", "Real_Sociedad_de_Fútbol", "Sevilla_Fútbol_Club", "Valencia_Club_de_Fútbol", "Real_Valladolid", "Villarreal_Club_de_Fútbol"],
                theme: { scoreboardBg: '#1C1C23', scoreboardText: '#FFFFFF' },
                flagColors: ['#E81C23', '#E81C23']
            },
            "champions": {
                id: "uefa.champions", apiFootballId: 2, seasonId: 2026, name: "Champions League",
                logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
                bg: "https://editorial.uefa.com/resources/027f-1793cd516cbd-e4e5d9d1aedf-1000/fbl-eur-c1-draw.jpeg",
                clubs: ["Real_Madrid_Club_de_Fútbol", "Futbol_Club_Barcelona", "Atlético_de_Madrid", "Manchester_City_Football_Club", "Arsenal_Football_Club", "Liverpool_Football_Club", "Manchester_United_Football_Club", "Fußball-Club_Bayern_München", "Borussia_Dortmund", "Bayer_04_Leverkusen", "RB_Leipzig", "Paris_Saint-Germain_Football_Club", "Internazionale_Milano", "Associazione_Calcio_Milan", "Juventus_Football_Club", "Philips_Sport_Vereniging", "Feyenoord_Rotterdam", "Sport_Lisboa_e_Benfica", "Futebol_Clube_do_Porto", "Sporting_Clube_de_Portugal"]
            },
            "libertadores": {
                id: "conmebol.libertadores", apiFootballId: 13, seasonId: 2026, name: "Libertadores",
                logo: "https://upload.wikimedia.org/wikipedia/pt/4/4b/Conmebol_Libertadores_Bridgestone_logo.png",
                bg: "https://lncimg.lance.com.br/cdn-cgi/image/width=950,quality=75,fit=pad,format=webp/uploads/2021/01/29/60141dfea45a6.jpeg",
                clubs: ["Clube_de_Regatas_do_Flamengo", "Sociedade_Esportiva_Palmeiras", "São_Paulo_Futebol_Clube", "Fluminense_Football_Club", "Grêmio_Foot-Ball_Porto_Alegrense", "Sport_Club_Internacional", "Clube_Atlético_Mineiro", "Club_Atlético_Boca_Juniors", "Club_Atlético_River_Plate", "Racing_Club_de_Avellaneda", "Club_Atlético_Independiente", "Club_Atlético_San_Lorenzo_de_Almagro", "Club_Atlético_Peñarol", "Club_Nacional_de_Football", "Club_Olimpia", "Club_Cerro_Porteño", "Colo-Colo", "Club_Universidad_de_Chile", "Atlético_Nacional", "Liga_Deportiva_Universitaria_de_Quito"]
            },
            "seriea": {
                id: "ita.1", apiFootballId: 135, seasonId: 2026, name: "Serie A",
                logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png",
                bg: "https://cloudfront-us-east-1.images.arcpublishing.com/newr7/L6ZP3CEJ6VMPNFT5HTW7H7L7LY.jpg",
                clubs: ["Atalanta_Bergamasca_Calcio", "Bologna_Football_Club_1909", "Cagliari_Calcio", "Como_1907", "Empoli_Football_Club", "ACF_Fiorentina", "Genoa_Cricket_and_Football_Club", "Internazionale_Milano", "Juventus_Football_Club", "Società_Sportiva_Lazio", "Unione_Sportiva_Lecce", "Associazione_Calcio_Milan", "Associazione_Calcio_Monza", "Società_Sportiva_Calcio_Napoli", "Parma_Calcio_1913", "Associazione_Sportiva_Roma", "Torino_Football_Club", "Udinese_Calcio", "Venezia_Football_Club", "Hellas_Verona_Football_Club"],
                theme: { scoreboardBg: '#FFFFFF', scoreboardText: '#00387D' },
                flagColors: ['#008C45', '#FFFFFF', '#CD212A']
            },
            "bundesliga": {
                id: "ger.1", apiFootballId: 78, seasonId: 2026, name: "Bundesliga",
                logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png",
                bg: "https://s2-ge.glbimg.com/F2PP74GbwM16ougDWVMDhZzEp6U=/0x0:1024x659/984x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_bc8228b6673f488aa253bbcb03c80ec5/internal_photos/bs/2024/X/Y/3pfuBhTzuraB6EHOqszA/gettyimages-1742744089.jpg",
                clubs: ["Bayer_04_Leverkusen", "VfB_Stuttgart", "Fußball-Club_Bayern_München", "RB_Leipzig", "Borussia_Dortmund", "Eintracht_Frankfurt", "TSG_1899_Hoffenheim", "1._FC_Heidenheim_1846", "SV_Werder_Bremen", "SC_Freiburg", "FC_Augsburg", "VfL_Wolfsburg", "1._FSV_Mainz_05", "Borussia_Mönchengladbach", "1._FC_Union_Berlin", "VfL_Bochum", "FC_St._Pauli", "Holstein_Kiel", "Hamburger_SV", "FC_Schalke_04"]
            },
            "saudi": {
                id: "ksa.1", apiFootballId: 307, seasonId: 2026, name: "Saudi Pro League",
                logo: "https://a4.espncdn.com/combiner/i?img=%2Fi%2Fleaguelogos%2Fsoccer%2F500%2F2488.png",
                bg: "https://www.365scores.com/pt-br/news/magazine/wp-content/uploads/2023/11/366423961_5646928382077000_2604818796297545939_n-e1699379331310.jpg",
                clubs: ["Al-Ahli_Saudi_FC", "Al-Ettifaq_FC", "Al-Fateh_SC", "Al-Fayha_FC", "Al-Hilal_Saudi_Football_Club", "Al-Ittihad_Club", "Al-Khaleej_FC", "Al-Nassr_FC", "Al-Okhdood_Club", "Al-Qadsiah_FC", "Al-Raed_FC", "Al-Riyadh_SC", "Al-Shabab_Football_Club", "Al-Taawoun_FC", "Al-Wehda_Football_Club", "Damac_Football_Club", "Al-Kholood_Club", "Al-Orobah_FC", "Abha_Club", "Al-Hazem_SC"]
            }
            ,
            "paulista": {
                id: "bra.camp.paulista", apiFootballId: null, seasonId: 2026, name: "Paulistão",
                logo: "https://upload.wikimedia.org/wikipedia/pt/1/1c/Paulist%C3%A3o_2026.png",
                bg: "https://www.infomoney.com.br/wp-content/uploads/2025/03/copapaulistamar25-e1743017283823.jpg?fit=2500%2C1167&quality=50&strip=all",
                clubs: ["Sport_Club_Corinthians_Paulista", "Sociedade_Esportiva_Palmeiras", "Red_Bull_Bragantino", "Santos_Futebol_Clube", "São_Paulo_Futebol_Clube", "Esporte_Clube_Água_Santa", "Associação_Atlética_Ponte_Preta", "Associação_Portuguesa_de_Desportos", "Botafogo_Futebol_Clube_(Ribeirão_Preto)", "Guarani_Futebol_Clube", "Grêmio_Novorizontino", "Mirassol_Futebol_Clube", "Esporte_Clube_Noroeste", "Esporte_Clube_Santo_André", "Esporte_Clube_São_Bento", "Velo_Clube_Rioclarense"],
                flagColors: ['#000000', '#FFFFFF', '#FF0000']
            },
            "carioca": {
                id: "bra.camp.carioca", apiFootballId: null, seasonId: 2026, name: "Cariocão",
                logo: "https://upload.wikimedia.org/wikipedia/pt/3/3c/Carioca_2020_FERJ.jpg",
                bg: "https://i.metroimg.com/CN9inuWAEomvLQLMnCj7IjGrN5YQ9SZhw7Tbi1tIHjs/w:900/q:85/f:webp/plain/https://www.metropoles.com/wp-content/uploads/wp-content/uploads/2025/03/16165052/Taca-do-Campeonato-Carioca-1.jpg",
                clubs: ["Bangu_Atlético_Clube", "Boavista_Sport_Club", "Botafogo_de_Futebol_e_Regatas", "Clube_de_Regatas_do_Flamengo", "Fluminense_Football_Club", "Madureira_Esporte_Clube", "Nova_Iguaçu_Futebol_Clube", "Club_de_Regatas_Vasco_da_Gama", "Volta_Redonda_Futebol_Clube", "Associação_Atlética_Portuguesa_(Rio_de_Janeiro)", "Audax_Rio_de_Janeiro_Esporte_Clube", "Sampaio_Corrêa_Futebol_e_Esporte"],
                flagColors: ['#FFFFFF', '#003366']
            },
            "mineiro": {
                id: "bra.camp.mineiro", apiFootballId: null, seasonId: 2026, name: "Campeonato Mineiro",
                logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2360.png",
                bg: "https://s2-ge.glbimg.com/jDlPK0oNRm7JAib8jk8Y0Yt0YjU=/0x0:2048x1365/984x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_bc8228b6673f488aa253bbcb03c80ec5/internal_photos/bs/2022/Y/m/5ERG4iS62kBaYhB5XL2A/51181088676-973df72e83-k-cris-mattos-fmf.jpg",
                clubs: ["Clube_Atlético_Mineiro", "América_Futebol_Clube_(Minas_Gerais)", "Cruzeiro_Esporte_Clube", "Athletic_Club_(Minas_Gerais)", "Associação_Atlética_Caldense", "Democrata_Futebol_Clube", "Ipatinga_Futebol_Clube", "Patrocinense", "Pouso_Alegre_Futebol_Clube", "Tombense_Futebol_Clube", "Uberlândia_Esporte_Clube", "Villa_Nova_Atlético_Clube"],
                flagColors: ['#FFFFFF', '#FF0000', '#FFFFFF']
            },
            "gaucho": {
                id: "bra.camp.gaucho", apiFootballId: null, seasonId: 2026, name: "Gauchão",
                logo: "https://upload.wikimedia.org/wikipedia/pt/7/7e/Gauch%C3%A3o_2025.png",
                bg: "https://s2-ge.glbimg.com/yK2ZKxnnDVvc50YxV6V68wGDE1E=/0x0:1280x960/1008x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_bc8228b6673f488aa253bbcb03c80ec5/internal_photos/bs/2021/9/L/lTsAFbTB6bmMB064vLpw/whatsapp-image-2021-03-24-at-11.57.47-1-.jpeg",
                clubs: ["Grêmio_Foot-Ball_Porto_Alegrense", "Sport_Club_Internacional", "Esporte_Clube_Juventude", "Caxias_do_Sul", "Brasil_de_Pelotas", "Esporte_Clube_São_José", "Ypiranga_Futebol_Clube_(Erechim)", "Guarany_Futebol_Clube", "Esporte_Clube_Novo_Hamburgo", "Avenida", "Santa_Cruz_Futebol_Clube_(Santa_Cruz_do_Sul)", "Esporte_Clube_São_Luiz", "Monsoon_Futebol_Clube", "Esporte_Clube_Internacional_(Santa_Maria)"],
                flagColors: ['#008542', '#DA291C', '#FFCC00'],
                logoOverrides: {
                    "Guarany de Bagé": "https://www.ogol.com.br/img/logos/equipas/3280_imgbank_1688482671.png",
                    "Monsoon": "https://upload.wikimedia.org/wikipedia/commons/0/09/Monsoon_Futebol_Clube_logo.png",
                    "Internacional de Santa Maria": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Escudo_do_Inter_de_Santa_Maria.svg/1280px-Escudo_do_Inter_de_Santa_Maria.svg.png"
                }
            }
        }
    }
};

export const API_CONFIG = {
    espn: {
        baseSite: 'https://site.api.espn.com/apis/site/v2/sports',
        baseWeb: 'https://site.web.api.espn.com/apis',
        scoreboard: (sport, league, date) => {
            let url = `${API_CONFIG.espn.baseSite}/${sport}/${league}/scoreboard?lang=pt&region=br&limit=100`;
            if (date) {
                url += `&dates=${date}`;
            }
            return url;
        },
        standings: (league) => `${API_CONFIG.espn.baseWeb}/v2/sports/soccer/${league}/standings?lang=pt`,
        gameSummary: (league, eventId) => `${API_CONFIG.espn.baseSite}/soccer/${league}/summary?event=${eventId}&lang=pt`,
        teamSchedule: (sport, league, teamId) => `${API_CONFIG.espn.baseSite}/${sport}/${league}/teams/${teamId}/schedule?lang=pt&region=br`,
        news: (sport, league) => `${API_CONFIG.espn.baseSite}/${sport}/${league}/news?lang=pt&region=br`,
        teams: (sport, league) => `${API_CONFIG.espn.baseSite}/${sport}/${league}/teams?lang=pt&region=br`,
        roster: (league, teamId) => `${API_CONFIG.espn.baseSite}/soccer/${league}/teams/${teamId}/roster?lang=pt`,
    },
    apiFootball: {
        base: 'https://v3.football.api-sports.io',
        // Chamada direta para a API, pois não há backend/proxy neste projeto.
        topScorers: (leagueId, season) => `${API_CONFIG.apiFootball.base}/players/topscorers?league=${leagueId}&season=${season}`,
        // Endpoints abaixo não são utilizados na lógica atual
        fixtures: (params) => `/api/fixtures?${params}`, // ex: 'league=71&season=2026'
        standings: (leagueId, season) => `/api/standings?league=${leagueId}&season=${season}`,
        lineups: (fixtureId) => `/api/lineups?fixture=${fixtureId}`,
    },
    wikipedia: {
        base: 'https://pt.wikipedia.org/w/api.php',
        search: (query) => `${API_CONFIG.wikipedia.base}?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`,
        detail: (title) => `${API_CONFIG.wikipedia.base}?action=query&prop=extracts|pageimages&exintro&explaintext&pithumbsize=500&titles=${encodeURIComponent(title)}&format=json&origin=*`,
    },
    streaming: {
        esportesEmbed: (slug) => `https://esportesembed.top/${slug}`,
        reiDosCanais: (slug) => `https://api.reidoscanais.io/sports/${slug}`,
    },
    openF1: {
        base: 'https://api.openf1.org/v1',
    },
    utils: {
        formatDateForEspn: (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}${month}${day}`;
        }
    }
};

// ========================================================================
// EXPORTAÇÃO PADRÃO (FALLBACK)
// ========================================================================

const FirebaseServices = {
    auth,
    db,
    storage,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithGoogle,
    signOut,
    updateProfile,
    getItems,
    addOrUpdateItem,
    deleteItem,
    subscribeToCollection,
    fetchAndCache,
    uploadFile,
    deleteFileByUrl,
    seedInitialFirestoreData,
    downloadAllUserDataAsJson,
    uploadUserDataFromJson,
    GoogleAuthProvider,
    signInWithCredential,
    registerForPushNotificationsAsync,
    saveUserPushToken,
    SPORTS_DB,
    API_CONFIG,
};

export default FirebaseServices;