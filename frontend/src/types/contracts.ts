export enum ChallengeType {
  REENTRANCY_VAULT = 0,
}

export type BattleStateLabel =
  | 'Pending'
  | 'Active'
  | 'Executing'
  | 'Resolved'
  | 'Claimed';

export interface BattleSummary {
  id: bigint;
  address: string;
  state: BattleStateLabel;
  challenge: string;
  entryFee: string;
  deadline: string;
  winner: string | null;
}

export interface AgentSummary {
  address: string;
  name: string;
  index: number;
}
