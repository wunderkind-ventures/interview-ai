'use client';

import { useEffect, useRef } from 'react';

export default function PresentationPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Ensure the iframe takes up the full viewport
    const handleResize = () => {
      if (iframeRef.current) {
        iframeRef.current.style.height = `${window.innerHeight}px`;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-white">
      <iframe
        ref={iframeRef}
        src="/presentation/aipm-capstone.html"
        className="w-full h-full border-0"
        title="InterviewAI Product Review Presentation"
      />
    </div>
  );
}