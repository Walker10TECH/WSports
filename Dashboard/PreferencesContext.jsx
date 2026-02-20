import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, subscribeToCollection } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

const PreferencesContext = createContext();

export const usePreferences = () => {
  return useContext(PreferencesContext);
};

export const PreferencesProvider = ({ children }) => {
  const [favoriteLeagues, setFavoriteLeagues] = useState([]);
  const [favoriteTeams, setFavoriteTeams] = useState([]);
  const [matchReminders, setMatchReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Observa mudanças no estado de autenticação
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setLoading(true);
        
        // Se o usuário está logado, inscreve-se para ouvir as atualizações em tempo real das coleções
        const unsubLeagues = subscribeToCollection('favoriteLeagues', (data) => {
          setFavoriteLeagues(data || []);
        });
        
        const unsubTeams = subscribeToCollection('favoriteTeams', (data) => {
          setFavoriteTeams(data || []);
        });

        const unsubReminders = subscribeToCollection('matchReminders', (data) => {
          setMatchReminders(data || []);
        });

        // Quando ambas as coleções forem carregadas (ou pelo menos tentadas)
        // A lógica de loading pode ser melhorada, mas por agora vamos simplificar
        Promise.all([new Promise(res => setTimeout(res, 500))]).then(() => setLoading(false));

        // Retorna a função para cancelar a inscrição do DB quando o usuário deslogar ou o componente desmontar
        return () => {
          unsubLeagues();
          unsubTeams();
          unsubReminders();
        };
      } else {
        // Se o usuário deslogou, limpa os dados
        setFavoriteLeagues([]);
        setFavoriteTeams([]);
        setMatchReminders([]);
        setLoading(false);
      }
    });

    return () => authUnsubscribe(); // Limpa o observador de autenticação
  }, []);

  return (
    <PreferencesContext.Provider value={{ favoriteLeagues, favoriteTeams, matchReminders, loading }}>
      {children}
    </PreferencesContext.Provider>
  );
};