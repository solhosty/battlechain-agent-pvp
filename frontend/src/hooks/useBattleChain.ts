import { useEffect, useState } from 'react';
import { formatEther, ZeroAddress } from 'ethers';
import { getArenaContract, getBattleContract, getProvider } from '../utils/battlechain';
import type { BattleStateLabel, BattleSummary } from '../types/contracts';

const battleStateLabels: BattleStateLabel[] = [
  'Pending',
  'Active',
  'Executing',
  'Resolved',
  'Claimed',
];

export const useBattleChain = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [battles, setBattles] = useState<BattleSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = (await window.ethereum.request({
          method: 'eth_requestAccounts',
        })) as string[];
        setAccount(accounts[0] ?? null);
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    }
  };

  const fetchBattles = async () => {
    setLoading(true);
    try {
      const provider = getProvider();
      if (!provider) {
        setBattles([]);
        return;
      }
      const arena = getArenaContract(provider);
      
      // Get battle count and fetch each battle
      let battleIds: bigint[] = [];
      try {
        battleIds = await arena.getAllBattleIds();
      } catch (error) {
        console.warn('getAllBattleIds not available, using fallback');
      }
      const battleData = await Promise.all(
        battleIds.map(async (id) => {
          const battleAddress = await arena.battles(id);
          const battle = getBattleContract(battleAddress, provider);
          
          const [
            state,
            challenge,
            entryFee,
            deadline,
            winner
          ] = await Promise.all([
            battle.getState(),
            battle.getChallenge(),
            battle.entryFee(),
            battle.deadline(),
            battle.getWinner()
          ]);
          
          const stateIndex = Number(state);
          return {
            id,
            address: battleAddress,
            state: battleStateLabels[stateIndex] ?? 'Pending',
            challenge,
            entryFee: formatEther(entryFee),
            deadline: new Date(Number(deadline) * 1000).toLocaleString(),
            winner: winner === ZeroAddress ? null : winner,
          };
        })
      );
      
      setBattles(battleData);
    } catch (error) {
      console.error('Failed to fetch battles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!window.ethereum) return;
    const ethereum = window.ethereum as {
      on: (event: string, handler: (accounts: string[]) => void) => void;
    };
    ethereum.on('accountsChanged', (accounts) => {
      setAccount(accounts[0] ?? null);
    });
  }, []);

  return {
    account,
    battles,
    loading,
    connectWallet,
    fetchBattles
  };
};
