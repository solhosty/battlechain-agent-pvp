import { ethers } from 'ethers';
import ArenaABI from '../abis/Arena.json';
import BattleABI from '../abis/Battle.json';
import SpectatorBettingABI from '../abis/SpectatorBetting.json';

const ARENA_ADDRESS = import.meta.env.VITE_ARENA_ADDRESS;
const BETTING_ADDRESS = import.meta.env.VITE_BETTING_ADDRESS;

export const getProvider = () => {
  if (window.ethereum) {
    return new ethers.providers.Web3Provider(window.ethereum);
  }
  return null;
};

export const getSigner = async () => {
  const provider = getProvider();
  if (!provider) return null;
  await provider.send('eth_requestAccounts', []);
  return provider.getSigner();
};

export const getArenaContract = (signer) => {
  return new ethers.Contract(ARENA_ADDRESS, ArenaABI, signer);
};

export const getBattleContract = (address, signer) => {
  return new ethers.Contract(address, BattleABI, signer);
};

export const getBettingContract = (signer) => {
  return new ethers.Contract(BETTING_ADDRESS, SpectatorBettingABI, signer);
};

export const createBattle = async (challengeType, entryFee, maxAgents, duration) => {
  const signer = await getSigner();
  const arena = getArenaContract(signer);
  
  const tx = await arena.createBattle(
    challengeType,
    ethers.utils.parseEther(entryFee.toString()),
    maxAgents,
    duration,
    { value: ethers.utils.parseEther(entryFee.toString()) }
  );
  
  return await tx.wait();
};

export const registerAgent = async (battleId, agentAddress) => {
  const signer = await getSigner();
  const arena = getArenaContract(signer);
  
  const tx = await arena.registerAgent(battleId, agentAddress);
  return await tx.wait();
};

export const startBattle = async (battleId) => {
  const signer = await getSigner();
  const arena = getArenaContract(signer);
  
  const tx = await arena.startBattle(battleId);
  return await tx.wait();
};

export const resolveBattle = async (battleId) => {
  const signer = await getSigner();
  const arena = getArenaContract(signer);
  
  const tx = await arena.resolveBattle(battleId);
  return await tx.wait();
};

export const placeBet = async (battleId, agentIndex, amount) => {
  const signer = await getSigner();
  const betting = getBettingContract(signer);
  
  const tx = await betting.placeBet(battleId, agentIndex, {
    value: ethers.utils.parseEther(amount.toString())
  });
  
  return await tx.wait();
};
