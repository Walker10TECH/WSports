import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  Platform,
  Animated,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_CONFIG, auth, SPORTS_DB, fetchAndCache } from '../firebaseConfig';
import theme from '../theme';
import EmptyState from './EmptyState';

// Categorias/Ligas para as Notícias
const CATEGORIES = Object.values(SPORTS_DB.soccer.leagues)
  .filter(league => ['eng.1', 'esp.1', 'bra.1', 'ita.1', 'ger.1'].includes(league.id))
  .map(({ id, name }) => ({ id, name }));

// Componente reutilizável para o efeito de "esqueleto"
const SkeletonPiece = ({ width, height, borderRadius, style }) => {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: theme.COLORS.border },
        style,
        { opacity }
      ]}
    />
  );
};

export default function Noticias() {
  const user = auth.currentUser;
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const isLargeScreen = width > 768;

  // Busca as notícias reais na API da ESPN
  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        const url = API_CONFIG.espn.news('soccer', activeCategory);
        const cacheKey = `news_${activeCategory}`;
        // Cache de 30 minutos para notícias
        const data = await fetchAndCache(cacheKey, url, 30 * 60 * 1000);
        
        // Formata os artigos que vêm da API
        const articles = data.articles || [];
        setNews(articles);
      } catch (error) {
        console.error("Erro ao buscar notícias:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [activeCategory]);

  // Formata a data (ex: "10 de Fev")
  const formatDate = (dateString) => {
    if (!dateString) return 'Recente';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  // Cores dinâmicas para as tags de categoria na lista
  const getTagColor = (index) => {
    const colors = [theme.COLORS.primary, theme.COLORS.secondary, theme.COLORS.success, theme.COLORS.warning];
    return colors[index % colors.length];
  };

  const featuredNews = news.length > 0 ? news[0] : null;
  const latestNews = news.length > 1 ? news.slice(1) : [];

  const NewsSkeleton = () => (
    <>
      {/* Featured News Skeleton */}
      <View style={[styles.contentWrapper, isLargeScreen && { maxWidth: 1000 }]}>
        <View style={styles.featuredCardSkeleton}>
          <View style={styles.featuredContentSkeleton}>
            <SkeletonPiece width={80} height={20} borderRadius={4} />
            <SkeletonPiece width="80%" height={24} borderRadius={4} style={{ marginTop: 16 }} />
            <SkeletonPiece width="60%" height={24} borderRadius={4} style={{ marginTop: 8 }} />
          </View>
        </View>
      </View>
  
      {/* List News Skeleton */}
      <View style={[styles.contentWrapper, isLargeScreen && { maxWidth: 1000 }]}>
        <Text style={styles.listSectionTitle}>LATEST NEWS</Text>
        <View style={styles.listContainer}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.listCard}>
              <View style={styles.listInfo}>
                <SkeletonPiece width={100} height={16} borderRadius={4} />
                <SkeletonPiece width="90%" height={20} borderRadius={4} style={{ marginTop: 12 }} />
                <SkeletonPiece width="70%" height={16} borderRadius={4} style={{ marginTop: 8 }} />
              </View>
              <SkeletonPiece width={96} height={94} borderRadius={8} />
            </View>
          ))}
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>      
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={false}>
        {/* TABS DE CATEGORIAS */}
        <View style={[styles.tabsContainer, isLargeScreen && { maxWidth: 1000, width: '100%' }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <TouchableOpacity 
                  key={cat.id} 
                  style={[styles.tabButton, isActive && styles.tabButtonActive]}
                  onPress={() => setActiveCategory(cat.id)}
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <NewsSkeleton />
        ) : (
          <>
            {/* NOTÍCIA EM DESTAQUE (FEATURED) */}
            {featuredNews && (
              <View style={[styles.contentWrapper, isLargeScreen && { maxWidth: 1000 }]}>
                <TouchableOpacity 
                  activeOpacity={0.8} 
                  onPress={() => navigation.navigate('NoticiaDetalhe', { article: featuredNews })}
                >
                  <ImageBackground 
                    source={{ uri: featuredNews.images?.[0]?.url || 'https://via.placeholder.com/600x400' }} 
                    style={styles.featuredCard}
                    imageStyle={styles.featuredImage}
                    resizeMode="cover"
                  >
                    {/* Gradiente Escuro por cima da imagem */}
                    <LinearGradient
                      colors={['transparent', 'rgba(15, 23, 42, 0.4)', 'rgba(15, 23, 42, 0.9)']}
                      style={styles.featuredGradient}
                    >
                      <View style={styles.featuredContent}>
                        <View style={styles.featuredMetaRow}>
                          <View style={styles.featuredBadge}>
                            <Text style={styles.featuredBadgeText}>DESTAQUE</Text>
                          </View>
                          <View style={styles.featuredTime}>
                            <Feather name="clock" size={12} color="#CBD5E1" />
                            <Text style={styles.featuredTimeText}>{formatDate(featuredNews.published)}</Text>
                          </View>
                        </View>
                        <Text style={styles.featuredTitle} numberOfLines={3}>
                          {featuredNews.headline}
                        </Text>
                        <Text style={styles.featuredDesc} numberOfLines={2}>
                          {featuredNews.description}
                        </Text>
                      </View>
                    </LinearGradient>
                  </ImageBackground>
                </TouchableOpacity>
              </View>
            )}

            {/* LISTA DE ÚLTIMAS NOTÍCIAS */}
            <View style={[styles.contentWrapper, isLargeScreen && { maxWidth: 1000 }]}>
              <Text style={styles.listSectionTitle}>LATEST NEWS</Text>
              
              <View style={styles.listContainer}>
                {latestNews.map((article, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.listCard}
                    onPress={() => navigation.navigate('NoticiaDetalhe', { article })}
                  >
                    
                    {/* Info da Notícia (Esquerda) */}
                    <View style={styles.listInfo}>
                      <View style={styles.listMetaRow}>
                        <Text style={[styles.listCategory, { color: getTagColor(index) }]}>
                          NOTÍCIA
                        </Text>
                        <Text style={styles.listTime}>
                          {formatDate(article.published)}
                        </Text>
                      </View>
                      <Text style={styles.listTitle} numberOfLines={3}>
                        {article.headline}
                      </Text>
                      <Text style={styles.listDesc} numberOfLines={2}>
                        {article.description || 'Confira os detalhes completos no app.'}
                      </Text>
                    </View>

                    {/* Thumbnail (Direita) */}
                    <Image 
                      source={{ uri: article.images?.[0]?.url || 'https://via.placeholder.com/150' }} 
                      style={styles.listThumbnail} 
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}

                {latestNews.length === 0 && !featuredNews && (
                  <EmptyState
                    icon="file-text"
                    title="Sem Notícias"
                    message="Nenhuma notícia foi encontrada para esta liga no momento."
                  />
                )}
              </View>
            </View>
          </>
        )}
        
        {/* Espaçador inferior para a Navigation */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.COLORS.background },
  container: { flex: 1 },
  scrollContentContainer: { 
    paddingTop: 0,
    alignItems: 'center',
    flexGrow: 1,
  },
  /* FILTROS (TABS) */
  tabsContainer: { paddingVertical: theme.SPACING.md, backgroundColor: theme.COLORS.background, paddingTop: theme.SPACING.lg, width: '100%' },
  tabsScroll: { paddingHorizontal: theme.SPACING.lg, gap: 10 },
  tabButton: { 
    paddingVertical: theme.SPACING.sm, paddingHorizontal: 20, 
    backgroundColor: theme.COLORS.surface, borderRadius: theme.BORDERS.radiusFull, 
    borderWidth: theme.BORDERS.width, borderColor: theme.COLORS.border,
    justifyContent: 'center', alignItems: 'center'
  },
  tabButtonActive: {
    backgroundColor: theme.COLORS.primary, borderColor: theme.COLORS.primary, ...theme.SHADOWS.sm
  },
  tabText: { fontWeight: '600', fontSize: theme.FONT_SIZES.md, color: theme.COLORS.textSecondary },
  tabTextActive: { color: theme.COLORS.textOnPrimary, fontWeight: '700' },

  contentWrapper: {
    width: '100%',
    paddingHorizontal: theme.SPACING.lg,
    marginBottom: theme.SPACING.lg,
  },

  /* NOTÍCIA DESTAQUE */
  featuredCard: {
    width: '100%', height: 256,
    borderRadius: theme.BORDERS.radiusLarge,
    ...theme.SHADOWS.md,
  },
  featuredImage: { borderRadius: theme.BORDERS.radiusLarge },
  featuredCardSkeleton: {
    width: '100%', height: 256,
    borderRadius: theme.BORDERS.radiusLarge,
    backgroundColor: theme.COLORS.border,
    justifyContent: 'flex-end',
    padding: 20,
  },
  featuredContentSkeleton: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: theme.SPACING.md,
    borderRadius: theme.BORDERS.radiusMedium,
  },
  featuredGradient: { flex: 1, borderRadius: theme.BORDERS.radiusLarge, justifyContent: 'flex-end', padding: 20 },
  featuredContent: { gap: theme.SPACING.sm },
  featuredMetaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.xs },
  featuredBadge: { backgroundColor: theme.COLORS.primary, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  featuredBadgeText: { fontWeight: '700', fontSize: theme.FONT_SIZES.xs, color: theme.COLORS.textOnPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
  featuredTime: { flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.xs },
  featuredTimeText: { fontWeight: '500', fontSize: theme.FONT_SIZES.sm, color: '#CBD5E1' },
  featuredTitle: { fontWeight: '700', fontSize: theme.FONT_SIZES.h3, color: theme.COLORS.textOnPrimary, lineHeight: 25 },
  featuredDesc: { fontWeight: '400', fontSize: theme.FONT_SIZES.md, color: '#CBD5E1', lineHeight: 20, marginTop: 4 },

  /* LISTA DE NOTÍCIAS */
  listSectionTitle: { fontWeight: '700', fontSize: theme.FONT_SIZES.md, color: theme.COLORS.textSecondary, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: theme.SPACING.md },
  listContainer: { gap: theme.SPACING.md },
  
  listCard: {
    flexDirection: 'row',
    backgroundColor: theme.COLORS.surface, borderWidth: theme.BORDERS.width, borderColor: theme.COLORS.border,
    borderRadius: theme.BORDERS.radiusMedium, padding: theme.SPACING.md, gap: theme.SPACING.md,
    ...theme.SHADOWS.sm,
  },
  listInfo: { flex: 1, justifyContent: 'center' },
  listMetaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: 6 },
  listCategory: { fontWeight: '700', fontSize: theme.FONT_SIZES.xs, textTransform: 'uppercase' },
  listTime: { fontWeight: '500', fontSize: theme.FONT_SIZES.xs, color: theme.COLORS.textMuted },
  listTitle: { fontWeight: '700', fontSize: theme.FONT_SIZES.md, color: theme.COLORS.textPrimary, lineHeight: 19, marginBottom: 6 },
  listDesc: { fontWeight: '400', fontSize: theme.FONT_SIZES.sm, color: theme.COLORS.textSecondary, lineHeight: 16 },
  
  listThumbnail: { width: 96, height: 94, borderRadius: theme.BORDERS.radiusSmall, backgroundColor: theme.COLORS.border },
});