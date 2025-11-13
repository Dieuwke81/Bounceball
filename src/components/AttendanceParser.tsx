
import React, { useState } from 'react';

interface AttendanceParserProps {
  onParse: (text: string) => void;
}

const AttendanceParser: React.FC<AttendanceParserProps> = ({ onParse }) => {
  const [listText, setListText] = useState('');

  const handleParseClick = () => {
    onParse(listText);
    setListText(''); // Clear after parsing
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-4">Plak Aanwezigheidslijst</h2>
      <p className="text-gray-400 mb-4">
        Kopieer de lijst uit je whatsappgroep en plak hem hier. De app filtert automatisch de namen eruit.
      </p>
      <textarea
        value={listText}
        onChange={(e) => setListText(e.target.value)}
        className="w-full h-40 bg-gray-700 border border-gray-600 rounded-md shadow-sm p-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 mb-4 resize-y"
        placeholder={` 29 oktober 20:30

1. Bram
2. Hein
3. Gijs
4. Dieuwke
5. Roel
...`}
        aria-label="Aanwezigheidslijst invoerveld"
      />
      <button
        onClick={handleParseClick}
        disabled={!listText.trim()}
        className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:ring-opacity-50"
      >
        Verwerk Lijst
      </button>
    </div>
  );
};

export default AttendanceParser;