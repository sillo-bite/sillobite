import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, RefreshCw, Link2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/contexts/ThemeContext';

export default function ConnectionCodeCard() {
  const [cd, setCd] = useState<string | null>(null);
  const [exp, setExp] = useState<string | null>(null);
  const [ld, setLd] = useState(false);
  const [cp, setCp] = useState(false);
  const [tick, setTick] = useState(0);
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!exp || !cd) return;

    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [exp, cd]);

  const genCode = async () => {
    setLd(true);
    try {
      const res = await fetch('/api/auth/generate-code', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to generate code');
      }

      const data = await res.json();
      setCd(data.code);
      setExp(data.expires_at);
      setCp(false);

      toast({
        title: 'Code Generated',
        description: 'Share this code with CareBite to connect',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to generate connection code',
        variant: 'destructive',
      });
    } finally {
      setLd(false);
    }
  };

  const copyCode = () => {
    if (cd) {
      navigator.clipboard.writeText(cd);
      setCp(true);
      toast({
        title: 'Copied!',
        description: 'Connection code copied to clipboard',
      });
      setTimeout(() => setCp(false), 2000);
    }
  };

  const getRemainingTime = () => {
    if (!exp) return null;
    const now = new Date().getTime();
    const expTime = new Date(exp).getTime();
    const diff = expTime - now;
    if (diff <= 0) return 'Expired';
    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}:${remSecs.toString().padStart(2, '0')}`;
  };

  const isExpired = exp && new Date(exp).getTime() <= new Date().getTime();

  return (
    <Card
      className={`${
        resolvedTheme === 'dark'
          ? 'bg-card border border-gray-800 shadow-sm'
          : 'bg-white border border-gray-200 shadow-sm'
      }`}
    >
      <CardContent className="p-6">
        <div className="flex items-center mb-4">
          <Link2 className="w-5 h-5 text-purple-600 mr-3" />
          <div>
            <h3 className="font-semibold text-foreground">Connect to CareBite</h3>
            <p className="text-sm text-muted-foreground">
              Generate a code to link your account
            </p>
          </div>
        </div>

        {cd && !isExpired ? (
          <div className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-950/20 border-2 border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  Connection Code
                </span>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 mr-1" />
                  {getRemainingTime()}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400 tracking-wider">
                  {cd}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyCode}
                  className="hover:bg-purple-100 dark:hover:bg-purple-900/30"
                >
                  {cp ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <Copy className="w-5 h-5 text-purple-600" />
                  )}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Enter this code in CareBite app to connect your account
            </p>

            <Button
              variant="outline"
              className="w-full"
              onClick={genCode}
              disabled={ld}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${ld ? 'animate-spin' : ''}`} />
              Generate New Code
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {isExpired && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Code expired. Generate a new one.
                </p>
              </div>
            )}

            <Button
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              onClick={genCode}
              disabled={ld}
            >
              {ld ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Generate Connection Code
                </>
              )}
            </Button>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                <strong>How it works:</strong> Generate a code here, then enter it in
                the CareBite app to securely link your SilloBite account. Code expires
                in 2 minutes.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
