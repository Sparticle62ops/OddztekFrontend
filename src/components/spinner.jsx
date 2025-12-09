import React, { useState, useEffect } from 'react';

const Spinner = ({ text = "Processing" }) => {
  const frames = ['/', '-', '\\', '|'];
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, 100); // Speed of rotation
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="spinner">
      [{frames[frameIndex]}] {text}...
    </span>
  );
};

export default Spinner;
