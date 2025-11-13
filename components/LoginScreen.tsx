
import React, { useState } from 'react';
import LockIcon from './icons/LockIcon';

interface LoginScreenProps {
  onLogin: (password: string) => boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!onLogin(password)) {
      setError('Ongeldig wachtwoord.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-xl shadow-lg max-w-sm mx-auto">
      <LockIcon className="w-12 h-12 text-cyan-400 mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">Beveiligde Toegang</h2>
      <p className="text-gray-400 mb-6 text-center">Voer het beheerderswachtwoord in om verder te gaan.</p>
      <form onSubmit={handleSubmit} className="w-full">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-center focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="Wachtwoord"
          aria-label="Wachtwoord"
        />
        {error && <p className="text-red-400 text-sm text-center mt-3">{error}</p>}
        <button
          type="submit"
          className="w-full mt-4 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
        >
          Inloggen
        </button>
      </form>
    </div>
  );
};

export default LoginScreen;