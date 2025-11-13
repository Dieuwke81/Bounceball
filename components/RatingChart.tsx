import React from 'react';

interface RatingChartProps {
  data: { date: string; rating: number }[];
}

const RatingChart: React.FC<RatingChartProps> = ({ data }) => {
  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-500">
        Niet genoeg data voor een grafiek.
      </div>
    );
  }

  const W = 500; // SVG viewBox Width
  const H = 150; // SVG viewBox Height
  const P = 25;  // Padding

  const ratings = data.map(d => d.rating);
  const minRating = Math.min(...ratings);
  const maxRating = Math.max(...ratings);
  const ratingRange = Math.max(0.2, (maxRating - minRating));
  const effectiveMin = minRating - ratingRange * 0.1;
  const effectiveMax = maxRating + ratingRange * 0.1;
  const effectiveRange = effectiveMax - effectiveMin;

  const getX = (index: number) => {
    return (index / (data.length - 1)) * (W - P * 2) + P;
  };

  const getY = (rating: number) => {
    return H - P - ((rating - effectiveMin) / effectiveRange) * (H - P * 2);
  };
  
  const linePath = data.map((point, i) => {
    const x = getX(i);
    const y = getY(point.rating);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const formatDate = (dateStr: string) => {
    // Check if it's an ISO string, which will contain 'T'
    if (dateStr.includes('T')) {
        return new Date(dateStr).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });
    }
    // Fallback for non-ISO strings, like 'Nu'
    return dateStr;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <line x1={P} y1={P} x2={W - P} y2={P} className="stroke-gray-600" strokeWidth="0.5" />
      <text x={P - 5} y={P} dominantBaseline="middle" textAnchor="end" className="fill-gray-400 text-xs">
        {maxRating.toFixed(1)}
      </text>
      
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} className="stroke-gray-600" strokeWidth="1" />
      <text x={P - 5} y={H - P} dominantBaseline="middle" textAnchor="end" className="fill-gray-400 text-xs">
        {minRating.toFixed(1)}
      </text>
      
      <path d={linePath} fill="none" className="stroke-cyan-400" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {data.map((point, i) => {
        const x = getX(i);
        const y = getY(point.rating);
        return (
          <circle key={i} cx={x} cy={y} r="3" className="fill-cyan-400 stroke-gray-700" strokeWidth="1.5">
            <title>{`${formatDate(point.date)}: Rating ${point.rating.toFixed(2)}`}</title>
          </circle>
        );
      })}

      <text x={P} y={H - P + 15} textAnchor="start" className="fill-gray-400 text-xs">
        {formatDate(data[0].date)}
      </text>
      <text x={W - P} y={H - P + 15} textAnchor="end" className="fill-gray-400 text-xs">
        {formatDate(data[data.length - 1].date)}
      </text>
    </svg>
  );
};

export default RatingChart;
