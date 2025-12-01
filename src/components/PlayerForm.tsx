import React, { useState, useEffect, useRef } from 'react';
import type { Player, NewPlayer } from '../types';
import XIcon from './icons/XIcon';
import UsersIcon from './icons/UsersIcon';

interface PlayerFormProps {
  onSubmit: (player: Player | NewPlayer) => void;
  onCancel: () => void;
  initialData?: Player | null;
}

// 200px is groot genoeg voor een avatar, en klein genoeg voor Google Sheets limiet (50k tekens)
const MAX_IMAGE_SIZE = 200; 

const PlayerForm: React.FC<PlayerFormProps> = ({ onSubmit, onCancel, initialData }) => {
  const [name, setName] = useState('');
  const [rating, setRating] = useState('');
  const [isKeeper, setIsKeeper] = useState(false);
  const [isFixedMember, setIsFixedMember] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  // We hebben twee refs nodig: één voor bestand kiezen, één voor de camera
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setRating(initialData.rating.toString());
      setIsKeeper(initialData.isKeeper);
      setIsFixedMember(initialData.isFixedMember);
      setPhotoBase64(initialData.photoBase64);
    } else {
      setName('');
      setRating('');
      setIsKeeper(false);
      setIsFixedMember(false);
      setPhotoBase64(undefined);
    }
  }, [initialData]);

  const processImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let { width, height } = img;
        // Behoud aspect ratio, maar schaal terug naar MAX_IMAGE_SIZE
        if (width > height) {
          if (width > MAX_IMAGE_SIZE) {
            height *= MAX_IMAGE_SIZE / width;
            width = MAX_IMAGE_SIZE;
          }
        } else {
          if (height > MAX_IMAGE_SIZE) {
            width *= MAX_IMAGE_SIZE / height;
            height = MAX_IMAGE_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Comprimeer naar JPEG met 0.6 kwaliteit (veilig voor Google Sheets)
        setPhotoBase64(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImage(e.target.files[0]);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Naam is verplicht.');
    const ratingValue = parseFloat(rating);
    if (isNaN(ratingValue)) return setError('Rating moet een geldig getal zijn.');
    
    const playerData: NewPlayer | Player = {
        ...(initialData || {}),
        name,
        rating: ratingValue,
        isKeeper,
        isFixedMember,
        photoBase64,
    };
    onSubmit(playerData);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-6">
          {initialData ? 'Speler Bewerken' : 'Nieuwe Speler'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="playerName" className="block text-sm font-medium text-gray-300">Naam</label>
            <input type="text" id="playerName" value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
              required placeholder="Jan Jansen" />
          </div>
          <div>
            <label htmlFor="playerRating" className="block text-sm font-medium text-gray-300">Rating</label>
            <input type="number" id="playerRating" value={rating} onChange={(e) => setRating(e.target.value)}
              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
              step="0.1" required placeholder="7.5" />
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <input id="isKeeper" type="checkbox" checked={isKeeper} onChange={(e) => setIsKeeper(e.target.checked)}
                className="h-4 w-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500" />
              <label htmlFor="isKeeper" className="ml-2 block text-sm text-gray-300">Is keeper?</label>
            </div>
            <div className="flex items-center">
              <input id="isFixedMember" type="checkbox" checked={isFixedMember} onChange={(e) => setIsFixedMember(e.target.checked)}
                className="h-4 w-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500" />
              <label htmlFor="isFixedMember" className="ml-2 block text-sm text-gray-300">Vast lid?</label>
            </div>
          </div>
          
           <div>
            <label className="block text-sm font-medium text-gray-300">Profielfoto</label>
            <div className="mt-2 flex items-center space-x-4">
                {/* De avatar weergave */}
                <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-600 shrink-0">
                    {photoBase64 ? (
                        <img src={photoBase64} alt="Profielfoto" className="w-full h-full object-cover" /> 
                    ) : (
                        <UsersIcon className="w-10 h-10 text-gray-500"/>
                    )}
                </div>
                
                <div className="flex flex-col space-y-2 w-full">
                    {/* Verborgen inputs */}
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    
                    {/* Input speciaal voor mobiele camera (capture='user') */}
                    <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="user" className="hidden" />

                    {/* Knoppen die de inputs activeren */}
                    <div className="flex gap-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 text-sm bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-center">
                            📁 Upload
                        </button>
                        <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex-1 text-sm bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-center">
                            📷 Camera
                        </button>
                    </div>
                </div>
                
                {photoBase64 && (
                    <button type="button" onClick={() => setPhotoBase64(undefined)} className="self-start p-1 text-gray-400 hover:text-red-400">
                        <XIcon className="w-5 h-5"/>
                    </button>
                )}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-700">
            <button type="button" onClick={onCancel}
              className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">
              Annuleren
            </button>
            <button type="submit"
              className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 transform hover:scale-105">
              {initialData ? 'Opslaan' : 'Toevoegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlayerForm;
