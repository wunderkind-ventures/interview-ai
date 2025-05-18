export default function Footer() {
  return (
    <footer className="bg-card border-t border-border py-6 text-center text-muted-foreground">
      <div className="container mx-auto px-4">
        <p>&copy; {new Date().getFullYear()} InterviewAI. All rights reserved.</p>
        <p className="text-sm mt-1">Prepare Smarter, Interview Better.</p>
      </div>
    </footer>
  );
}
