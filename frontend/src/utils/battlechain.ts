import {
  BrowserProvider,
  Contract,
  ContractRunner,
  InterfaceAbi,
  JsonRpcSigner,
  parseEther,
} from 'ethers';
import ArenaAbi from '../abis/Arena.json';
import BattleAbi from '../abis/Battle.json';
import SpectatorBettingAbi from '../abis/SpectatorBetting.json';
import type { ChallengeType } from '../types/contracts';

const ARENA_ADDRESS = import.meta.env.VITE_ARENA_ADDRESS;
const BETTING_ADDRESS = import.meta.env.VITE_BETTING_ADDRESS;
const ARENA_ABI = ArenaAbi.abi as InterfaceAbi;
const BATTLE_ABI = BattleAbi.abi as InterfaceAbi;
const BETTING_ABI = SpectatorBettingAbi.abi as InterfaceAbi;

export const getProvider = (): BrowserProvider | null =>
  window.ethereum ? new BrowserProvider(window.ethereum) : null;

export const getSigner = async (): Promise<JsonRpcSigner | null> => {
  const provider = getProvider();
  if (!provider) return null;
  await provider.send('eth_requestAccounts', []);
  return provider.getSigner();
};

export const getArenaContract = (runner: ContractRunner) =>
  new Contract(ARENA_ADDRESS, ARENA_ABI, runner);

export const getBattleContract = (address: string, runner: ContractRunner) =>
  new Contract(address, BATTLE_ABI, runner);

export const getBettingContract = (runner: ContractRunner) =>
  new Contract(BETTING_ADDRESS, BETTING_ABI, runner);

export const createBattle = async (
  challengeType: ChallengeType,
  entryFeeEth: number,
  maxAgents: number,
  duration: number
) => {
  const signer = await getSigner();
  if (!signer) {
    throw new Error('Wallet not connected');
  }
  const arena = getArenaContract(signer);
  const entryFeeWei = parseEther(entryFeeEth.toString());

  const tx = await arena.createBattle(
    challengeType,
    entryFeeWei,
    maxAgents,
    duration,
    { value: entryFeeWei }
  );

  return tx.wait();
};

export const registerAgent = async (battleId: bigint, agentAddress: string) => {
  const signer = await getSigner();
  if (!signer) {
    throw new Error('Wallet not connected');
  }
  const arena = getArenaContract(signer);

  const tx = await arena.registerAgent(battleId, agentAddress);
  return tx.wait();
};

export const startBattle = async (battleId: bigint) => {
  const signer = await getSigner();
  if (!signer) {
    throw new Error('Wallet not connected');
  }
  const arena = getArenaContract(signer);

  const tx = await arena.startBattle(battleId);
  return tx.wait();
};

export const resolveBattle = async (battleId: bigint) => {
  const signer = await getSigner();
  if (!signer) {
    throw new Error('Wallet not connected');
  }
  const arena = getArenaContract(signer);

  const tx = await arena.resolveBattle(battleId);
  return tx.wait();
};

export const placeBet = async (
  battleId: bigint,
  agentIndex: bigint,
  amountEth: number
) => {
  const signer = await getSigner();
  if (!signer) {
    throw new Error('Wallet not connected');
  }
  const betting = getBettingContract(signer);

  const tx = await betting.placeBet(battleId, agentIndex, {
    value: parseEther(amountEth.toString()),
  });

  return tx.wait();
};
