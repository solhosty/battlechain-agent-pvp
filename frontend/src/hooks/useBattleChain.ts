import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getArenaContract, getBattleContract, getProvider } from '../utils/battlechain';

export const useBattleChain = () => {
  const [account, setAccount] = useState(null);
  const [battles, setBattles] = useState([]);
  const [loading, setLoading] = useState(false);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        setAccount(accounts[0]);
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    }
  };

  const fetchBattles = async () => {
    setLoading(true);
    try {
      const provider = getProvider();
      const arena = getArenaContract(provider);
      
      // Get battle count and fetch each battle
      const battleIds = await arena.getAllBattleIds();
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
          
          return {
            id: id.toString(),
            address: battleAddress,
            state: ['Pending', 'Active', 'Executing', 'Resolved', 'Claimed'][state],
            challenge,
            entryFee: ethers.utils.formatEther(entryFee),
            deadline: new Date(deadline.toNumber() * 1000).toLocaleString(),
            winner: winner === ethers.constants.AddressZero ? null : winner
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
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        setAccount(accounts[0] || null);
      });
    }
  }, []);

  return {
    account,
    battles,
    loading,
    connectWallet,
    fetchBattles
  };
};
