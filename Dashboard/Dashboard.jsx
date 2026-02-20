import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
  ActivityIndicator,
  Platform,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  View,
  Alert,
  useWindowDimensions,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreferences } from './PreferencesContext';
import { API_CONFIG, auth, SPORTS_DB, fetchAndCache, addOrUpdateItem, deleteItem } from '../firebaseConfig';
import theme from '../theme';

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

export default function Dashboard() {
  const user = auth.currentUser;
  const { favoriteLeagues, loading: prefsLoading, matchReminders } = usePreferences();
  const [matches, setMatches] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const dateScrollRef = useRef(null);
  const [togglingReminder, setTogglingReminder] = useState(null);
  const isLargeScreen = width > 768;

  const handleToggleReminder = async (match) => {
    if (togglingReminder === match.id) return;
    setTogglingReminder(match.id);

    const existingReminder = matchReminders.find(r => r.apiId === match.id);

    try {
        if (existingReminder) {
            // Cancelar lembrete
            if (existingReminder.notificationId) {
                await Notifications.cancelScheduledNotificationAsync(existingReminder.notificationId);
            }
            await deleteItem('matchReminders', existingReminder.id);
            Alert.alert('Lembrete Removido', `Você não será mais notificado sobre o jogo ${match.name}.`);
        } else {
            // Criar lembrete
            const matchDate = new Date(match.date);
            const trigger = new Date(matchDate.getTime() - 5 * 60 * 1000); // 5 minutos antes

            if (trigger < new Date()) {
                Alert.alert('Jogo Próximo', 'Não é possível criar um lembrete para um jogo que já começou ou está prestes a começar.');
                return;
            }

            const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'Jogo prestes a começar! ⚽',
                    body: `${match.name}`,
                    data: { matchId: match.id },
                    sound: 'default',
                },
                trigger,
            });

            const reminderData = { apiId: match.id, notificationId, matchName: match.name, matchDate: match.date };
            await addOrUpdateItem('matchReminders', reminderData, false);
            Alert.alert('Lembrete Criado!', `Você será notificado 5 minutos antes de ${match.name}.`);
        }
    } catch (error) {
        console.error("Erro ao gerenciar lembrete:", error);
        Alert.alert('Erro', 'Não foi possível gerenciar o lembrete.');
    } finally {
        setTogglingReminder(null);
    }
  };

  // Função para buscar dados reais usando a API da ESPN mapeada no seu código
  useEffect(() => {
    const fetchMatches = async () => {
      // Não faz nada se as preferências ainda estiverem carregando
      if (prefsLoading) return;

      // Se não houver ligas favoritas, para o carregamento e limpa os jogos
      if (!favoriteLeagues || favoriteLeagues.length === 0) {
        setMatches([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Pegando data atual no formato YYYYMMDD
        const dateString = API_CONFIG.utils.formatDateForEspn(selectedDate);

        // Cria uma lista de promises para buscar os jogos de todas as ligas favoritas em paralelo
        const promises = favoriteLeagues
          .map(league => {
            const url = API_CONFIG.espn.scoreboard('soccer', league.apiId, dateString); // A data selecionada é usada aqui
            const cacheKey = `scoreboard_${league.apiId}_${dateString}`;
            return fetchAndCache(cacheKey, url);
          });

        const results = await Promise.all(promises);

        // Junta os resultados de todas as chamadas
        const allMatches = results.flatMap(data => data.events || []);

        // Ordena os jogos: ao vivo > futuros > passados
        allMatches.sort((a, b) => {
          const stateOrder = { 'in': 1, 'pre': 2, 'post': 3 };
          const stateA = stateOrder[a.status.type.state] || 4;
          const stateB = stateOrder[b.status.type.state] || 4;
          if (stateA !== stateB) return stateA - stateB;
          return new Date(a.date) - new Date(b.date);
        });

        setMatches(allMatches);
      } catch (error) {
        console.error("Erro ao buscar jogos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [favoriteLeagues, prefsLoading, selectedDate]);

  // Categorizando os jogos baseados no 'status.state' da ESPN
  const liveMatches = matches.filter(m => m.status.type.state === 'in');
  const upcomingMatches = matches.filter(m => m.status.type.state === 'pre');
  const pastMatches = matches.filter(m => m.status.type.state === 'post');

  // Se não houver jogos ao vivo, mostramos os últimos finalizados para a UI não ficar vazia
  const displayLive = liveMatches.length > 0 ? liveMatches : pastMatches.slice(0, 3);
  const nextMatch = upcomingMatches.length > 0 ? upcomingMatches[0] : null;

  const DashboardSkeleton = ({ isLargeScreen }) => (
    <>
      {/* Live/Recent Skeleton */}
      <View style={[styles.section, isLargeScreen && { maxWidth: 1200, width: '100%' }]}>
        <Text style={styles.sectionTitle}>CARREGANDO...</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {[1, 2, 3].map(i => (
            <View key={i} style={styles.liveCard}>
              <SkeletonPiece width={80} height={16} borderRadius={4} style={{ marginBottom: 12 }} />
              <View style={styles.matchRow}>
                <SkeletonPiece width={32} height={32} borderRadius={16} />
                <SkeletonPiece width={40} height={24} borderRadius={4} />
              </View>
              <View style={styles.matchRow}>
                <SkeletonPiece width={32} height={32} borderRadius={16} />
                <SkeletonPiece width={40} height={24} borderRadius={4} />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
  
      {/* Next Match Skeleton */}
      <View style={[styles.section, isLargeScreen && { maxWidth: 800, width: '100%' }]}>
        <Text style={styles.sectionTitle}>PRÓXIMA PARTIDA</Text>
        <View style={[styles.heroCard, { backgroundColor: '#E9EFFD', elevation: 0, boxShadow: 'none' }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroTeam}>
              <SkeletonPiece width={56} height={56} borderRadius={28} />
              <SkeletonPiece width={60} height={14} borderRadius={4} />
            </View>
            <View style={styles.heroCenter}>
              <SkeletonPiece width={100} height={12} borderRadius={4} />
              <SkeletonPiece width={40} height={24} borderRadius={4} style={{ marginVertical: 8 }} />
              <SkeletonPiece width={80} height={20} borderRadius={10} />
            </View>
            <View style={styles.heroTeam}>
              <SkeletonPiece width={56} height={56} borderRadius={28} />
              <SkeletonPiece width={60} height={14} borderRadius={4} />
            </View>
          </View>
        </View>
      </View>
  
      {/* Today's Matches Skeleton */}
      <View style={[styles.section, isLargeScreen && { maxWidth: 800, width: '100%' }]}>
        <Text style={styles.sectionTitle}>JOGOS DE HOJE</Text>
        <View style={styles.matchesList}>
          {[1, 2, 3].map(i => (
            <View key={i} style={[styles.matchBox, {marginBottom: 12, backgroundColor: '#F8FAFC'}]}>
                <SkeletonPiece width={'100%'} height={40} borderRadius={4} />
            </View>
          ))}
        </View>
      </View>
    </>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={false}>
          <DashboardSkeleton isLargeScreen={isLargeScreen} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>      
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={false}>
        {/* SELETOR DE DATA CUSTOMIZADO */}
        <View style={[styles.section, isLargeScreen && { maxWidth: 800, width: '100%' }]}>
          <Text style={styles.sectionTitle}>SELECIONAR DATA</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateSelectorScroll} ref={dateScrollRef}>
            {[...Array(31)].map((_, i) => {
              const date = new Date();
              date.setHours(0, 0, 0, 0);
              date.setDate(date.getDate() + (i - 15)); // 15 dias antes, hoje, 15 dias depois

              const isToday = new Date().toDateString() === date.toDateString();
              const isSelected = selectedDate.toDateString() === date.toDateString();

              const formatDateLabel = (d) => {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
                const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

                if (d.getTime() === today.getTime()) return { day: 'Hoje', date: '' };
                if (d.getTime() === tomorrow.getTime()) return { day: 'Amanhã', date: '' };
                if (d.getTime() === yesterday.getTime()) return { day: 'Ontem', date: '' };

                const day = d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '');
                const dateNum = d.getDate();
                return { day, date: dateNum };
              };

              const { day, date: dateNum } = formatDateLabel(date);

              return (
                <TouchableOpacity key={i} style={[styles.dateButton, isSelected && styles.dateButtonActive]} onPress={() => setSelectedDate(date)}>
                  <Text style={[styles.dateButtonDay, isSelected && styles.dateButtonTextActive]}>{day}</Text>
                  <Text style={[styles.dateButtonDate, isSelected && styles.dateButtonTextActive]}>{dateNum}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* LIVE NOW / RECENT SECTION */}
        <View style={[styles.section, isLargeScreen && { maxWidth: 1200, width: '100%' }]}>
          <Text style={styles.sectionTitle}>{liveMatches.length > 0 ? 'LIVE NOW' : 'RECENTES'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            
            {displayLive.map((match) => {
              const comp = match.competitions[0];
              const home = comp.competitors.find(c => c.homeAway === 'home');
              const away = comp.competitors.find(c => c.homeAway === 'away');
              const isLive = match.status.type.state === 'in';

              return (
                <View key={match.id} style={styles.liveCard}>
                  <View style={styles.liveBadgeRow}>
                    <View style={[styles.liveDot, { backgroundColor: isLive ? theme.COLORS.live : theme.COLORS.textMuted }]} />
                    <Text style={[styles.liveText, { color: isLive ? theme.COLORS.live : theme.COLORS.textSecondary }]}>
                      {isLive ? match.status.displayClock : 'FIM'}
                    </Text>
                  </View>
                  <View style={styles.matchRow}>
                    <Image source={{ uri: home.team.logo }} style={styles.teamLogo} resizeMode="contain" />
                    <Text style={styles.scoreText}>{home.score}</Text>
                  </View>
                  <View style={styles.matchRow}>
                    <Image source={{ uri: away.team.logo }} style={styles.teamLogo} resizeMode="contain" />
                    <Text style={styles.scoreText}>{away.score}</Text>
                  </View>
                </View>
              );
            })}

            {displayLive.length === 0 && (
              <View style={{width: width - 48}}>
              </View>
            )}
          </ScrollView>
        </View>

        {/* NEXT MATCH SECTION */}
        {nextMatch && (
          <View style={[styles.section, isLargeScreen && { maxWidth: 800, width: '100%' }]}>
            <Text style={styles.sectionTitle}>NEXT MATCH</Text>
            <LinearGradient // Este componente tem um design único e forte, mantido intencionalmente.
              colors={['#135BEC', '#2563EB']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              {(() => {
                const comp = nextMatch.competitions[0];
                const home = comp.competitors.find(c => c.homeAway === 'home');
                const away = comp.competitors.find(c => c.homeAway === 'away');
                const matchDate = new Date(nextMatch.date);
                const leagueInfo = Object.values(SPORTS_DB.soccer.leagues).find(l => l.id === nextMatch.competitions[0].league?.slug);
                
                return (
                  <>
                    <View style={styles.heroTop}>
                      <View style={styles.heroTeam}>
                        <View style={styles.heroTeamLogoBg}>
                          <Image source={{ uri: home.team.logo }} style={styles.heroLogoImg} resizeMode="contain" />
                        </View>
                        <Text style={styles.heroTeamName}>{home.team.abbreviation}</Text>
                      </View>
                      
                      <View style={styles.heroCenter}>
                        <Text style={styles.heroLeague}>{leagueInfo?.name || 'Próximo Jogo'}</Text>
                        <Text style={styles.heroVs}>VS</Text>
                        <View style={styles.heroTimeBadge}>
                          <Text style={styles.heroTimeText}>
                            {matchDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.heroTeam}>
                        <View style={styles.heroTeamLogoBg}>
                          <Image source={{ uri: away.team.logo }} style={styles.heroLogoImg} resizeMode="contain" />
                        </View>
                        <Text style={styles.heroTeamName}>{away.team.abbreviation}</Text>
                      </View>
                    </View>
                  </>
                );
              })()}
            </LinearGradient>
          </View>
        )}

        {/* TODAY'S MATCHES SECTION */}
        <View style={[styles.section, isLargeScreen && { maxWidth: 800, width: '100%' }]}>
          <Text style={styles.sectionTitle}>JOGOS DO DIA</Text>
          <View style={styles.matchesList}>
            
            {matches.map((match) => {
              const comp = match.competitions[0];
              const home = comp.competitors.find(c => c.homeAway === 'home');
              const away = comp.competitors.find(c => c.homeAway === 'away');
              const matchDate = new Date(match.date);
              const isPre = match.status.type.state === 'pre';
              const leagueInfo = Object.values(SPORTS_DB.soccer.leagues).find(l => l.id === match.competitions[0].league?.slug);

              return (
                <View key={match.id} style={styles.matchItem}>
                  <View style={styles.matchLeagueHeader}>
                    <MaterialCommunityIcons name="trophy" size={14} color="#94A3B8" />
                    <Text style={styles.matchLeagueText}>{leagueInfo?.name || 'Futebol'}</Text>
                  </View>
                  <View style={styles.matchBox}>
                    <View style={styles.matchTeamInfo}>
                      <Image source={{ uri: home.team.logo }} style={styles.smallTeamLogo} resizeMode="contain" />
                      <Text style={styles.matchTeamName}>{home.team.abbreviation}</Text>
                    </View>

                    <View style={styles.matchCenterContainer}>
                      <View style={styles.matchScoreBadge}>
                        <Text style={styles.matchScoreText}>
                          {isPre ? matchDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : `${home.score} - ${away.score}`}
                        </Text>
                      </View>
                      
                      {isPre && (
                          <TouchableOpacity 
                              style={styles.reminderButton} 
                              onPress={() => handleToggleReminder(match)}
                              disabled={togglingReminder === match.id}
                          >
                              {togglingReminder === match.id ? (
                                  <ActivityIndicator size="small" color={theme.COLORS.primary} />
                              ) : (
                                  <Feather 
                                      name={matchReminders.some(r => r.apiId === match.id) ? "bell" : "bell-off"} 
                                      size={18} 
                                      color={matchReminders.some(r => r.apiId === match.id) ? theme.COLORS.primary : theme.COLORS.textMuted} 
                                  />
                              )}
                          </TouchableOpacity>
                      )}
                    </View>
                    
                    <View style={styles.matchTeamInfoRight}>
                      <Text style={styles.matchTeamName}>{away.team.abbreviation}</Text>
                      <Image source={{ uri: away.team.logo }} style={styles.smallTeamLogo} resizeMode="contain" />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.COLORS.background },
  container: { flex: 1, },
  scrollContentContainer: { 
    paddingTop: theme.SPACING.lg,
    alignItems: 'center',
    flexGrow: 1,
  },
  section: { marginBottom: theme.SPACING.xl, width: '100%' },
  sectionTitle: { fontWeight: '700', fontSize: theme.FONT_SIZES.md, color: theme.COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: theme.SPACING.lg, marginBottom: theme.SPACING.md },
  horizontalScroll: { paddingHorizontal: theme.SPACING.lg, gap: theme.SPACING.md },
  dateSelectorScroll: {
    paddingHorizontal: theme.SPACING.lg,
    gap: theme.SPACING.md,
  },
  dateButton: {
    backgroundColor: theme.COLORS.surface,
    borderWidth: theme.BORDERS.width,
    borderColor: theme.COLORS.border,
    borderRadius: theme.BORDERS.radiusMedium,
    paddingVertical: theme.SPACING.md,
    paddingHorizontal: theme.SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  dateButtonActive: {
    backgroundColor: theme.COLORS.primary,
    borderColor: theme.COLORS.primary,
  },
  dateButtonDay: {
    fontWeight: '700', fontSize: theme.FONT_SIZES.sm, color: theme.COLORS.textSecondary, textTransform: 'uppercase'
  },
  dateButtonDate: {
    fontWeight: '800', fontSize: theme.FONT_SIZES.xl, color: theme.COLORS.textPrimary, marginTop: theme.SPACING.xs
  },
  dateButtonTextActive: { color: theme.COLORS.textOnPrimary },
  liveCard: {
    width: 160, height: 142, backgroundColor: theme.COLORS.surface, borderWidth: theme.BORDERS.width, borderColor: theme.COLORS.border,
    borderRadius: theme.BORDERS.radiusMedium, padding: theme.SPACING.md, marginRight: theme.SPACING.md,
    ...theme.SHADOWS.sm,
  },
  liveBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontWeight: '600', fontSize: theme.FONT_SIZES.sm },
  matchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.SPACING.sm, height: 32 },
  teamLogo: { width: 32, height: 32 },
  scoreText: { fontWeight: '700', fontSize: theme.FONT_SIZES.h2, color: theme.COLORS.textPrimary },
  heroCard: { 
    marginHorizontal: theme.SPACING.lg, borderRadius: theme.BORDERS.radiusLarge, padding: theme.SPACING.lg, elevation: 8,
    boxShadow: '0 10px 15px rgba(19, 91, 236, 0.2)', // Web shadow
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTeam: { alignItems: 'center', gap: theme.SPACING.sm },
  heroTeamLogoBg: { width: 56, height: 56, backgroundColor: theme.COLORS.surface, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  heroLogoImg: { width: 36, height: 36 },
  heroTeamName: { fontWeight: '700', fontSize: theme.FONT_SIZES.md, color: theme.COLORS.textOnPrimary },
  heroCenter: { alignItems: 'center' },
  heroLeague: { fontWeight: '500', fontSize: theme.FONT_SIZES.sm, color: '#DBEAFE', marginBottom: theme.SPACING.xs },
  heroVs: { fontWeight: '900', fontSize: theme.FONT_SIZES.h2, color: theme.COLORS.textOnPrimary, letterSpacing: -0.6, marginBottom: theme.SPACING.xs },
  heroTimeBadge: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: theme.SPACING.md, paddingVertical: theme.SPACING.xs, borderRadius: theme.BORDERS.radiusMedium },
  heroTimeText: { fontWeight: '600', fontSize: theme.FONT_SIZES.xs, color: theme.COLORS.textOnPrimary },
  matchesList: { paddingHorizontal: theme.SPACING.lg, gap: theme.SPACING.md },
  matchItem: { marginBottom: theme.SPACING.md },
  matchLeagueHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.sm },
  matchLeagueText: { fontWeight: '700', fontSize: theme.FONT_SIZES.lg, color: theme.COLORS.textPrimary },
  matchBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.COLORS.surface, borderWidth: theme.BORDERS.width, borderColor: theme.COLORS.border, borderRadius: theme.BORDERS.radiusMedium, padding: theme.SPACING.md },
  matchTeamInfo: { flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md, flex: 1 },
  matchTeamInfoRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: theme.SPACING.md, flex: 1 },
  matchTeamName: { fontWeight: '600', fontSize: theme.FONT_SIZES.lg, color: theme.COLORS.textSecondary },
  smallTeamLogo: { width: 24, height: 24 },
  matchCenterContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.SPACING.md, marginHorizontal: theme.SPACING.sm },
  matchScoreBadge: { backgroundColor: theme.COLORS.background, paddingHorizontal: theme.SPACING.md, paddingVertical: theme.SPACING.xs, borderRadius: theme.BORDERS.radiusSmall },
  matchScoreText: { fontWeight: '700', fontSize: theme.FONT_SIZES.sm, color: theme.COLORS.textSecondary },
  reminderButton: {
    padding: theme.SPACING.xs,
  },
  // --- Premier League Scoreboard Theme ---
  plScoreboardBar: {
      flexDirection: 'row',
      height: 50,
      backgroundColor: 'white',
      alignItems: 'stretch',
      // fontFamily: 'Outfit',
  },
  plTeamBox: {
      backgroundColor: 'white',
      width: 140,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      // The styles below should be applied to a <Text> component inside
      // fontSize: 28,
      // fontWeight: '700',
      // color: '#38003c', // --pl-purple
      // letterSpacing: 0.5,
  },
  plTeamColorStrip: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 6,
  },
  plMatchCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      // background: linear-gradient(...) -> Use LinearGradient component
      minWidth: 180,
      paddingHorizontal: 10,
      zIndex: 2,
  },
  plScore: {
      fontSize: 32,
      fontWeight: '800',
      color: '#38003c', // --pl-purple
      width: 40,
      textAlign: 'center',
      zIndex: 3,
  },
  plLogoContainer: {
      width: 45,
      height: 45,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 5,
      zIndex: 5,
  },
  plLogoImg: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
  },
  plTimerContainer: {
      backgroundColor: '#fcfcfc',
      paddingVertical: 2,
      paddingHorizontal: 30,
      borderBottomLeftRadius: 15,
      borderBottomRightRadius: 15,
      marginTop: -2,
      position: 'relative',
      zIndex: 1,
      minWidth: 120,
      alignItems: 'center',
      // boxShadow: inset... -> Not supported in React Native
  },
  plTimerText: {
    color: '#38003c', // --pl-purple
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // --- Brasileirão Betano Scoreboard Theme ---
  brWidgetContainer: {
      alignItems: 'center',
      // filter: drop-shadow(...) -> use shadow props
      minHeight: 80,
      justifyContent: 'flex-start',
      padding: 0,
      transform: [{ scale: 0.75 }],
  },
  brScoreboardBar: {
      flexDirection: 'row',
      height: 50,
      alignItems: 'stretch',
      position: 'relative',
      zIndex: 10,
  },
  brTeamBox: {
      backgroundColor: '#ffffff', // --br-navy (light)
      width: 140,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      zIndex: 1,
  },
  brHomeTeam: {
      borderTopLeftRadius: 4,
      borderBottomLeftRadius: 4,
  },
  brAwayTeam: {
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
  },
  brTeamTextWrapper: {
      alignItems: 'center',
      height: 35,
      opacity: 1,
      transform: [{ translateY: 0 }],
  },
  brTeamName: {
      height: 35,
      fontSize: 28,
      fontWeight: '800',
      color: '#000000', // --br-green (light)
      letterSpacing: 0.5,
  },
  brGoalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ translateY: 1000 }], // Off-screen
      zIndex: 20,
      gap: 8,
  },
  brGoalOverlayActive: {
      transform: [{ translateY: 0 }],
  },
  brTeamLogoAnim: {
      height: 30,
      width: 30,
      resizeMode: 'contain',
  },
  brGoalWord: {
      flexDirection: 'row',
      fontSize: 24,
      fontWeight: '900',
      color: '#ffffff',
      textTransform: 'uppercase',
      alignItems: 'center',
  },
  brTeamColorStrip: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 8,
      zIndex: 10,
  },
  brHomeStrip: {
      left: 0,
  },
  brAwayStrip: {
      right: 0,
  },
  brMatchCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff', // --br-navy (light)
      minWidth: 180,
      paddingHorizontal: 10,
      zIndex: 20,
  },
  brScore: {
      fontSize: 34,
      fontWeight: '900',
      color: '#000000', // --br-green (light)
      width: 40,
      textAlign: 'center',
      zIndex: 3,
  },
  brScorePop: {
      transform: [{ scale: 1.5 }],
      color: '#fff',
  },
  brLogoContainer: {
      width: 45,
      height: 45,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 8,
      zIndex: 5,
  },
  brLogoImg: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
  },
  brTimerContainer: {
      backgroundColor: '#ffffff', // --br-navy (light)
      paddingVertical: 4,
      paddingHorizontal: 30,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      marginTop: 0,
      position: 'relative',
      zIndex: 0,
      minWidth: 100,
      alignItems: 'center',
      borderTopWidth: 2,
      borderTopColor: '#000000', // --br-green (light)
  },
  brTimerText: {
    color: '#000000', // --br-green (light)
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  brTeamBoxYellowActive: {
      backgroundColor: '#ffeb3b', // --card-yellow
  },
  brTeamNameYellowActive: {
      color: '#ffffff', // CSS var was --br-navy which is #fff in light mode
  },
  brTeamBoxRedActive: {
      backgroundColor: '#d32f2f', // --card-red
  },
  brTeamNameRedActive: {
      color: '#ffffff',
  },

  // --- Liga Forte União (LFU) Standings Table ---
  lfuStandingsCard: {
      backgroundColor: '#ffffff', // --lfu-bg
      borderRadius: 16,
      overflow: 'hidden',
      // shadow props needed for boxShadow
  },
  lfuStandingsHeader: {
      flexDirection: 'row',
      paddingVertical: 16,
      paddingHorizontal: 20,
      // Use child components for grid layout
  },
  lfuStandingsRow: {
      flexDirection: 'row',
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#eef2f6',
  },
  lfuRankCell: {
      fontWeight: '800',
      fontSize: 16,
      alignItems: 'center',
      justifyContent: 'center',
      width: 50, // From grid-template-columns
  },
  lfuZoneIndicator: {
    width: 5,
    height: '60%', // Approximation of top/bottom 10px
    borderRadius: 3,
    position: 'absolute',
    left: 10, // Approximated from padding
  },
  lfuZoneLibertadores: { backgroundColor: '#3b82f6' },
  lfuZonePrelibertadores: { backgroundColor: '#06b6d4' },
  lfuZoneSulamericana: { backgroundColor: '#f59e0b' },
  lfuZoneRebaixamento: { backgroundColor: '#ef4444' },
  lfuZoneAcesso: { backgroundColor: '#22c55e' },
  lfuTeamCell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 3, // From grid-template-columns
  },
  lfuTeamCellImage: {
      width: 28,
      height: 28,
      resizeMode: 'contain',
  },
  lfuPointsCell: {
      fontWeight: '900',
      fontSize: 18,
      textAlign: 'center',
      flex: 1, // From grid-template-columns
  },
  lfuStatsCell: {
      textAlign: 'center',
      fontWeight: '600',
      color: '#475569',
      flex: 1, // From grid-template-columns
  },
  emptyStateContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 16,
    lineHeight: 24,
  },
});