import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { ImageBackground, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import theme from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NoticiaDetalhe({ route }) {
  const { article } = route.params;
  const [webViewHeight, setWebViewHeight] = useState(300);
  const [loadingWebView, setLoadingWebView] = useState(true);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Script para injetar no WebView para obter a altura do conteúdo
  const webViewScript = `
    (function() {
      function C() {
        const height = document.body.scrollHeight;
        window.ReactNativeWebView.postMessage(height);
      }
      window.addEventListener('load', C);
      window.addEventListener('resize', C);
      // Um pequeno delay para garantir que todo o conteúdo (imagens, etc) foi carregado e renderizado
      setTimeout(C, 500);
    })();
    true;
  `;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView>
        <ImageBackground
          source={{ uri: article.images?.[0]?.url || 'https://via.placeholder.com/600x400' }}
          style={styles.featuredImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['transparent', 'rgba(15, 23, 42, 0.8)', theme.COLORS.backgroundDark]}
            style={styles.gradient}
          />
        </ImageBackground>

        <View style={styles.contentContainer}>
          <Text style={styles.headline}>{article.headline}</Text>
          <View style={styles.metaRow}>
            <Feather name="clock" size={theme.FONT_SIZES.md} color={theme.COLORS.textMuted} />
            <Text style={styles.metaText}>{formatDate(article.published)}</Text> 
          </View>
          
          {/* WebView para carregar a notícia completa */}
          {loadingWebView && (
            <ActivityIndicator size="large" color={theme.COLORS.primary} style={{ marginVertical: 40 }} />
          )}
          <WebView
            originWhitelist={['*']}
            source={{ uri: article.links.web.href }}
            style={[styles.webView, { height: webViewHeight }]}
            onLoadEnd={() => setLoadingWebView(false)}
            injectedJavaScript={webViewScript}
            onMessage={(event) => {
              // Adiciona um padding para não ficar colado no final
              const newHeight = parseInt(event.nativeEvent.data, 10) + 50;
              if (newHeight > webViewHeight) {
                setWebViewHeight(newHeight);
              }
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={false} // A rolagem será feita pelo ScrollView principal
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.COLORS.backgroundDark },
  featuredImage: {
    width: '100%',
    height: 350,
    justifyContent: 'flex-end',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  contentContainer: {
    padding: theme.SPACING.lg,
    backgroundColor: theme.COLORS.backgroundDark,
    marginTop: -30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  headline: {
    fontSize: theme.FONT_SIZES.h2,
    fontWeight: 'bold',
    color: theme.COLORS.textOnPrimary,
    lineHeight: 32,
    marginBottom: theme.SPACING.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.sm,
    marginBottom: theme.SPACING.lg,
  },
  metaText: {
    fontSize: theme.FONT_SIZES.md,
    color: theme.COLORS.textMuted,
    fontWeight: '500',
  },
  description: {
    fontSize: theme.FONT_SIZES.lg,
    color: '#CBD5E1',
    lineHeight: 26,
    textAlign: 'justify',
  },
  webView: {
    width: '100%',
    backgroundColor: theme.COLORS.backgroundDark, // Para evitar flash branco
  },
});