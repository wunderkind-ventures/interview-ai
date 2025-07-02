import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'InterviewAI | Product Review Presentation',
  description: 'InterviewAI: Democratizing Elite Interview Coaching - Product Review Presentation',
};

export default function PresentationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}