'use client';

import { useState } from 'react';
import { Database, Loader2, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function InstallPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      setStatus('Preparando a base de dados vazia…');
      const migration = await fetch('/api/install/migrate', { method: 'POST' });
      const migrationResult = (await migration.json()) as { error?: string };
      if (!migration.ok) throw new Error(migrationResult.error || 'Não foi possível preparar a base de dados.');
      setStatus('Criando a conta proprietária POPForge…');
      const response = await fetch('/api/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: data.get('fullName'), accountName: data.get('accountName'), email: data.get('email'),
          password: data.get('password'), confirmPassword: data.get('confirmPassword'),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a instalação.');
      window.location.href = '/dashboard';
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : 'Falha na instalação.');
      setStatus('');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <Card className="w-full max-w-lg border-cyan-400/20 bg-slate-900 text-white shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950"><Store className="size-7" /></div>
          <CardTitle className="text-2xl">Instalar POPForge</CardTitle>
          <CardDescription className="text-slate-300">Cria uma base nova e independente. Nenhum dado da JP Massagem será importado.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="accountName">Nome da loja</Label><Input id="accountName" name="accountName" defaultValue="POPForge" required /></div>
            <div className="space-y-2"><Label htmlFor="fullName">Nome do proprietário</Label><Input id="fullName" name="fullName" required /></div>
            <div className="space-y-2"><Label htmlFor="email">E-mail de acesso</Label><Input id="email" name="email" type="email" required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" minLength={8} required /></div>
              <div className="space-y-2"><Label htmlFor="confirmPassword">Confirmar senha</Label><Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required /></div>
            </div>
            {error && <p className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
            {status && <p className="flex items-center gap-2 text-sm text-cyan-200"><Database className="size-4" />{status}</p>}
            <Button type="submit" disabled={loading} className="h-11 w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200">{loading && <Loader2 className="mr-2 size-4 animate-spin" />} Criar instalação independente</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
