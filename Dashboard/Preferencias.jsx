import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Switch,
    TouchableOpacity,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { usePreferences } from './PreferencesContext';
import {
    SPORTS_DB,
    API_CONFIG,
    addOrUpdateItem,
    deleteItem,
    fetchAndCache,
} from '../firebaseConfig';
import theme from '../theme';

// Componente para o seletor de abas
const SegmentedControl = ({ options, selected, onSelect }) => (
  <View style={styles.segmentedControl}>
    {options.map(option => (
      <TouchableOpacity
        key={option.value}
        style={[styles.segmentButton, selected === option.value && styles.segmentButtonActive]}
        onPress={() => onSelect(option.value)}
      >
        <Feather name={option.icon} size={16} color={selected === option.value ? '#135BEC' : '#475569'} />
        <Text style={[styles.segmentText, selected === option.value && styles.segmentTextActive]}>
          {option.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

// Componente para cada linha da lista de ligas
const LeagueItem = ({ league, isFavorite, onToggle, disabled }) => (
  <View style={styles.leagueItem}>
    <Image source={{ uri: league.logo }} style={styles.leagueLogo} resizeMode="contain" />
    <Text style={styles.leagueName}>{league.name}</Text>
    <Switch
      trackColor={{ false: '#E2E8F0', true: '#86A6F3' }}
      thumbColor={isFavorite ? '#135BEC' : '#f4f3f4'}
      ios_backgroundColor="#E2E8F0"
      onValueChange={onToggle}
      value={isFavorite}
      disabled={disabled}
    />
  </View>
);

// Componente para cada linha da lista de times
const TeamItem = ({ team, isFavorite, onToggle, disabled }) => (
  <View style={styles.leagueItem}>
    <Image source={{ uri: team.logos?.[0]?.href }} style={styles.leagueLogo} resizeMode="contain" />
    <Text style={styles.leagueName}>{team.displayName}</Text>
    <TouchableOpacity onPress={onToggle} disabled={disabled} style={styles.starButton}>
      <Feather name="star" size={24} color={isFavorite ? '#F59E0B' : '#CBD5E1'} />
    </TouchableOpacity>
  </View>
);

export default function PreferenciasScreen() {
  const { favoriteLeagues, favoriteTeams, loading: prefsLoading } = usePreferences();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [activeTab, setActiveTab] = useState('leagues'); // 'leagues' ou 'teams'
  
  // Estados para Ligas
  const [allLeagues, setAllLeagues] = useState([]);
  const [togglingLeagueId, setTogglingLeagueId] = useState(null); // Para desabilitar o switch durante a operação

  // Estados para Times
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [togglingTeamId, setTogglingTeamId] = useState(null);

  useEffect(() => {
    // Pega todas as ligas disponíveis da configuração local
    const availableLeagues = Object.values(SPORTS_DB.soccer.leagues).map(l => ({
      id: l.id, // Este é o apiId
      name: l.name,
      logo: l.logo,
    }));
    setAllLeagues(availableLeagues);

    // Define a primeira liga favorita como selecionada por padrão na aba de times
    if (!prefsLoading && favoriteLeagues.length > 0) {
      if (!selectedLeague) {
        setSelectedLeague(favoriteLeagues[0].apiId);
      }
    }
  }, [prefsLoading, favoriteLeagues]);

  // Busca os times da liga selecionada
  useEffect(() => {
    if (!selectedLeague) {
      setTeams([]);
      return;
    }

    const fetchTeams = async () => {
      setLoadingTeams(true);
      try {
        const url = API_CONFIG.espn.teams('soccer', selectedLeague);
        const cacheKey = `teams_${selectedLeague}`;
        // Cache de times pode ser longo, ex: 24 horas
        const data = await fetchAndCache(cacheKey, url, 24 * 60 * 1000);

        const leagueTeams = data?.sports?.[0]?.leagues?.[0]?.teams?.map(t => t.team) || [];
        setTeams(leagueTeams);
      } catch (e) {
        console.error("Erro ao buscar times:", e);
        Alert.alert("Erro", "Não foi possível buscar os times para esta liga.");
      } finally {
        setLoadingTeams(false);
      }
    };

    fetchTeams();
  }, [selectedLeague]);

  const handleToggleLeague = async (league, isNowFavorite) => {
    setTogglingLeagueId(league.id);

    if (isNowFavorite) {
      const newFavData = {
        apiId: league.id, // ex: 'bra.1'
        name: league.name,
        esporte: 'soccer',
        ativa: true,
      };
      const { success } = await addOrUpdateItem('favoriteLeagues', newFavData, false);
      if (!success) {
        Alert.alert('Erro', 'Não foi possível salvar a preferência.');
      }
    } else {
      const favToRemove = favoriteLeagues.find(fav => fav.apiId === league.id);
      if (!favToRemove || !favToRemove.id) {
        setTogglingLeagueId(null);
        return;
      }
      
      const { success } = await deleteItem('favoriteLeagues', favToRemove.id);
      if (!success) {
        Alert.alert('Erro', 'Não foi possível remover a preferência.');
      }
    }
    setTogglingLeagueId(null);
  };

  const handleToggleTeam = async (team, isNowFavorite) => {
    setTogglingTeamId(team.id);

    if (isNowFavorite) {
      const newFavData = {
        apiId: team.id, // ex: '819' (ID do time na ESPN)
        name: team.displayName,
        logo: team.logos?.[0]?.href,
        leagueId: selectedLeague,
        esporte: 'soccer',
        ativa: true,
      };
      const { success } = await addOrUpdateItem('favoriteTeams', newFavData, false);
      if (!success) {
        Alert.alert('Erro', 'Não foi possível salvar a preferência.');
      }
    } else {
      const favToRemove = favoriteTeams.find(fav => fav.apiId === team.id);
      if (!favToRemove || !favToRemove.id) {
        setTogglingTeamId(null);
        return;
      }
      const { success } = await deleteItem('favoriteTeams', favToRemove.id);
      if (!success) {
        Alert.alert('Erro', 'Não foi possível remover a preferência.');
      }
    }
    setTogglingTeamId(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={[styles.container, isLargeScreen && styles.containerLarge]}>
          <SegmentedControl
            options={[
              { label: 'Ligas', value: 'leagues', icon: 'shield' },
              { label: 'Times', value: 'teams', icon: 'users' },
            ]}
            selected={activeTab}
            onSelect={setActiveTab}
          />

          <Text style={styles.subtitle}>
            {activeTab === 'leagues'
              ? 'Selecione as ligas que você deseja acompanhar.'
              : 'Escolha seus times do coração para receber notificações e destaques.'}
          </Text>
          
          {prefsLoading ? (
            <ActivityIndicator size="large" color="#135BEC" style={{ marginTop: 40 }} />
          ) : activeTab === 'leagues' ? (
            // RENDERIZAÇÃO DAS LIGAS
            <View style={styles.itemsList}>
              {allLeagues.map(league => (
                <LeagueItem
                  key={league.id}
                  league={league}
                  isFavorite={favoriteLeagues.some(fav => fav.apiId === league.id)}
                  onToggle={(value) => handleToggleLeague(league, value)}
                  disabled={togglingLeagueId === league.id}
                />
              ))}
            </View>
          ) : (
            // RENDERIZAÇÃO DOS TIMES
            <>
              <View style={styles.leaguePicker}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leaguePickerScroll}>
                  {favoriteLeagues.map(league => (
                    <TouchableOpacity 
                      key={league.apiId}
                      style={[styles.leagueChip, selectedLeague === league.apiId && styles.leagueChipActive]}
                      onPress={() => setSelectedLeague(league.apiId)}
                    >
                      <Text style={[styles.leagueChipText, selectedLeague === league.apiId && styles.leagueChipTextActive]}>{league.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {loadingTeams ? (
                <ActivityIndicator size="large" color="#135BEC" style={{ marginTop: 40 }} />
              ) : (
                <View style={styles.itemsList}>
                  {teams.map(team => (
                    <TeamItem
                      key={team.id}
                      team={team}
                      isFavorite={favoriteTeams.some(fav => fav.apiId === team.id)}
                      onToggle={() => handleToggleTeam(team, !favoriteTeams.some(fav => fav.apiId === team.id))}
                      disabled={togglingTeamId === team.id}
                    />
                  ))}
                </View>
              )}
            </>
          )}
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
    paddingVertical: 24,
  },
  container: {
    width: '100%',
    maxWidth: 600,
    paddingHorizontal: 24,
  },
  containerLarge: {
    paddingHorizontal: 0,
  },
  subtitle: {
    fontSize: 15,
    color: '#475569',
    marginVertical: 24,
    lineHeight: 22,
    textAlign: 'center',
  },
  itemsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  leagueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  leagueLogo: {
    width: 32,
    height: 32,
    marginRight: 16,
  },
  leagueName: {
    flex: 1,
    fontWeight: '600',
    fontSize: 16,
    color: '#334155',
  },
  starButton: {
    padding: 4,
  },
  errorText: {
    textAlign: 'center',
    color: '#EF4444',
    marginTop: 20,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#E9EEF3',
    borderRadius: 99,
    padding: 4,
    alignSelf: 'center',
  },
  segmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 99,
    gap: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    ...theme.SHADOWS.sm,
  },
  segmentText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#475569',
  },
  segmentTextActive: {
    color: '#135BEC',
  },
  leaguePicker: {
    marginBottom: 24,
  },
  leaguePickerScroll: {
    gap: 10,
    paddingHorizontal: 24,
  },
  leagueChip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  leagueChipActive: {
    backgroundColor: '#135BEC',
    borderColor: '#135BEC',
  },
  leagueChipText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#334155',
  },
  leagueChipTextActive: {
    color: '#FFFFFF',
  },
});