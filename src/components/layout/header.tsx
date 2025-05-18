import Link from 'next/link';
import { BotMessageSquare } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-primary">
          <BotMessageSquare className="h-8 w-8" />
          <span>InterviewAI</span>
        </Link>
        {/* Navigation links can be added here if needed in the future */}
      </div>
    </header>
  );
}
