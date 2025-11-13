
import React from 'react';

const FutbolIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 0 1 8.66 5H3.34A10 10 0 0 1 12 2z" />
    <path d="M12 22a10 10 0 0 0 8.66-5H3.34A10 10 0 0 0 12 22z" />
    <path d="M7 2.5 12 7l5-4.5" />
    <path d="m7 21.5 5-4.5 5 4.5" />
    <path d="m2.68 12 4.5-5 4.5 5-4.5 5z" />
    <path d="m21.32 12-4.5-5-4.5 5 4.5 5z" />
  </svg>
);

export default FutbolIcon;