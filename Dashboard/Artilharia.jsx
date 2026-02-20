import React, { useEffect, useState } from 'react';
import {
  Platform,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, SPORTS_DB } from '../firebaseConfig';
import theme from '../theme';
import EmptyState from './EmptyState';

// Ligas disponíveis
const LEAGUES = Object.values(SPORTS_DB.soccer.leagues)
  .filter(league => league.apiFootballId) // Apenas ligas com ID para a API de artilharia
  .map(({ id, name, apiFootballId, seasonId }) => ({ id, name, apiFootballId, season: seasonId }));

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

export default function Artilharia() {
  const user = auth.currentUser;
  const [activeLeague, setActiveLeague] = useState(LEAGUES[0].id);
  const [scorers, setScorers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchScorers = async () => {
      if (!activeLeague) return;
      setLoading(true);
      setScorers([]);
      setError('');

      // --- AVISO DE SEGURANÇA ---
      // A chave da API (APIFOOTBALL_KEY) foi removida do código do cliente por segurança.
      // Expor chaves de API no frontend é um risco grave.
      // Para esta funcionalidade voltar, é necessário criar um backend (ex: Firebase Function)
      // que faça a chamada à API de forma segura, sem expor a chave.
      setError('Este recurso está temporariamente indisponível para garantir a segurança dos dados.');
      setLoading(false);
    };

    fetchScorers();
  }, [activeLeague]);

  const topScorer = scorers.length > 0 ? scorers[0] : null;
  const otherScorers = scorers.length > 1 ? scorers.slice(1) : [];

  const ScorersSkeleton = () => (
    <>
      {/* Highlight Skeleton */}
      <View style={styles.contentWrapper}>
        <View style={styles.highlightCard}>
          <View style={styles.highlightRow}>
            <SkeletonPiece width={80} height={80} borderRadius={40} />
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonPiece width="70%" height={20} borderRadius={4} />
              <SkeletonPiece width="40%" height={14} borderRadius={4} />
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                <View style={{alignItems: 'flex-start'}}><SkeletonPiece width={40} height={22} borderRadius={4} /><SkeletonPiece width={30} height={10} borderRadius={4} style={{marginTop: 4}} /></View>
                <View style={{alignItems: 'flex-start'}}><SkeletonPiece width={40} height={22} borderRadius={4} /><SkeletonPiece width={50} height={10} borderRadius={4} style={{marginTop: 4}} /></View>
                <View style={{alignItems: 'flex-start'}}><SkeletonPiece width={40} height={22} borderRadius={4} /><SkeletonPiece width={40} height={10} borderRadius={4} style={{marginTop: 4}} /></View>
              </View>
            </View>
          </View>
        </View>
      </View>
  
      {/* List Skeleton */}
      <View style={styles.contentWrapper}>
        {[...Array(5)].map((_, index) => (
          <View key={index} style={styles.playerCard}>
            <SkeletonPiece width={16} height={16} borderRadius={4} style={{ width: 24 }} />
            <View style={styles.tdPlayerInfo}>
              <SkeletonPiece width={40} height={40} borderRadius={20} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonPiece width="80%" height={14} borderRadius={4} />
                <SkeletonPiece width="50%" height={12} borderRadius={4} />
              </View>
            </View>
            <SkeletonPiece width={30} height={20} borderRadius={4} style={{ width: 40 }} />
          </View>
        ))}
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>      
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={false}>
        {/* TÍTULO DA PÁGINA */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Artilharia</Text>
        </View>

        {/* TABS DE LIGAS */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            {LEAGUES.map((league) => {
              const isActive = activeLeague === league.id;
              return (
                <TouchableOpacity 
                  key={league.id} 
                  style={[styles.tabButton, isActive && styles.tabButtonActive]}
                  onPress={() => setActiveLeague(league.id)}
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {league.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <ScorersSkeleton />
        ) : error ? (
          <EmptyState
            icon="alert-triangle"
            title="Recurso Indisponível"
            message={error}
          />
        ) : (
          <>
            {/* DESTAQUE 1º COLOCADO */}
            {topScorer ? (
          <View style={styles.contentWrapper}>
            <View style={styles.highlightCard}>
              <View style={styles.highlightRow}>
                
                {/* Avatar Destaque */}
                <View style={styles.highlightAvatarContainer}>
                  <View style={styles.avatarBorderWrapper}>
                    <Image source={{ uri: topScorer.photo }} style={styles.highlightAvatar} resizeMode="contain" />
                  </View>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankBadgeText}>1</Text>
                  </View>
                </View>
                
                {/* Info Destaque */}
                <View style={styles.highlightInfo}>
                  <Text style={styles.highlightName} numberOfLines={1}>{topScorer.name}</Text>
                  <View style={styles.highlightTeamRow}>
                    <View style={[styles.teamDot, { backgroundColor: topScorer.teamColor }]} />
                    <Text style={styles.highlightTeam}>{topScorer.team}</Text>
                  </View>
                  
                  {/* Estatísticas */}
                  <View style={styles.highlightStats}>
                    <View style={styles.statBox}>
                      <Text style={styles.statValueBlue}>{topScorer.goals}</Text>
                      <Text style={styles.statLabel}>GOLS</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                      <Text style={styles.statValueDark}>{topScorer.matches}</Text>
                      <Text style={styles.statLabel}>PARTIDAS</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                      <Text style={styles.statValueDark}>{topScorer.avg}</Text>
                      <Text style={styles.statLabel}>MÉDIA</Text>
                    </View>
                  </View>
                </View>
                
              </View>
            </View>
              </View>
            ) : <Text style={styles.emptyText}>Nenhum artilheiro encontrado para esta liga.</Text>}

            {/* LISTA DE OUTROS ARTILHEIROS */}
        <View style={styles.contentWrapper}>
          
          {/* Cabeçalho da Lista */}
          <View style={styles.listHeaderRow}>
            <Text style={[styles.listHeaderTh, { width: 24, textAlign: 'center' }]}>POS</Text>
            <Text style={[styles.listHeaderTh, { flex: 1, paddingLeft: 8 }]}>JOGADOR</Text>
            <Text style={[styles.listHeaderTh, { width: 40, textAlign: 'right' }]}>GOLS</Text>
          </View>

          {/* Renderização da Lista */}
          {otherScorers.map((player) => (
            <View key={player.id} style={styles.playerCard}>
              <Text style={styles.tdRank}>{player.rank}</Text>
              
              <View style={styles.tdPlayerInfo}>
                <View style={styles.playerAvatarBg}>
                  <Image source={{ uri: player.photo }} style={styles.playerAvatar} resizeMode="contain" />
                </View>
                <View style={styles.playerTexts}>
                  <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
                  <View style={styles.teamSubRow}>
                    <View style={[styles.tinyTeamDot, { backgroundColor: player.teamColor }]} />
                    <Text style={styles.playerTeam} numberOfLines={1}>{player.team}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.tdGoals}>{player.goals}</Text>
            </View>
          ))}

          {otherScorers.length === 0 && (
            <Text style={styles.emptyText}>Sem mais dados disponíveis para esta liga.</Text>
          )}
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
    
  pageHeader: { paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.md, backgroundColor: theme.COLORS.background },
  pageTitle: { fontWeight: '700', fontSize: theme.FONT_SIZES.h2, color: theme.COLORS.textPrimary },
  
  tabsContainer: { marginBottom: theme.SPACING.md },
  tabsScroll: { paddingHorizontal: theme.SPACING.lg, gap: theme.SPACING.md },
  tabButton: { 
    paddingVertical: theme.SPACING.sm, paddingHorizontal: theme.SPACING.md, 
    backgroundColor: theme.COLORS.surface, borderRadius: theme.BORDERS.radiusFull, 
    borderWidth: theme.BORDERS.width, borderColor: theme.COLORS.border,
    justifyContent: 'center', alignItems: 'center'
  },
  tabButtonActive: {
    backgroundColor: theme.COLORS.primary, borderColor: theme.COLORS.primary, ...theme.SHADOWS.md
  },
  tabText: { fontWeight: '600', fontSize: theme.FONT_SIZES.md, color: theme.COLORS.textSecondary },
  tabTextActive: { color: theme.COLORS.textOnPrimary, fontWeight: '700' },

  contentWrapper: {
    width: '100%',
    maxWidth: 800,
    paddingHorizontal: theme.SPACING.lg,
    marginBottom: theme.SPACING.lg,
  },

  /* DESTAQUE 1º LUGAR */
  highlightCard: {
    backgroundColor: theme.COLORS.surface, borderWidth: theme.BORDERS.width, borderColor: theme.COLORS.border,
    borderRadius: theme.BORDERS.radiusLarge, padding: theme.SPACING.md,
    ...theme.SHADOWS.md,
  },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md },
  
  highlightAvatarContainer: { position: 'relative', width: 80, height: 80 },
  avatarBorderWrapper: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.COLORS.background, borderWidth: 2, borderColor: theme.COLORS.primary,
    justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden'
  },
  highlightAvatar: { width: 70, height: 70 },
  rankBadge: {
    position: 'absolute', top: -6, right: -6, width: 28, height: 28,
    backgroundColor: theme.COLORS.primary, borderRadius: 14, borderWidth: 2, borderColor: theme.COLORS.surface,
    justifyContent: 'center', alignItems: 'center',
    ...theme.SHADOWS.sm,
  },
  rankBadgeText: { fontWeight: '700', fontSize: theme.FONT_SIZES.sm, color: theme.COLORS.textOnPrimary },

  highlightInfo: { flex: 1, justifyContent: 'center' },
  highlightName: { fontWeight: '700', fontSize: theme.FONT_SIZES.h3, color: theme.COLORS.textPrimary, marginBottom: 2 },
  highlightTeamRow: { flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.md },
  teamDot: { width: 12, height: 12, borderRadius: 6 },
  highlightTeam: { fontWeight: '500', fontSize: theme.FONT_SIZES.md, color: theme.COLORS.textSecondary },
  
  highlightStats: { flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md },
  statBox: { alignItems: 'flex-start' },
  statValueBlue: { fontWeight: '900', fontSize: 22, color: theme.COLORS.primary, lineHeight: 28 },
  statValueDark: { fontWeight: '700', fontSize: theme.FONT_SIZES.xl, color: theme.COLORS.textSecondary, lineHeight: 28 },
  statLabel: { fontWeight: '600', fontSize: theme.FONT_SIZES.xs, color: theme.COLORS.textMuted, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 28, backgroundColor: theme.COLORS.border },

  /* LISTA COMUM */
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.SPACING.md, marginBottom: theme.SPACING.xs },
  listHeaderTh: { fontWeight: '700', fontSize: theme.FONT_SIZES.sm, color: theme.COLORS.textMuted },

  playerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.COLORS.surface, borderWidth: theme.BORDERS.width, borderColor: theme.COLORS.border,
    borderRadius: theme.BORDERS.radiusMedium, padding: theme.SPACING.md, marginBottom: theme.SPACING.md,
    ...theme.SHADOWS.sm,
  },
  tdRank: { width: 24, textAlign: 'center', fontWeight: '700', fontSize: theme.FONT_SIZES.lg, color: theme.COLORS.textMuted },
  
  tdPlayerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: theme.SPACING.sm, gap: theme.SPACING.md },
  playerAvatarBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.COLORS.background, justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden' },
  playerAvatar: { width: 36, height: 36 },
  playerTexts: { flex: 1, justifyContent: 'center' },
  playerName: { fontWeight: '700', fontSize: theme.FONT_SIZES.md, color: theme.COLORS.textPrimary, marginBottom: 2 },
  teamSubRow: { flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.xs },
  tinyTeamDot: { width: 8, height: 8, borderRadius: 4 },
  playerTeam: { fontWeight: '500', fontSize: theme.FONT_SIZES.sm, color: theme.COLORS.textSecondary },

  tdGoals: { width: 40, textAlign: 'right', fontWeight: '900', fontSize: theme.FONT_SIZES.xl, color: theme.COLORS.textPrimary },
  
  emptyText: { textAlign: 'center', color: theme.COLORS.textMuted, marginTop: theme.SPACING.lg },

});