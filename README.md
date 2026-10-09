# POPForge Commerce

Plataforma independente para a loja POPForge, construída sobre a base técnica do CRM e adaptada para comércio eletrónico e produção 3D.

## Módulos

- CRM de clientes, conversas, WhatsApp, tarefas e automações
- Loja e produção em `/commerce`
- Calculadora de preços 3D em `/commerce/calculadora`
- Catálogo, variantes, stock, encomendas e fila de produção no esquema MySQL
- Financeiro, campanhas, portal do cliente, relatórios e gestor do site público

## Desenvolvimento

```bash
npm ci
npm run dev
```

Copie `.env.example` para `.env.local`, configure uma base MySQL exclusiva da POPForge e execute:

```bash
npm run db:migrate:mysql
npm run typecheck
npm run lint
npm run build:cpanel
```

## Publicação no cPanel

O GitHub Actions gera a branch `cpanel-runtime` com o runtime standalone. No cPanel, a aplicação Node deve usar:

- repositório: `/home/jpmassag/repositories/popforge-system`
- URL: `https://popforge.jpmassagem.pt`
- ficheiro de arranque: `server.js`
- versão Node: 22 ou superior

O projeto não utiliza a base de dados nem os diretórios da JP Massagem. Credenciais e dados operacionais devem ser próprios da POPForge.
