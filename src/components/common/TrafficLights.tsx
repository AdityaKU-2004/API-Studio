import React, { useState } from 'react';

interface TrafficLightsProps {
  className?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
}

export const TrafficLights: React.FC<TrafficLightsProps> = ({
  className = '',
  onClose,
  onMinimize,
  onMaximize,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`flex items-center gap-2 px-1 select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="group"
      aria-label="Window controls"
    >
      <button
        type="button"
        onClick={onClose}
        title="Close Window"
        className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] flex items-center justify-center transition-all hover:brightness-110 active:brightness-90 cursor-pointer group"
      >
        <span
          className={`text-[8px] text-[#4d0000] font-bold leading-none transition-opacity ${
            isHovered ? 'opacity-80' : 'opacity-0'
          }`}
        >
          ×
        </span>
      </button>

      <button
        type="button"
        onClick={onMinimize}
        title="Minimize"
        className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] flex items-center justify-center transition-all hover:brightness-110 active:brightness-90 cursor-pointer group"
      >
        <span
          className={`text-[8px] text-[#5e3c00] font-bold leading-none transition-opacity ${
            isHovered ? 'opacity-80' : 'opacity-0'
          }`}
        >
          –
        </span>
      </button>

      <button
        type="button"
        onClick={onMaximize}
        title="Zoom / Fullscreen"
        className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] flex items-center justify-center transition-all hover:brightness-110 active:brightness-90 cursor-pointer group"
      >
        <span
          className={`text-[7px] text-[#004d00] font-bold leading-none transition-opacity ${
            isHovered ? 'opacity-80' : 'opacity-0'
          }`}
        >
          +
        </span>
      </button>
    </div>
  );
};
