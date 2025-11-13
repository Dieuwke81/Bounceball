
import React from 'react';

const Header: React.FC = () => {
  const getCurrentCompetition = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth(); // 0 = Januari, 5 = Juni
    const season = month < 6 ? 1 : 2; // Jan-Juni = 1, Juli-Dec = 2
    return `Competitie ${year}/${season}`;
  };

  return (
    <header className="text-center p-4 md:p-6">
      <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
        Bounceball
      </h1>
      <p className="mt-2 text-lg text-gray-400">
        {getCurrentCompetition()}
      </p>
    </header>
  );
};

export default Header;