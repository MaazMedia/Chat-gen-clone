import React from 'react';
import { AlertTriangle, RefreshCw, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ServerStatusProps {
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ServerStatus({ onRetry, isRetrying = false }: ServerStatusProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
            <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <CardTitle className="flex items-center gap-2 justify-center">
            <Server className="h-5 w-5" />
            ADK Server Not Available
          </CardTitle>
          <CardDescription>
            The ADK server is not running or cannot be reached.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>To start the ADK server:</strong></p>
            <ol className="list-decimal list-inside space-y-1 text-xs bg-muted p-3 rounded">
              <li>Open a terminal in the project root</li>
              <li>Run: <code className="bg-background px-1 rounded">cd adk-server</code></li>
              <li>Run: <code className="bg-background px-1 rounded">npm install</code></li>
              <li>Run: <code className="bg-background px-1 rounded">npm start</code></li>
            </ol>
            <p className="text-xs">
              The server should start on <code className="bg-background px-1 rounded">http://localhost:8080</code>
            </p>
          </div>
          
          {onRetry && (
            <Button 
              onClick={onRetry} 
              disabled={isRetrying}
              className="w-full"
              variant="outline"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Check Again
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}