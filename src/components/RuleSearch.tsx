import React from "react";

interface RuleSearchProps {
  query: string;
  onChange: (value: string) => void;
}

const RuleSearch: React.FC<RuleSearchProps> = ({ query, onChange }) => {
  return (
    <div className="mb-6">
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Zoeken in spelregels..."
        className="w-full px-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 
                   focus:ring-2 focus:ring-cyan-500 focus:outline-none"
      />
    </div>
  );
};

export default RuleSearch;
