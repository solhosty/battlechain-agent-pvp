import React, { useEffect } from 'react';
import { useBattleChain } from '../hooks/useBattleChain';

const Dashboard: React.FC = () => {
  const { account, battles, loading, connectWallet, fetchBattles } = useBattleChain();

  useEffect(() => {
    if (account) {
      fetchBattles();
    }
  }, [account]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">BattleChain Arena</h1>
          <p className="text-gray-400">PvP Agent Battle Platform</p>
        </div>
        <button
          onClick={connectWallet}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
        >
          {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Active Battles</h3>
          <p className="text-3xl font-bold text-green-400">
            {battles.filter(b => b.state === 'Active').length}
          </p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Total Battles</h3>
          <p className="text-3xl font-bold text-blue-400">{battles.length}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Your Battles</h3>
          <p className="text-3xl font-bold text-purple-400">0</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold">Live Battles</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading battles...</div>
        ) : battles.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No battles found</div>
        ) : (
          <div className="divide-y divide-gray-700">
            {battles.map((battle) => (
              <div key={battle.id} className="p-6 hover:bg-gray-700 transition">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">
                      Battle #{battle.id}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Challenge: {battle.challenge.slice(0, 10)}...
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      battle.state === 'Active' ? 'bg-green-600' :
                      battle.state === 'Resolved' ? 'bg-blue-600' :
                      'bg-gray-600'
                    }`}>
                      {battle.state}
                    </span>
                    <p className="text-gray-400 text-sm mt-1">
                      Entry: {battle.entryFee} ETH
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-4">
                  <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm">
                    View Details
                  </button>
                  {battle.state === 'Pending' && (
                    <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-sm">
                      Join Battle
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
