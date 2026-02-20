import { getFocusedRouteNameFromRoute, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, Image } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

// Importação das telas
import Artilharia from './Dashboard/Artilharia';
import Classificacao from './Dashboard/Classificacao';
import Dashboard from './Dashboard/Dashboard';
import Noticias from './Dashboard/Noticias';
import NoticiaDetalhe from './Dashboard/NoticiaDetalhe'; // Nova tela de detalhe
import PerfilScreen from './Dashboard/Perfil';
import PreferenciasScreen from './Dashboard/Preferencias'; // Nova tela
import EditarPerfilScreen from './Dashboard/EditarPerfil'; // Nova tela de edição
import Login from './LoginCadastroES/LoginUnico';

import { PreferencesProvider } from './Dashboard/PreferencesContext';
import { auth, onAuthStateChanged, registerForPushNotificationsAsync, saveUserPushToken } from './firebaseConfig';
import theme, { COLORS } from './theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const ProfileStack = createStackNavigator();
const NewsStack = createStackNavigator();

// Navegador para a seção de Perfil, contendo a tela principal e a de preferências
function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen 
        name="PerfilPrincipal" 
        component={PerfilScreen} 
        options={{ headerShown: false }} // O cabeçalho já é fornecido pelo Tab Navigator
      />
      <ProfileStack.Screen 
        name="Preferencias" 
        component={PreferenciasScreen} 
        options={{ 
          title: 'Preferências de Ligas',
          headerStyle: { backgroundColor: theme.COLORS.background, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: theme.COLORS.border },
          headerTitleStyle: { fontWeight: '700', fontSize: theme.FONT_SIZES.xl, color: theme.COLORS.textPrimary },
          headerBackTitleVisible: false,
          headerTintColor: theme.COLORS.textPrimary
        }} 
      />
      <ProfileStack.Screen 
        name="EditarPerfil" 
        component={EditarPerfilScreen} 
        options={{ 
          title: 'Editar Perfil',
          headerTitleStyle: { fontWeight: '700', fontSize: theme.FONT_SIZES.xl, color: theme.COLORS.textPrimary },
          headerBackTitleVisible: false,
          headerTintColor: theme.COLORS.textPrimary
        }}
      />
    </ProfileStack.Navigator>
  );
}

// Navegador para a seção de Notícias
function NewsStackScreen() {
  return (
    <NewsStack.Navigator>
      <NewsStack.Screen 
        name="NoticiasPrincipal" 
        component={Noticias} 
        options={{ headerShown: false }}
      />
      <NewsStack.Screen 
        name="NoticiaDetalhe" 
        component={NoticiaDetalhe} 
        options={{ headerShown: false }} // Cabeçalho customizado na própria tela
      />
    </NewsStack.Navigator>
  );
}

function MainApp() {
  const user = auth.currentUser;
  return (
      <Tab.Navigator
          screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                  let iconName;
                  if (route.name === 'Início') iconName = 'home';
                  else if (route.name === 'Classificação') iconName = 'bar-chart-2';
                  else if (route.name === 'Artilharia') iconName = 'target';
                  else if (route.name === 'Notícias') iconName = 'file-text';
                  else if (route.name === 'Perfil') iconName = 'user';
                  
                  return <Feather name={iconName} size={20} color={color} />;
              },
              tabBarActiveTintColor: theme.COLORS.primary,
              tabBarInactiveTintColor: theme.COLORS.textMuted,
              tabBarStyle: {
                  height: 65,
                  paddingBottom: theme.SPACING.sm,
                  paddingTop: theme.SPACING.xs,
                  backgroundColor: theme.COLORS.surface,
                  borderTopWidth: theme.BORDERS.width,
                  borderTopColor: theme.COLORS.border,
              },
              tabBarLabelStyle: {
                  fontWeight: '500',
                  fontSize: theme.FONT_SIZES.xs,
                  marginTop: theme.SPACING.xs,
              },
              headerStyle: { backgroundColor: theme.COLORS.background, borderBottomWidth: 1, borderBottomColor: theme.COLORS.border },
              headerTitleAlign: 'left',
              headerTitle: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md }}>
                  <View style={{ width: 32, height: 32, backgroundColor: theme.COLORS.primaryLight, borderRadius: theme.BORDERS.radiusSmall, justifyContent: 'center', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="soccer" size={16} color={theme.COLORS.primary} />
                  </View>
                  <Text style={{ fontWeight: '700', fontSize: theme.FONT_SIZES.h3, color: theme.COLORS.textPrimary }}>ScoreBoard</Text>
                </View>
              ),
              headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md, paddingRight: theme.SPACING.lg }}>
                  <TouchableOpacity><Feather name="bell" size={16} color={theme.COLORS.textSecondary} /></TouchableOpacity>
                  <Image source={{ uri: user?.photoURL || `https://i.pravatar.cc/100?u=${user?.uid}` }} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.COLORS.border }} />
                </View>
              ),
          })}
      >
          <Tab.Screen name="Início" component={Dashboard} />
          <Tab.Screen name="Classificação" component={Classificacao} />
          <Tab.Screen name="Artilharia" component={Artilharia} />
          <Tab.Screen 
            name="Notícias" 
            component={NewsStackScreen}
            options={({ route }) => {
              // Oculta a barra de abas na tela de detalhe da notícia
              const routeName = getFocusedRouteNameFromRoute(route) ?? 'NoticiasPrincipal';
              const display = routeName === 'NoticiaDetalhe' ? 'none' : 'flex';
              return { tabBarStyle: { display, height: 65, paddingBottom: 10, paddingTop: 5, backgroundColor: theme.COLORS.surface, borderTopWidth: 1, borderTopColor: theme.COLORS.border } };
            }}
          />
          <Tab.Screen 
            name="Perfil" 
            component={ProfileStackScreen}
            options={({ route }) => {
              // Oculta a barra de abas quando o usuário entra na tela de "Preferências"
              const routeName = getFocusedRouteNameFromRoute(route) ?? 'PerfilPrincipal';
              const display = ['Preferencias', 'EditarPerfil'].includes(routeName) ? 'none' : 'flex';
              return {
                tabBarStyle: { display, height: 65, paddingBottom: 10, paddingTop: 5, backgroundColor: theme.COLORS.surface, borderTopWidth: 1, borderTopColor: theme.COLORS.border }
              };
            }}
          />
      </Tab.Navigator>
  );
}

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  // Observador do estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (initializing) {
        setInitializing(false);
      }
    });

    return unsubscribe; // Cancela a inscrição ao desmontar
  }, []);

  // Efeito para configurar as notificações
  useEffect(() => {
    if (user) {
      const setupNotifications = async () => {
        try {
          const token = await registerForPushNotificationsAsync();
          if (token) {
            await saveUserPushToken(user.uid, token);
          }
        } catch (error) {
          console.error("Falha ao configurar notificações:", error);
        }
      };
      setupNotifications();

      const notificationListener = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notificação recebida em primeiro plano:', notification);
      });

      const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Usuário interagiu com a notificação:', response);
      });

      return () => {
        Notifications.removeNotificationSubscription(notificationListener);
        Notifications.removeNotificationSubscription(responseListener);
      };
    }
  }, [user]);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    ); 
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="MainApp">
            {() => (
              <PreferencesProvider><MainApp /></PreferencesProvider>
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Login" component={Login} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
