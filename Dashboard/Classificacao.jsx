import React, { useEffect, useState } from 'react';
import {
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreferences } from './PreferencesContext';
import { API_CONFIG, auth, SPORTS_DB, fetchAndCache } from '../firebaseConfig';
import theme from '../theme';
import EmptyState from './EmptyState';

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

// Novo Componente para o seletor de rodadas
const RoundSelector = ({ rounds, selectedRound, onSelectRound }) => {
  const scrollRef = React.useRef(null);

  // Efeito para centralizar a rodada ativa na tela
  useEffect(() => {
    if (scrollRef.current && selectedRound) {
      const index = rounds.findIndex(r => r.number === selectedRound);
      if (index > -1) {
        // Cada botão tem ~60px de largura. Calculamos um offset para centralizar.
        const xOffset = index * 60 - 100;
        scrollRef.current.scrollTo({ x: xOffset, animated: true });
      }
    }
  }, [selectedRound, rounds]);

  return (
    <View style={styles.roundSelectorContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScroll}
      >
        {rounds.map(({ number }) => {
          const isActive = selectedRound === number;
          return (
            <TouchableOpacity
              key={number}
              style={[styles.roundButton, isActive && styles.roundButtonActive]}
              onPress={() => onSelectRound(number)}
            >
              <Text style={[styles.roundButtonText, isActive && styles.roundButtonTextActive]}>
                {`R${number}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default function Classificacao() {
  const user = auth.currentUser;
  const { favoriteLeagues, loading: prefsLoading } = usePreferences();

  const [displayedLeagues, setDisplayedLeagues] = useState([]);
  const [activeLeague, setActiveLeague] = useState(null);
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Novos estados para o calendário de rodadas
  const [rounds, setRounds] = useState([]); // ex: [{ number: 1, endDate: '2024-08-20' }]
  const [selectedRound, setSelectedRound] = useState(null);
  const [loadingRounds, setLoadingRounds] = useState(false);

  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  useEffect(() => {
    if (!prefsLoading) {
      const favLeagueIds = favoriteLeagues.map(f => f.apiId);
      const filtered = Object.values(SPORTS_DB.soccer.leagues)
        .filter(l => favLeagueIds.includes(l.id))
        .map(({ id, name }) => ({ id, name }));

      setDisplayedLeagues(filtered);

      // Se a liga ativa não for mais uma favorita, define uma nova
      const isCurrentLeagueActive = filtered.some(l => l.id === activeLeague);
      if (!isCurrentLeagueActive) {
        setActiveLeague(filtered.length > 0 ? filtered[0].id : null);
      }
    }
  }, [favoriteLeagues, prefsLoading, activeLeague]);

  // Busca o calendário de rodadas quando a liga ativa muda
  useEffect(() => {
    if (!activeLeague) {
      setRounds([]);
      setStandings([]);
      return;
    }

    const fetchAndSetRoundData = async () => {
      setLoadingRounds(true);
      setRounds([]);
      try {
        // O endpoint do scoreboard, sem data, nos dá o calendário da temporada
        const url = API_CONFIG.espn.scoreboard('soccer', activeLeague);
        const cacheKey = `calendar_${activeLeague}`;
        // Cache do calendário pode ser mais longo, ex: 24 horas
        const data = await fetchAndCache(cacheKey, url, 24 * 60 * 60 * 1000);
        
        // Filtramos para a temporada regular (type: "2")
        const calendarEntries = data?.leagues?.[0]?.calendar?.filter(c => c.type === "2")?.[0]?.entries || [];

        const roundsMap = new Map();
        calendarEntries.forEach(entry => {
          const weekNumberMatch = entry.label.match(/\d+/);
          if (!weekNumberMatch) return;
          const weekNumber = parseInt(weekNumberMatch[0], 10);
          const date = new Date(entry.value);
          
          // Agrupamos por rodada e pegamos a data final de cada uma
          if (!roundsMap.has(weekNumber) || date > roundsMap.get(weekNumber).endDate) {
            roundsMap.set(weekNumber, { number: weekNumber, endDate: date });
          }
        });

        const sortedRounds = Array.from(roundsMap.values()).sort((a, b) => a.number - b.number);
        setRounds(sortedRounds);

        // Define a rodada atual como padrão
        const currentWeek = data?.week?.number;
        if (currentWeek && roundsMap.has(currentWeek)) {
          setSelectedRound(currentWeek);
        } else if (sortedRounds.length > 0) {
          setSelectedRound(sortedRounds[sortedRounds.length - 1].number);
        }

      } catch (error) {
        console.error("Erro ao buscar calendário de rodadas:", error);
      } finally {
        setLoadingRounds(false);
      }
    };

    fetchAndSetRoundData();
  }, [activeLeague]);

  // Busca a classificação quando a rodada selecionada muda
  useEffect(() => {
    if (!activeLeague || selectedRound === null || rounds.length === 0) {
      if (!loadingRounds) setLoading(false);
      return;
    }

    const fetchStandings = async () => {
      setLoading(true);
      try {
        const roundInfo = rounds.find(r => r.number === selectedRound);
        if (!roundInfo) {
            setStandings([]);
            setLoading(false);
            return;
        }
        const dateString = API_CONFIG.utils.formatDateForEspn(roundInfo.endDate);
        
        // Adicionamos o parâmetro de data para buscar o histórico
        const url = `${API_CONFIG.espn.standings(activeLeague)}&date=${dateString}`;
        const cacheKey = `standings_${activeLeague}_${selectedRound}`;
        const data = await fetchAndCache(cacheKey, url);
        
        // Modificação para suportar múltiplos grupos (ex: Champions League)
        // Se 'data.children' existir, usamos isso como a lista de grupos. Senão, criamos um grupo falso com os standings principais.
        const tableData = data.children && data.children.length > 0 ? data.children : (data.standings ? [{ standings: data.standings, name: data.name }] : []);
        setStandings(tableData);
      } catch (error) {
        console.error("Erro ao buscar classificação:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStandings();
  }, [selectedRound, rounds]); // Re-executa quando a rodada ou as rodadas disponíveis mudam

  // Função auxiliar para pegar as estatísticas de cada time
  const getStat = (statsArray, statName) => {
    const stat = statsArray.find(s => s.name === statName);
    return stat ? stat.displayValue : '0';
  };

  const getZoneStyle = (rank, leagueId) => {
    // Rules for Brasileirão (20 teams)
    // if (leagueId === 'bra.1') {
    //   if (rank <= 4) return { backgroundColor: theme.COLORS.zone1 }; // Libertadores
    //   if (rank <= 6) return { backgroundColor: theme.COLORS.zone2 }; // Pré-Libertadores
    //   if (rank <= 12) return { backgroundColor: theme.COLORS.zone3 }; // Sul-Americana
    //   if (rank >= 17) return { backgroundColor: theme.COLORS.zone4 }; // Rebaixamento
    //   return {};
    // }

    // Rules for Bundesliga (18 teams) - assuming 'ger.1'
    // if (leagueId === 'ger.1') {
    //   if (rank <= 4) return { backgroundColor: theme.COLORS.zone1 }; // Champions League
    //   if (rank === 5) return { backgroundColor: theme.COLORS.zone2 }; // Europa League
    //   if (rank === 6) return { backgroundColor: theme.COLORS.zone3 }; // Conference League
    //   if (rank >= 17) return { backgroundColor: theme.COLORS.zone4 }; // Rebaixamento
    //   return {};
    // }

    // Default rules for other European leagues (20 teams)
    if (rank <= 4) return styles.lfuZoneLibertadores; // Champions League
    if (rank === 5) return styles.lfuZonePrelibertadores; // Europa League
    if (rank === 6) return styles.lfuZoneSulamericana; // Conference League
    if (rank >= 18) return styles.lfuZoneRebaixamento; // Rebaixamento
    return {};
  };

  return (
    <SafeAreaView style={styles.safeArea}>      
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={false}>
        {/* TÍTULO E TABS DE LIGAS */}
        <View style={[styles.pageHeader, isLargeScreen && { maxWidth: 800, width: '100%' }]}>
          <Text style={styles.pageTitle}>Classificação</Text>
        </View>

        {prefsLoading ? (
          <ActivityIndicator style={{ marginTop: 20 }} size="small" />
        ) : displayedLeagues.length > 0 ? (
          <View style={styles.tabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
              {displayedLeagues.map((league) => {
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
        ) : (
          <EmptyState
            icon="settings"
            title="Nenhuma liga favorita"
            message="Vá em Perfil > Preferências para escolher as ligas que você quer acompanhar."
          />
        )}

        {/* TABELA DE CLASSIFICAÇÃO */}
        <View style={[styles.tableSection, isLargeScreen && { maxWidth: 800 }]}>
          {activeLeague && <View style={styles.tableCard}>
            
            {/* Cabeçalho da Tabela */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.thText, { width: 36, textAlign: 'center' }]}>#</Text>
              <Text style={[styles.thText, { flex: 1, paddingLeft: 8 }]}>CLUBE</Text>
              <Text style={[styles.thText, { width: 32, textAlign: 'center' }]}>PTS</Text>
              <Text style={[styles.thText, { width: 28, textAlign: 'center' }]}>J</Text>
              <Text style={[styles.thText, { width: 28, textAlign: 'center' }]}>V</Text>
              <Text style={[styles.thText, { width: 32, textAlign: 'center' }]}>SG</Text>
            </View>

            {/* Loading / Lista */}
            {loading ? (
              [...Array(12)].map((_, index) => (
                <View key={index} style={styles.tableRow}>
                  <View style={styles.tdRankContainer}>
                    <SkeletonPiece width={4} height={20} borderRadius={2} />
                    <SkeletonPiece width={16} height={16} borderRadius={4} />
                  </View>
                  <View style={styles.tdTeam}>
                    <SkeletonPiece width={28} height={28} borderRadius={14} />
                    <SkeletonPiece width={120} height={16} borderRadius={4} />
                  </View>
        
                  <SkeletonPiece width={24} height={16} borderRadius={4} style={{ width: 32 }} />
                  <SkeletonPiece width={20} height={16} borderRadius={4} style={{ width: 28 }} />
                  <SkeletonPiece width={20} height={16} borderRadius={4} style={{ width: 28 }} />
                  <SkeletonPiece width={24} height={16} borderRadius={4} style={{ width: 32 }} />
                </View>
              ))
            ) : standings.length > 0 ? (
              standings.map((group) => (
                (group.standings?.entries || []).length > 0 && (
                  <React.Fragment key={group.name || group.standings.id}>
                    {standings.length > 1 && (
                      <View style={styles.groupHeader}>
                        <Text style={styles.groupHeaderText}>{group.name}</Text>
                      </View>
                    )}
                    {group.standings.entries.map((entry, index) => {
                      const rank = index + 1;
                      const zoneStyle = getZoneStyle(rank, activeLeague);
                      const points = getStat(entry.stats, 'points');
                      const gamesPlayed = getStat(entry.stats, 'gamesPlayed');
                      const wins = getStat(entry.stats, 'wins');
                      const goalDiff = getStat(entry.stats, 'pointDifferential');

                      return (
                        <View key={entry.team.id} style={styles.tableRow}>
                          <View style={styles.tdRankContainer}>
                            <View style={[styles.lfuZoneIndicator, zoneStyle]} />
                            <Text style={styles.tdRank}>
                              {rank}
                            </Text>
                          </View>
                          <View style={styles.tdTeam}>
                            <View style={styles.teamLogoBg}>
                              <Image source={{ uri: entry.team.logos?.[0]?.href }} style={styles.teamLogo} resizeMode="contain" />
                            </View>
                            <Text style={styles.teamName} numberOfLines={1}>
                              {entry.team.shortDisplayName}
                            </Text>
                          </View>

                          <Text style={[styles.tdStat, styles.tdPoints]}>{points}</Text>
                          <Text style={styles.tdStat}>{gamesPlayed}</Text>
                          <Text style={styles.tdStat}>{wins}</Text>
                          <Text style={styles.tdStat}>{goalDiff}</Text>
                        </View>
                      );
                    })}
                  </React.Fragment>
                )
              ))
            ) : (
              <EmptyState
                icon="bar-chart-2"
                title="Sem dados"
                message="Não há dados de classificação para esta liga ou rodada no momento."
              />
            )}
          </View>}

          {/* Legenda das Zonas */}
          {!loading && standings.length > 0 && (
            <View style={styles.legendContainer}>
              {activeLeague === 'bra.1' ? (
                <>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, {backgroundColor: theme.COLORS.zone1}]} />
                    <Text style={styles.legendText}>Libertadores</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, {backgroundColor: theme.COLORS.zone2}]} />
                    <Text style={styles.legendText}>Pré-Libertadores</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, {backgroundColor: theme.COLORS.zone3}]} />
                    <Text style={styles.legendText}>Sul-Americana</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, {backgroundColor: theme.COLORS.zone1}]} />
                    <Text style={styles.legendText}>Champions League</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, {backgroundColor: theme.COLORS.zone2}]} />
                    <Text style={styles.legendText}>Europa League</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, {backgroundColor: theme.COLORS.zone3}]} />
                    <Text style={styles.legendText}>Conference League</Text>
                  </View>
                </>
              )}
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, {backgroundColor: theme.COLORS.zone4}]} />
                <Text style={styles.legendText}>Rebaixamento</Text>
              </View>
            </View>
          )}

        </View>
        
        {/* Espaçador para o bottom nav */}
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
  pageHeader: { paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.md, backgroundColor: theme.COLORS.background, width: '100%' },
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

  tableSection: { paddingHorizontal: theme.SPACING.lg, width: '100%' },
  tableCard: {
    backgroundColor: theme.COLORS.surface, borderWidth: theme.BORDERS.width, borderColor: theme.COLORS.border,
    borderRadius: theme.BORDERS.radiusMedium, overflow: 'hidden',
    ...theme.SHADOWS.sm,
  },
  tableHeaderRow: {
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: '#F8FAFC', borderBottomWidth: theme.BORDERS.width, borderBottomColor: theme.COLORS.border,
    paddingVertical: theme.SPACING.md, paddingHorizontal: theme.SPACING.md,
  },
  thText: { fontWeight: '700', fontSize: theme.FONT_SIZES.sm, color: theme.COLORS.textSecondary },
  
  groupHeader: {
    backgroundColor: '#F8FAFC',
    paddingVertical: theme.SPACING.sm,
    paddingHorizontal: theme.SPACING.md,
    borderTopWidth: theme.BORDERS.width,
    borderTopColor: theme.COLORS.border,
  },
  groupHeaderText: {
    fontWeight: '700',
    fontSize: theme.FONT_SIZES.md,
    color: theme.COLORS.textPrimary,
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', height: 60,
    borderTopWidth: theme.BORDERS.width, borderTopColor: theme.COLORS.border,
    paddingHorizontal: theme.SPACING.md, position: 'relative'
  },
  lfuZoneIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  lfuZoneLibertadores: { backgroundColor: theme.COLORS.zone1 },
  lfuZonePrelibertadores: { backgroundColor: theme.COLORS.zone2 },
  lfuZoneSulamericana: { backgroundColor: theme.COLORS.zone3 },
  lfuZoneRebaixamento: { backgroundColor: theme.COLORS.zone4 },
  tdRankContainer: {
    width: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: theme.SPACING.xs,
  },
  tdRank: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: theme.FONT_SIZES.md,
    color: theme.COLORS.textSecondary
  },
  tdTeam: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, gap: 10 },
  teamLogoBg: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  teamLogo: { width: 18, height: 18 },
  teamName: { fontWeight: '600', fontSize: 14, color: '#334155', flexShrink: 1 },
  tdStat: { width: 28, textAlign: 'center', fontWeight: '500', fontSize: 14, color: '#475569' },
  tdPoints: { width: 32, fontWeight: '700', color: '#0F172A' },
    
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.SPACING.md, marginTop: theme.SPACING.md, marginBottom: theme.SPACING.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontWeight: '500', fontSize: theme.FONT_SIZES.sm, color: theme.COLORS.textSecondary },
});