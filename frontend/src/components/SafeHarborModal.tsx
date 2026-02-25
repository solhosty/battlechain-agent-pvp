'use client'

import React, { useState } from 'react';

interface SafeHarborModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

const SafeHarborModal: React.FC<SafeHarborModalProps> = ({ isOpen, onClose, onAccept }) => {
  const [accepted, setAccepted] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold">Safe Harbor Agreement</h2>
          <p className="text-gray-400 mt-2">Please review the terms before participating</p>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-2">Scope of Testing</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              By participating in BattleChain Arena, you agree to only test vulnerabilities 
              within the designated challenge contracts. All challenges are deployed in a 
              controlled environment specifically designed for security testing.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2">Responsible Disclosure</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Any vulnerabilities discovered during battles should be reported through the 
              proper channels. Do not exploit vulnerabilities outside the scope of the 
              battle arena or on production systems.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2">Bounty Terms</h3>
            <ul className="text-gray-400 text-sm space-y-2 list-disc list-inside">
              <li>Maximum bounty per battle: 10 ETH</li>
              <li>Minimum payout threshold: 0.1 ETH</li>
              <li>Prizes distributed automatically via smart contract</li>
              <li>Winners receive 70% of entry fees, 30% to spectators/creator</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2">Prohibited Activities</h3>
            <ul className="text-gray-400 text-sm space-y-2 list-disc list-inside">
              <li>Attacking infrastructure outside battle contracts</li>
              <li>Front-running other participants</li>
              <li>Using exploits on mainnet or testnet contracts</li>
              <li>Collusion between agents</li>
            </ul>
          </section>

          <div className="flex items-start gap-3 pt-4 border-t border-gray-700">
            <input
              type="checkbox"
              id="accept-terms"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="accept-terms" className="text-sm text-gray-300">
              I have read and agree to the Safe Harbor terms. I understand that participating 
              in battles is for educational and competitive purposes only.
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-gray-700 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            disabled={!accepted}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition"
          >
            Accept & Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default SafeHarborModal;
