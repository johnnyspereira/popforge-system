# POPForge System

Projeto independente de e-commerce e operação de impressão 3D da POPForge.

## Estado atual

- Montra pública responsiva com catálogo e carrinho demonstrativo
- Dashboard inicial em `/dashboard`
- Modelo inicial de dados em `database/schema.sql`
- Metadados preparados para `https://popforge.jpmassagem.pt`
- Sem dados, segredos ou dependências operacionais da JP Massagem

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` e `http://localhost:3000/dashboard`.

## Publicação no cPanel

Cada push para `main` valida e gera a branch `cpanel-runtime`. No cPanel, ligue
essa branch ao subdomínio `popforge.jpmassagem.pt`; o conteúdo é estático e não
partilha processos, diretórios ou configuração com a JP Massagem.

## Próximas integrações

1. Supabase/PostgreSQL e autenticação
2. Catálogo administrativo real
3. Stripe Checkout e webhooks
4. Encomendas e portal do cliente
5. Produção 3D, inventário e notificações WhatsApp
6. Configuração DNS/deploy de `popforge.jpmassagem.pt`

Consulte `docs/ROADMAP.md` para a arquitetura e as fases.
