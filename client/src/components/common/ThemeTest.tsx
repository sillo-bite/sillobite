import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeToggle, SimpleThemeToggle } from '@/components/common/ThemeToggle';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function ThemeTest() {
  const { theme, resolvedTheme } = useTheme();

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold mb-4">Theme Test Component</h2>
          <div className="space-y-2">
            <p><strong>Current Theme:</strong> {theme}</p>
            <p><strong>Resolved Theme:</strong> {resolvedTheme}</p>
            <p><strong>System Preference:</strong> {window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'}</p>
          </div>
          
          <div className="mt-4 space-x-2">
            <ThemeToggle />
            <SimpleThemeToggle />
          </div>
          
          <div className="mt-4 p-4 bg-background border border-border rounded">
            <p>This card should change colors based on the theme.</p>
            <p className="text-muted-foreground">This text should be muted in both themes.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
